import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A browser spec that intercepts requests keeps the service worker out of the page.
 *
 * `page.route` cannot see a request the worker sent on the page's behalf, and whether the
 * worker has claimed the page yet is a race — so a spec that routes without blocking it
 * passes alone and times out one run in thirty under load. `ROUTES_REQUESTS` in
 * `e2e/helpers/fixtures.ts` says why at length. Walks `e2e/`, never a list of its own.
 */

const E2E = "e2e";

const specs = readdirSync(E2E).filter((name) => name.endsWith(".spec.ts"));

describe("browser specs that route requests", () => {
  it("finds the specs", () => {
    expect(specs.length).toBeGreaterThan(0);
  });

  for (const spec of specs) {
    const source = readFileSync(join(E2E, spec), "utf8");
    if (!/\b(page|context)\.route\(/.test(source)) continue;

    it(`${spec} blocks the service worker`, () => {
      expect(source).toMatch(/test\.use\(ROUTES_REQUESTS\)/);
    });
  }
});
