import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import {
  adminDatabaseUrl,
  deriveTestDatabaseUrl,
  testDatabaseName,
} from "../../scripts/test-db-url.mjs";

/**
 * Runs once before the integration suite: makes sure the template database exists and
 * carries the current migrations, and clears away any worker databases a previous run
 * left behind.
 *
 * Nothing runs against the template itself. Each worker copies it — see
 * tests/setup/worker-db.ts — so the files can run at the same time without truncating
 * each other's tables.
 */
export default async function setup() {
  const url = deriveTestDatabaseUrl();
  const name = testDatabaseName(url);

  if (!(await databaseExists(url))) {
    await onAdmin(url, `CREATE DATABASE "${quoted(name)}"`);
  }

  // Invoke the CLI's entry point with node directly: spawning the npx shim needs a
  // shell, which Node refuses for .cmd files on Windows.
  const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });

  await dropWorkerDatabases(url, name);

  // A run that is killed never gets here, which is why the sweep above exists too.
  return () => dropWorkerDatabases(url, name);
}

/**
 * Drops every database this suite's workers made. They are named after the template
 * with a process id in the middle, and the pattern is anchored to the same "_test"
 * suffix everything else here checks for, so nothing outside the suite can match it.
 */
async function dropWorkerDatabases(url: string, template: string) {
  const admin = new PrismaClient({ datasourceUrl: adminDatabaseUrl(url) });
  try {
    const rows = await admin.$queryRaw<{ datname: string }[]>`
      SELECT datname FROM pg_database WHERE datname LIKE ${`${template.replace(/_test$/, "")}_w%_test`}
    `;

    for (const { datname } of rows) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${quoted(datname)}" WITH (FORCE)`);
    }
  } finally {
    await admin.$disconnect();
  }
}

function quoted(name: string) {
  return name.replace(/"/g, '""');
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

async function onAdmin(url: string, statement: string) {
  const client = new PrismaClient({ datasourceUrl: adminDatabaseUrl(url) });
  try {
    await client.$executeRawUnsafe(statement);
  } finally {
    await client.$disconnect();
  }
}
