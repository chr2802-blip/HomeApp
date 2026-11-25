# Baby charts: sleep/awake and nappies apart, full-height bars, a number per block

- **Date** — 2026-11-25
- **Branch** — `ccr-d327e11d-s73x6h`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"Søvn og vågen pr. dag" and "Bleer pr. dag" were one card; now two (`SleepTotalsChart`,
`DiaperTotalsChart`). Every sleep bar fills the whole height, awake is 24 − sleep (today
too, by the household's choice — it used to be only the hours that had passed), and every
block carries its hours; every nappy bar its count.

## The route

Read the page, the lib and the component; changed `chartDay`'s awake rule and its unit
test; split the component; screenshotted week and month; month's two-digit numbers
wrapped in 9px bars, so dense mode got 7px, nowrap; screenshotted again.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | page, lib and component were each one file |
| Building | small | |
| Tests | small | one unit expectation changed |
| Review, CI, deploy | push hook | |

## What should have been quicker

Seeing the month chart's bars at full size: `--full` makes a 4500px image that is read
scaled down, so the wrapped digits only showed after cropping it with a throwaway
Playwright page. A `--clip`/selector option on `npm run screenshot` would save that.

## What CLAUDE.md did not say

Nothing missing for this change.
