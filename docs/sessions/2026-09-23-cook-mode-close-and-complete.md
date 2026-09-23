# Action mode closes from the first page and completes on the last

- **Date** — 2026-09-23
- **Branch** — `claude/recipe-cooking-mode-nav-vfagbu`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

On the mise en place (the first page of action mode), the left footer button was a
disabled "Back" — there was nothing to go back to, so it did nothing. On the last step,
the right button read "Finish" and turned one more page to a "That is dinner." screen
whose only job was to offer a second button back to the recipe. Asked to make the first
page's left action Close (and close the mode) and the last step's right action Complete
(and close the mode directly), with only the truly last step reading Complete — every
step before it, including the second-to-last, keeps reading Next.

## The route

Read `src/components/cook-mode.tsx` end to end: `pageCount = steps.length + 2` (mise en
place, one page per step, then a `Finished` page), with `Back` disabled at page 0 and
`Finish` on the last step turning to `Finished`, whose own "Back to the recipe" link was
the actual exit. Since Complete was now supposed to close directly, the `Finished` page
had nothing left to do — removed it and its four now-unused copy phrases
(`finished`, `thatIsDinner`, `everyStepDone`, `backToRecipe`) rather than leave them
unreachable. `pageCount` dropped to `steps.length + 1`; the last page is now a step page,
not a screen about having finished one.

Reused the existing `APP.close` phrase for the left button (the same word the header's X
already uses) and renamed `RECIPES.finish` to `RECIPES.complete` for the right one, since
"Finish" was describing turning a page and "Complete" is closing the mode — different
enough to want its own word. `forward()` now checks `page === pageCount - 1` and calls a
new `complete()` (cheer, then the same `leave()` the X button and Escape already used)
instead of `goTo`, so the keyboard's ArrowRight and a swipe-next on the last step close
the mode the same way the button does — three inputs for one action, not one covered and
two forgotten.

One edge case: a recipe with no steps at all (a reel with nothing written down,
`steps.length === 0`) makes page 0 both the first and last page at once. The label
logic (`page === 0 && !isLastStep` before `isLastStep`) already resolves that to Complete
rather than Start, and the progress bar's `page / (pageCount - 1)` would have divided by
zero in that case — guarded with `pageCount > 1 ? page / (pageCount - 1) : 1`.

Updated `e2e/cook-mode.spec.ts`: the existing "covers the app's own chrome" test pressed
through to "Finish" and then a "Back to the recipe" link, which no longer exists — changed
the last button to "Complete" and asserted the URL directly. Added a new test pinning
the two ends explicitly: no "Back" button at all on the first page (Close instead), no
"Next" on the last step (Complete instead), and both close to `/recipes/{id}`.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 5 min | The instruction corrected itself mid-sentence (only the *last* step is Complete, not the one before it) — read as confirming the existing `page === steps.length` check rather than asking for a new one. |
| Reading the codebase | 10 min | `cook-mode.tsx` in full, `src/lib/copy/recipes.ts` for the existing phrases, `e2e/cook-mode.spec.ts` for what the current flow's contract actually was. |
| Building | 15 min | Removing the `Finished` page and its `done` state, wiring `complete()` into the button, keyboard, and swipe paths alike, and catching the zero-step division. |
| Tests | 20 min | `npm run setup` on a cold container, lint + `tsc --noEmit` + the full unit suite (1542 tests) + `db:check`, then built and ran `e2e/cook-mode.spec.ts` (7 tests, including the new one) against the local Postgres. |
| Review, CI, deploy | — | Not yet pushed. |

## What should have been quicker

Nothing stood out — the component was small enough to read whole before changing it, and
the existing e2e spec already named the flow precisely enough to say exactly what needed
updating.

## What CLAUDE.md did not say

Nothing new — `docs/design/ui-patterns.md`'s account of `PageTransition` and portalling
already covered why this surface works the way it does; nothing about a footer button
closing a route was missing from the rules.

## Decided rather than known

- Removed the `Finished` celebration screen entirely rather than keeping it and having
  Complete skip past it: the instruction was explicit that Complete closes the mode, and
  a screen nothing can reach is dead weight, not a kept option.
- On a zero-step recipe, made the single mise-en-place page read Close on the left and
  Complete on the right (both ends coincide) rather than keeping a "Start" label that
  would have advanced nowhere. Untested by any existing spec — worth an e2e case if a
  reel-only recipe's cook page becomes a place bugs turn up.
