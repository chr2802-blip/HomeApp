/**
 * The Postgres housekeeping both test suites do before they can run: make the template,
 * bring it up to date with the migrations, copy it once per worker, and sweep the copies
 * away again.
 *
 * It is one module rather than one per suite because the two were the same code twice,
 * differing only in which suffix they looked for — and the pair that has to agree is not
 * within a suite but across them: `workerDatabaseUrl` writes a copy's name and the sweep
 * here has to recognise it again, including the copies a killed run left behind. Written
 * out twice, that agreement was four places instead of two.
 *
 * Nothing here decides *which* database; the caller derives that through
 * `scripts/test-db-url.mjs`, which is also where the suffix guard lives. Every name
 * reaching a statement below has been through it.
 *
 * Plain JavaScript, and no `import.meta`: vitest loads this as ESM, while Playwright
 * compiles the file that imports it to CommonJS.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { adminDatabaseUrl, workerDatabasePattern } from "./test-db-url.mjs";

/** Doubles any quote in a name, so it cannot end the identifier it sits inside. */
const quoted = (name) => name.replace(/"/g, '""');

/**
 * Runs statements against the server's own "postgres" database, on one connection.
 *
 * `CREATE DATABASE` cannot run inside a transaction, so these are separate statements
 * rather than a batch — but they are one connection, which is what matters when every
 * worker opens one on its way in.
 */
async function onAdmin(url, ...statements) {
  const admin = new PrismaClient({ datasourceUrl: adminDatabaseUrl(url) });
  try {
    for (const statement of statements) await admin.$executeRawUnsafe(statement);
  } finally {
    await admin.$disconnect();
  }
}

async function canConnect(url) {
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

/**
 * Makes the template if it is not there and applies the migrations to it.
 *
 * The CLI's entry point is invoked with node directly: spawning the npx shim needs a
 * shell, which Node refuses for .cmd files on Windows. It is resolved through Node's own
 * resolution rather than a hand-built path so a hoisted install still finds it, and from
 * the project root rather than from `import.meta.url`, which does not survive
 * Playwright's compile to CommonJS.
 */
export async function prepareTemplate(url, name) {
  if (!(await canConnect(url))) {
    await onAdmin(url, `CREATE DATABASE "${quoted(name)}"`);
  }

  const requireFromRoot = createRequire(pathToFileURL(path.join(process.cwd(), "package.json")));
  const prismaCli = requireFromRoot.resolve("prisma/build/index.js");

  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}

/**
 * Copies the template into a database of the worker's own.
 *
 * `CREATE DATABASE … TEMPLATE` is about a tenth of a second against nearly two for
 * spawning the migration CLI again, and it cannot produce a database the migrations have
 * not been applied to. The drop first is for a database a killed run left behind: it
 * would otherwise be inherited with its rows still in it.
 */
export async function copyTemplate(url, { from, to }) {
  await onAdmin(
    url,
    `DROP DATABASE IF EXISTS "${quoted(to)}" WITH (FORCE)`,
    `CREATE DATABASE "${quoted(to)}" TEMPLATE "${quoted(from)}"`,
  );
}

/**
 * Drops the copies taken from a template — every one of them, not just the ones this run
 * is about to remake: a run with fewer workers than the last would otherwise leave the
 * surplus lying about for ever.
 *
 * `keep` spares a copy whose key says it is still in use. A run is swept at its start as
 * well as its end, because a run that is killed never reaches its own teardown — and
 * that opening sweep is otherwise in a position to drop a database another run is in the
 * middle of reading.
 */
export async function dropCopies(url, template, { keep } = {}) {
  const admin = new PrismaClient({ datasourceUrl: adminDatabaseUrl(url) });
  try {
    const rows = await admin.$queryRaw`
      SELECT datname FROM pg_database WHERE datname LIKE ${workerDatabasePattern(template)}
    `;

    for (const { datname } of rows) {
      if (keep?.(datname)) continue;
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${quoted(datname)}" WITH (FORCE)`);
    }
  } finally {
    await admin.$disconnect();
  }
}

/**
 * Empties every table so a test starts from a known, empty database. The migrations
 * table is left alone: it describes the database rather than living in it.
 *
 * Which tables there are is asked once per client and kept. It cannot change under a
 * run — the database was copied from the template before the first test and is dropped
 * after the last — and asking again would put a catalogue query in front of every test
 * in both suites.
 */
const tableLists = new WeakMap();

export async function truncateAll(client) {
  let list = tableLists.get(client);

  if (list === undefined) {
    const rows = await client.$queryRaw`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    list = rows.map((row) => `"public"."${row.tablename}"`).join(", ");
    tableLists.set(client, list);
  }

  if (list) await client.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
