import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { deriveE2eDatabaseUrl } from "./scripts/test-db-url.mjs";

// Playwright loads this config as CommonJS, so import.meta is unavailable here.
const rootDir = __dirname;

loadEnv({ path: path.join(rootDir, ".env.test"), quiet: true });
loadEnv({ path: path.join(rootDir, ".env"), quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;
const databaseUrl = deriveE2eDatabaseUrl();

/** Everything the app server needs, pointed at the throwaway E2E database. */
const serverEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  AUTH_SECRET: "e2e-auth-secret-that-is-long-enough-to-sign-with",
  CRON_SECRET: "e2e-cron-secret",
  NODE_ENV: "production",
  // Serve as production does, in UTC, rather than inheriting the developer's clock.
  TZ: "UTC",
  // No VAPID keys: push stays inert, so no test can fire a real notification.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  globalSetup: "./e2e/global-setup.ts",

  // The specs share one database and reseed it between tests, so they must not overlap.
  workers: 1,
  fullyParallel: false,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // Built and served rather than `next dev`: closer to production, and pages respond
    // immediately instead of compiling on first hit.
    command: `npm run e2e:build && npx next start --port ${PORT} --hostname 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
    env: serverEnv,
  },
});
