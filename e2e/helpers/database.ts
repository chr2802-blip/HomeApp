import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { deriveE2eDatabaseUrl, e2eDatabaseName } from "../../scripts/test-db-url.mjs";
import { copyTemplate, dropCopies, prepareTemplate, truncateAll } from "../../scripts/test-db.mjs";
import { e2eWorkerCount, serverDatabaseUrl } from "./servers";

/**
 * This worker's database — the same one its app server was started against. Playwright
 * numbers its workers in the environment; outside a worker (the global setup) there is
 * no number and this is the first database, which is the one that gets migrated.
 */
export const E2E_DATABASE_URL = serverDatabaseUrl(Number(process.env.TEST_PARALLEL_INDEX ?? 0));

// Guard, as in the vitest suite: this module truncates tables, so it refuses to load
// unless it is pointed at a database whose name marks it as throwaway.
e2eDatabaseName(E2E_DATABASE_URL);

export const ACCOUNTS = {
  superAdmin: { email: "super@e2e.test", name: "Super Admin", password: "e2e-password-1" },
  admin: { email: "admin@e2e.test", name: "Ada Admin", password: "e2e-password-2" },
  member: { email: "member@e2e.test", name: "Mo Member", password: "e2e-password-3" },
  outsider: { email: "outsider@e2e.test", name: "Otto Outsider", password: "e2e-password-4" },
} as const;

export const HOME_NAME = "E2E House";
export const OTHER_HOME_NAME = "Neighbour House";

/**
 * Categories the first home starts with. A recipe cannot be saved without one, so the
 * seed provides them the way a real home's admin would have done before anyone cooked.
 */
export const CATEGORIES = ["Baking", "Weeknight"] as const;

// The cast is rebuilt before every spec, and bcrypt at the app's cost takes about a
// tenth of a second per account — four of them, on every test. The passwords are fixed,
// so each is hashed once per worker and reused; the hash is a real one, so logging in
// still goes through the same check a person's would.
const hashes = new Map<string, Promise<string>>();

function passwordHash(password: string) {
  let hash = hashes.get(password);
  if (!hash) {
    hash = bcrypt.hash(password, 10);
    hashes.set(password, hash);
  }
  return hash;
}

let client: PrismaClient | null = null;

export function prisma() {
  client ??= new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  return client;
}

export async function disconnect() {
  await client?.$disconnect();
  client = null;
}

/**
 * Prepares a database per worker, before any server is asked for a page.
 *
 * Only the template is migrated; each worker's is copied from it, which Postgres does in
 * a fraction of the time it takes to spawn the migration CLI again and which cannot
 * leave them disagreeing. Nothing ever runs against the template itself.
 */
export async function prepareDatabase() {
  const template = deriveE2eDatabaseUrl();
  const name = e2eDatabaseName(template);

  await prepareTemplate(template, name);

  // Everything a previous run made, not just the ones about to be remade: a run with
  // fewer workers than the last would otherwise leave the surplus lying about for ever.
  // Nothing is spared here the way the vitest sweep spares a live worker — a browser
  // worker's database is keyed by its slot rather than by anything an operating system
  // can be asked about, so two runs at once would collide over the ports first.
  await dropCopies(template, name);

  for (let worker = 0; worker < e2eWorkerCount(); worker += 1) {
    // Copied fresh rather than reused, so one can never be a migration behind the
    // template. Both names carry the "_e2e" suffix every entry point here checks for.
    await copyTemplate(template, {
      from: name,
      to: e2eDatabaseName(serverDatabaseUrl(worker)),
    });
  }
}

/**
 * Wipes the database and rebuilds the fixed cast: two homes, a super admin with no home
 * of their own, an admin plus a member in the first home, and that home's recipe
 * categories. Every spec starts here.
 */
export async function resetAndSeed() {
  const db = prisma();
  await truncateAll(db);

  const home = await db.home.create({ data: { name: HOME_NAME, address: "1 Test Street" } });
  const otherHome = await db.home.create({ data: { name: OTHER_HOME_NAME } });

  await db.recipeCategory.createMany({
    data: CATEGORIES.map((name) => ({ homeId: home.id, name })),
  });

  // A home is joined rather than pointed at: the membership says somebody is in it, and
  // the active home only says which of theirs they are reading.
  const account = async (
    who: (typeof ACCOUNTS)[keyof typeof ACCOUNTS],
    membership: { homeId: string; role: "ADMIN" | "USER" } | null,
    superAdmin = false,
  ) =>
    db.user.create({
      data: {
        email: who.email,
        name: who.name,
        passwordHash: await passwordHash(who.password),
        role: superAdmin ? "SUPER_ADMIN" : "USER",
        activeHomeId: membership?.homeId ?? null,
        ...(membership ? { memberships: { create: { homeId: membership.homeId, role: membership.role } } } : {}),
      },
    });

  await account(ACCOUNTS.superAdmin, null, true);
  await account(ACCOUNTS.admin, { homeId: home.id, role: "ADMIN" });
  await account(ACCOUNTS.member, { homeId: home.id, role: "USER" });
  await account(ACCOUNTS.outsider, { homeId: otherHome.id, role: "ADMIN" });

  return { home, otherHome };
}
