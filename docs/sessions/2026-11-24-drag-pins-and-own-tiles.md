# Tab bar pins by drag and drop; the dashboard's three tiles chosen per person

- **Date** — 2026-11-24
- **Branch** — `ccr-a5808ff0-06ncrj`
- **PR** — not yet
- **Reached production** — not yet

## The idea

Choose the tab bar's two places by dragging a tab onto one (the one there drops down),
and let each person pick the dashboard's three tiles from: start sleep, a list, start
breastfeed, create recipe. First round kept the old three numbers as options and the
default; the user's answer was to remove them and draw an empty place that explains
"press and hold" instead — so nothing is chosen for anybody.

## The route

Read nav-pins / dashboard / baby actions → `src/lib/dashboard-tiles.ts`, a `User` column,
`setDashboardTiles` → tiles component → NavPins rewritten on dnd-kit → screenshots → the
drag overlay was invisible and drops did nothing → fixed → screenshots sent → user:
remove the numbers, placeholders instead → rebuilt `readTiles` around empty places →
e2e rewritten for dragging → verify: 3 failures (old pin buttons in `baby.spec.ts`,
`animation.spec.ts` needing a `press-card` on the dashboard, one contention flake).

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

A Playwright drag measured with `boundingBox()` on something below the fold presses the
mouse on nothing and only selects text — scroll it into view first. Cost one e2e round.

`e2e/animation.spec.ts` asks the dashboard for a `.press-card`, `.press-button` and
`.press-icon`; the stat tiles were its only guaranteed `press-card`, which surfaced only in
the full suite. The empty tile is now a button (a tap opens the chooser as well).

A throwaway Playwright script needs `isMobile`/`hasTouch` and `getByRole(..., { exact:
true }).last()` for "Menu" — the tab bar is not drawn without them and the name repeats.

## What CLAUDE.md did not say

That a `DragOverlay` inside a sheet has to be portalled to `<body>` — the same trap the
cook mode already documents for `PageTransition`. Added to *Traps worth knowing*.

## After the PR went up

CI on #196 failed `e2e/list-categories.spec.ts` twice (attempt and retry) at `page.reload()`
with `ERR_ABORTED`; `main` was green. The same race this session met in its own spec: a
sheet closing takes its history entry back (`popOwnEntry`), and a reload started under
that traverse is aborted. The spec now waits for the dialog to be gone before reloading.
A browser test that reloads or navigates right after a sheet closes waits on
`getByRole("dialog")` having count 0 first.
