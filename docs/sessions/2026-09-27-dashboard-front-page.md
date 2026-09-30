# Make the dashboard read as a front page, with everything on one screen

- **Date** — 2026-09-27
- **Branch** — `claude/frontpage-dashboard-design-m1e3jf`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"The front page is too generic — make it look like a real dashboard with relevant info,
as much as possible on one screen without overdoing it." It turned out to mean: stop
stacking the other pages' first rows, and add a summary layer (date, week ring, three
numbers) plus the days ahead's dinners, while compacting what was already there.

## The route

Read the dashboard and its design doc → `npm run setup` → a throwaway demo-household seed
and a throwaway Playwright screenshot script → before shot → rough draft with hard-coded
English → sent both, user said "It's good" → finished it properly (both languages, the
snooze menu and the fold kept, `DinnerRow` and `WeekRing` split out) → Danish shot, one
word shortened to fit a tile → user asked for the home picture back; showed a square
beside the greeting and a slim banner, they picked the square → updated the three e2e expectations the layout moved →
CLAUDE.md and the design doc.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 2 min | |
| Reading the codebase | 5 min | the design doc says why each block is where it is |
| Building | 25 min | rough draft, then the real one |
| Tests | 15 min | e2e build + affected specs |
| Screenshots | 15 min | demo seed + screenshot script written from scratch |

## What should have been quicker

**Screenshots, again.** A demo household (two members, tasks due and overdue, lists with
ticks, a meal plan, a pantry with run-out entries) and a log-in-and-shoot script were
written from nothing for the fifth session running. Neither was committed, per the rule.
This is now the most repeated cost in `docs/sessions/`: a `scripts/demo-seed.mjs` plus a
`scripts/screenshot.mjs <path>` would pay for itself on the next UI change.

Second: `pkill -f "next dev"` run from the Bash tool kills the tool's own shell, because
the pattern is in its own command line — lost a command twice. Now noted in CLAUDE.md.

## What CLAUDE.md did not say

The pkill trap above (added under Commands). The dashboard section now describes the new
layout.

## Decided rather than known

- The home's picture is a 64px square beside the greeting (the user picked it over a slim
  banner after seeing both; dropping it entirely was the first draft and they wanted it back).
- The three tiles are due-for-you, to-buy (open items across all lists) and run-out
  pantry entries. Streak stays as a line under the greeting, not a tile.
- The meal strip starts tomorrow and is hidden when nothing in the next six days is planned.
- The snooze menu sits beside Done on the row (small icon vs. a labelled button), rather
  than in the card's corner, since a task is now one row.
- Danish tile copy: "til dig", "at købe", "brugt op", "i forrådet".
