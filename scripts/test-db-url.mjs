/**
 * Tests truncate every table between cases, so they must never point at a database
 * that holds real data. The test database is derived from DATABASE_URL by suffixing
 * the database name with "_test", and every entry point asserts that suffix before
 * connecting.
 */

function derive(env, overrideKey, suffix) {
  if (env[overrideKey]) return env[overrideKey];

  const base = env.DATABASE_URL;
  if (!base) {
    throw new Error(
      `Neither ${overrideKey} nor DATABASE_URL is set. Copy .env.example to .env first.`,
    );
  }

  const url = new URL(base);
  const name = url.pathname.replace(/^\//, "");
  if (!name) throw new Error(`DATABASE_URL has no database name: ${url.host}`);

  url.pathname = `/${name.endsWith(suffix) ? name : `${name}${suffix}`}`;
  return url.toString();
}

function assertSuffix(urlString, suffix) {
  const name = new URL(urlString).pathname.replace(/^\//, "");
  if (!name.endsWith(suffix)) {
    throw new Error(
      `Refusing to run tests against database "${name}": the name must end with "${suffix}". ` +
        "Point the override variable at a throwaway database.",
    );
  }
  return name;
}

/** Database for the vitest suite. */
export function deriveTestDatabaseUrl(env = process.env) {
  return derive(env, "TEST_DATABASE_URL", "_test");
}

export function testDatabaseName(urlString) {
  return assertSuffix(urlString, "_test");
}

/**
 * Database for the Playwright suite. Kept separate from the vitest one so the browser
 * tests and the unit suite can never interfere with each other's rows.
 */
export function deriveE2eDatabaseUrl(env = process.env) {
  return derive(env, "E2E_DATABASE_URL", "_e2e");
}

export function e2eDatabaseName(urlString) {
  return assertSuffix(urlString, "_e2e");
}

/**
 * The database belonging to one worker, given something that tells it apart from the
 * others running at the same time.
 *
 * The plain name — "homehub_test", "homehub_e2e" — is not one of these. It is the
 * template: migrated once, never run against, and copied to make each of these. So a
 * worker never shares, and never has to be told which migrations it is meant to have.
 *
 * The key goes *before* the suffix because the suffix is the whole guard: every entry
 * point refuses a database whose name does not end in "_test" or "_e2e", and a worker's
 * database has to be refused on the same terms as the template it came from.
 */
export function workerDatabaseUrl(urlString, key) {
  const url = new URL(urlString);
  const name = url.pathname.replace(/^\//, "");
  url.pathname = `/${name.replace(/(_test|_e2e)$/, `_w${key}$1`)}`;
  return url.toString();
}

/** The same server, but connected to the default "postgres" database. */
export function adminDatabaseUrl(urlString) {
  const url = new URL(urlString);
  url.pathname = "/postgres";
  return url.toString();
}
