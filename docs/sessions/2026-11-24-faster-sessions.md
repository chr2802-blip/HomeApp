# Make a session's own overhead smaller

- **Date** — 2026-11-24
- **Branch** — `ccr-53562c60-7hh7fa`
- **PR** — not opened yet
- **Reached production** — not yet (nothing here deploys anything a household sees)

## The idea

The question was "why does a feature take so long to build and ship?" Read across the 100
notes in this folder, the answer came down to three repeated costs, and the household said
to take all three: a cold container on every session, a browser suite that failed a push in
the container on a random test, and a throwaway script for every screenshot that needed
more than a button press.

## The route

Read every note's "what should have been quicker" → `npm run setup` (1m02s cold) → made a
personal cloud environment "HomeApp" whose setup script runs it, after running that script
here from the repo's parent directory → `e2eWorkerCount` answers 1 under
`CLAUDE_CODE_REMOTE=true`, with a unit test → `screenshot.ts` steps `--tap`, `--fill`,
`--hold`, `--photo` beside `--press`, in the order typed (`parseArgs` `tokens`), each tried
against the demo household → CLAUDE.md.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | short | the notes had already answered it |
| Reading the codebase | short | `servers.ts`, `screenshot.ts`, `use-long-press.ts` |
| Building | short | |
| Tests | ~15 min | one wrong button name stalled for 30s; the push runs the whole browser suite on one worker |
| Review, CI, deploy | — | |

## What should have been quicker

Guessing a button's accessible name for `--press` ("Add to the pantry" — it is "Add to
supplies") cost Playwright's full 30s timeout before it said so. Steps now time out after 8s.
Reading the label out of `src/lib/copy/` first is still quicker than guessing.

## What CLAUDE.md did not say

That none of the setup cost had to be paid inside the session: a cloud environment's setup
script can pay it before the session opens. Now in CLAUDE.md under Commands, beside the
Postgres line.

## Decided rather than known

- One e2e worker under `CLAUDE_CODE_REMOTE`, not "1 when there are ≤ 4 cores": GitHub's CI
  runners have 4 cores too, and run 4 workers cleanly.
- The environment's setup script is untested until a fresh session starts on "HomeApp" —
  the script ran here by hand, but never as a setup script.

## Later in the same session: the pre-push hook is the only gate

The household asked for the tests to run only here, not again on GitHub and Vercel.
`.github/workflows/test.yml` is gone, `npm run build` no longer runs the unit tests, and the
hook exports `TEST_GATE` so both suites still refuse a stray `.only` (that was CI's job).
CLAUDE.md, README and `docs/design/testing.md` say so, and that code must reach GitHub
through `git push` with the hook, never the GitHub API or web editor.

Decided rather than known: whether Vercel's Deployment Checks or a GitHub ruleset still wait
for the "Lint, types and tests" check. Neither is readable from here (the Vercel API's
project answer does not say), and README described both as optional. If either is on, it
waits for a check that will never come again and has to be removed by hand.

## And then: how many browser tests run is a judgement of risk

The household chose: `RISK=low` runs no browser tests, `medium` the 41 tagged `@smoke`
(~3 min), `high` all 344, and the pusher (Claude, in a session) decides which. The hook
reads `RISK`, treats unset as `high`, and raises any level to `high` for paths every page
stands on (`ALWAYS_HIGH`). The rubric is in CLAUDE.md under *Tests gate everything*.

Decided rather than known: which 41 tests are the smoke set, and what is in `ALWAYS_HIGH`.
Both were picked by reading test titles and past incidents, not measured against which
tests have ever caught anything — nothing records that.
