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

## Later in the same session: grams past 999, decimals, and an expiry date

Three follow-ups, each committed on its own:

- **9999 ceiling.** `MAX_PANTRY_QUANTITY` was 999; the number box was sized for three
  digits, so it now widens with what it holds.
- **One decimal.** `PantryItem.quantity` Int → double (a cast that keeps every stored
  value). The box became `type="text" inputMode="decimal"`: a number input throws away a
  Danish comma. The e2e helper `quantityBox` moved from `spinbutton` to `textbox` with it.
- **Expiry date.** `PantryItem.expiresOn`, optional, in the edit sheet (renamed "Shelf,
  unit and date"); an amber icon on the row within 14 days, only while any is left.

### What should have been quicker

A full `npm run verify` dropped one unrelated spec (`dialogs.spec.ts`, back button after a
save) to contention; CLAUDE.md's advice to re-run that one spec alone settled it in 16s.
Worth it being written down — that was the cheapest possible answer.

### Decided rather than known

- 9999 as the ceiling (not higher): five digits of anything in a cupboard is a typo.
- Decimals are rounded, not refused: "2,25" is stored as 2,3.
- Expiry warns at 14 days inclusive, in amber, icon only (its sentence is the icon's
  label); an expired entry uses the same icon. No warning at zero quantity.
- The date is left in place when the entry runs out and is restocked — the household
  changes it in the sheet when a new packet arrives. Nothing clears it automatically.
