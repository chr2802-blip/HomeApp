# The pantry-match dialog defaulted to adding, which read backwards

- **Date** — 2026-09-23
- **Branch** — `claude/dialog-pr-default-unchecked-tkmxik`
- **PR** — not yet
- **Reached production** — not yet

## The idea

A screenshot of "Already have some of this?" (`AddToListMenu`'s ambiguous-line dialog):
every box arrived pre-checked, with no text saying what checking or unchecking meant.
Asked for two things — every box starts unchecked, and a line of copy explains the
dialog — and it turned out to be one change: the boxes were checked by default *on
purpose*, to keep a plain press adding everything exactly as it always had before the
pantry existed, but that default silently contradicted the question the dialog itself
asks ("already have some of this?" answered, by default, "no, add it anyway").

## The route

Short. Found the dialog (`src/components/add-to-list-menu.tsx`), read the design note in
`docs/sessions/2026-09-23-pantry-match-partial-ingredients.md` and the "household has a
cupboard" section of `CLAUDE.md` to understand why `keep` existed and what checked/
unchecked already meant to `writeRecipesToList` (checked = still add; unchecked = treat as
covered, same as a line the pantry answered for outright). Changed the initial `keep` set
from every line's key to empty, added a help phrase, and fixed the two e2e tests that
encoded the old default in their names and assertions (`e2e/pantry.spec.ts`) — one now
confirms the unchecked default leaves the line off, a new one confirms checking it still
adds it. Ran `npm run setup` (cold container) then `npm run verify` twice, clean both
times.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 20% | The screenshot alone didn't say *why* boxes were checked; had to read the prior session's note and the pantry matching code to see the default was deliberate, not an oversight. |
| Reading the codebase | 15% | Tracing `keep` from the dialog through `PANTRY_KEEP_FIELD` into `stripStocked`'s `resolvedKeep`, to be sure flipping the default flips the right thing. |
| Building | 15% | One line changed in the component, one phrase added to `app.ts`, one paragraph of help text. |
| Tests | 30% | The e2e suite had baked the old default into a test's name and its assertions; splitting it into an unchecked-default test and a checked-adds-it-anyway test. |
| Review, CI, deploy | 20% | Cold-container `npm run setup`, then `npm run verify` (full suite) twice. |

## What should have been quicker

**Nothing stands out as slower than it should have been** — the design doc from the
session that built this dialog explained the `keep` semantics precisely enough that no
guessing was needed, which is the payoff of that convention working as intended.

## What CLAUDE.md did not say

Nothing new; the existing "household has a cupboard" section already covers what checked
and unchecked answer for. This was a UX default worth changing, not a gap in the rules.

## Decided rather than known

- **Unchecked now means "leave it out," matching how a line the pantry answers for
  outright is already handled** — nothing is added until the household says otherwise.
  This inverts what a plain press used to do (add everything), which was the explicit ask.
