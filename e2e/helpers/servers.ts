import { cpus } from "node:os";
import { deriveE2eDatabaseUrl, workerDatabaseUrl } from "../../scripts/test-db-url.mjs";

/**
 * How many browser workers run at once.
 *
 * Each one needs a whole app of its own — a server, on its own port, reading its own
 * database — because sharing either would have one worker's reseed empty the page
 * another was in the middle of reading. Capped rather than simply "every core", and
 * settable with `E2E_WORKERS` where a machine cannot hold that many: each one is a Next
 * server and a Chromium, which costs a good deal more than a vitest worker.
 *
 * vitest is not given a number — it sizes its own pool, and takes a database per worker
 * process as it goes.
 */
export function e2eWorkerCount() {
  const asked = Number(process.env.E2E_WORKERS);
  if (Number.isInteger(asked) && asked > 0) return asked;
  return Math.max(1, Math.min(4, cpus().length));
}

const BASE_PORT = Number(process.env.E2E_PORT ?? 3100);

/** The port a given worker's server listens on. Workers are numbered from zero, as Playwright numbers them. */
export function serverPort(worker: number) {
  return BASE_PORT + worker;
}

/** The server a given worker talks to. */
export function serverUrl(worker: number) {
  return `http://127.0.0.1:${serverPort(worker)}`;
}

/**
 * The database that worker's server is pointed at — a copy of the template, made before
 * any server is started. Nothing runs against the plain "homehub_e2e"; it is only ever
 * the thing the copies are taken from.
 */
export function serverDatabaseUrl(worker: number) {
  return workerDatabaseUrl(deriveE2eDatabaseUrl(), worker);
}

/**
 * The port that worker's stand-in for the Messages API listens on.
 *
 * A hundred clear of the app servers so the two ranges cannot meet however many workers a
 * machine decides on, and one per worker for the same reason the app servers are: a shared
 * one would be a shared thing to restart, and the suite's whole arrangement is that a
 * worker owns its world.
 */
export function anthropicStubPort(worker: number) {
  return BASE_PORT + 100 + worker;
}

/** Where that worker's app server is told to send its reading. */
export function anthropicStubUrl(worker: number) {
  return `http://127.0.0.1:${anthropicStubPort(worker)}`;
}
