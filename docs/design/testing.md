# How the tests are set up, and why that way

Moved out of CLAUDE.md, which keeps the rules. This is the reasoning behind them.

## Tests gate everything

`.githooks/pre-push` checks the change before it leaves: lint, types and unit tests
always; the integration and browser suites only when `src/`, `prisma/`, `tests/`, `e2e/`,
`scripts/`, a lockfile or a build config changed. CI runs the full suite regardless, and
`npm run build` runs the unit tests. Pushing to `main` deploys, so a failing suite must
not reach the remote.

Integration and E2E use **separate** databases (`homehub_test`, `homehub_e2e`), created
automatically. They empty every table between tests, and refuse to run against a
database whose name lacks the right suffix.

**Emptying is `DELETE`, not `TRUNCATE`.** `TRUNCATE` swaps a fresh file in for every table
it names, rows or none, and measured about 55ms a call — before each of 544 integration
tests and 270 browser ones. A `DELETE` of what one test left behind is about 3ms. The
order is the only thing it has to get right, and only a key that refuses (`NO ACTION`,
`RESTRICT`) constrains it: a cascading key takes its rows along whichever table goes
first, and a `SET NULL` one lets go. The schema has a cycle (a home has a picture, a
picture belongs to a home) but none made of refusing keys, which is what makes a
children-first order exist; `scripts/test-db.mjs` falls back to `TRUNCATE` on the day
one does, rather than failing. Integration went from about 51s to 38s on a four-core
container.

**The browser suite hands out tests, not files** (`fullyParallel: true`). Handing out
files left the run waiting on `meals.spec.ts` — a third of the wall clock alone — with
the other workers idle. It is safe because every test reseeds its worker's database
first. Turning it on shook out one race that CI's single retry had been hiding:
`animation.spec.ts`'s `tickOff` pressed a row again every second until it read as
ticked, and on a loaded machine a slow-to-show first press settled the row into the
folded "Completed" section, leaving the retry nothing to press. It now waits for the
page's `data-ready` and presses once.

**Both suites run their files at the same time, and a worker owns a whole world.** The
plain names — `homehub_test`, `homehub_e2e` — are **templates**: migrated, and never run
against. Every worker gets a `CREATE DATABASE … TEMPLATE` copy of one, which takes about
a tenth of a second against nearly two for spawning the migration CLI again, and cannot
produce a database the migrations have not been applied to. The files truncate between
tests, so a shared database would have them emptying tables another file was halfway
through reading.

**All of that plumbing is `scripts/test-db.mjs`, once, for both suites** — making the
template, migrating it, copying it per worker, sweeping the copies up, truncating between
tests. It was written out twice, differing only in which suffix it looked for, and the
pair that has to agree is not within a suite but across them: `workerDatabaseUrl` writes
a copy's name and the sweep has to recognise it again, including the copies a killed run
left behind. `workerDatabasePattern` beside it is that second half, so the two cannot
drift. The module is plain JavaScript and uses no `import.meta`: vitest loads it as ESM,
Playwright compiles the file importing it to CommonJS.

**A worker's database is keyed by something that cannot be shared by two of them at
once.** For vitest that is the **process id** — `VITEST_POOL_ID` looks like the right
thing and is not: two workers running at the same time are sometimes handed the same
one, which puts two files on one database, where they truncate each other mid-test and
deadlock trying. That holds only while a worker *is* a process, which is why the
integration project says `pool: "forks"` rather than inheriting whatever the default is:
a pool of threads shares one pid and brings the collision straight back. Playwright's
`parallelIndex` *is* a real lease, so the browser suite uses it. Copies are swept away
afterwards, and again at the start of the next run, since a run that is killed never
reaches its own teardown — **except one whose process is still alive**, asked of the
operating system rather than assumed, so `npm test` alongside an open `npm run test:watch`
does not drop the watcher's databases on the way past.

The key goes *before* the suffix (`homehub_w7_test`, never `homehub_test_w7`) because the
suffix is the whole guard: every entry point refuses a database whose name does not end
in `_test` or `_e2e`, and a worker's copy has to be refused on the same terms.
`tests/unit/test-db-url.test.ts` holds every one of those rules — the suffix guard, the
key's position, the sweep's pattern matching the copies and nothing else — in
milliseconds and without a database, because the alternative way to find out that this
module disagrees with itself is a suite that has already started deleting.

**The browser suite gives each worker its own app server too**, on its own port, because
a server reads one database and one only. `e2e/helpers/servers.ts` says which worker gets
which. **Do not put `baseURL` in `playwright.config.ts`** — a value set there wins over
the one `e2e/helpers/fixtures.ts` picks per worker, and every worker then drives the
first worker's server while seeding its own database. That passes, because the seed is
the same either way, and hides every collision it causes. The build is the `e2e` script's
first half rather than the first server's command, because they all start at once and
none of them can start without it. `E2E_WORKERS` lowers the count on a machine that
cannot hold that many — a browser worker is a Next server and a Chromium, where vitest
sizes its own pool and takes a database per worker process as it goes.

**A password is hashed once per password, not once per user.** bcrypt at the cost the app
uses takes about a tenth of a second, and the fixtures make hundreds of people whose
password nobody varies — it was the single largest cost in both suites. The hash is real
and the cost factor is untouched; it is simply not recomputed. Likewise the browser
suite's `loginAs` puts the session cookie straight into the browser rather than filling
the login form, which `auth.spec.ts` still does by hand through `logInThroughForm`,
because there the form is the thing being tested.

A flaky test is worse than no test: it teaches everyone to press the button again. Fix the
race, do not add a timeout. An `it.only` left in is the same failure by another route — a
file reduced to one test, reading as a pass — so CI refuses one in either suite
(`forbidOnly` for Playwright, `allowOnly` for vitest).

**Never pipe a suite whose exit code is the thing being asked about.** `npm run e2e |
tail -30` reports `tail`'s status, not Playwright's, so a run in which every test failed
came back `0` — a green light over a red suite, which is worse than no check at all,
because it is the one kind of check nobody re-reads. It was caught by noticing that
`test-results/` held 249 directories, and with `trace: "retain-on-failure"` that number
can only be the number of failures. Redirect to a file and read `$?`, or read
`${PIPESTATUS[0]}`; the same goes for `| head`, `| grep` and `| tee`. This belongs with
the flaky test and the stray `it.only` above: all three are ways a suite reads as a pass
without having been one, and that is the only failure mode of a test suite that cannot be
caught by the test suite.

Two races are worth knowing about, because both passed on an idle machine and only
showed once the files started running at the same time. **A tick is optimistic**: the
item folds away the instant it is pressed, before the action has been answered, so a test
that navigates on that signal is racing its own write — wait on the stored row instead,
as the favourites and the list counts do. And **a wait for the page a save lands on must
not match the page the form is already on**: `/recipes/new` satisfies
`/recipes/[a-z0-9]+$`, so that wait was answered the moment it was asked and the test
walked on mid-save. `SAVED_RECIPE` in `e2e/helpers/fixtures.ts` is that pattern written
so it cannot.
