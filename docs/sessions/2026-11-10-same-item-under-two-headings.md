# The same item under two of a list's own headings

- **Date** — 2026-11-10
- **Branch** — `claude/dreamy-mayer-12uvoq`
- **PR** — none yet
- **Reached production** — not yet

## The idea

"Legetøj" should be able to sit under both "Bagsæde" and "Bella" on one list. `addItem`
refused any open row with the same text anywhere on the list, whatever heading was chosen.

## The route

Found the duplicate check in `addItem` (`src/lib/list-writes.ts`) and scoped it to the
chosen heading (`findSameItem`). Then noticed the add box's suggestions would move a
ticked row from one heading to another, which defeats the point, so they are now filtered
and labelled by heading. The first screenshot was wrong: `demo-seed.ts` matched items to
headings by text, so a duplicate landed under the first heading. Fixed it to match by position.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | short | |
| Reading the codebase | short | `addItem` was easy to find |
| Building | short | |
| Tests | short | two integration tests in `list-categories.test.ts` |
| Review, CI, deploy | — | |

## What should have been quicker

The demo seed's assumption that item texts are unique within a list cost a second screenshot
round. It now matches by position.

## What CLAUDE.md did not say

Nothing missing. The rule changed, and CLAUDE.md's *A list can keep categories of its own*
section now describes it.

## Decided rather than known

- With a heading chosen, a ticked row under **no** heading is adopted and moved there. A
  ticked row under **another** heading is left alone, and a new row is made.
- With no heading chosen, the whole list is searched as before. Typing "Legetøj" with
  "Uden kategori" selected while it is open under Bella is refused as a duplicate.
- Suggestions show the heading name beside a ticked row that has one.
