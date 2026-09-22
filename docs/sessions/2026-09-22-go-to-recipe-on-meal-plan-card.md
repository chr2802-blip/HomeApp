# Add a "Go to recipe" button to the meal plan sheet when a recipe is chosen

- **Date** — 2026-09-22
- **Branch** — `claude/meal-plan-recipe-button-nalicc`
- **PR** — not yet
- **Reached production** — not yet

## The idea

"Add a go to recipe button on the meal plan card when something is selected." The card in
question is the day's sheet on `/meals` (`MealWeek`), and "something is selected" turned out
to mean specifically a recipe — not "eating out", not leftovers, not nothing — since only a
recipe has a page of its own to go to.

## The route

Read `meal-week.tsx` and `meal-picker.tsx` to find where the day's choice lives (`choice`
state, submitted through `PLAN_FIELD`), then `lib/meals.ts` to see how its four possible
shapes are told apart: `PLAN_NOTHING`, `PLAN_OUT`, a `leftovers:`-prefixed pointer, or a bare
recipe id. `leftoversDay` already existed for telling the third apart, so the new button's
condition is one expression built from constants already there rather than a new one.

Added a `ButtonLink` (`variant="info"`, the "way back" colour the codebase already uses for
navigation-away controls) inside `ModalFooter`, shown only when `choice` is none of the
non-recipe values. Wrote one new e2e test for it and added two assertions to existing tests
(eating-out hides it, leftovers hides it) rather than a whole second suite, since the
picker's four states already had tests exercising each one.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | reading `meal-week.tsx`, `meal-picker.tsx`, `lib/meals.ts` |
| Reading the codebase | small | `ui.tsx` for `ButtonLink` and its variants |
| Building | small | one derived value, one conditional `ButtonLink` |
| Tests | most of it | one new e2e test, two assertions added to existing ones, then a full `npm run verify` |
| Review, CI, deploy | — | not yet pushed |

## What should have been quicker

Nothing here cost more than expected — the four-state shape of a day's plan was already
named and exported from `lib/meals.ts`, so there was no guessing to do about what counted as
"a recipe is selected."

## What CLAUDE.md did not say

Nothing new. The `info` variant's own comment in `ui.tsx` ("a way back rather than a way to
undo something") already named this exact kind of control.

## Decided rather than known

The button shows the currently-picked `choice`, not only what is already saved — so opening
a day, changing the radio, and pressing "Go to recipe" before pressing Save goes to the
newly-picked recipe without saving the day first. Nothing else in the sheet warns about
navigating away with an unsaved pick (Cancel does the same), so this follows that existing
behaviour rather than introducing a save-before-leave guard nothing else here has.
