# Pantry item name on the left

- **Date** — 2026-09-25
- **Branch** — `claude/pantry-item-name-left-g1387k`
- **PR** — not opened
- **Reached production** — not yet

## The idea

The household wanted each pantry row to read name first. The row was stepper, name, dots.
It is now name, "run out", stepper, dots.

## The route

Read `pantry-row.tsx`, moved `PantryQuantityField` after the name, gave the name a `-ml-2`
so its text lines up with the row's edge, dropped the error's `pl-14` (it was indenting
past the old stepper), and added `ml-1` to the menu so it sits a small gap away from the
stepper's "+". Lint, types, and `e2e/pantry.spec.ts` passed. I checked a 390px
screenshot from a throwaway spec.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | |
| Reading the codebase | 2 min | one component |
| Building | 3 min | |
| Tests | 10 min | `npm run setup` and the e2e build were most of it |
| Review, CI, deploy | — | |

## What should have been quicker

Taking a screenshot of one page meant copying the helpers from `e2e/pantry.spec.ts` into
a throwaway spec. A small `e2e/helpers` "screenshot this path as a seeded user" script
would make visual checks like this one a single command.

## What CLAUDE.md did not say

The pantry paragraph described the old row order implicitly ("at the far end of the row
where a thumb aiming at 'we're out of rice' cannot reach it"). It now states the order.
