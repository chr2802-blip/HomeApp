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

## Follow-up: CI red after merging main

Merging `main` twice hit `CLAUDE.md` conflicts beside the line this branch edited (#144's
rating-reset bullet, #143's kitchen timers); both kept. The browser suite then failed on two
tests this diff does not touch. `pantry.spec.ts` "checking that line in the dialog adds it
anyway" went to `/lists` straight after "Add checked", and the sheet's `popOwnEntry` cancelled
the load (`ERR_ABORTED`) — the race #147 fixed in `recipe-ingredients.spec.ts`; fixed here the
same way. `ai-wait.spec.ts` "an edit that changes nothing…" timed out with the save never
posted, only under a loaded parallel run; it passes 6/6 alone on both `main` and this branch.
Left alone.

**What should have been quicker:** a second test with #147's race was still on `main`. A
shared "close the sheet and wait for it" helper in `e2e/helpers` would have fixed both at once.
