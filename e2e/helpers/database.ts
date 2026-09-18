import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  adminDatabaseUrl,
  deriveE2eDatabaseUrl,
  e2eDatabaseName,
} from "../../scripts/test-db-url.mjs";
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

  if (!(await canConnect(template))) {
    await onAdmin(template, `CREATE DATABASE "${quoted(name)}"`);
  }

  // Resolved by path rather than createRequire: Playwright compiles this file to
  // CommonJS, where import.meta does not exist.
  const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: template, DIRECT_URL: template },
  });

  // Everything a previous run made, not just the ones about to be remade: a run with
  // fewer workers than the last would otherwise leave the surplus lying about for ever.
  await dropWorkerDatabases(template, name);

  for (let worker = 0; worker < e2eWorkerCount(); worker += 1) {
    const copy = e2eDatabaseName(serverDatabaseUrl(worker));

    // Copied fresh rather than reused, so one can never be a migration behind the
    // template. Both names carry the "_e2e" suffix every entry point here checks for,
    // and are quoted anyway so neither can read as SQL.
    await onAdmin(template, `CREATE DATABASE "${quoted(copy)}" TEMPLATE "${quoted(name)}"`);
  }
}

/** Drops every copy taken from the template, whoever made it. */
async function dropWorkerDatabases(url: string, template: string) {
  const admin = new PrismaClient({ datasourceUrl: adminDatabaseUrl(url) });
  try {
    const rows = await admin.$queryRaw<{ datname: string }[]>`
      SELECT datname FROM pg_database WHERE datname LIKE ${`${template.replace(/_e2e$/, "")}_w%_e2e`}
    `;

    for (const { datname } of rows) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${quoted(datname)}" WITH (FORCE)`);
    }
  } finally {
    await admin.$disconnect();
  }
}

const quoted = (name: string) => name.replace(/"/g, '""');

async function onAdmin(url: string, statement: string) {
  const admin = new PrismaClient({ datasourceUrl: adminDatabaseUrl(url) });
  try {
    await admin.$executeRawUnsafe(statement);
  } finally {
    await admin.$disconnect();
  }
}

async function canConnect(url: string) {
  const probe = new PrismaClient({ datasourceUrl: url });
  try {
    await probe.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await probe.$disconnect();
  }
}

async function truncate() {
  const db = prisma();
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const list = rows.map((row) => `"public"."${row.tablename}"`).join(", ");
  if (list) await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/**
 * Wipes the database and rebuilds the fixed cast: two homes, a super admin with no home
 * of their own, an admin plus a member in the first home, and that home's recipe
 * categories. Every spec starts here.
 */
export async function resetAndSeed() {
  const db = prisma();
  await truncate();

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
