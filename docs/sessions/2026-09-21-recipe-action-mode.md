# Action mode: cooking a recipe one step at a time

- **Date** — 2026-09-21
- **Branch** — `claude/recipe-action-mode-ui-ioku0t`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

Asked for: a full-screen flow where each instruction shows with its own ingredients,
swiped between like the pages of a cookbook, and the AI checking a recipe's instructions
when it is created so they suit that reading.

What it turned out to mean: the swiping and the page turn were the small half. The feature
is a **data question** — nothing in this app knows which ingredients belong to which step,
and the two obvious ways to store that answer are both wrong. Matching words between the
two text blocks is the pattern-matching `docs/design/recipes.md` already records as the
wrong tool. Storing the steps' text alongside `Recipe.instructions` is a second answer to
"what are the steps". The design is the third way: store *positions* and no text at all.

## The route

Idea → four clarifying questions → plan → build → green. In one sitting, no review round
yet.

The loops worth naming:

- **The storage shape was decided three times before any code.** First as a `RecipeStep`
  model with text, then as text-plus-a-fingerprint-column, then as the positions-only Json
  column with a count check. Each rewrite was triggered by re-reading the same paragraph of
  `CLAUDE.md` about two answers to one question. That thinking was the work, and it was
  cheap because it happened before the migration.
- **`normalizeRecipe` was nearly extended, twice.** The first plan put per-step ingredient
  links into the importer's schema; the second added a separate linker *and* kept the
  importer's. Both would have been two prompts answering "which ingredients does this step
  use". What landed — one function on stored text, called from the save path, with the
  importer untouched — is strictly smaller than either, and it fell out of asking which
  *question* each call answers rather than which *pipeline* it sits in.
- **One wrong e2e assertion.** `toBeHidden()` on the tab bar under the cook surface. The
  nav is behind it, not hidden, and Playwright does not check occlusion. Replaced with
  `elementFromPoint` at the nav's own coordinates — which is a better test anyway, since
  stacking is exactly how this feature would silently break.
- **Two intermittent reds in the full browser suite, and only there.** Both in
  `pantry.spec.ts`, a different test each time, neither reproducible in isolation. The
  first was a genuine race in the spec (reloading while an optimistic switch's action was
  still in flight) and is fixed. Chasing the second turned up something real in this diff:
  `actions/recipes.ts` is imported by four route segments, and a static import of
  `cook-steps.ts` put the Anthropic SDK into all four of their server bundles — loaded on
  the first request to each, whether or not anything was ever read. Now imported lazily,
  inside the one function that reads. The suite ran clean afterwards, and the base commit
  had already been checked green under the same load so the comparison meant something.
- **The container's Chromium was two revisions behind the lockfile.** `CLAUDE.md` already
  describes this exactly, including the directory rename between 1194 and 1243. Following
  it took one command. Worth recording as the case where the note paid for itself.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 15% | Four questions up front; all four changed the build |
| Reading the codebase | 20% | Two parallel explorations, then the normalizer in full |
| Building | 35% | The surface is the bulk; the libs are small |
| Tests | 20% | 30 unit, 5 integration, 6 browser |
| Review, CI, deploy | 10% | Full suite four times, plus a baseline run on the base commit |

## What should have been quicker

**Deciding where the AI call goes.** It was reopened four times — extend the importer's
schema, a separate linker beside it, one linker called from both, and finally one linker
called only from the save path with the importer untouched. Each round was reasoning about
the same thing from a different angle, and the answer only arrived on asking "what
*question* is this call answering" instead of "where in the pipeline does it fit".

That question is the one `CLAUDE.md` is really asking in every "two answers to the same
question" rule, but it is stated each time as a *conclusion* about a particular pair
(a flag beside the interval, a counter beside the snooze, a fingerprint beside the key) and
never as the test to apply to a new one. A reader takes ten similar rules and still has to
derive the method. Naming the method once would have collapsed those four rounds into one.

Second: **the ingredient-line contract is stated in `renderNormalized`'s doc comment**, and
it is not only the importer's. Anything that writes or reads an ingredient line — which now
includes action mode's breakdown — has to honour the comma rule and the unit-behind-an-
amount rule. It was found by reading the importer, which a feature not touching imports had
no obvious reason to read.

## What CLAUDE.md did not say

- **How to decide whether a new thing is a second answer or a second question.** Closed in
  this PR: the new action-mode section states the test in the terms that resolved it, and
  `docs/design/recipes.md` works the `prepareCookSteps` / `normalizeRecipe` split as the
  example — different question about different text, so nothing to disagree about.
- **That the stored ingredient-line format is a contract with four readers**, not an
  importer detail. Partly closed: the new section says outright that a step's ingredients
  are the stored lines verbatim and that `prepareCookSteps` never rewrites one. The general
  statement still lives only in `docs/design/recipes.md`, and a line under the `homeDb`
  section pointing at it would probably pay for itself.
- **That a portalled surface is the only way out of the app frame**, because
  `PageTransition`'s keyframe puts a `transform` on an ancestor and that contains a fixed
  child. Closed: stated in the new section, and `e2e/cook-mode.spec.ts` asserts it with
  `elementFromPoint` rather than trusting the class list.
- **That a `"use server"` module's imports land in every segment that uses it.** An
  actions file reads like a leaf, and it is closer to a shared chunk: `actions/recipes.ts`
  is reached from four routes. `recipe-normalize.ts` already carries a note about not being
  importable from a client component, which is the adjacent rule and not this one. Not
  closed as a convention — one occurrence — but it is the second weight-of-the-SDK note in
  this area, and a third would want a line under the import section.
- **That an optimistic control's e2e helper has to wait for the write, not the paint.**
  Not closed as a convention — it is the third optimistic control in the app and the first
  to be caught doing this. If it happens again it wants a shared helper rather than a note.

## Decided rather than known

- **Save waits for the model** rather than returning and preparing in the background. A
  page that rewrites itself seconds after you saved is worse than a Save that takes a
  moment. Flagged before building and confirmed; still the thing most likely to want
  revisiting once there are real timings from a phone.
- **No fingerprint column.** The count check plus the rewrite-on-every-save invariant is
  the guard. A fingerprint would be stricter and a second thing to keep in step.
- **The breakdown is a `Json` column**, the first in this schema, rather than a text block
  with a bespoke line format. Json is validated by zod on the way in and out, and extends
  to the timer minutes without a second parser; the house style leans to text blocks, so
  this is a deliberate departure.
- **`createRecipe` and `updateRecipe` both redirect**, so neither can report that the steps
  were tidied — the plan expected a note and there is nowhere to put one. The cook lands on
  the recipe and reads the result instead. Acceptable, but it means the rewrite is
  announced by nothing.
- **Timers are in memory and do not notify.** Leaving action mode ends them.
- **Nothing here goes offline.** `public/sw.js` is untouched: a kitchen has wifi.
