# Import writes a preparation into the steps when the source never did

- **Date** — 2026-09-23
- **Branch** — `claude/recipe-ingredient-prep-instructions-dxwxfe`
- **PR** — not yet
- **Reached production** — not yet

## The idea

The prompt already dropped `preparation` from an ingredient line once a step said the same
thing ("2 kartofler, i tern" beside a step reading "Skær kartoflerne i tern" needs the cut
once, from a session on 2026-09-21). What it never did was the other direction: a source
that only ever wrote "kartofler, skåret i tern" and no step for it kept the cut sitting on
the ingredient line forever, because nothing told the model to write the missing step
itself. Asked to close that gap, so a preparation always ends up said in the steps —
existing or newly written — never left as ingredient-only text.

## The route

Read `recipe-normalize.ts`'s existing bullet and the session note that added it before
touching anything, since the fix is a continuation of that rule rather than a new one. One
bullet extended in the system prompt: if no step already covers a preparation, write one
(placed where the cut would actually happen, tagged with the ingredient's own `component`),
then treat it exactly as the existing rule treats a preparation a step already covers —
drop it from `preparation`. No schema change; `Step` already carries `component`.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | confirming it was the mirror image of the 09-21 rule |
| Reading the codebase | small | the existing bullet, its session note, `tests/unit/recipe-normalize.test.ts` |
| Building | small | one bullet extended in the system prompt |
| Tests | small | existing `recipe-normalize.test.ts` (83 tests) still passes; the prompt itself has no test of its own, same as last time |
| Review, CI, deploy | — | not yet pushed |

## What should have been quicker

Nothing new — `npm run setup` on a cold container was the only real cost, and CLAUDE.md
already names that as the expected first step.

## What CLAUDE.md did not say

Nothing new to add: the ingredient/preparation split and its trim rule were already
documented by the 09-21 session note; this closes the other half of the same rule rather
than discovering an undocumented one.

## Decided rather than known

Where exactly the synthesised step belongs in the order, and which existing step (if any)
it should be folded into versus standing alone, is left to the model's judgement — "placed
where the recipe would actually make that cut, generally just before the ingredient is
first used" is a description, not an algorithm. This can only really be judged by running
real imports through it; if it turns out to place steps oddly in practice, that is the next
thing to tighten.
