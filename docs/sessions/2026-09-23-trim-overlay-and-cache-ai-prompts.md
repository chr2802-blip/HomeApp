# Trim the import overlay's stage lines, then cache both readers' system prompts

- **Date** — 2026-09-23
- **Branch** — `claude/loader-time-estimation-x4klpq`
- **PR** — not yet
- **Reached production** — not yet

## The idea

Three asks in sequence: explain what the loader's per-step time estimation is for, explain
every place the app calls the model so the user could judge what to cut, then act on two of
those findings — trim `AiOverlay`'s decorative stage list, and add prompt caching to the two
model calls for real latency/cost, not just perceived speed. What was asked for and what got
built match at each step; nothing here was a misread of the request.

## The route

Straight through, no loops. Read `ai-overlay.tsx`, `recipe-normalize.ts`, `cook-steps.ts` and
the copy/overlay call sites to confirm there are exactly two model calls and that the stage
list is cosmetic; explained both in chat. Trimmed `recipeImportOverlay` from six stage lines
to four. Added `cache_control: { type: "ephemeral" }` to the system prompt block in both
`normalizeRecipe` and `prepareCookSteps` — the prompt is identical for every household on a
given language, so a cache write from one home's call is a cache read for the next, home or
not. That changed `system` from a bare string to a one-element content-block array, which
broke a unit test asserting `system` was a string (`ai-readers.test.ts`); fixed the test to
read `.text` off the array instead.

The push itself was the long pole: three consecutive full `npm run verify` runs (the trim,
then twice more for the caching change) each dropped exactly one unrelated e2e test —
`animation.spec.ts`'s sheet-close check, then `pantry.spec.ts`'s list-link click, then
`validation.spec.ts`'s blank-name toast — never the same one twice, never anything either
diff touched. Each was re-run alone and passed in a few seconds, confirming contention under
the full suite's parallel workers rather than a real regression, and that finding went into
CLAUDE.md so the next session does not re-discover it test by test.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 2 min | Three sequential, unambiguous requests |
| Reading the codebase | 6 min | Overlay + both readers, plus checking the SDK's `system` typing supports content blocks before committing to the caching approach |
| Building | 5 min | Overlay trim, two `system` edits, one test fixed to match the new shape |
| Tests | ~20 min | Three full `npm run verify`/pre-push runs, each carrying a genuine but unrelated e2e flake that had to be individually re-run in isolation to rule out a real break |
| Review, CI, deploy | — | Not pushed yet at the point this note was written |

## What should have been quicker

The three flaky e2e re-runs. Each one cost a full 5-minute parallel suite run plus a
separate isolated re-run of the one failing spec to confirm it wasn't real — about 20
minutes total spent confirming the same underlying fact three times (this container's e2e
run drops one random test under load, unrelated to whatever changed). That is now written
into CLAUDE.md's bare-container section, so the next session recognises the pattern on the
first failure and reaches for the one-spec re-run immediately instead of re-deriving it.

## What CLAUDE.md did not say

That a bare container's parallel e2e run reliably drops one unrelated test per full run, and
that the fix is re-running that one spec alone rather than the whole suite again. Written
into CLAUDE.md, in the same paragraph that already covers this container's Postgres and
Chromium quirks (search "drops one random").

## Decided rather than known

Which two of the six import stages to drop (kept "Fetching the page…", "Looking for the
recipe…", "Sorting out the ingredients…", "Writing up the steps…") was a judgement call
against "trim to 3–4 lines," not a spec. Caching the whole system prompt as one block,
rather than splitting the shared rules from anything call-specific, was also a judgement
call — today the entire prompt is invariant per language with nothing per-recipe in it, so
one cache breakpoint at the end is the natural boundary; if a per-recipe fragment is ever
added to the system prompt, this stops being true and the breakpoint would need moving
before it.
