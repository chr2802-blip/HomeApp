/**
 * Tests truncate every table between cases, so they must never point at a database
 * that holds real data. The test database is derived from DATABASE_URL by suffixing
 * the database name with "_test", and every entry point asserts that suffix before
 * connecting.
 */

export function deriveTestDatabaseUrl(env = process.env) {
  if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL;

  const base = env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "Neither TEST_DATABASE_URL nor DATABASE_URL is set. Copy .env.example to .env first.",
    );
  }

  const url = new URL(base);
  const name = url.pathname.replace(/^\//, "");
  if (!name) throw new Error(`DATABASE_URL has no database name: ${url.host}`);

  url.pathname = `/${name.endsWith("_test") ? name : `${name}_test`}`;
  return url.toString();
}

export function testDatabaseName(urlString) {
  const name = new URL(urlString).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests against database "${name}": the name must end with "_test". ` +
        "Point TEST_DATABASE_URL at a throwaway database.",
    );
  }
  return name;
}

/** The same server, but connected to the default "postgres" database. */
export function adminDatabaseUrl(urlString) {
  const url = new URL(urlString);
  url.pathname = "/postgres";
  return url.toString();
}
