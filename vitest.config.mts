import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";
import { deriveTestDatabaseUrl } from "./scripts/test-db-url.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// .env.test wins where it sets something; .env fills in the rest (dotenv never
// overwrites a variable that is already defined).
loadEnv({ path: path.join(rootDir, ".env.test"), quiet: true });
loadEnv({ path: path.join(rootDir, ".env"), quiet: true });

// Unit tests never open a connection, so a missing DATABASE_URL must not stop them
// running — that is the case during a Vercel build. Integration tests re-check this
// for real in tests/helpers/db.ts before deleting anything.
let databaseUrl: string;
try {
  databaseUrl = deriveTestDatabaseUrl();
} catch {
  databaseUrl = "postgresql://unset:unset@localhost:5432/unset_test";
}

export default defineConfig({
  resolve: {
    alias: { "@": path.join(rootDir, "src") },
  },
  test: {
    env: {
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      AUTH_SECRET: "test-auth-secret-that-is-long-enough-to-sign-with",
      CRON_SECRET: "test-cron-secret",
      // Run as production does. Without this the suite inherits the developer's clock,
      // which in Copenhagen makes a local-time bug invisible until CI runs in UTC.
      TZ: "UTC",
      // Deliberately no VAPID keys: push stays inert unless a test mocks it.
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["./tests/setup/integration.ts"],
          globalSetup: ["./tests/setup/global.ts"],
          // One shared database, so files must not race each other.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
