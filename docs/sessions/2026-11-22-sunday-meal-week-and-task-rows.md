# Sunday meal week, excluded recipes out of the picker, no task dots, no blue ring, 8s import

- **Date** — 2026-11-22
- **Branch** — `ccr-ba18feb1-i6g5oe`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

Five small asks in one message: a recipe filed only under "skip at dinner suggestions"
headings is never offered by the meal plan's picker; the meal plan's week starts on
Sunday; the blue border on press goes; the import loader is paced to 8s; the task rows
lose their three dots and "Snooze to tomorrow" moves to the task's own page.

## The route

Setup (`npm run setup`) ran in the background while reading. The "blue border" was
`LinkCue`'s accent ring (OCEAN is blue) — removed, plus `:focus:not(:focus-visible)` for
the browser's outline. The Sunday week is a second pair of helpers (`mealWeekStartOn`,
`mealWeekStartInZone`) rather than changing `weekStartInZone`, which keys `ClearedWeek`
and the streak. The exclusion rule flipped from "any heading" to "every heading", as asked,
and moved into one helper (`isSuggestible` / `SUGGESTIBLE`). Two e2e failures were the
meals spec's `weekDays(FUTURE_WEEK)[0]` now being a Sunday, and the animation spec waiting
on the task row's menu for hydration.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | "blue border" took a look at what draws an accent ring |
| Reading the codebase | moderate | the week helpers are shared by four features |
| Building | small | |
| Tests | moderate | e2e specs named days by position in the week |
| Review, CI, deploy | — | |

## What should have been quicker

The e2e meals spec destructures `weekDays(FUTURE_WEEK)` as `[monday, tuesday]`, so moving
the week's first day broke tests by name rather than by logic — a run of the browser suite
was the only way to find them.

## What CLAUDE.md did not say

That the meal plan's week is a different week from the household's; it now does (meals
section). The rule that every stored thing has three dots now names the task row as the
exception.
