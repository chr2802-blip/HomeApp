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

/**
 * Database for the vitest suite.
 *
 * @param {Record<string, string | undefined>} [env] where to read the settings from,
 *   named rather than taken from `process.env` so it can be asked hypothetically.
 */
export function deriveTestDatabaseUrl(env = process.env) {
  return derive(env, "TEST_DATABASE_URL", "_test");
}

export function testDatabaseName(urlString) {
  return assertSuffix(urlString, "_test");
}

/**
 * Database for the Playwright suite. Kept separate from the vitest one so the browser
 * tests and the unit suite can never interfere with each other's rows.
 *
 * @param {Record<string, string | undefined>} [env]
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
  const { stem, suffix } = split(url.pathname.replace(/^\//, ""));
  url.pathname = `/${stem}_w${key}${suffix}`;
  return url.toString();
}

/**
 * A LIKE pattern matching every worker database taken from a given template, and
 * nothing else.
 *
 * It is here rather than beside the sweeps that use it because it is the other half of
 * `workerDatabaseUrl`: one writes the name, the other has to recognise it again, and a
 * run that is killed leaves databases only the second one can clear away. Written twice
 * — once per suite — they drifted apart by construction.
 */
export function workerDatabasePattern(name) {
  const { stem, suffix } = split(name);
  return `${stem}_w%${suffix}`;
}

/**
 * Splits a test database's name into the part that names the project and the suffix
 * that marks it throwaway. Anything else is refused here rather than allowed to produce
 * a name that would be refused later, further from the mistake.
 */
function split(name) {
  const match = /^(.*)(_test|_e2e)$/.exec(name);
  if (!match) {
    throw new Error(
      `"${name}" is not a test database name: it must end with "_test" or "_e2e".`,
    );
  }
  return { stem: match[1], suffix: match[2] };
}

/** The same server, but connected to the default "postgres" database. */
export function adminDatabaseUrl(urlString) {
  const url = new URL(urlString);
  url.pathname = "/postgres";
  return url.toString();
}
