# Remove keep-screen-on from the recipe page

- **Date** — 2026-09-26
- **Branch** — `claude/remove-ingredient-always-on-hraw8i`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"Remove always on feature on ingredient details" — the `ScreenAwakeToggle` button by the
recipe's title. Action mode already holds a wake lock for as long as it is open.

## The route

One grep for the component found every reference; removed the component, its call site and
its `APP.keepScreenOn` copy, kept `useWakeLock` (action mode uses it), updated CLAUDE.md and
`docs/design/recipes.md` where they named the toggle.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | "always on" → the wake-lock toggle |
| Reading the codebase | 2 min | |
| Building | 2 min | |
| Tests | 3 min | `npm run setup`, then tsc, eslint, unit suite — green |
| Review, CI, deploy | | |

## What should have been quicker

Nothing in the code; the cost was the cold checkout — `npm run setup` has to run before any
check can.

## What CLAUDE.md did not say

Nothing missing for this change.

## Decided rather than known

That "always on" meant the screen wake lock and not something else on the ingredients.
