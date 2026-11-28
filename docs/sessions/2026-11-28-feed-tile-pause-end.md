# Dashboard feed tile: V/H starts, then pause and stop

- **Date** — 2026-11-28
- **Branch** — `ccr-234a6c9a-r4ej7o`
- **PR** — not opened
- **Reached production** — not yet

## The idea

On the dashboard's breastfeed tile, V or H starts a feed, and the two buttons then become
pause and finish. Paused, they go back to V/H so carrying on still picks a side.

## The route

Read `FeedTile`, rewrote its buttons, screenshotted. "Pause"/"Afslut" as words truncated
at 390px, so they became icons, which the user then asked for as well. The paused line moved
into the label's slot so the tile keeps its height. Added one e2e test.

## What should have been quicker

The screenshot tool can't crop to a single component, so checking a 110px tile means
reading the whole page. A `--clip <selector>` option would have saved a round.
