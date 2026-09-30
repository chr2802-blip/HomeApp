# Small sheets as bottom drawers

- **Date** — 2026-09-26
- **Branch** — `claude/dialog-fullscreen-drawer-ndykmo`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

Every sheet filled the phone screen, which felt like too much for a one-control action
(portions, rating). Asked for a drawer for simple dialogs; it became a `size="drawer"` on
`Modal`, used by `SheetButton` and the two confirmation sheets.

## The route

Read `modal.tsx`, `sheet-button.tsx`, the sheet keyframes and the callers of `Modal` →
added the variant → one e2e test in `dialogs.spec.ts` measuring both sizes → ran lint,
types and the four specs touching sheets → screenshots at 390px.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | `Modal` has few callers and they were easy to grep |
| Building | small | |
| Tests | most | `npm run setup` in a cold container, then the e2e build |
| Review, CI, deploy | — | |

## What should have been quicker

The e2e build before a single spec (~1 min) is most of the loop for a CSS-only change;
nothing to fix, it is what a served `.next` costs.

## What CLAUDE.md did not say

Which sheets are "small" was nowhere — now a bullet under *Sheets, folds, movement* and a
section in `docs/design/ui-patterns.md`.

## Decided rather than known

- Which sheets became drawers: `SheetButton` and the confirmations. Forms (edit sheets,
  the meal picker, new recipe, pantry add) stay full screen.
- No drag handle and no swipe-to-dismiss: a handle promises a gesture that isn't there.
- Cap at 85dvh, matching the desktop panel's 85vh.
