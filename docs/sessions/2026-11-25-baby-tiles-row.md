# The baby log's tiles carry the "+", scroll sideways and are reordered by hold-and-drag

- **Date** — 2026-11-25
- **Branch** — `ccr-184f8a17-fr0sak`
- **PR** — none yet
- **Reached production** — not yet

## The idea

From a phone screenshot: drop the three big buttons at the bottom of `/baby`, put a "+"
on each tile at the top instead, add a tile for every other thing logged (solid food,
bottle), let the row scroll sideways, and let each person drag the tiles into their own
order by pressing and holding.

## The route

Read `baby-log.tsx` and the `dashboardTiles` pattern → `src/lib/baby-tiles.ts`, a
`User.babyTiles` column and migration, `setBabyTiles` → rewrote the tile row as a dnd-kit
sortable with a hold delay → screenshot → unit test, e2e spec moved from `data-baby-dock`
to `data-baby-add` plus a drag test. One red e2e run: a bottle logged a second ago read
"Nothing yet" on its tile.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | the screenshot's scribbles said it plainly |
| Reading the codebase | small | `dashboardTiles` was the exact precedent |
| Building | most | the tile row, per-method "last" queries on the page |
| Tests | some | one rebuild-and-rerun for the clock bug |
| Review, CI, deploy | — | push runs the full suite (schema changed) |

## What should have been quicker

The "Nothing yet" bug cost a full `e2e:build` round: the page's `useNow` ticked every 30 s
and an entry stamped with the server's "now" was in the future to it until the next tick.
It was always there for the old single feed tile; a tile per method only made it visible.
`useNow` now also re-reads the clock when the entries change.

## What CLAUDE.md did not say

How the baby page's top row works — added under *The baby log is one table of events*.

## Decided rather than known

- Hold to drag is 300 ms (touch tolerance 8 px, mouse 5 px), so a sideways swipe still
  scrolls.
- Bottle and solid food read "last at 15:45"; only a breast feed reads "ended".
- `?show=` takes a tile (`breast`, `bottle`, …) and still `feed` for every feed at once,
  which the dashboard links to.
- The "+" on the sleep tile turns into a stop square while the baby sleeps.
