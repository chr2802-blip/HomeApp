import { describe, expect, it } from "vitest";
import {
  adminDatabaseUrl,
  deriveE2eDatabaseUrl,
  deriveTestDatabaseUrl,
  e2eDatabaseName,
  testDatabaseName,
  workerDatabasePattern,
  workerDatabaseUrl,
} from "../../scripts/test-db-url.mjs";

/**
 * The one piece of the test setup that had no tests of its own, and the one whose
 * failure is worst: every entry point in both suites truncates tables, and what stops
 * either of them doing that to a real database is this module agreeing with itself.
 *
 * Nothing here opens a connection — these are string rules, and the point is that they
 * can be checked in milliseconds rather than only being found out by a suite that has
 * already started deleting.
 */

const LIVE = "postgresql://user:secret@db.example.com:5433/homehub?sslmode=require";

describe("deriving a test database", () => {
  it("suffixes the name and leaves the rest of the connection alone", () => {
    const url = new URL(deriveTestDatabaseUrl({ DATABASE_URL: LIVE }));

    expect(url.pathname).toBe("/homehub_test");
    // Credentials, host, port and parameters are the developer's own server: a derived
    // URL that dropped any of them would fail to connect rather than connect elsewhere,
    // but it would fail in a way that reads as "Postgres is down".
    expect(url.username).toBe("user");
    expect(url.password).toBe("secret");
    expect(url.host).toBe("db.example.com:5433");
    expect(url.searchParams.get("sslmode")).toBe("require");
  });

  it("leaves a name that already ends in the suffix as it is", () => {
    const once = deriveTestDatabaseUrl({ DATABASE_URL: LIVE });

    expect(deriveTestDatabaseUrl({ DATABASE_URL: once })).toBe(once);
  });

  it("prefers an override, whatever DATABASE_URL says", () => {
    const override = "postgresql://elsewhere/scratch_test";

    expect(deriveTestDatabaseUrl({ DATABASE_URL: LIVE, TEST_DATABASE_URL: override })).toBe(
      override,
    );
  });

  it("keeps the browser suite's database apart from the unit suite's", () => {
    expect(deriveE2eDatabaseUrl({ DATABASE_URL: LIVE })).not.toBe(
      deriveTestDatabaseUrl({ DATABASE_URL: LIVE }),
    );
  });

  it("says what to do when there is nothing to derive from", () => {
    expect(() => deriveTestDatabaseUrl({})).toThrow(/DATABASE_URL/);
  });
});

describe("the suffix guard", () => {
  it("accepts a name marked throwaway", () => {
    expect(testDatabaseName("postgresql://localhost/homehub_test")).toBe("homehub_test");
    expect(e2eDatabaseName("postgresql://localhost/homehub_e2e")).toBe("homehub_e2e");
  });

  it.each([
    ["the production database", "postgresql://localhost/homehub"],
    ["a name that merely contains the suffix", "postgresql://localhost/homehub_test_backup"],
    ["the other suite's database", "postgresql://localhost/homehub_e2e"],
  ])("refuses %s", (_what, url) => {
    expect(() => testDatabaseName(url)).toThrow(/must end with "_test"/);
  });

  it("refuses an empty setting rather than reading it as no opinion", () => {
    expect(() => testDatabaseName("")).toThrow();
  });
});

describe("a worker's own database", () => {
  it("puts the key before the suffix, so the guard still applies to it", () => {
    const worker = workerDatabaseUrl("postgresql://localhost/homehub_test", 4711);

    expect(worker).toBe("postgresql://localhost/homehub_w4711_test");
    // The whole protection: a copy has to be refused on the same terms as the template.
    expect(testDatabaseName(worker)).toBe("homehub_w4711_test");
  });

  it("does the same for the browser suite", () => {
    const worker = workerDatabaseUrl("postgresql://localhost/homehub_e2e", 2);

    expect(e2eDatabaseName(worker)).toBe("homehub_w2_e2e");
  });

  it("keeps the rest of the connection, so a worker reaches the same server", () => {
    const worker = new URL(workerDatabaseUrl(deriveTestDatabaseUrl({ DATABASE_URL: LIVE }), 9));

    expect(worker.pathname).toBe("/homehub_w9_test");
    expect(worker.host).toBe("db.example.com:5433");
    expect(worker.searchParams.get("sslmode")).toBe("require");
  });

  it("gives two workers two databases", () => {
    const template = "postgresql://localhost/homehub_test";

    expect(workerDatabaseUrl(template, 1)).not.toBe(workerDatabaseUrl(template, 2));
  });

  it("refuses to key a database that is not a test one", () => {
    expect(() => workerDatabaseUrl("postgresql://localhost/homehub", 1)).toThrow(/_test/);
  });
});

describe("the sweep that clears the copies away", () => {
  /** Postgres' LIKE, near enough for the names this module can produce. */
  const matches = (pattern: string, name: string) =>
    new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`).test(
      name,
    );

  it("matches the names the workers were given", () => {
    const pattern = workerDatabasePattern("homehub_test");

    for (const key of [1, 42, process.pid]) {
      const name = testDatabaseName(workerDatabaseUrl("postgresql://localhost/homehub_test", key));
      expect(matches(pattern, name)).toBe(true);
    }
  });

  it.each([
    ["the template it copies", "homehub_test"],
    ["the production database", "homehub"],
    ["the other suite's worker", "homehub_w1_e2e"],
    ["another project on the same server", "otherapp_w1_test"],
  ])("spares %s", (_what, name) => {
    expect(matches(workerDatabasePattern("homehub_test"), name)).toBe(false);
  });

  it("refuses a template that is not a test database, rather than matching everything", () => {
    expect(() => workerDatabasePattern("homehub")).toThrow(/_test/);
  });
});

describe("the admin connection", () => {
  it("points at the server's own database, keeping the credentials", () => {
    const admin = new URL(adminDatabaseUrl(LIVE));

    expect(admin.pathname).toBe("/postgres");
    expect(admin.username).toBe("user");
    expect(admin.host).toBe("db.example.com:5433");
  });
});
