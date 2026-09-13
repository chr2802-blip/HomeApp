import { ACCOUNTS, expect, test } from "./helpers/fixtures";

/**
 * Asserted against the real server rather than the config file, so a header that is
 * configured but not actually sent still counts as missing.
 */
test.describe("security headers", () => {
  const expected: Record<string, RegExp> = {
    "x-frame-options": /^DENY$/i,
    "content-security-policy": /frame-ancestors 'none'/,
    "x-content-type-options": /^nosniff$/i,
    "referrer-policy": /strict-origin-when-cross-origin/,
    "permissions-policy": /camera=\(\)/,
    "strict-transport-security": /max-age=\d+/,
  };

  test("are sent on a public page", async ({ page }) => {
    const response = await page.goto("/login");
    const headers = response!.headers();

    for (const [name, pattern] of Object.entries(expected)) {
      expect(headers[name] ?? "", `missing or wrong: ${name}`).toMatch(pattern);
    }
  });

  test("are sent on a signed-in page too", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.member);
    const response = await page.goto("/lists");
    const headers = response!.headers();

    expect(headers["x-frame-options"]).toMatch(/DENY/i);
    expect(headers["referrer-policy"]).toMatch(/strict-origin-when-cross-origin/);
  });

  test("do not advertise the framework", async ({ page }) => {
    const response = await page.goto("/login");

    expect(response!.headers()["x-powered-by"]).toBeUndefined();
  });
});
