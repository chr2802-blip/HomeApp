# Breastfeeding: stop it from the dashboard, and two phones agreeing

- **Date** — 2026-11-27
- **Branch** — `ccr-c3d34e67-ka391e`
- **PR** — not yet
- **Reached production** — not yet

## The idea

The dashboard's feed tile could start and pause a feed but never finish one, and a press
on one phone while the other phone had started the feed did the opposite of what it said.

## The route

Read the tile, the actions and the /baby sheet → found three causes → fixed all three →
integration tests → screenshots of start, pause, start again and finish on the dashboard.

1. The tile had no "end" at all. It now has one (`finishBreastFeed`, by id, only while it
   still runs), written as the label line under the clock: "ammer · afslut" / "pause · afslut".
2. `pressBreastSide` and `toggleSleep` toggled whatever the server held, so a phone that
   had not yet heard of the other's start *paused* the feed it meant to start. Every press
   now sends `to` (`run`/`pause`, `asleep`/`awake`), and a press the stored row already
   answers is a no-op. Without `to` they still toggle, for a page loaded before this.
3. The dashboard never asked again, and the baby actions revalidated only `/baby`. The
   actions now revalidate `/dashboard` too, and the tiles follow (`useFollow`, moved out of
   `baby-log.tsx` into `src/components/use-follow.ts`) while a baby tile is showing.
   `saveFeed`'s "Done" on a feed the other phone already finished keeps its end and sides.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | medium | the tile, three actions, the sheet |
| Building | small | |
| Tests | small | |
| Review, CI, deploy | push hook | |

## What should have been quicker

The first `npm run screenshot` after `npm run dev` timed out at 8s while the dashboard
compiled cold; the second run worked. Nothing to fix beyond knowing to run it twice.

## What CLAUDE.md did not say

Nothing missing; the baby section now says that a timer's press carries its intent.

## Decided rather than known

- "Finish" on the tile is the label line, not a third button: three 32px buttons do not
  fit in a third of a 390px row.
- The dashboard follows every 30 s only while a sleep or feed tile is on it.
