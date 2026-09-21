# Stop the importer repeating a cut the instructions already state

- **Date** — 2026-09-21
- **Branch** — `claude/normalize-ingredients-wd8czx`
- **PR** — not yet
- **Reached production** — not yet

## The idea

A recipe's ingredient list was carrying "1 stk tomat, i tern, stor" while a step further
down read "Skær tomater i tern" — the same instruction, said twice. Asked what to do about
it; it turned out `preparation` already existed as its own field for exactly this
(`recipe-normalize.ts`), the model just never checked the steps before filling it.

## The route

Read `recipe-normalize.ts` to confirm the field split was already right before proposing
anything — the fix was one rule in the system prompt, not a schema change. No back-and-forth.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | reading the ingredient/preparation split that already existed |
| Reading the codebase | small | `recipe-normalize.ts`, the existing unit tests |
| Building | small | one bullet added to `SYSTEM_PROMPT` |
| Tests | small | existing `recipe-normalize.test.ts` still passes; nothing new to assert against, since the prompt itself isn't unit-tested |
| Review, CI, deploy | — | not yet pushed |

## What should have been quicker

`npm ci` and `prisma generate` had to run before anything (lint, typecheck, `vitest`) would
work — a fresh checkout with no `node_modules`. Not specific to this change, but worth
naming since it's the first thing any session in a cold container hits.

## What CLAUDE.md did not say

Nothing new — the file already documents the ingredient line format and the comma
convention in full (`docs/design/recipes.md`); this change is a refinement inside that
existing contract, not a gap in it.

## Decided rather than known

Where exactly to draw the line between "the steps already say this, drop it" and "keep it"
is left to the model's judgement rather than a stricter rule — a prep that happens *before*
any step touches the ingredient ("stuetemperatur", "smeltet" where nothing else melts it)
still belongs in `preparation`. This can't be checked without running real imports through
it; if it turns out to under- or over-trim in practice, that's the next thing to tighten.
