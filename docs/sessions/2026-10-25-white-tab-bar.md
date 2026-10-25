# Make the bottom tab bar white

- **Date** — 2026-10-25
- **Branch** — `ccr-44ac0d34-ioiocp`
- **PR** — not opened
- **Reached production** — not yet

## The idea

A phone screenshot with the tab bar circled: "the bottom navbar must be white". It was the
linen `--band`; it is now `bg-white`, the app's own (cream) white that the cards wear.

## The route

Found `bottom-nav.tsx` by grepping for `safe-area-inset-bottom`, changed one class, updated
the assertion in `tests/unit/theme.test.ts` that pinned the nav to the band, and the
sentences in CLAUDE.md and `docs/design/theme-and-frame.md` saying the band fills the
gesture bar. `npm run setup`, `db:demo`, one screenshot.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | |
| Reading the codebase | 2 min | |
| Building | 1 min | |
| Tests | 1 min | |
| Review, CI, deploy | 3 min | setup in a cold container was most of it |

## What should have been quicker

`npm run setup` in a cold container (npm ci, Postgres) was the bulk of a one-class change.

## What CLAUDE.md did not say

That the tab bar was the band was written down; now the exception is too (theme section).

## Decided rather than known

"White" was read as the app's `white` (`#fffdf9`, a card's cream) rather than pure `#fff`,
so the bar matches the cards beside it.
