# One full-screen, more "AI" loader for import and save

- **Date** — 2026-09-23
- **Branch** — `claude/loading-screens-ai-loader-qi7exd`
- **PR** — not opened
- **Reached production** — not yet

## The idea

The link import showed a small inline box and the save a sheet-sized overlay, both with a
plain spinner. Asked: make both the same, full screen, and make it look like something
complicated is happening.

## The route

Found both from the Danish copy (`grep` on the phrase) → `AiOverlay` rewritten as a
portalled full-screen wait with stage lines and a paced bar → import field switched to it
→ `item-menu.tsx`'s overlay type found by `tsc` → screenshot through a throwaway spec with
the server action delayed by `page.route` → `npm run verify`.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | copy grep led straight there |
| Building | most | CSS for the orb, copy for the stages |
| Tests | some | a single spec failed first: no `.next` build |
| Review, CI, deploy | — | |

## What should have been quicker

Running one Playwright spec to take a screenshot: `npx playwright test <file>` fails with
"no production build" unless `next build` ran first. Now in CLAUDE.md's Commands.

## What CLAUDE.md did not say

That AI waits are one component, and how to run a single browser spec. Both added.

## Decided rather than known

- Violet and cyan beside the home's `--accent` as the "AI" colours — not green, red or
  amber, so no meaning is borrowed.
- The bar is paced (15 s import, 20 s save) and never reaches 100%; the stage lines are
  illustrative, not reported by the server.
