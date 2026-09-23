# Trim the import overlay's stage lines from six to four

- **Date** — 2026-09-23
- **Branch** — `claude/loader-time-estimation-x4klpq`
- **PR** — not yet
- **Reached production** — not yet

## The idea

The user asked what the loader's per-step time estimation was for, then asked for a
walkthrough of every place the app calls the model, to see if anything could be cut. The
answer was that there are exactly two model calls (`normalizeRecipe`, `prepareCookSteps`)
and that `AiOverlay`'s stage list is cosmetic pacing, not a report of real sub-steps. The
user then asked to trim it. What was asked for and what got built match — the "explain"
half and the "cut" half were two separate, sequential requests, not a slip between them.

## The route

Straight through, no loops: read `ai-overlay.tsx`, `recipe-normalize.ts`, `cook-steps.ts`
and the copy/overlay call sites to confirm there really are only two call sites; explained
that in chat; on request, dropped two of `recipeImportOverlay`'s six stage lines
(`readingStage4` "Converting to metric…" and `readingStage6` "Checking it all over…"),
renumbering `readingStage5` down to `readingStage4`; confirmed no other file referenced the
dropped keys; ran `npm run setup` (the checkout started cold) then `npm run verify` end to
end, green; reported the diff without committing, since committing wasn't asked for yet.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | Two sequential, unambiguous requests |
| Reading the codebase | 5 min | `recipe-normalize.ts`, `cook-steps.ts`, `ai-overlay.tsx`, the copy file — well-commented, so this was reading rather than guessing |
| Building | 2 min | Two small edits: drop two copy entries, drop two array entries |
| Tests | ~6 min | `npm run setup` (cold checkout) + full `npm run verify`, dominated by the e2e suite's wall-clock time |
| Review, CI, deploy | — | Not pushed yet at the point this note was written |

## What should have been quicker

Nothing here cost a repeat lookup or a wrong turn — the doc comments already in
`ai-overlay.tsx` (progress is "a promise that something is moving, not a measurement") and
`recipe-import.ts`/`recipe-normalize.ts`'s comments naming the two model calls made this a
short, single-pass research task rather than an archaeology dig. The only real wall-clock
cost was the e2e suite itself, which is inherent to the gate, not to how this session went
about the change.

## What CLAUDE.md did not say

Nothing new surfaced. The file already documents both model call sites and — implicitly,
via the `AiOverlay` doc comment it references — that the stage list is decorative. No gap
to close here.

## Decided rather than known

Which two of the six import stages to drop was a judgement call, not a spec: kept
"Fetching the page…", "Looking for the recipe…", "Sorting out the ingredients…" and
"Writing up the steps…" as the four that read most like distinct moments in an import, and
dropped "Converting to metric…" and "Checking it all over…" as the two that added the least
beyond restating "the AI is working." Nobody checked this against user preference beyond
the general instruction to trim to 3–4 lines.
