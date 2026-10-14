# A list's own categories

- **Date** — 2026-10-14
- **Branch** — `ccr-a0ea0db8-buu9bv`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

"Egne kategorier" as a setting on a list, and a place to set those categories up — headings
that belong to the one list and are not shared between lists. Asked mid-way, the household
also wanted to pick the heading in the add box rather than move every new item afterwards.

## The route

Read the aisle grouping (the nearest thing) end to end, then replaced `List.groupByAisle`
with one `grouping` enum (`NONE`/`AISLE`/`OWN`) rather than adding a second flag beside it.
Model + migration, actions, `listVersion`, the grouped rows, the sheet, screenshots in Danish,
one question to the user (chips in the add box — yes), then tests. The browser test found a
real bug: the list's "Set up categories" offer drew its own sheet, and unmounted (taking the
sheet with it) the moment the first heading existed. Fixed by keeping one sheet beside the
title and opening it by an event.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | One question, asked after the first screenshots |
| Reading the codebase | medium | `list-items.tsx` is 780 lines; the aisle path runs through page, route, version, actions, offline ops |
| Building | most | |
| Tests | medium | one e2e failure that was a real bug |
| Review, CI, deploy | — | not yet |

## What should have been quicker

The first `npm run setup` ran in the background and appeared to stop after `npm install`
without saying so; a second foreground run finished the job. Cost a few minutes of looking
at a log that had simply ended.

Opening a sheet from an `ItemMenu` entry (`extraItems`) was the first plan; the menu's panel
unmounts on close, which would take a sheet inside it along. Nothing says so — found by
reading `MenuItem`. Not written into CLAUDE.md as a rule yet, since it is the second time a
sheet's owner unmounting closed it (see the "Set up categories" bug above); a third would
make it one.

## What CLAUDE.md did not say

How a list is grouped is now one enum, and own categories have their own section — both
written into CLAUDE.md in this commit.

## Decided rather than known

- Headings are per list and live on the row (`ListItem.categoryId`), not remembered per
  `pantryKey` like aisles — the ask was explicit that they do not cross lists.
- Unsorted items are drawn first, under "No category", the same as "Not sorted yet" for aisles.
- Deleting a heading unsorts its items rather than being refused.
- The heading chosen in the add box is kept for the next item (not reset like the amount),
  and is not remembered across visits.
- Adding a ticked line with no heading chosen keeps the heading it had.
- Anyone in the home can edit a list's headings — like the items, not an admin setting.
