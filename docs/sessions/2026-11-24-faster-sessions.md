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
