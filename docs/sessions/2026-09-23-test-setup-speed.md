# Faster test suites

- **Date** — 2026-09-23
- **Branch** — `claude/test-setup-optimization-lx1xrg`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"The test setup has grown big — anything to optimise, anything redundant?" This meant
measuring first. The harness was already well tuned (template databases, a password
hashed once per password, parallel workers), so the question became where the remaining
seconds actually go.

## The route

`npm run setup` got a bare container ready in one go. Baseline on 4 cores: unit ~15s,
integration ~51–61s, `next build` 70s, browser suite 4m44s, all green. The per-test and
per-file durations from the JSON reporters pointed at two things. The first was
`TRUNCATE` costing ~55ms before every test. The second was files being handed out
whole, so the run waited on `meals.spec.ts` (98s of a 282s run). Benchmarking three
reset strategies in a throwaway script showed that `DELETE` ordered by refusing FKs
brings the reset down to ~3ms. `fullyParallel` exposed a race in `animation.spec.ts`
twice, in two shapes, before its fix held under `--repeat-each=15`.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | CLAUDE.md + docs/design/testing.md covered the harness |
| Building | small | |
| Tests | most | each full browser run is ~4.5 min; four were needed |
| Review, CI, deploy | — | |

## What should have been quicker

Getting per-test timings. There is no script for "where does the suite spend its time".
I wrote `--reporter=json` plus a node one-liner by hand for both vitest and Playwright.
A `test:profile` script would make the next look at this a one-liner.

The `animation.spec.ts` race cost two full browser runs to find. CI's `retries: 1` had
been hiding it, and a flaky pass does not fail CI, so nobody was told.

## What CLAUDE.md did not say

That browser tests must stand alone within their file. This is now written under *Tests
gate everything*, together with why the reset is a `DELETE`.

## Decided rather than known

- The fallback to `TRUNCATE` when refusing keys form a cycle. No such cycle exists
  today, so the path is untested.
- I did not delete any tests as "redundant". The e2e specs that look like they overlap
  integration ones (tenancy, photos, validation) check what a page shows rather than
  what an action returns, so removing them is a call for the owner.
