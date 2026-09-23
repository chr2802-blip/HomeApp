# Rewrote the preparation rule as a numbered procedure instead of one paragraph

- **Date** — 2026-09-23
- **Branch** — `claude/recipe-ingredient-prep-instructions-dxwxfe`
- **PR** — not yet
- **Reached production** — not yet

## The idea

The preparation-into-steps rule (added, then raised to `medium` effort, both earlier
today) had grown into one dense sentence doing six things at once: check every step,
allow inflected/synonym matches, write a missing step, place it, carry its `component`,
null out `preparation` — with the state-only exception ("stuetemperatur") tacked on at
the very end, out of the order a reader would actually need it in. Asked whether the
prompt itself might be the problem rather than the effort level, and it's a fair guess:
a paragraph that reads fine to a person can still be harder for a model to fully apply
under time pressure than the same logic laid out as an explicit sequence.

## The route

Kept the content identical — nothing was added or removed, including the specific
"lunkne"/"lunkent" inflection example from the last round — and only changed the shape:
one bullet with a three-step numbered procedure (state exception first since it's the
one that ends the check early, then "already covered", then "write it yourself"),
instead of one run-on sentence. Left the rest of the prompt alone; the headers and the
other bullets weren't the thing that was reported broken.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | the person's own diagnosis ("long and overcomplicated") pointed straight at the one paragraph that actually was |
| Reading the codebase | small | already had the file open from the last two rounds |
| Building | small | one bullet restructured into a 3-step list |
| Tests | small | existing `recipe-normalize.test.ts` (83 tests) still passes |
| Review, CI, deploy | — | not yet pushed |

## What should have been quicker

Nothing new this round — the branch-restart dance (this PR's predecessor was merged, so
the branch had to come from `main` again) is now a known, quick step rather than a
surprise.

## What CLAUDE.md did not say

Nothing new to add. This is a shape change to prose already governed by the rules in
"An import is two stages" — no new invariant, no new file.

## Decided rather than known

Whether restructuring as a numbered procedure actually changes the model's reliability
here, versus the effort bump from the previous round doing all the work (or neither
being enough), is not something this session can settle — there is still no test of the
prompt's actual behaviour, only of `renderNormalized`'s handling of whatever the model
returns. The next real signal is another fresh import tried against this.
