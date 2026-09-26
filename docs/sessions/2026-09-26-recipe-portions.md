# Portions on a recipe, scaled on its page and at the hob

- **Date** — 2026-09-26
- **Branch** — `claude/recipe-portion-scaling-s5l5hv`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

Creating or importing a recipe asks how many portions it is. The recipe page lets the
household turn that up or down and the ingredient amounts follow, and action mode cooks
the amounts that were on screen when "Start cooking" was pressed.

## The route

Read the schema, the recipe page, the cook page and `CookMode`, the form and the action,
the importer's two stages and the cook session. Added `Recipe.servings`, a required form
field that the action nonetheless accepts blank, `scaleIngredient` beside
`renderIngredient`, a small client context on the recipe page (stepper, list, cook link),
and `?portions=` into action mode, out of it and through the resume path. The importer
passes `recipeYield` on as a `SERVINGS` block and the reader answers `servings`.
`npm run verify` went green apart from one assertion in the new e2e test (an exact text
match against a row that also holds its "·"), fixed and re-run alone.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | moderate | the importer's split, and where the cook page gets its lines |
| Building | moderate | |
| Tests | moderate | the full verify with e2e is about five minutes |
| Review, CI, deploy | — | |

## What should have been quicker

Deciding whether "must ask" could be a server-side requirement meant counting how many
tests and seeds create a recipe without it (about a dozen files, a hundred-odd calls).
That count is what made the form-required, action-optional split the answer; nothing
said up front that the recipe factories are that widely shared.

## What CLAUDE.md did not say

That the e2e specs saving a recipe through the form are spread over nine files
(`recipes`, `photos`, `pantry`, `recipe-ingredients`, `validation`, `dialogs`, `language`,
`ai-wait`, `cook-mode`), so a new required field on the recipe form touches all of them.
Now in CLAUDE.md under the portions section, by implication: the field is required only
in the form.

## Decided rather than known

- Portions required in the form but optional in the action, so older recipes still save
  and show unscaled rather than being forced through an edit.
- Scaled amounts of ten or more are rounded to whole numbers (no "333,33 g"); below ten,
  two decimals and then the usual fractions.
- The instructions' own amounts are not scaled.
- The chosen portions are not remembered per recipe; they live in the address only.
