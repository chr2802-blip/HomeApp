# Recipe page: portions, rating and "Add to list" as icons opening sheets

- **Date** — 2026-09-26
- **Branch** — `claude/recipe-details-layout-vrm9hk`
- **PR** — not opened
- **Reached production** — not yet

## The idea

The recipe page felt crowded. The rating card, the portion stepper and the "Add to list"
button become three icons where "Add to list" was (the ingredients card's header), and
each one opens a sheet.

## The route

Read the page and the three components → added `SheetButton` (icon pill + `Modal`) →
`PortionsButton` and `RecipeRatingButton` wrap the existing stepper and hearts; `AddToListMenu`
got a `sheet` prop so the pantry and the meal plan keep their menu → updated five e2e
specs. One loop: `npx prettier --write` on the touched files rewrapped every e2e spec, so
everything was reverted and the edits reapplied.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | |
| Building | medium | |
| Tests | medium | `pantry.spec.ts`'s `addToList` drives both the pantry's menu and a recipe's sheet |
| Review, CI, deploy | — | |

## What should have been quicker

Running Prettier: the repo has no config for it, and it rewrapped ~30 files. Cost a
revert and a reapply of every edit.

## What CLAUDE.md did not say

That Prettier is not the formatter here. Added under *Working style*. Also added a line
under the rating section saying where the hearts now live.

## Decided rather than known

- The icons: people (portions, with the count), heart (rating, filled once rated, with the
  average), trolley (add to list). The count and average are shown beside the icons
  because they are what the amounts and the recipe's standing mean at a glance.
- The rating icon sits by the title, beside keep-screen-on (asked for mid-session: the
  rating is about the recipe, not the ingredients); portions and "Add to list" stay in
  the ingredients' heading, only where there are ingredients, as before.
- The sheets use the existing `Modal`, so on a phone they are full-screen like every other
  sheet in the app.
