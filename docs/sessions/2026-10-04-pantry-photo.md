# A picture on a pantry entry, seen only in its edit sheet

- **Date** — 2026-10-04
- **Branch** — `ccr-5411f7b9-8tlsat`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"Add images in the pantry, visible only on the edit page." A `photoId` on `PantryItem`,
the ordinary `PhotoField` in the sheet behind the three dots, and nothing on the row.

## The route

Schema + migration → `Photo.pantryItems` so the sweep leaves it alone → `editPantryItem`
reads it with `readPhotoChoice`/`discardReplaced`, `deletePantryItem` calls `discardPhoto`
→ page/shelves/row pass `photoId` → field in `PantryEditFields`. Screenshot, then tests.
The menu entry "Shelf, unit and date" became "Edit" now that the sheet holds a fourth thing.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | the photo pattern is well documented |
| Building | small | |
| Tests | small | |
| Screenshot | most | seed script, test image, menu trigger |

## What should have been quicker

The screenshot. The seed script guessed `PASTA_RICE_GRAINS` for the enum (it is
`DRY_GOODS`), there was no image to upload and no PIL to make one, and the first
`[data-ready]` on the page is the header's menu, not the row's.

## What CLAUDE.md did not say

All three of the above — now under "A dev database for screenshots".

## Decided rather than known

- Pantry pictures count towards `rest` in the storage breakdown, not a slice of their own:
  `storage.ts`'s CASE has no pantry branch and adding a fifth kind means a colour too.
- The menu entry is renamed to the generic "Edit" / title "Edit entry" ("Rediger vare").
