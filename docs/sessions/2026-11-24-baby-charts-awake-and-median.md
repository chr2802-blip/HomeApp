# Baby charts: awake time and a median day

- **Date** — 2026-11-24
- **Branch** — `ccr-e4a53487-rogr3k`
- **PR** — none yet
- **Reached production** — not yet

## The idea

"Timers søvn pr. dag" should show the awake hours as well, so each bar is the whole day,
and every chart should also show the median day. Median meant something different per
chart: a per-quarter-hour majority on the 24-hour lines, the n-th feed/nappy at its median
time, and plain medians for the bars.

## The route

Read `baby-charts.ts`, the charts component and the copy → `awakeHours` and `medianDay`
in the lib → the four charts drew them → screenshots of week and month in Danish → the
"Median" label truncated under the bars, fixed → sent to the user with two open questions
(the title, and medians in the summary tiles) → unit tests for awake and median.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | deciding what "the median day" means on a clock chart |
| Reading the codebase | small | the baby section in CLAUDE.md pointed straight at the files |
| Building | most | |
| Tests | small | |
| Review, CI, deploy | — | waiting on the user's answers first |

## What should have been quicker

`npm run screenshot -- … --out baby-week.png` made a *directory* called `baby-week.png`
in the checkout root. That cost one wrong read path and a clean-up before the commit.

## What CLAUDE.md did not say

That `--out` is a directory. It is now written next to the screenshot command in CLAUDE.md.

## Decided rather than known

- Today's bar counts awake time only up to now, and a day with nothing logged gets no
  awake time (it is before the log began, not a day spent awake).
- The median day is asleep in a quarter hour where more than half of the logged days were.
  It is night where most of those sleeps were.
- The median day is not drawn when fewer than two days are logged.
- The awake segment is the neutral `slate-200`, not a new baby colour.

## Second round

The user chose the title "Søvn og vågen pr. dag" and medians in place of averages in the
summary tiles (`summary.average` is now `summary.typical`). The screenshot taken while the
first push's pre-push e2e build was running came out with no styling: that build rewrites
`.next` underneath the dev server, which CLAUDE.md already warns about. Wait for the push
before taking the next screenshot.
