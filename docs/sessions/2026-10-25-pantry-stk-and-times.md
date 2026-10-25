# The pantry in stk or endless, counted down by recipes made ½×/1×/2×

- **Date** — 2026-10-25
- **Branch** — `ccr-8f78c047-ul0845`
- **PR** — opened from this branch
- **Reached production** — not yet

## The idea

Keeping grams and litres current in the pantry took the household too long. Every entry is
now either stk (one stk = enough for cooking once) or endless (had or not), and putting a
recipe on a list counts the stk down by how many times over it is made — so the recipe's
"portions" stepper became a ½×/1×/2× multiplier, and the meal plan's days carry one too.

## The route

Two rounds of design in chat before any code: what a tick means (bought and used, so net
zero, so ticks never touch the pantry), whether a recipe takes one stk or "its amount" (one
per time made), and what happens when there is too little (use it up, put the line on the
list). Then schema → pantry UI → screenshot → multiplier → screenshot → the deduction →
tests → e2e. The e2e pantry spec assumed every entry has a stepper; since salt is now
endless on the list of goods, the spec's `keepIn` picks stk explicitly and one new test
covers the switch.

The pre-push hook's full browser suite failed twice on tests this change does not touch.
`list-aisles.spec.ts` reloaded while the aisle sheet was still taking its history entry back
off (`ERR_ABORTED`), the race CLAUDE.md describes for `goto`; it now waits for the sheet to be
gone. `scroll.spec.ts` dropped a test now and then on `/lists` ("Element is not attached to the
DOM") — reproduced on `main` too (2 of 12 runs). Left alone at first, it then failed the PR's
CI outright, so it was fixed after all: the page can be redrawn as it hydrates, and the spec
took a card before then. It now waits for the card's three dots to carry `data-ready`
(40 of 40 at four workers). Lesson: a flake proven on `main` is still this PR's to fix once
it is the thing standing between the PR and green.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 20% | Two chat rounds; the answers decided the whole shape. |
| Reading the codebase | 15% | Pantry, list writes, the portions plumbing through cook mode, kitchen and push. |
| Building | 35% | "Portions" ran through eight files (cook mode, kitchen, cook session, timer push, resume). |
| Tests | 25% | Unit, integration and five e2e specs. |
| Review, CI, deploy | 15% | Three pre-push runs of ~12 min each; one real race fixed, one flake proven on `main`. |

## What should have been quicker

The screenshots of a pantry shelf: every shelf starts folded, and a selector for "the fold
buttons" also matched every row's three dots (they carry `aria-expanded` too), so the first
shot opened a menu over the page. The shelf toggles carry `data-shelf-toggle`; use that.

## What CLAUDE.md did not say

That the multiplier, not the portion count, is what flows from the recipe page into action
mode, the cook session and the timer push — now written under "A recipe is made ½×, 1×,
2×…". The pantry sections are rewritten for stk/endless and `planPantry`.

## Decided rather than known

- The migration turns every entry with a unit of measure into endless (had if it had any),
  and rounds a plain count up to whole stk. The household turns a measured one into stk by
  hand where it wants it counted.
- Which common goods start counted (rice, pasta, tins, frozen goods, onions, potatoes,
  coffee, cream) and which endless (everything else).
- ½× counts as one use; the multipliers offered stop at 10×.
- The deduction happens when a recipe is put on a list, not when it is cooked; a dropped
  dinner is corrected by hand.
- "Still add it" in the ambiguous-line dialog is buying, so it takes nothing from the pantry.
