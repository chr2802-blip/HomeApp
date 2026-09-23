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
 * It deletes rather than truncates. `TRUNCATE` gives every table a fresh file on disk
 * whether it held a row or not, and cost about 55ms a time here — once before every test
 * in both suites, which came to some thirty seconds of worker time per integration run.
 * A `DELETE` of the handful of rows a test leaves behind is a few milliseconds.
 *
 * The one thing a `DELETE` has to get right that a `TRUNCATE … CASCADE` did not is the
 * order. Only a foreign key that refuses (`NO ACTION` or `RESTRICT`) cares: a cascading
 * one takes its rows along whichever table goes first, and a `SET NULL` one lets go of
 * them. So the tables are ordered by the refusing keys alone, children first — which is
 * what makes the order possible at all, because the schema *has* a cycle (a home carries
 * a picture and a picture belongs to a home), just not one made of refusing keys. If one
 * ever is, no order exists, and this falls back to truncating rather than failing.
 *
 * The statement is worked out once per client and kept. The tables cannot change under a
 * run — the database was copied from the template before the first test and is dropped
 * after the last — and asking again would put catalogue queries in front of every test.
 */
const emptyingStatements = new WeakMap();

export async function truncateAll(client) {
  let statement = emptyingStatements.get(client);

  if (statement === undefined) {
    statement = await emptyingStatement(client);
    emptyingStatements.set(client, statement);
  }

  if (statement) await client.$executeRawUnsafe(statement);
}

async function emptyingStatement(client) {
  const tables = (
    await client.$queryRaw`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `
  ).map((row) => row.tablename);

  if (tables.length === 0) return "";

  // Which tables a given table must be emptied before: the ones it holds a refusing key
  // into. A key into itself is left out — one statement deletes every row of the table,
  // and `NO ACTION` is checked once that statement is over.
  const refusing = await client.$queryRaw`
    SELECT child.relname AS child, parent.relname AS parent
    FROM pg_constraint c
    JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_class parent ON parent.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'f' AND c.confdeltype IN ('a', 'r')
      AND n.nspname = 'public' AND c.conrelid <> c.confrelid
  `;

  const name = (table) => `"public"."${quoted(table)}"`;
  const ordered = childrenFirst(tables, refusing);

  if (!ordered) {
    return `TRUNCATE TABLE ${tables.map(name).join(", ")} RESTART IDENTITY CASCADE`;
  }

  // One statement, so one round trip, and atomic: `DELETE`s cannot share a prepared
  // statement, but a `DO` block runs them as one.
  return `DO $$ BEGIN ${ordered.map((table) => `DELETE FROM ${name(table)};`).join(" ")} END $$`;
}

/** Tables ordered so that each comes before every table it refers to; null on a cycle. */
function childrenFirst(tables, edges) {
  const waitingOn = new Map(tables.map((table) => [table, 0]));
  const parentsOf = new Map(tables.map((table) => [table, []]));

  for (const { child, parent } of edges) {
    if (!waitingOn.has(child) || !waitingOn.has(parent)) continue;
    // A parent waits until every child pointing into it has been emptied.
    waitingOn.set(parent, waitingOn.get(parent) + 1);
    parentsOf.get(child).push(parent);
  }

  const ready = tables.filter((table) => waitingOn.get(table) === 0);
  const ordered = [];

  while (ready.length > 0) {
    const table = ready.shift();
    ordered.push(table);
    for (const parent of parentsOf.get(table)) {
      waitingOn.set(parent, waitingOn.get(parent) - 1);
      if (waitingOn.get(parent) === 0) ready.push(parent);
    }
  }

  return ordered.length === tables.length ? ordered : null;
}
