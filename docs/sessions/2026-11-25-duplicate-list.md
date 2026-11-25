# Duplicate a list

- **Date** — 2026-11-25
- **Branch** — `claude/zen-sagan-5fu6cg`
- **PR** — not opened
- **Reached production** — not yet

## The idea

Make a new list from an existing one — all its items — to adjust, rather than typing a
nearly identical list from scratch. Became "Duplicate" in a list's three dots, on `/lists`
and on the list's own page: a sheet asks the copy's name (prefilled "… (copy)"), then
lands on the copy.

## The route

Action (`duplicateList`) → menu entry → screenshot → e2e test, which caught the sheet
closing a moment after it opened: it was drawn inside the menu entry, and the menu's
panel unmounts once closed. Moved into `ListMenu` (`src/components/list-menu.tsx`), which
wraps `ItemMenu` and draws the sheet beside it.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | |
| Building | medium | the sheet-inside-the-panel loop, once |
| Tests | medium | cold container setup, two e2e builds |
| Review, CI, deploy | — | |

## What should have been quicker

The sheet was first built inside a `MenuItem` passed as `ItemMenu`'s `extraItems`. The
warning was in `ItemMenu`'s own comment, not in CLAUDE.md, and the screenshot script
didn't show it (the sheet flashed and went). Cost: one e2e build and run.

## What CLAUDE.md did not say

That an `extraItems` entry cannot own a sheet — added under *Editing and deleting live
behind the three dots*.

## Decided rather than known

- Every item is copied **open**, ticked ones too: the copy is a list still to do.
- Copied: title (asked), amounts setting, sorting, emoji, own headings, item amounts and
  order. Not copied: ticks, who ticked, recipe notes, the picture (a `Photo` belongs to
  one thing, and deleting either list would take it from both), favourites.
