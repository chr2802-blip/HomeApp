# A home has a language (PR 2, part 2: the recipes area)

- **Date** — 2026-09-22
- **Branch** — `claude/home-language-recipe-translation-d00qa8`
- **PR** — not yet opened
- **Reached production** — not yet (PR 2 part 1 — shared dialogs, lists, tasks — reached
  production as #105)

## The idea

Continuing PR 2's area-by-area conversion, picking up where the previous session's PR
(#105, merged) left off: the recipes area, which the original plan flagged as the largest
single area (`cook-mode.tsx` alone, ~22 strings) and the one with the most server/client
boundary traps, since almost every recipe component is shared between a card's own menu, a
standalone page and a dialog.

## The route

Read every file in the area first (five pages, six components, two action files) before
writing a line of the catalogue, so the ~140-entry addition to `RECIPES` could be written
in one pass rather than discovered piecemeal. Converted in dependency order: the catalogue,
then `recipe-fields.tsx`/`recipe-form.tsx` (the shared form both the dialog and the
standalone pages build on), then the five pages, then `cook-mode.tsx`, then the two action
files, then `recipe-categories-admin.tsx` on `/settings`.

`timeLabel` in `src/lib/recipes.ts` needed the same dual-use-lib treatment as `repeatLabel`
did for tasks — it was hard-coding "min"/"hr" and is called from both a server page and a
client component, so it gained a required `language` parameter and moved its two English
strings into the catalogue.

Two real defects surfaced, both caught before push rather than by it, having read the
session note from the previous PR about the same trap:

1. **The same server/client boundary bug as `AmountsField`, twice over.** `RecipeFields`
   (via its private `CategoryField`) and `AmountsField`'s sibling `RECIPE_SAVE_OVERLAY`
   are both rendered as children passed down from a server page's `ItemMenu` — exactly the
   shape that broke `AmountsField` last session. Caught by reading each call site before
   converting rather than after, both fixed the same way: `RecipeFields` takes `language`
   as a prop, and `RECIPE_SAVE_OVERLAY` (a plain object, not a component, so it could not
   take a prop) became `recipeSaveOverlay(language)`, a function each of its four call
   sites calls with whichever language it has to hand.
2. **A genuine multi-word coincidence between English and Danish**, not a bug pasted into
   the Danish slot: `"{min} min"`, `"{min} min+"` and `"Start {time}"` all failed
   `language.test.ts`'s "not identical between languages" check, because "min" and "Start"
   are the same word in both — and the heuristic counted the `{slot}` itself as a second
   "word", so a phrase that is really one content word plus a number read as multi-word.
   Fixed the heuristic to strip `{slots}` before counting, which is a structural
   generalisation of "single words are exempt" rather than a per-phrase allow-list — the
   one thing the test's own docstring says not to do. The one case that survived even after
   that fix (`"Under {min} min"`, where **two** real words coincide) got a genuinely
   different Danish phrasing ("Op til {min} min") rather than an exemption.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | none | User reported seeing English after switching to Danish — expected, since only three of ~nine areas were converted; explained the remaining scope and continued with the next area per the existing plan. |
| Reading the codebase | medium | All eleven recipe-area files read up front, specifically to find every place a component crosses the server/client boundary before converting anything — worth it, since it caught both `RecipeFields` and `RECIPE_SAVE_OVERLAY` before they broke a build. |
| Building | large | ~140 catalogue entries, eleven files converted, `timeLabel`'s signature change threaded through its three call sites. |
| Tests | medium | The `language.test.ts` heuristic fix, one `timeLabel` test rewritten for the new signature, `e2e/language.spec.ts` extended for the now-Danish recipe-create flow and the recipe page. |
| Review, CI, deploy | small | Caught both defects locally before any push this time — the previous session's note about the `AmountsField` trap paid for itself immediately. |

## What should have been quicker

**Nothing new — the previous session's fix paid off.** Reading `CLAUDE.md`'s new paragraph
on the server/client boundary trap before writing `RecipeFields` meant checking every call
site's context (server page vs. client component) as each file was read, rather than
discovering the break at the pre-push hook's e2e run the way `AmountsField` did last time.
That is the note-writing process working as intended: the cost was paid once and the next
five components that could have hit the same wall did not.

## What CLAUDE.md did not say

The `language.test.ts` heuristic's word count did not account for `{slots}`, which meant a
phrase built from one content word and one number-shaped slot (`"{min} min"`) read as
"multi-word" and tripped the "not identical between languages" check for entirely
legitimate reasons — Danish and English share a fair number of short technical words and
unit abbreviations. Written into `CLAUDE.md` in this commit, directly under the existing
description of that test: the fix is to strip slots before counting (a structural change to
what "word" means to the heuristic), and a phrase that still coincides after that is a sign
to reword the Danish, not to add an exemption.

## Decided rather than known

- **`recipeSaveOverlay` is a function rather than a second constant beside
  `RECIPE_SAVE_OVERLAY`.** The four call sites already each have a `language` value in
  scope (three from `sayIn`/`useLanguage()`, one from `user.homeLanguage`), so computing
  the `{title, detail}` pair at each call site costs nothing extra and keeps one function
  as the single source of that wording, the same shape `repeatLabel` and `timeLabel`
  already use.
- **`recipe-categories-admin.tsx`'s own heading on `/settings` was converted along with
  it**, even though `/settings` as a whole is not part of this PR — leaving the section's
  content in Danish under an English "Recipe categories" heading would have read as
  half-finished rather than mid-migration. The rest of `/settings` (the Home card's own
  fields aside, already done in PR 1) stays English until the profile/homes/settings area's
  own PR.
