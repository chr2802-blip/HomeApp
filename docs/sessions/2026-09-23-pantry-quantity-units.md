# Pantry quantity and units, replacing the in/out switch

- **Date** — 2026-09-23
- **Branch** — `claude/pantry-quantity-units-3eeaqf`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

Replace `PantryItem.inStock` (a boolean) with a quantity and a unit: zero is what
`false` used to mean, any amount above it is what `true` did, and the household can say
what the amount is counted in — g, kg, dl, l, or the kitchen's own can/bag/pack/jar/
bunch. It turned out to mean exactly that and nothing more: the matching against the
shopping list (`pantryKey`, `stripStocked`, `matchedStockedKey`) still asks only "is the
quantity above zero", so none of that logic changed at all.

## The route

Straight through, once the shape of the existing feature was read: `PantryItem.inStock`
in the schema, `setPantryStock`/`addPantryToList` in the actions, `stockedKeys` in
`pantry-stock.ts`, the switch in `PantryRow`, and the CLAUDE.md section documenting all
of it as one bit. Followed the app's own precedent for a fixed, localised set
(`HomeTheme`/`THEMES`/`SETTINGS.colour.names`) rather than inventing a new shape for the
unit list. One loop: the e2e suite still queried `role="switch"` in two specs
(`pantry.spec.ts` and the pantry helper inside `language.spec.ts`), both needed rewriting
against the new stepper+select markup — caught by grepping for `role="switch"` across
`src` and `e2e` before considering the UI work done, rather than by a failing run.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 15% | Reading `lib/pantry.ts`, the actions, the row, and every design paragraph in CLAUDE.md the change would need to keep honest. |
| Reading the codebase | 15% | Finding the unit-list precedent (`theme.ts`/`STORAGE_KIND_LABELS`) so the new `PantryUnit` enum followed it rather than reinventing a pattern. |
| Building | 30% | Schema + migration, `PANTRY_UNITS`/`clampPantryQuantity` in `lib/pantry.ts`, the new `PantryQuantityField` component, and rewiring the row and actions. |
| Tests | 25% | Updating the integration suite off `inStock`, and rewriting both e2e specs' switch locators against the new control. |
| Review, CI, deploy | 15% | `npm run verify` end to end: lint, types, `db:check`, unit, integration, and all 271 e2e specs. |

## What should have been quicker

Nothing here cost real time twice, but it is worth writing down why: the app already had
a working example of "a fixed, localised set of values" (`HomeTheme`) with its schema
enum, its `THEMES` derivation, and its `Record<Enum, Phrase>` label file all in one
place, so there was nothing to work out from scratch — only to find and copy. A session
without that precedent already in CLAUDE.md would have spent real time inventing and
then second-guessing a shape for `PANTRY_UNITS`.

## What CLAUDE.md did not say

Nothing new — the pantry section already said enough to know what had to change and
what could not: the CLAUDE.md text itself asserted the pantry was "a name and one bit",
which this session's whole job was to make untrue in the same commit that changed the
code. Updated in place rather than left to drift.

## Decided rather than known

- **Which units to offer**: g, kg, dl, l, can, bag, pack, jar, bunch — no `stk`/"piece",
  deliberately: a plain count with no unit already means "so many of them", the same
  reason `UNIT_WORDS` drops `stk` from a recipe's own ingredient lines. Nobody asked for
  this explicitly; it followed from the existing rule once it was named.
- **The floor is zero, not `MIN_AMOUNT` (one)**: a pantry quantity's zero is its own
  meaning ("run out"), unlike a list item's amount, whose floor is one because "zero of
  something on a shopping list" is not a state the list draws. `clampPantryQuantity` is
  a separate function from `clampAmount` for exactly this reason rather than a shared one
  with a configurable floor.
