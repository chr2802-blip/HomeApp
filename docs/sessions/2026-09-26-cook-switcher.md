# Switching between recipes inside action mode

- **Date** — 2026-09-26
- **Branch** — `claude/recipe-switching-timer-ux-v1gotc-switcher`
- **PR** — second of two, stacked on the kitchen-timers PR
- **Reached production** — not yet

## The idea

With the timers now belonging to the kitchen (the PR below this one), make cooking two
recipes pleasant: tabs for the recipes on the stove, a "+" to put another one on, and a
timer from another recipe that goes to the step it is for.

## The route

`CookPicker` (a screen sheet: search, then still cooking / tonight's plan / all
recipes), tabs under the cook header, `turnCook` in `cook-session.ts`, and Complete
moving on to what is still on the stove. The cook page now also reads every recipe's
title and today's `MealPlan` row. One e2e round: back after picking landed on the first
recipe rather than leaving cooking, because `Modal` pushes a history entry it never pops
and the switch replaced that one. Left as the sheet's documented cost rather than popping
history by hand, and the comment says so.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | designed with the first PR |
| Reading the codebase | small | `Modal`, how `tonightsDinner` reads today's row |
| Building | moderate | |
| Tests | moderate | the back-gesture round |
| Review, CI, deploy | | |

## What should have been quicker

Knowing up front that any sheet costs one history entry — it is in `Modal`'s comment and
`ui-patterns.md`, but not where a navigation *from inside* a sheet is designed. Found by a
failing assertion instead.

## What CLAUDE.md did not say

Nothing new beyond the sheet's history entry, which it does say (under *Sheets*); the
action mode section now has a bullet for the tabs and the picker.

## Decided rather than known

- Completing one recipe goes to the next one still on the stove rather than out.
- A tab's cross takes the recipe off the stove but, as with Complete, leaves its timers.
- The picker lists every recipe in the home, unpaged — a household's recipes are dozens.
