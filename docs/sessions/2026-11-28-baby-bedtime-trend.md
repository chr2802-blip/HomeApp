# Baby: median bedtime and waking over time

- **Date** — 2026-11-28
- **Branch** — `ccr-434b6fba-0v1t2h`
- **PR** — not yet (waiting on the first screenshot's feedback)
- **Reached production** — not yet

## The idea

"A chart of the median time awake in the morning and asleep at night, as a development
over time." Read as: per night, bedtime (first night sleep's start) and waking (last
night sleep's end), with a running 7-night median line, on the charts tab's week/month.

## The route

Read `baby-charts.ts`, the charts panel and `baby-charts.tsx` → wrote `nightOf` /
`sleepTimesTrend` / `clockOf` with unit tests → an SVG card in `baby-charts.tsx` →
`npm run db:demo` + screenshot (month, `da`) sent for feedback. No loops.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | "Night" had to be defined: grouped noon→noon |
| Reading the codebase | small | The baby charts are three files and well commented |
| Building | most | |
| Tests | small | |
| Review, CI, deploy | — | Not yet |

## What should have been quicker

The first screenshot timed out on `networkidle` because the dev server was still compiling
`/baby` for the first time; a second run worked. A cold dev page costs one wasted run.

## What CLAUDE.md did not say

That the first `npm run screenshot` against a freshly started dev server can time out while
the page compiles — added to the screenshot paragraph in CLAUDE.md.

## Decided rather than known

- A night is every night sleep starting between noon and the next noon; bedtime is its
  first start, waking its last end (none while still asleep).
- The trend window is 7 nights (`TREND_NIGHTS`); later times are drawn lower.
- The card is not drawn in the Day period.
