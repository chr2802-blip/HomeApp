# Pantry overview: folded shelves

- **Date** — 2026-09-27
- **Branch** — `claude/pantry-overview-improvement-9eew1k`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

"The pantry feels difficult to get an overview in." In practice, 46 entries drawn open took
about eight phone screens. Every shelf now starts folded, showing its count, how many have
run out and a preview of its names, so the whole cupboard fits on about one screen.

## The route

Baseline screenshot → rough folded version → screenshot → the user picked "folded shelves"
over two alternatives (run-out names first in the preview; open shelves with denser rows
and jump chips) → the user asked how search works, answered with a screenshot → tests.
The first e2e run failed 11 of 13. Every `keepIn` into an empty pantry landed the entry
folded: `PantryShelves` mounted *with* the first entry already there, so it never saw it
arrive. Fixed by keeping it mounted and passing it the empty state as children.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | a screenshot of the real page answered it |
| Reading the codebase | small | the pantry section of CLAUDE.md pointed straight at `PantryShelves` |
| Building | medium | |
| Tests | medium | two e2e rebuilds lost to the empty-pantry mount and to a locator matching two `aria-expanded` buttons |
| Review, CI, deploy | — | |

## What should have been quicker

Seeding a home to screenshot. `prisma/seed.ts` only creates the super admin, so a
throwaway seed script (a home, a member, ~45 pantry rows) had to be written. It needs
`tsx --env-file=.env`, because a bare `tsx` script does not read `.env`. The e2e
`resetAndSeed` has the standard cast but is not usable from a dev server. A
`npm run db:demo` that seeds a demo home with a stocked pantry, lists and recipes would
turn every future "show it on screen first" into one command.

## What CLAUDE.md did not say

`Collapsible` unmounts its panel when it is shut, so it cannot be used anywhere rows hold
optimistic state (the pantry). The fold here is hand-drawn with `hidden`. This is now
written into the pantry section of CLAUDE.md.

## Decided rather than known

- Clearing a search goes back to the shelves opened by hand, not to everything folded.
- The "Not sorted yet" shelf folds like the others; its sort button stays on the heading.
- "N run out" in a shelf heading is a slate pill, not amber: amber means overdue.
