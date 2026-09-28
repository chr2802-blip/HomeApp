# Pantry shelves fold smoothly

- **Date** — 2026-09-27
- **Branch** — `claude/pantry-expand-collapse-smooth-i7qhio`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

"Expanding and collapsing in the pantry feels a bit hacky and jumpy." Sampling the Spices
card's height every frame through a press showed three distinct jumps: the heading's
preview line vanished before the rows moved (65 → 48 → 295px in two frames), shutting
grew the card a line before stopping dead, and a second press mid-fold leapt to full
height first. All three are fixed in `useFold` and the pantry's heading.

## The route

Read `useFold`, the keyframes and `PantryShelves` → guessed the three causes → fixed →
measured heights per frame with a throwaway Playwright script, new vs `git stash` → found
two leftovers the numbers showed (a 1–2px snap at the end from padding/border on the grid
item) → fixed → verify.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | "jumpy" became three numbers once measured |
| Reading the codebase | small | CLAUDE.md pointed at `useFold` and `fold.test.ts` |
| Building | small | |
| Tests | medium | `npm run setup` failed once on a network reset, then worked |
| Review, CI, deploy | — | |

## What should have been quicker

Seeding a home to look at, again — the previous session's note asked for a `db:demo`
script and this one wrote another throwaway seed (a home, a member, 32 pantry rows). That
is the second time; one more and it wants to exist. Also: a frame-by-frame height sampler
was far more useful than screenshots for judging an animation, and a filmstrip made by
pausing `document.getAnimations()` was misleading — it freezes the page's own entry
transition too.

## What CLAUDE.md did not say

That a fold's grid item must be bare (padding/border can't fold to `0fr`), and that
anything in the heading that comes and goes with a fold has to fold too. Both are now in
the fold bullet under *Sheets, folds, movement*.

## Decided rather than known

- 260ms and `cubic-bezier(0.4, 0, 0.6, 1)`, slightly longer than the old 220ms, for all
  folds (the `Collapsible` sections too), not only the pantry.
- The opacity is held back for the first 35% opening and gone by 65% shutting.
