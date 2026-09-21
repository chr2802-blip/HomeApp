# Show AI spending against a per-home monthly limit

- **Date** — 2026-09-21
- **Branch** — `claude/ai-integration-spending-overview-xm1iib`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

"An overview of spending... on the system page across homes and the settings page on
home level, as a progress bar toward the limit, which is 5 dollars in DKK a month per
home." What it turned out to mean: the app has exactly one AI call in it —
`normalizeRecipe` — and nothing anywhere records what a call costs. The whole session
was building that record (a new `AiUsage` row per call, priced at the moment it is
billed) and then reading it back two ways, which is the same split `storage.ts` already
uses for bytes: one home's own figure, and every home's figure at once.

## The route

Read `recipe-normalize.ts` and `recipe-import.ts` to find the one place a model is
called and confirm `homeId` was already threaded down to it. Read `storage.ts` and
`storage-usage.tsx` as the pattern to match — same shape of question, same two
audiences — and `home-db.ts` to confirm a model with a `homeId` column classifies
itself with no list to update. Loaded the `claude-api` skill for Sonnet 5's actual
per-token price rather than guess it.

No Postgres or Playwright browser was preinstalled in this sandbox. Started a local
cluster by hand (`service postgresql start`, created `homehub`) rather than skip
`db:check` and the integration suite — neither is committed, both cost time that had
nothing to do with the change.

Loops worth naming:

- **`homeDb(homeId).aiUsage.create(...)` did not typecheck.** Prisma's create input
  wants either `homeId` or a `home: { connect }`, and the home-scoping extension adds
  `homeId` only at runtime, invisible to the static type. Grepped the codebase for how
  every other action writes a home-scoped row and found the actual convention is plain
  `prisma.X.create({ data: { homeId, ... } })` — `homeDb` is used for reads there, not
  writes. Fixed by matching that, which is also simpler.
- **`formatDkk`'s test failed with two identical-looking strings.** da-DK's currency
  format sits "kr." behind a non-breaking space (U+00A0), not an ordinary one. Invisible
  in a terminal, so the assertion had to be re-typed with ` ` rather than trusted by
  eye — worth a comment in the test so the next person does not lose the same ten
  minutes.
- **Verified in a real browser, not just the test suite.** Seeded a super admin, made
  two homes, inserted rows by hand (one over the limit) and screenshotted `/settings`
  and `/admin/system`. Worth doing: it caught nothing broken, but it confirmed the "over
  the limit" home sorts first and reads in red while its bar still wears its own colour,
  which the tests assert separately and never together.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 10m | Reading the importer to confirm there is one call site, not several |
| Reading the codebase | 20m | `storage.ts`/`storage-usage.tsx` as the pattern, `home-db.ts`, `time.ts`, the claude-api skill for pricing |
| Building | 40m | Schema + migration, `ai-usage.ts`, `ai-spend.tsx`, wiring into both pages, `monthStartInstant` |
| Tests | 30m | Unit tests for the pure functions, integration tests for the two readers, the non-breaking-space fix |
| Review, CI, deploy | 25m | Standing up local Postgres, `verify`'s pieces one at a time, a real browser check |

## What should have been quicker

**Standing up a database that was never going to exist here.** `docker start
homehub-pg` is the documented path and this sandbox has no Docker. Postgres itself was
already installed, which nothing says — `service postgresql start` plus a hand-rolled
`.env` got every check in `verify` actually running rather than skipped. Worth writing
down once rather than rediscovering per session: a sandbox with no Docker daemon but a
Postgres binary is not a dead end.

## What CLAUDE.md did not say

1. **That a home-scoped row is written through plain `prisma.X.create({ data: { homeId,
   ... } })`, not `homeDb(homeId).X.create(...)`.** The "Home-scoped data goes through
   `homeDb`" rule reads as covering every operation, and every write in the codebase
   already disagrees with that reading — `homeDb` is for reads. Not added to CLAUDE.md
   this session because it is a documentation gap rather than a new decision, and it
   would want its own pass across the file to say precisely where the line is; flagging
   it here so it does not have to be rediscovered from a type error again.

## Decided rather than known

- **A fixed USD→DKK rate (6.9), not a live one.** The number only has to be roughly
  right and a rate that moved under the bar between renders would be a second thing to
  explain. Revisit by hand if the krone moves meaningfully; nothing here will notice on
  its own.
- **The limit is visual only.** Nothing stops a call once a home is over 5 USD for the
  month — the ask was an overview, not a cap, and enforcement (blocking imports, warning
  before one starts) was out of scope rather than forgotten.
- **A call is priced and stored even when it turns out not to be a recipe.** Anthropic
  bills whatever tokens were spent regardless of the verdict, so `recordAiUsage` runs
  right after the response comes back, before `isRecipe` or `parsed_output` is checked.
- **Metering never fails the import.** `recordAiUsage` catches its own errors and logs
  them the way `recipe-normalize.ts` already logs the reader going down — a lost metric
  is not worth a lost recipe.
- **One row per call, not a running total on `Home`.** Matches `AiUsage` to the same
  shape `storage.ts` uses for bytes: a total can only grow and cannot be corrected, and
  a raw sum over rows is what makes "this calendar month" a `WHERE` clause instead of a
  second column to keep in step.
