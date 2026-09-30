# Make the app feel like a home, not a generic app

- **Date** — 2026-09-30
- **Branch** — `ccr-e2578d1c-s28on5`
- **PR** — opened from this branch
- **Reached production** — not yet

## The idea

"The UI feels too generic — make it warm, fun, like a real home." That turned into five
parts, all asked for together: a warm base (palette, serif titles, softer frame), faces on
lists and tasks, a voice (time-of-day greeting, a line about the day, warmer empty
states), small celebratory moments and drawings, and opt-in seasonal touches.

## The route

Screenshots of the current app first, then a CSS-only mock injected into the running dev
server (no code) to settle the direction before building. After the go-ahead, each part
was built and screenshotted in turn at 390×844, in English and in an empty Danish home.
`npm run verify` then failed four e2e tests on the assignee mark (its screen-reader text
repeated the name beside it), which was a real accessibility duplicate and was fixed by
making the mark decorative where the name is already written.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | a mock screenshot settled the direction in one round |
| Reading the codebase | moderate | the theme test, the band's four painters, PhotoThumb's callers |
| Building | most | five parts, two migrations |
| Tests | moderate | one verify round red on the assignee mark |
| Review, CI, deploy | — | not yet |

## What should have been quicker

- **Seeding a realistic home for screenshots.** `npm run db:seed` makes only a super
  admin, and the e2e cast has no lists, tasks or dinner, so a throwaway seed script was
  written twice (a full home, then an empty Danish one). A `scripts/demo-seed` that makes
  a lived-in home and an empty one would make every "show it on screen first" faster.
- **A stale Prisma client in the dev server** turned every page into the global error
  screen after the second migration; it took a log read to see it was the server and not
  the change. Now in CLAUDE.md beside the screenshot advice.
- **`tests/unit/language.test.ts` silently skips arrays.** Rotating phrasings written as
  an array compiled and passed while escaping every language check; caught by reading the
  test, not by a failure. Now a rule in CLAUDE.md (key them).
- **Two pushes refused by the pre-push hook on contention**, each on a different
  `ai-wait.spec.ts` test that passed alone. `E2E_WORKERS=3` got the third through with
  every suite still run. Now in CLAUDE.md beside the flake advice.
- **Splitting a JSX element over lines moves a prop out of its `eslint-disable-next-line`.**
  Cost one verify round.

## What CLAUDE.md did not say

- Every neutral is `slate`, so the palette can be warmed in one `@theme` block — now the
  first bullet of the new section.
- The dev server keeps the old Prisma client after `prisma generate` — added to *Show the
  change on screen first*.
- The language test does not walk arrays — added to the new section.
- Pushing from a 4-CPU container wants `E2E_WORKERS=3` — added beside the flake advice.

## Decided rather than known

- The exact warm palette, band (`#f3ebdf`) and page (`#faf6f0`) values; the default
  SLATE theme's accent moved from navy-black to espresso (`#2a211b`).
- Fraunces for titles, not tested on real phones (it is vendored, so it loads the same).
- The emoji choice set and the title keywords behind the guess.
- The greeting's hour boundaries (5 / 11 / 17 / 22) and every new sentence, both
  languages — the Danish is mine and wants a native read.
- The streak line wins over the day line when both have something to say.
- Seasons: festive stretches as dated, Easter left out.
