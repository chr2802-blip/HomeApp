/**
 * Fails if `prisma/schema.prisma` says something the migrations do not.
 *
 * Migrations run inside the production build, so a schema edit that nobody generated a
 * migration for does not present as a missing column at runtime — it presents as a
 * failed deploy, from a branch that was already merged, with no rollback path. This is
 * the check that says so in two seconds on the developer's own machine instead.
 *
 * The integration suite catches some of this already, but only incidentally and only
 * where a test happens to touch the model: the generated client selects the column, the
 * database has not got it, and the query errors. A field on a model no test exercises
 * sails straight through. This asks the question directly.
 *
 * `migrate diff` needs a scratch database to replay the migrations into. It is created
 * beside the development one, it is dropped and rebuilt by Prisma on every run, and its
 * name ends in "_shadow" — the same rule the test databases follow, so it can never be
 * pointed at anything holding real data.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", quiet: true });

const SUFFIX = "_shadow";

function shadowDatabaseUrl(env = process.env) {
  if (env.SHADOW_DATABASE_URL) return env.SHADOW_DATABASE_URL;

  const base = env.DIRECT_URL ?? env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "Neither SHADOW_DATABASE_URL nor DATABASE_URL is set. Copy .env.example to .env first.",
    );
  }

  const url = new URL(base);
  const name = url.pathname.replace(/^\//, "");
  if (!name) throw new Error(`DATABASE_URL has no database name: ${url.host}`);

  url.pathname = `/${name.endsWith(SUFFIX) ? name : `${name}${SUFFIX}`}`;
  return url.toString();
}

function databaseName(urlString) {
  const name = new URL(urlString).pathname.replace(/^\//, "");
  if (!name.endsWith(SUFFIX)) {
    throw new Error(
      `Refusing to use "${name}" as a shadow database: the name must end with "${SUFFIX}". ` +
        "Prisma drops and rebuilds it on every run.",
    );
  }
  return name;
}

function adminUrl(urlString) {
  const url = new URL(urlString);
  url.pathname = "/postgres";
  return url.toString();
}

async function ensureDatabase(url, name) {
  const probe = new PrismaClient({ datasourceUrl: url });
  try {
    await probe.$queryRaw`SELECT 1`;
    return;
  } catch {
    // Not there yet; created below.
  } finally {
    await probe.$disconnect();
  }

  const admin = new PrismaClient({ datasourceUrl: adminUrl(url) });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
  } finally {
    await admin.$disconnect();
  }
}

const url = shadowDatabaseUrl();
const name = databaseName(url);

try {
  await ensureDatabase(url, name);
} catch (error) {
  console.error(`schema check: could not reach Postgres to prepare "${name}".`);
  console.error("  Is the local database running?  docker start homehub-pg");
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

// The CLI's entry point is invoked with node directly: spawning the npx shim needs a
// shell, which Node refuses for .cmd files on Windows. Same reasoning as tests/setup.
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

/*
 * `--exit-code` makes a difference exit 2, which execFileSync raises as an error. So
 * the difference arrives here rather than in a return value, and what Prisma printed —
 * the tables and columns that differ — is on the error rather than on stdout.
 */
try {
  execFileSync(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--from-migrations",
      "prisma/migrations",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--shadow-database-url",
      url,
      "--exit-code",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
} catch (error) {
  const detail = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
  console.error("schema check: prisma/schema.prisma and prisma/migrations disagree.\n");
  if (detail) console.error(`${detail}\n`);
  console.error("  The schema has been edited without a migration to match. Generate one:");
  console.error("    npm run db:migrate -- --name <what-changed>\n");
  console.error("  Migrations run inside the production build, so this would not fail at");
  console.error("  runtime — it would fail the deploy, after the branch had already merged.");
  process.exit(1);
}

console.log("schema check: migrations and schema agree.");
