import {
  deriveTestDatabaseUrl,
  testDatabaseName,
  workerDatabaseUrl,
} from "../../scripts/test-db-url.mjs";
import { copyTemplate } from "../../scripts/test-db.mjs";

/**
 * Gives this worker a database of its own, copied from the migrated template, before
 * anything opens a connection.
 *
 * It is keyed by process id rather than by any number vitest hands out. `VITEST_POOL_ID`
 * looks like the right thing and is not: two workers running at the same time are
 * sometimes given the same one — which puts two files on one database, where they
 * truncate each other's tables mid-test and deadlock trying. A process id cannot be
 * shared by two processes that exist at once, which is exactly the property needed —
 * and it holds only while a worker *is* a process, which is why the integration project
 * names its pool rather than inheriting the default.
 *
 * This is a setup file of its own, listed first, because `new PrismaClient()` reads
 * DATABASE_URL as it is constructed — which happens the moment `@/lib/prisma` is
 * imported. Doing it at the top of the other setup file would not be early enough:
 * that file's own imports are hoisted above its statements.
 */
const template = deriveTestDatabaseUrl();
const url = workerDatabaseUrl(template, process.pid);

await copyTemplate(template, {
  from: testDatabaseName(template),
  to: testDatabaseName(url),
});

process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
