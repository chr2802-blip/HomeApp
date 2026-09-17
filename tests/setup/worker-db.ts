import { PrismaClient } from "@prisma/client";
import {
  adminDatabaseUrl,
  deriveTestDatabaseUrl,
  testDatabaseName,
  workerDatabaseUrl,
} from "../../scripts/test-db-url.mjs";

/**
 * Gives this worker a database of its own, copied from the migrated template, before
 * anything opens a connection.
 *
 * It is keyed by process id rather than by any number vitest hands out. `VITEST_POOL_ID`
 * looks like the right thing and is not: two workers running at the same time are
 * sometimes given the same one — which puts two files on one database, where they
 * truncate each other's tables mid-test and deadlock trying. A process id cannot be
 * shared by two processes that exist at once, which is exactly the property needed.
 *
 * Copying is about a tenth of a second, against nearly two for running the migrations,
 * and it cannot produce a database the migrations have not been applied to.
 *
 * This is a setup file of its own, listed first, because `new PrismaClient()` reads
 * DATABASE_URL as it is constructed — which happens the moment `@/lib/prisma` is
 * imported. Doing it at the top of the other setup file would not be early enough:
 * that file's own imports are hoisted above its statements.
 */
const template = deriveTestDatabaseUrl();
const url = workerDatabaseUrl(template, process.pid);

const admin = new PrismaClient({ datasourceUrl: adminDatabaseUrl(template) });
try {
  const name = quoted(testDatabaseName(url));
  // FORCE, and a drop first, so a database left by a run that was killed cannot be
  // inherited with its rows still in it.
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.$executeRawUnsafe(
    `CREATE DATABASE "${name}" TEMPLATE "${quoted(testDatabaseName(template))}"`,
  );
} finally {
  await admin.$disconnect();
}

process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;

function quoted(name: string) {
  return name.replace(/"/g, '""');
}
