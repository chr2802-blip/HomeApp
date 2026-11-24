# Carry on a finished breast feed

- **Date** — 2026-11-24
- **Branch** — `claude/optimistic-bohr-57ueci`
- **PR** — not yet
- **Reached production** — not yet

## The idea

"Save the times, e.g. a breast feed, and then start it again." Read as: a feed finished
with "Done · save" can be carried on as the same feed, timer picking up from its stored
sides, rather than starting a new one.

## The route

Read the baby action, lib and log component → `resumableFeed` in `src/lib/baby.ts`,
`resumeFeed` action, a "Carry on" card in the feed sheet → demo seed row for a feed finished
ten minutes ago → two screenshots sent → open questions back to the user (window length,
start immediately or paused, sleep too). Committed as a first rough version; tests not
written yet, pending the answers.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | one ambiguous sentence; interpreted, then asked with a screenshot |
| Reading the codebase | small | baby code is three files and well commented |
| Building | small | |
| Tests | none yet | waiting on the user's answers |
| Review, CI, deploy | — | |

## What should have been quicker

Nothing was done twice. The only wait was the cold `npm run setup` (npm ci) at session
start, run in the background while reading.

## What CLAUDE.md did not say

Nothing new: `--press` being repeatable got the "after" shot without a throwaway script.

## Decided rather than known

- A feed can be carried on for `RESUME_FEED_WITHIN_MS` = 60 minutes after it was finished.
- Carrying on leaves the timer paused; the next press on a side starts it.
- Sleep cannot be carried on (yet) — merging two sleeps would count the waking gap as sleep.
