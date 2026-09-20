# Fix: "Add to list" squeezing the Meals title into single letters

- **Date** — 2026-09-20
- **Branch** — `claude/mealplan-add-to-list-appearance-gj877m`
- **PR** — none yet
- **Reached production** — not yet

## The idea

A screenshot showed `/meals` with its "Meals" title stacked one letter per line, and the
pantry note from a completed "Add to list" press cut off unreadably beside it. It turned out
to be one bug, not two: an unbounded status message forcing the header's flex layout to
collapse the title.

## The route

Read the screenshot → found `PageHeader` gives its `h1` `flex-1 min-w-0 break-words` and its
`action` slot `shrink-0` → traced `action` on `/meals` to `AddToListMenu`'s result message,
a `<p role="status">` with no width constraint → confirmed the mechanism: a `shrink-0` flex
child's hypothetical width is its unwrapped content width, so a long unbounded sentence
("Added to Indkøbsliste. Salt, Peber, Olivenolie and 1 more already in the pantry.") forces
the sibling `flex-1 min-w-0` title down to near zero, and `break-words` then wraps "Meals"
one letter per line rather than overflowing → bounded the message with `max-w-40
text-right` so it wraps within its own column instead of dictating the row's width.

No loop worth naming — the screenshot pointed straight at the header, and `PageHeader` and
`AddToListMenu` were the only two files in the causal chain.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | The screenshot was self-explanatory once the two symptoms were read as one cause |
| Reading the codebase | most of it | `PageHeader`, `AddToListMenu`, and confirming the same component is used unaffected on the recipe page (short "Ingredients" heading never exposed it) |
| Building | small | One class change |
| Tests | small | No suite covers layout; typecheck was environmental-only (no `node_modules` in this container) |
| Review, CI, deploy | not yet | |

## What should have been quicker

Nothing stands out — the fix followed directly from reading the two components once the
screenshot named the symptom. Worth naming for the next session anyway: a `shrink-0` flex
sibling next to a `flex-1 min-w-0` one is a recurring shape in this codebase
(`PageHeader`'s own action slot), and any child put in that slot needs its own bound on
unwrapped text width — the flex layout will not add one for free.

## What CLAUDE.md did not say

Nothing new; `ui-patterns.md` already covers sheets, folds and form submission but not this
specific flex trap. Not worth a new rule for one occurrence.

## Decided rather than known

- **`max-w-40`** (10rem) as the bound on the status message. Chosen to comfortably wrap the
  longest realistic pantry note (up to three named items plus a count) across two or three
  short lines without feeling cramped on a phone width; not measured against every possible
  list title length.
