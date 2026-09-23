# One ingredient format for every recipe

- **Date** — 2026-09-23
- **Branch** — `claude/recipe-ingredient-normalization-tsi5pe`
- **PR** — #123
- **Reached production** — not yet

## The idea

"Start over" with ingredient normalisation: every stored recipe (hand-typed, link or reel)
should have lines that are only amount, unit and ingredient, with everything else moved into
the steps by the AI. It turned out to mean moving the gate from the importer to the save,
because hand-typed recipes never went through any reader of their lines.

## The route

Read the importer, `shoppingText` and `prepareCookSteps`. Then interviewed the household
in four rounds of scenarios (manual saves, existing recipes, to-taste, states, product
words, sizes, ranges, alternatives, components, combined lines, counts, units, optional
items, reader down, translation). Built `src/lib/ingredient-line.ts` as the one description
of a line, pointed both model calls at it, and made every save go through
`prepareCookSteps`, which now returns ingredients as well as steps. Tests, stub, CLAUDE.md and
`docs/design/recipes.md` were updated in the same change.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | a third | the interview; most answers reversed a documented rule |
| Reading the codebase | small | CLAUDE.md pointed at every file involved |
| Building | a third | the index renumbering in `readAnswer` was the only subtle part |
| Tests | a third | the e2e stub had to echo ingredients now, without mangling typed lines |
| Review, CI, deploy | — | |

## What should have been quicker

Several of the household's answers overturned rules CLAUDE.md states as absolute
("`cook-steps.ts` is never given a language and must never translate", "never rewrites an
ingredient line", "units are never converted", "a range takes the lower number"). Each one
had to be found and rewritten in three places: CLAUDE.md, `docs/design/recipes.md` and the
code comments. No single place listed the product decisions behind the ingredient format.
`ingredientRules` is now that place: one bullet per decision, handed verbatim to both model
calls.

## What CLAUDE.md did not say

That the ingredient format was really three formats depending on the way in. It now has a
section, *Every ingredient line is an amount, a unit and the thing bought*.

## Decided rather than known

- Every save re-read the recipe at first, including a title-only edit. The household found
  the waiting too long, so two saves now skip the call (see below).
- The importer now answers the breakdown too, carried through the form in a token signed
  with `AUTH_SECRET`. Chosen over trusting a hidden field so that a browser cannot claim
  arbitrary text is already in the format.
- The "in the format" marker is the breakdown's version (`v: 2`), not a new column.
- Merging one ingredient across components with different units (weight and volume) is
  left to the reader's conversion, the same judgement it makes for cups.
- The save's reader moved from `low` effort to `medium` with adaptive thinking (the importer
  found `low` missed preparation matches), with a 30-second timeout and 8,000 max tokens.
  Not measured against real recipes.
- The title is translated along with the rest when the save reads it.
- A recipe with ingredients but no instructions is still sent to the reader, so its lines
  are normalised; only a recipe with neither skips the model.

## Second round, same session

The household asked where the wait could be skipped, and changed one answer: the same
ingredient in two components is now **one line**, not two (the `group` field went with it).
Two skips were added: an import saved untouched stores the importer's own signed breakdown,
and an edit that leaves both blocks alone skips the reader on a recipe already in the format.
The cost behind this round: the first round did not ask how long Save was allowed to take,
and "AI rewrites on every save" was taken literally.

## Left over

`e2e/list-reorder.spec.ts` › "reordering by keyboard › survives a reload, so the order really
was saved" failed once during the full `npm run verify` (a dnd-kit live-region assertion) and
then passed 30 of 30 on its own with `--repeat-each=3`. It touches no recipe code. It is a
race that shows up under full-suite load, and it wants fixing in its own change.
