# Today's sleep bar stops where the day has got to

- **Date** — 2026-11-27
- **Branch** — `ccr-69db16ce-efsilu`
- **PR** — not yet
- **Reached production** — not yet

## The idea

"Søvn og vågen pr. dag" drew today's bar at full height, as a share of the hours so far.
Days that are over should fill the column; today should reach only as far as the day has gone.

## The route

Found the chart via the copy string, saw the bar was normalised to its own total, scaled it
to `max(total, 24)` instead (the median still fills, being a whole day). One screenshot.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | |
| Reading the codebase | 3 min | copy string → component in two greps |
| Building | 2 min | |
| Tests | 2 min | existing unit tests unchanged |
| Review, CI, deploy | — | push only |

## What should have been quicker

`npm run setup` had to start the stopped Postgres cluster before the screenshot could be
taken — a couple of minutes on a session whose change took two.

## What CLAUDE.md did not say

Nothing missing for this one.

## Decided rather than known

The median bar keeps filling its column (its parts are medians, so their sum is not
exactly 24; it is drawn as a whole typical day).
