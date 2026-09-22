# Add a "Go to recipe" button to the meal plan card

- **Date** — 2026-09-22
- **Branch** — `claude/meal-plan-recipe-button-nalicc`
- **PR** — not yet
- **Reached production** — not yet

## The idea

"Add a go to recipe button on the meal plan card when something is selected." The first
reading put it in the day's *sheet* (`MealWeek`'s `Modal`), reasoning that "selected" meant
the picker's live radio choice. The user corrected that: the button belongs on the day's
*row* on `/meals` itself — the card, not the dialog opened from it — and "selected" means
the day already has a recipe planned, read from its saved state rather than from whatever is
mid-pick in a sheet that might not even be open.

## The route

First pass: read `meal-week.tsx` and `meal-picker.tsx` for where the day's choice lives
(`choice` state, submitted through `PLAN_FIELD`), then `lib/meals.ts` for how its four
possible shapes are told apart — `PLAN_NOTHING`, `PLAN_OUT`, a `leftovers:`-prefixed
pointer, or a bare recipe id — and put a `ButtonLink` in the sheet's `ModalFooter`,
conditioned on the live `choice`.

Corrected pass, once told the placement was wrong: same four-state test, but read off each
row's already-saved `entry.selected` instead of the sheet's `choice`, and drawn on the card
row rather than in the footer. The row is one big `<button>` that opens the sheet
(`onClick={() => openAt(index)}`), and a button cannot hold a link — `task-card.tsx` already
carries the answer to that exact problem (its own comment: "beside the card's own button
rather than inside it: a button cannot hold another"), so the row became a flex wrapping the
existing button and a sibling `ButtonLink`, the same shape `TaskCard` uses for its row button
and `ContextMenu` trigger.

Tests moved with it: the e2e test that checked the link inside the open sheet was rewritten
to check it on the row, closed or open, and a `dayRow` locator (`day(...).locator("xpath=..")`)
was added so a `getByRole("link", { name: "Go to recipe" })` could be scoped to one day
without also catching a sibling day's own link — the leftovers test plans Monday with a real
recipe before testing Tuesday, so an unscoped page-wide query for that link was already
wrong the moment the first assertion started passing for the wrong reason.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small first pass, one correction | "the card" was read as the sheet until told otherwise |
| Reading the codebase | small | `ui.tsx` for `ButtonLink`, `task-card.tsx` for the sibling-not-nested pattern |
| Building | small, done twice | the second pass is a smaller diff than the first — less state, no dialog wiring |
| Tests | most of it | one e2e test rewritten, a scoping locator added, two `npm run verify` runs |
| Review, CI, deploy | — | not yet pushed |

## What should have been quicker

**"The meal plan card" was ambiguous between the row and the sheet it opens, and the first
guess picked the wrong one.** The row is what `MealWeek`'s own JSX calls `Card`; the sheet is
a `Modal`. A `Card` component existing right there, named exactly what the request said,
was a stronger signal than "something is selected" reading naturally as the picker's live
radio state — worth checking against the component names before writing code next time
wording like this arrives.

## What CLAUDE.md did not say

Nothing new to add: `task-card.tsx`'s own comment already states the sibling-not-nested
rule this reused, so there was nothing to look up twice.

## Decided rather than known

The button reads a day's saved `selected` value, not any per-render sheet state, so it shows
correctly whether or not that day's sheet has ever been opened — including for a day already
in the past, where the row itself is disabled but the recipe once cooked is still one press
away. Nothing asked for that explicitly; it follows from the row being the source of truth
once the button moved there.
