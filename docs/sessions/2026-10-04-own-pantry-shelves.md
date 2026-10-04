# A household's own shelves in Supplies, and a better category builder

- **Date** — 2026-10-04
- **Branch** — `ccr-33d9f6b6-dviat9`
- **PR** — see the branch's PR
- **Reached production** — not yet

## The idea

"Let me build my own categories in the storage, like I can with recipes — and improve the
category builder, still in the home's admin." Storage is the pantry (Supplies), whose
shelves were a fixed enum; "the builder" was the recipe-category form on `/settings`, a
field and a Rename button per row.

## The route

Read the pantry's enum through every reader (`lookupGood`, `sortPantryGoods`, the aisle
map) and chose to keep the built-ins as they are and add `PantryShelf` beside them, an
entry holding one of `category`/`shelfId`, rather than turn the enum into per-home rows
seeded into every home (every test factory and the e2e seed create homes directly, so
seeding would have touched them all). Settings first, screenshot, then the pantry page
and sheets, screenshot, then tests.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | "storage" = Supplies, from the copy (`PANTRY.title`) |
| Reading the codebase | a third | the enum has five readers |
| Building | a third | |
| Tests | a quarter | old recipe-category e2e rewritten for the sheet |
| Review, CI, deploy | — | |

## What should have been quicker

The migration: `prisma format` after a hand-edit by string replace put a back-relation on
`Photo` (the first `pantryItems PantryItem[]` in the file, not `Home`'s `pantry`), and
`migrate dev --create-only` named the folder so it sorted before the two newest
migrations, which are dated ahead of the clock. Two regenerations.

## What CLAUDE.md did not say

That a new migration's timestamp can sort before existing ones here — now under
*Deployment*. The own-shelves design is written into the pantry section.

## Decided rather than known

- Built-in shelves stay fixed and cannot be renamed or hidden; own shelves sit after them
  and before "Other".
- The model never files onto an own shelf (it is not told they exist).
- Deleting an own shelf unsorts its entries instead of refusing.
- A category in use now has a menu with Edit and no Delete (it used to have no menu).
