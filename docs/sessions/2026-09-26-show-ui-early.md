# A rule: show the UI of a change as early as possible

- **Date** — 2026-09-26
- **Branch** — `claude/early-ui-preview-r5tqdx`
- **PR** — not opened
- **Reached production** — not yet

## The idea

The user asked for a standing rule: always show them the UI of a change as early as
possible, so iteration happens on something they can see rather than on a finished build.

## The route

Read the Working style section and the earlier session notes that mention screenshots, to
see how sessions have actually been producing them. Wrote the rule into CLAUDE.md under
Working style ("Show the change on screen first, before finishing it"). No code changed.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | |
| Reading the codebase | 3 min | past session notes on screenshots |
| Building | 5 min | one CLAUDE.md section |
| Tests | — | docs only |
| Review, CI, deploy | — | |

## What should have been quicker

Nothing to speed up in this session; the gap it names is in the ones to come. Three earlier
notes (2026-09-22, 2026-09-23, 2026-09-25) each built a throwaway spec to take one
screenshot, and 2026-09-25 asked for a helper. With screenshots now expected early in
every UI session, that helper is the next thing worth building.

## What CLAUDE.md did not say

That the user wants to see UI changes early, and how to get a screenshot quickly. Both are
now in the new Working style subsection.

## Decided rather than known

- 390×844 as the default viewport, plus a Danish-language shot when the change has words.
- "Ask and wait" only when the screenshot settles a choice; otherwise keep building and let
  the user interrupt.
