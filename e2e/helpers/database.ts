import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  adminDatabaseUrl,
  deriveE2eDatabaseUrl,
  e2eDatabaseName,
} from "../../scripts/test-db-url.mjs";

export const E2E_DATABASE_URL = deriveE2eDatabaseUrl();

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

let client: PrismaClient | null = null;

export function prisma() {
  client ??= new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  return client;
}

export async function disconnect() {
  await client?.$disconnect();
  client = null;
}

/** Creates the database if it is missing, then applies migrations. */
export async function prepareDatabase() {
  const name = e2eDatabaseName(E2E_DATABASE_URL);

  if (!(await canConnect(E2E_DATABASE_URL))) {
    const admin = new PrismaClient({ datasourceUrl: adminDatabaseUrl(E2E_DATABASE_URL) });
    try {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
    } finally {
      await admin.$disconnect();
    }
  }

  // Resolved by path rather than createRequire: Playwright compiles this file to
  // CommonJS, where import.meta does not exist.
  const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL, DIRECT_URL: E2E_DATABASE_URL },
  });
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
 * of their own, and an admin plus a member in the first home. Every spec starts here.
 */
export async function resetAndSeed() {
  const db = prisma();
  await truncate();

  const hash = async (password: string) => bcrypt.hash(password, 10);

  const home = await db.home.create({ data: { name: HOME_NAME, address: "1 Test Street" } });
  const otherHome = await db.home.create({ data: { name: OTHER_HOME_NAME } });

  await db.user.create({
    data: {
      email: ACCOUNTS.superAdmin.email,
      name: ACCOUNTS.superAdmin.name,
      passwordHash: await hash(ACCOUNTS.superAdmin.password),
      role: "SUPER_ADMIN",
      homeId: null,
    },
  });

  await db.user.create({
    data: {
      email: ACCOUNTS.admin.email,
      name: ACCOUNTS.admin.name,
      passwordHash: await hash(ACCOUNTS.admin.password),
      role: "ADMIN",
      homeId: home.id,
    },
  });

  await db.user.create({
    data: {
      email: ACCOUNTS.member.email,
      name: ACCOUNTS.member.name,
      passwordHash: await hash(ACCOUNTS.member.password),
      role: "USER",
      homeId: home.id,
    },
  });

  await db.user.create({
    data: {
      email: ACCOUNTS.outsider.email,
      name: ACCOUNTS.outsider.name,
      passwordHash: await hash(ACCOUNTS.outsider.password),
      role: "ADMIN",
      homeId: otherHome.id,
    },
  });

  return { home, otherHome };
}
