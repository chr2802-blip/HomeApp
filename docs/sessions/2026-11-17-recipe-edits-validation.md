# Six recipe fixes: stay on the list, Sonnet 5.5, redo/edit the guide, optional portions, bulk categories, no duplicates, no dinner auto-pick

- **Date** — 2026-11-17
- **Branch** — `claude/recipe-edits-validation-8p4847`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

Six asks in one message. "Gendan handling" was ambiguous (undo the AI's rewrite, or redo
the guide) and was asked back; the answer was "make the guide again" in action mode.

## The route

Setup → read the recipe actions, both readers, cook mode, the directory, tonight's dinner
→ built in order of size (portions, stay-on-list, no auto-pick, model, guide, duplicates,
bulk) → screenshots in Danish → integration tests → browser specs → `npm run verify` green
first time (4950 unit/integration, 325 e2e).

Mid-session the household changed the bulk editing: choosing starts by press and hold
(not a "Choose" button), and the bar grew Delete, Add to list and Cancel beside Categories.
Rebuilt as `RecipeSelectionBar` + `useLongPress`, on the same branch.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | one question back |
| Reading the codebase | medium | timeouts budget test, cook mode, dinner tests |
| Building | most | |
| Tests | medium | three e2e loops on the chip checkboxes and a snack |
| Review, CI, deploy | — | not pushed to main |

## What should have been quicker

- **Ticking a chip checkbox inside a sheet in e2e.** `check({ force: true })` on the
  `sr-only` input — the way `e2e/recipes.spec.ts` ticks categories on a page — fails
  "outside of the viewport" inside a `Modal` still animating in. Clicking the chip's text
  waits for the sheet and works. Two rebuild-and-rerun loops to find. Written into
  CLAUDE.md under *Traps worth knowing*.
- **A snack from a sheet whose owner unmounts on success.** An effect on the action's
  state never ran, because the success also unmounted the component. Calling `notify`
  from a wrapper around the action is what works.

- **Holding a card in e2e** needs `scrollIntoViewIfNeeded` before `mouse.down`: a
  bounding box below the fold puts the mouse outside the viewport and the hold silently
  never starts — two of four tests failed that way, the two with a third recipe.

- **Three list specs failed in the full run after the selection change** (`page.reload`
  ERR_ABORTED, a reorder that "did not move"). They failed the same way, at random, on
  `main` itself in a worktree, at one worker. Proving that took a worktree build; the
  first "baseline" was taken with `git stash`, which left the new untracked files behind
  importing actions the stash had removed — the build failed and the "base" run was
  meaningless. A baseline wants `git worktree add`, never a stash.

## What CLAUDE.md did not say

The chip-in-a-sheet trap above; now in *Traps worth knowing*.

## Decided rather than known

- **Sonnet 5.5 at `low` effort, adaptive thinking, one attempt with no retry** (30s import,
  45s save). The waits are guesses until Admin → System → AI call times has real rows;
  `expectedSeconds` (15/18) is a guess too. No server-side refusal fallback was added:
  a refusal already reads as "the reader is not answering".
- **Duplicate = same title in the home, ignoring case and outer spaces**, checked on
  create (before and after the reader, which may rename) and on rename.
- **"Find new" stays** on a dinner chosen on `/meals`; only the silent auto-pick went.
- **Bulk filing only adds headings**, never removes, so no recipe can end up under none.
- **A hand-edited step on an unprepared recipe writes a `v: 1` breakdown**, so the next
  ordinary save still reads it into the format.
