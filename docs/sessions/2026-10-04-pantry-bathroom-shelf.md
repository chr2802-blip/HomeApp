# Bathroom and Cleaning shelves, stk, and amount and unit when adding

- **Date** — 2026-10-04
- **Branch** — `ccr-5bccd17d-cijh6b`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"I am missing a bathroom category in the storage." Storage is the pantry (Supplies /
Forråd), and a category there is a `PantryCategory` shelf.

## The route

Found the Baby shelf (#156) as the exact precedent and repeated it: enum value before
`OTHER` plus a migration, a label in both languages, a description for the sorting model,
known goods in `pantry-goods.ts`, and the shelf's shop aisle in `AISLE_OF_SHELF`
(`HOUSEHOLD`, where the shop list already files toiletries). One unit test, one screenshot.

Later in the same session: "stk" as the word for a plain count (null unit, so nothing
migrated) and amount + unit in the add sheet; then a Cleaning (Rengøring) shelf, the
Bathroom shelf's change again, file for file.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | "storage" → pantry, by grepping for an existing shelf |
| Reading the codebase | 3 min | `git show --stat` of the Baby commit listed every place |
| Building | 3 min | |
| Tests | 3 min | unit + pantry integration |
| Review, CI, deploy | — | |

## What should have been quicker

The screenshot. A throwaway seed script in the scratchpad cannot resolve
`@prisma/client` (it is outside the repo's `node_modules`), and a dev server started with
`nohup … &` inside a compound command died with it. Both cost a retry.

## What CLAUDE.md did not say

That a throwaway `tsx` script must live inside the checkout to import its packages —
written into the screenshot paragraph of CLAUDE.md in this commit.

## Decided rather than known

- The name: "Bathroom" / "Badeværelse", placed after Baby and before Other.
- Its shop aisle is `HOUSEHOLD` ("Household & toiletries").
- "stk" is the null unit rather than a new enum value; the add sheet's unit follows a
  known good's (ris → kg) until one is picked by hand.
- Cleaning: "Cleaning" / "Rengøring", after Bathroom, household aisle; paper towels filed
  under cleaning rather than bathroom.
- The ten known goods and their units (toilet paper and plasters by the pack, the rest a
  plain count).
