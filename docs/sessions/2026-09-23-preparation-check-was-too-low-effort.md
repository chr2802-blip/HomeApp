# The preparation-into-steps rule needed more than "low" effort to actually run

- **Date** — 2026-09-23
- **Branch** — `claude/recipe-ingredient-prep-instructions-dxwxfe`
- **PR** — not yet
- **Reached production** — not yet

## The idea

Earlier today's session added a rule to `recipe-normalize.ts`'s system prompt: an
ingredient's `preparation` should end up said in the steps, either because a step already
covers it or because the model writes one that does. Merged and deployed
(`c793bb7`/`762221e`), then tested against a real import — a Danish bread recipe — and it
didn't work: "6 dl vand, lunkent" stayed on the ingredient line even though the first step
read "Bland gæren ud i **det lunkne vand**" (the same word, inflected — "lunkne" agreeing
with "vand" in its definite form, "lunkent" in its indefinite predicative form), and "2 dl
havregryn, blendet" got no step written for it at all, nothing in the instructions mentions
blending the oats.

Both failures point the same way: the rule asks the model to cross-reference every
ingredient's preparation against every step, which is a different kind of work than
splitting one line into fields, and `output_config.effort: "low"` — chosen when this file's
job was described as "tidying a caption, not inventing a dish" — wasn't giving it the room
to do that reliably.

## The route

Confirmed with the person reporting it that the recipe was imported *after* the fix
deployed, not an old stored recipe (which wouldn't be reprocessed at all — checked that
first, since it's the more common explanation and needs no prompt change). Checked the
Vercel deployment list to confirm the merged commit really was live in production before
concluding this was a prompt-following failure rather than a stale deploy.

Two changes, not one: raised `effort` from `low` to `medium` (this file's own comment
already explained why low was chosen, so it had to explain why it no longer holds), and
named the specific failure mode — inflected agreement — in the prompt bullet itself, since
"check every step" is exactly what the previous wording already said and the model still
missed a same-word match sitting one step away. Effort alone might have fixed it; naming
the failure explicitly is the part that doesn't rely on hoping more compute finds it.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | the report came with the actual bad output, which is what made the two distinct failures (redundant preparation still shown, missing preparation still missing) visible at a glance |
| Reading the codebase | small | confirming both merged PRs (#116, #118) landed the identical rule, and that the branch needed restarting from `main` since its own PR was already merged |
| Building | small | one `effort` value, one comment, one prompt bullet extended |
| Tests | small | existing `recipe-normalize.test.ts` (83 tests) still passes; still no test of the prompt's actual behaviour, which is the real gap here |
| Review, CI, deploy | — | not yet pushed |

## What should have been quicker

Two parallel sessions built the identical fix (`#116` and this session's `#118`) and both
merged, harmlessly but pointlessly — the second merge was an empty diff. Nothing here would
have caught that in advance; worth naming so a future session isn't surprised to find its
own PR merge as a no-op.

## What CLAUDE.md did not say

Nothing about `output_config.effort` and what it actually buys — the file documents the
model and the token/time limits but had no rule of thumb for when `low` stops being enough.
The answer isn't "always higher": it's that a judgement requiring the model to hold two
parts of the input against each other (every ingredient against every step) is a different
shape of task than transforming one part in isolation (splitting a line into fields), and
the second kind is where `low` effort starts missing things a careful read would not.
Worth watching whether this recurs elsewhere in this file (`isRecipe`, `needsReview` are
per-item judgements; the preparation rule and deduplication are the only two
whole-recipe cross-references) before writing it down as a general rule.

## Decided rather than known

Whether `medium` is enough, or this needed `high`, is not something a single manual test
settles — the failure could have been effort, could have been the specific inflection
gap, could have been both, and only running a batch of real imports through it would say
which lever actually mattered. If it still under-triggers, the next lever is effort again
before touching the wording further, since a second wording patch for a second unmatched
case (a synonym, a paraphrase) is the same failure this session already tried to head off
by naming the general case ("wording is not identical") rather than only the one instance
found.
