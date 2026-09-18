import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_SECRET } from "./e2e/helpers/session";
import { e2eWorkerCount, serverDatabaseUrl, serverPort, serverUrl } from "./e2e/helpers/servers";

// Playwright loads this config as CommonJS, so import.meta is unavailable here.
const rootDir = __dirname;

loadEnv({ path: path.join(rootDir, ".env.test"), quiet: true });
loadEnv({ path: path.join(rootDir, ".env"), quiet: true });

const workers = e2eWorkerCount();

/** Everything an app server needs, pointed at one worker's throwaway E2E database. */
const serverEnv = (worker: number) => ({
  ...process.env,
  DATABASE_URL: serverDatabaseUrl(worker),
  DIRECT_URL: serverDatabaseUrl(worker),
  AUTH_SECRET: E2E_AUTH_SECRET,
  CRON_SECRET: "e2e-cron-secret",
  NODE_ENV: "production",
  // Serve as production does, in UTC, rather than inheriting the developer's clock.
  TZ: "UTC",
  // No VAPID keys: push stays inert, so no test can fire a real notification.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
});

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  globalSetup: "./e2e/global-setup.ts",

  // A whole app each — server, port and database — so the files can run at the same
  // time. Within a file they still run in order, one after another on the same worker.
  workers,
  fullyParallel: false,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  // Deliberately no baseURL here: each worker has a server of its own, and a value set
  // here would win over the one e2e/helpers/fixtures.ts picks per worker — which is how
  // every worker ended up driving the first worker's server while seeding its own
  // database, and passing anyway because the seed is the same either way.
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Served rather than `next dev`: closer to production, and pages respond immediately
  // instead of compiling on first hit. The build itself is the `e2e` script's first
  // half, because these all start at once and none of them can start without it.
  webServer: Array.from({ length: workers }, (_, worker) => ({
    command: `npx next start --port ${serverPort(worker)} --hostname 127.0.0.1`,
    url: serverUrl(worker),
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "pipe" as const,
    stderr: "pipe" as const,
    env: serverEnv(worker),
  })),
});
