# Turn the container bring-up ritual into one command

- **Date** — 2026-09-21
- **Branch** — `claude/session-evaluations-review-fvsplj`
- **PR** — not yet
- **Reached production** — not yet

## The idea

"What does the last session evaluations say. Anything we can improve." So the task was
reading `docs/sessions/` rather than writing to it — and the answer was already in it, ten
times over. The last note (`2026-09-21-drop-redundant-preparation.md`) is a clean one-bullet
change to `recipe-normalize.ts`'s system prompt whose only named cost is `npm ci` and
`prisma generate` in a cold container. **Seven of the ten notes name environment bring-up as
their largest cost**, and three of them explicitly ask for a script. By this directory's own
rule — "when the same answer appears in three entries it is a convention or a check" — that
was overdue by four sessions, so the session turned into writing it.

## The route

Grepped the two lines `docs/sessions/README.md` says to grep, which is the whole finding in
one command. Then: read `check-schema-drift.mjs` and `test-db.mjs` for the shape a script
here takes, and built `scripts/dev-setup.mjs` against **this** container, which happened to
be cold in exactly the documented way — no `node_modules`, a stopped `16/main` cluster,
Chromium 1194 against the lockfile's 1243. That was luck worth using: every path in the
script ran for real rather than being reasoned about.

Two loops, both in the Chromium half:

- **Asking Playwright where its browser goes does not work through the front door.**
  `require('playwright-core/browsers.json')` and `.../lib/server/registry` are both blocked
  by the package's `exports` map, and the bundled `lib/serverRegistry.js` exports an object
  whose shape is not the registry's. Three attempts in, this was the wrong door: an internal
  surface that a script depending on it would break on at the next Playwright bump. Backed
  out to `playwright install --dry-run`, which is a **stable public output** naming both the
  install directory and the archive that would have been unpacked there — and the archive's
  name is the internal layout directory, which is the half that moves.
- **The first mirror derived the donor's revision directory from `path.dirname` of the
  directory holding its binary**, which is right only while the binary is exactly one level
  down. Carried it explicitly instead. Caught by reading the diff back, not by running it —
  the container's layout is one level down, so it would have passed here and broken on the
  first image that nests differently.

Then deliberately broke it twice to see the guards fire: a wrong `.env` (must refuse to
rewrite credentials it did not write) and a stopped cluster with a good `.env` (must restart
and carry on). Both behaved.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | the answer was two greps over `docs/sessions/` |
| Reading the codebase | small | two existing scripts for style, `testing.md`, `.claude/settings.json` |
| Building | most of it | `dev-setup.mjs`, and four attempts at how to ask Playwright what it wants |
| Tests | medium | ran the script cold, twice more for idempotency, and twice against broken states |
| Review, CI, deploy | — | one `npm run verify`, then one push |

## What should have been quicker

**Chasing Playwright's internals for something its CLI already prints.** Four calls went
into `browsers.json`, `lib/server/registry`, an absolute-path `require` of the same, and
`lib/serverRegistry.js` — all of it trying to be told an executable path that
`install --dry-run` states in plain text, and none of it a surface worth depending on
anyway. The tell was there at the first `ERR_PACKAGE_PATH_NOT_EXPORTED`: a package that has
closed its subpaths has closed them on purpose. **When a tool's internals resist being
imported, that is the tool saying to use its CLI** — and a setup script whose job is to
survive lockfile bumps is the last place to reach past a supported interface.

**And the smaller one, which is the interesting half:** this script should have existed
after the second note named the cost, not the seventh. What went into CLAUDE.md instead was
the *incantation* — and the three notes after that all confirm the documentation worked,
because each one says the warning saved them the diagnosis. Documentation converted twenty
minutes of diagnosis into five minutes of typing and then stopped converting anything,
five times. **A cost that documentation reduces but does not remove keeps being paid, and
looks like it has been dealt with** — which is exactly why it survived four sessions of
people noticing it. The rule worth keeping: when a note's fix is "write down the commands",
ask in the same breath whether the commands could be a command.

## What CLAUDE.md did not say

Two things, both now in it:

- **The bring-up is a command** — `npm run setup` heads the Commands block, with what it
  probes, that it is safe to run twice, and that it never touches an existing `.env`. The
  hand-written paragraph below it is deliberately **kept**: the day the script is wrong,
  whoever is fixing it needs to know what it was aiming at. Added there too: which Chromium
  revision Playwright wants is asked of Playwright, because it moves with the lockfile.
- **"Never pipe a suite whose exit code is the thing being asked about."** This was found
  back on 2026-09-20 (`2026-09-20-session-notes.md`) and was the worst finding in the set —
  `npm run e2e | tail -30` reported `tail`'s status, so a run in which all 249 tests failed
  came back `0`, a green light over a red suite. It lived in that one note and **nowhere
  else**: not in CLAUDE.md, not in `docs/design/testing.md`. Now in both, beside the flaky
  test and the stray `it.only`, because all three are ways a suite reads as a pass without
  having been one.

That second one is its own finding about this directory. `importer-tolerant-schema.md` said
it best a few notes earlier — "the finding was written down as a story about units instead
of as a rule about schemas, and a story only protects the example in it". The same thing had
already happened to the pipe lesson, in a note nobody had reread. **A note is where a
finding is discovered, not where it lives**; the same session has to move it somewhere a
reader will hit it without going looking.

## Decided rather than known

- **No unit test for the script.** The two derivations that could drift — the archive name
  to layout directory, and the layout directory to binary name — are both **validated by
  execution** at the end of every mirror, and the run finishes by launching a real browser,
  so a wrong reading fails loudly with the wrong thing named. A test asserting the regexes
  would restate them. The judgement is that this repo tests what fails *silently* (the
  scoping list against the schema, the database-name guard), and this does not. If a future
  image nests its browser differently and the mirror produces something that runs but
  misbehaves, that judgement was wrong.
- **`npm run setup` is not wired into `verify` or `pretest`.** Setting up an environment as
  a side effect of asking for tests is the kind of surprise that ends with a script having
  written an `.env` somebody did not want. The SessionStart hook *tells* rather than acts,
  for the same reason the session-note hook asks once.
- **The local password is the literal `postgres`.** Only ever written for a cluster on the
  container's own loopback, holding test data, and only when there is no `.env` to respect —
  a random one would be better hygiene and worse to debug with `psql` by hand.
- **The `check` probe treats "Postgres does not answer" as needing setup**, which on a
  laptop where the cluster is simply off says the same thing as a cold container. Harmless,
  but it means the hook is occasionally advice rather than news.
