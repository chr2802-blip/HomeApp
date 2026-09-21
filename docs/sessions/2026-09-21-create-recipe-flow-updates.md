# Simplify the new-recipe flow: always ask first, one spinner, no caption paste box

- **Date** — 2026-09-21
- **Branch** — `claude/create-recipe-flow-updates-qwri9a`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

Four requests on `NewRecipeDialog` / `RecipeImportField`: always show the "start from
scratch or import" choice first (a clipboard link used to skip it); move the
clipboard-link auto-fetch to the moment "Import from a link" is pressed instead; stop
duplicating the loading spinner in both the Fetch button and the status banner; and
remove the "Paste the description instead" fallback entirely, since the cook found it
confusing now that the automatic read works.

## The route

Straightforward once the two components were read: moved the clipboard check from
`openFresh` to a new `openImportFromLink`, dropped the caption state/handler/UI from
`RecipeImportField`, and trimmed the Fetch button to text-only while pending. The
session immediately before this one (commit c8f31d4) had just added the banner+button
double spinner this one is now partly removing, so this reverses part of a change from a
few hours earlier in the same file.

The larger cost was proving it still worked: no `node_modules`, no Postgres, and a stale
Chromium revision in `/opt/pw-browsers` all had to be fixed before `npm run verify`'s
slower half could run at all.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 5 min | Reading the two components once |
| Reading the codebase | 10 min | `new-recipe-dialog.tsx`, `recipe-import-field.tsx`, the design doc's paste-box rationale |
| Building | 15 min | Small, mechanical edits to both components |
| Tests | 30 min | `npm ci`, `prisma generate`, standing up Postgres, mirroring the Chromium revision, rewriting the e2e clipboard tests, dropping the caption e2e suite |
| Review, CI, deploy | — | Not yet pushed |

## What should have been quicker

Standing up the environment cost more than the change itself: installing dependencies,
starting Postgres from the bare cluster, and mirroring Chromium 1194 → 1243 by hand are
all steps CLAUDE.md already documents, but none of it is automated, so it is paid again
by whichever session hits it first. A setup script that did all three in one command
would turn a documented incantation into a fact instead of a ritual.

## What CLAUDE.md did not say

Nothing new — the container-setup steps (Postgres, Chromium mirroring) were exactly as
documented in `CLAUDE.md`'s Commands section, which is what let this session get through
them without guessing.

## Decided rather than known

Removed the "Paste the description instead" UI (and the e2e coverage that drove it)
without removing the backend it calls: `importPastedCaption` in `src/lib/recipe-import.ts`
and the `importRecipeFromCaption` server action are untouched, and still covered by
`tests/unit/recipe-import.test.ts` and `tests/integration/recipe-import.test.ts`, which
call the lib function directly. `docs/design/recipes.md` calls that paste box "the
load-bearing half" of reel import — the only route in when Instagram or Facebook refuse
a signed-out fetch — so a reel that the automatic read cannot reach now has no recourse
in the UI beyond "Start from scratch" and retyping it by hand. That tradeoff was the
user's explicit call, made knowing the box existed for exactly that case; it is recorded
here in case a future session wonders why working backend code has no caller.
