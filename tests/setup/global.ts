import { deriveTestDatabaseUrl, testDatabaseName } from "../../scripts/test-db-url.mjs";
import { dropCopies, prepareTemplate } from "../../scripts/test-db.mjs";

/**
 * Runs once before the integration suite: makes sure the template database exists and
 * carries the current migrations, and clears away any worker databases a previous run
 * left behind.
 *
 * Nothing runs against the template itself. Each worker copies it — see
 * tests/setup/worker-db.ts — so the files can run at the same time without truncating
 * each other's tables.
 */
export default async function setup() {
  const url = deriveTestDatabaseUrl();
  const name = testDatabaseName(url);

  await prepareTemplate(url, name);

  // A run that is killed never reaches its own teardown, so the sweep happens at both
  // ends. Both spare a worker whose process is still alive — see below.
  await dropCopies(url, name, { keep: stillRunning });

  return () => dropCopies(url, name, { keep: stillRunning });
}

/**
 * Whether the run that made a copy is still using it.
 *
 * A worker's database is named after its process id, so the question can be asked of the
 * operating system: `npm test` alongside an open `npm run test:watch` would otherwise
 * drop the watcher's databases out from under it on the way past, which presents as a
 * database that has vanished mid-test rather than as two runs colliding.
 *
 * A dead process's id can be handed out again, so a copy can be spared once for a pid
 * that now belongs to something else. The next run sweeps it up, which is what this
 * sweep is for — nothing runs against a copy it did not just make.
 *
 * This run's own process is the exception to the question: it is alive by definition,
 * so asking would spare its copy for ever and never clear one away.
 */
function stillRunning(datname: string) {
  const pid = Number(/_w(\d+)_test$/.exec(datname)?.[1]);
  if (!Number.isInteger(pid) || pid === process.pid) return false;

  try {
    // Signal 0 asks whether the process exists without sending it anything.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // "Not allowed to signal it" is still an answer: the process is there.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
