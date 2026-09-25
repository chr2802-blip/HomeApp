import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

/**
 * The AI readers' quality eval — `npm run eval:ai`, never part of `npm test`.
 *
 * It calls the real API, so it is billed, slow and different between runs: the three
 * reasons the suites answer the model with a stub instead. That is right for the suites,
 * which test the wiring, and it is exactly why nothing tested the *reading*. This is the
 * other half, run by hand — before and after a change of model, effort or prompt — and
 * judged by its scorecard rather than by a green tick.
 */

const rootDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(rootDir, ".env"), quiet: true });

export default defineConfig({
  resolve: {
    alias: { "@": path.join(rootDir, "src") },
  },
  test: {
    include: ["tests/eval/**/*.eval.ts"],
    environment: "node",
    env: { TZ: "UTC" },
    // One at a time: the timings on the scorecard are part of what it is for, and calls
    // racing each other would measure the rate limiter.
    fileParallelism: false,
    testTimeout: 120_000,
  },
});
