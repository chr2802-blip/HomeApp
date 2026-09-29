# A Baby shelf in the pantry

- **Date** — 2026-09-29
- **Branch** — `ccr-4a7c078b-t49erb`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"In the pantry I am missing a category called Baby." A new value in the fixed
`PantryCategory` set, named in both languages, known to the model sorter, and with a few
common baby goods in `PANTRY_GOODS` so they are filed without asking the model.

## The route

One grep for an existing shelf (`FREEZER`) named every place a shelf lives: schema,
migration, `PANTRY_CATEGORY_LABELS`, `SHELVES` in `pantry-sort.ts`, `pantry-goods.ts`.
Edited all five, `npm run setup`, `npm run verify` green first time, one screenshot.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | |
| Reading the codebase | 3 min | one grep was enough |
| Building | 3 min | |
| Tests | 10 min | full verify incl. e2e; nothing new needed — the label record's type forces the rest |
| Screenshot | 5 min | seeding a user by hand for the dev server |

## What should have been quicker

The screenshot: the dev database has no user (the seed needs `SUPER_ADMIN_EMAIL`), so a
throwaway script had to create a home, a member and pantry rows. A `db:seed:demo` that
writes a small logged-in-able household would make every screenshot a one-liner.

## What CLAUDE.md did not say

Nothing missing for this change; the shelf list in the pantry section was updated to
include baby.

## Decided rather than known

- The shelf sits after Drinks and before Other (Other stays last).
- The Danish name is "Baby" — the same word, allowed by the language test as one word.
- The starter goods: formula, baby food, nappies, wipes. "Grød" was left out as an alias
  because plain porridge is not only for babies.
