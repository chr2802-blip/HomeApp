# Dashboard list card press feedback, edge bar height, "N missing" wording

- **Date** — 2026-09-22
- **Branch** — `claude/list-card-frontpage-feedback-f9fbba`
- **PR** — not yet
- **Reached production** — not yet

## The idea

The dashboard's recent/favourite list cards gave no press feedback, unlike the same cards
on `/lists`; the edge progress bar on those cards read thinner than the free-standing one
on the week's task card; and a list's own page said "133 of 135 ticked off" where "2
missing" says the same thing faster. All three turned out to be exactly what they sound
like — no surprise in the ask.

## The route

Straight through: found the three spots, matched each against an existing precedent
already in the codebase (`admin/page.tsx`'s `Entry` for a whole-card link, `WeekProgress`
for the free-standing bar's height), and edited. One e2e assertion (`e2e/lists.spec.ts`)
was pinned to the old "N of M ticked off" wording and needed updating alongside it.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 5 min | Reading the three components involved |
| Reading the codebase | 10 min | Finding the `pressable` precedent and the two `edge` call sites |
| Building | 5 min | Three small edits |
| Tests | 15 min | `npm run setup` (cold container) + full `npm run verify` |
| Review, CI, deploy | — | not yet |

## What should have been quicker

Nothing notable — the precedents (`admin/page.tsx`'s card-as-link pattern, `grep`ping for
`pressable` and for `ProgressBar edge`) were fast to find because the codebase already
names its own conventions clearly.

## What CLAUDE.md did not say

Nothing new; the existing rules on `ProgressBar`'s `edge` variant and on cards living
behind `pressable` links covered this without needing to be extended.

## Decided rather than known

Bumped the `edge` progress bar's height from `h-1` to `h-1.5` (matching the free-standing
bar) globally in `ProgressBar`, rather than adding a second size prop — the only two
callers of `edge` are both list cards (dashboard and `/lists`), so there is no third
caller whose look this changes by surprise.
