# A loading overlay for the AI on create and update, matching import

- **Date** — 2026-09-22
- **Branch** — `claude/ai-loading-overlay-ca4bqz`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

The importer already says the AI is working while it reads a page (#91). Saving a recipe
spends the same kind of model call — `withCookSteps` in `app/actions/recipes.ts` writes
`cookSteps` from the instructions on every create and on an update that changed them, up
to `PREPARE_TIMEOUT_MS` (20s) — but every place that submits a recipe only ever showed
"Saving…" on the button. Asked to make the AI's part of that wait as visible as the
importer's.

## The route

Read `recipe-import-field.tsx` first to see what "clear" already looks like here, then
found every place a recipe save can run long: `RecipeForm` (the standalone new/edit
pages), `NewRecipeDialog`'s form step, and — the one that was easy to miss — the "Edit"
sheet behind the three-dot menu on both `recipes/[id]/page.tsx` and
`recipe-directory.tsx`, both wired through the generic `ItemMenu` → `DialogForm`. Four
call sites, one action each (`createRecipe` / `updateRecipe`), so the fix was a small
`AiOverlay` component plus one optional prop threaded through `DialogForm` and `ItemMenu`
(`overlay` / `editOverlay`) rather than four bespoke banners — `DialogForm` is shared by
every other entity's edit sheet too, so the prop had to be opt-in and unused everywhere
that isn't a recipe.

One wording lives in `recipe-fields.tsx` as `RECIPE_SAVE_OVERLAY`, read by all four sites,
for the reason CLAUDE.md gives for `homeDb` and `FINISHED`/`UNFINISHED`: four places
independently phrasing "why is Save slow" would eventually disagree, and the one that
disagreed quietly would be the one nobody noticed drift.

Verified with `npm run lint`, `tsc --noEmit`, the full `vitest` suite, `npm run build`,
and the full `npm run e2e` (266 tests, none of them touching the overlay text so none
broke). Also drove two throwaway Playwright scripts by hand — one against `/recipes/new`,
one against the Edit sheet — routing POSTs through an artificial 3s delay to actually see
the overlay render and get clipped to the sheet's rounded corners correctly, then deleted
both; neither is checked in.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 15 min | Reading `recipe-import-field.tsx`, then `grep`ping every `createRecipe`/`updateRecipe` call site to find all four |
| Building | 20 min | `AiOverlay`, the `overlay`/`editOverlay` prop, four call sites |
| Tests | 15 min | `npm run verify` end to end, plus the two hand-written screenshot checks |
| Review, CI, deploy | — | Not yet pushed |

## What should have been quicker

Finding all four call sites cost the most time, and would have been one `grep` instead of
several if a rule like *"home-scoped data goes through `homeDb`"* existed for "every place
that can run an AI-backed save" — there is no single seam like `homeDb` for that, because
the four sites share an action but not a component. Worth a line in CLAUDE.md the next
time an AI-backed action grows a fifth caller: **`createRecipe` and `updateRecipe` are
called from four places** (`RecipeForm`, `NewRecipeDialog`, and `ItemMenu` on both
`recipes/[id]/page.tsx` and `recipe-directory.tsx`) **and a change to how either is
presented has to touch all four or it will visibly disagree with itself.**

## What CLAUDE.md did not say

The line above — added to this file rather than CLAUDE.md itself, since it is one
sentence of trivia rather than a rule anyone would get wrong twice.

## Decided rather than known

The overlay's wording hedges with "if there are instructions" rather than asserting the
AI is always running, because `withCookSteps` skips the model entirely for a recipe with
none, and an update also skips it when neither `ingredients` nor `instructions` changed.
Reproducing that exact condition client-side would mean re-deriving `updateRecipe`'s
`rewrite` check in a second place — precisely the kind of two-answers-to-one-question this
codebase avoids — so the overlay just always shows while the save is pending, worded so it
is never wrong, and flashes briefly on the saves it does not apply to.
