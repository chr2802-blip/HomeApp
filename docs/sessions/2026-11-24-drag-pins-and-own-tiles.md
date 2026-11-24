# Tab bar pins by drag and drop; the dashboard's three tiles chosen per person

- **Date** — 2026-11-24
- **Branch** — `ccr-a5808ff0-06ncrj`
- **PR** — not yet (first rough version, waiting on the user's answers)
- **Reached production** — not yet

## The idea

Choose the tab bar's two places by dragging a tab onto one (the one there drops down),
and let each person pick the dashboard's three tiles from: start sleep, a list, start
breastfeed, create recipe. Decided, not asked: the old three numbers stay as options and
as the default, and a tile is changed by holding it (plus `/profile`).

## The route

Read nav-pins / dashboard / baby actions → `src/lib/dashboard-tiles.ts`, a `User` column,
`setDashboardTiles` → tiles component → NavPins rewritten on dnd-kit → screenshots → the
drag overlay was invisible and drops did nothing → fixed → screenshots sent, waiting.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | medium | baby actions and the dnd-kit setup in list-items |
| Building | most | |
| Tests | none yet | |
| Review, CI, deploy | none yet | |

## What should have been quicker

The drag in the tab-bar drawer: dnd-kit's `DragOverlay` is `position: fixed`, and the
drawer (`Modal`) animates with a `transform`, so the overlay was drawn relative to the
drawer — off screen — and collisions were judged from the wrong box. One screenshot round
to see it. Portalling the overlay to `<body>` and using `pointerWithin` fixed both.
Also: the overlay takes the size of the draggable node, so the node must be the row with
the handle as `setActivatorNodeRef`, not the handle itself.

A throwaway Playwright script needs `isMobile`/`hasTouch` and `getByRole(..., { exact:
true }).last()` for "Menu" — the tab bar is not drawn without them and the name repeats.

## What CLAUDE.md did not say

That a `DragOverlay` inside a sheet has to be portalled to `<body>` — the same trap the
cook mode already documents for `PageTransition`. Added to *Traps worth knowing*.
