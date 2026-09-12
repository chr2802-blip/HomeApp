import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import {
  adminDatabaseUrl,
  deriveTestDatabaseUrl,
  testDatabaseName,
} from "../../scripts/test-db-url.mjs";

/**
 * Runs once before the integration suite: makes sure the throwaway test database
 * exists and carries the current migrations.
 */
export default async function setup() {
  const url = deriveTestDatabaseUrl();
  const name = testDatabaseName(url);

  if (!(await databaseExists(url))) {
    await createDatabase(url, name);
  }

  // Invoke the CLI's entry point with node directly: spawning the npx shim needs a
  // shell, which Node refuses for .cmd files on Windows.
  const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}

async function databaseExists(url: string) {
  const client = new PrismaClient({ datasourceUrl: url });
  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await client.$disconnect();
  }
}

async function createDatabase(url: string, name: string) {
  const client = new PrismaClient({ datasourceUrl: adminDatabaseUrl(url) });
  try {
    // The name is derived from our own DATABASE_URL and validated to end with
    // "_test", but quote it anyway so it can never be read as SQL.
    await client.$executeRawUnsafe(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
  } finally {
    await client.$disconnect();
  }
}
