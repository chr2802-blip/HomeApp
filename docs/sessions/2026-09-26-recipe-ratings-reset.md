# Home admins can reset a recipe's ratings

- **Date** — 2026-09-26
- **Branch** — `claude/recipe-ratings-reset-6iz8hy`
- **PR** — not opened
- **Reached production** — not yet

## The idea

A home admin must be able to reset the ratings on a recipe from the ratings drawer. Read as:
delete every `RecipeRating` row for that recipe, everybody's, so the average starts again.

## The route

Read the rating component, action and page, the access helpers, and how existing confirms
(`ConfirmButton`, `ConfirmDialog`) work. Added `resetRecipeRatings` (gated with
`assertHomeAdmin` on the recipe's home), a two-step inline confirm in the rating sheet shown
only to `canAdministerCurrentHome` and only when there is a rating to clear, copy in both
languages, integration tests (admin clears, member and cross-home admin refused) and an e2e.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | the rating section of CLAUDE.md pointed straight at the files |
| Building | small | |
| Tests | most | `npm run setup` on a cold container, then `verify` |
| Review, CI, deploy | — | |

## What should have been quicker

Deciding how to confirm inside a sheet: `ConfirmButton` opens a second `Modal`, and whether
two stacked modals behave had to be read out of `modal.tsx` (each pushes a history entry and
listens to `popstate`, so back closes both). Nothing said so.

## What CLAUDE.md did not say

That stacking a `ConfirmButton` inside a `SheetButton` drawer closes both on one back press.
Written into the rating section of CLAUDE.md alongside the reset.

## Decided rather than known

- A reset clears everybody's ratings, not just the admin's own.
- The confirm is inline in the drawer rather than a stacked sheet.
- The button is hidden, not disabled, when there is nothing to reset.
