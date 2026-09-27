# Animate every section folding open and shut

- **Date** — 2026-09-27
- **Branch** — `claude/section-expand-collapse-animation-p8205i`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"When I expand and collapse sections there must be an animation, on all of them." In the
code that means five folds: `Collapsible` (a list's Completed items, Done lists, Done
tasks, the dashboard's "due for someone else") and the pantry's shelves, which are drawn
by hand.

## The route

Grepped `aria-expanded` for every fold and left out the menus and popovers. Wrote one
hook, `useFold`, that animates a one-row grid from `0fr` to `1fr` and keeps the panel
present until the shut animation ends. `Collapsible` still unmounts once shut and the
pantry still hides, so every existing e2e assertion kept its meaning. Measured the panel's
height frame by frame in Playwright (0 → 318px over 220ms) before taking the screenshot,
because the first screenshot came too late to catch the movement.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | `Collapsible`'s own comment said why it did not animate |
| Building | small | |
| Tests | most | `npm run setup`, an e2e build, a throwaway screenshot spec, full verify |
| Review, CI, deploy | — | |

## What should have been quicker

The screenshot. There is still no "screenshot this path" helper, so a throwaway spec was
written again. It forgot `loginAs` (each spec logs in inside its own `beforeEach`, not a
fixture), which cost one e2e run. Catching an animation mid-way also needs CDP's
`Animation.setPlaybackRate`, because a screenshot takes longer than a 220ms animation.

## What CLAUDE.md did not say

That a fold now animates, and how. Added under *Sheets, folds, movement*.

## Decided rather than known

220ms, and fading the contents in and out with the height. Folds opened by a filter (the
pantry search) animate too, where they could have jumped open.
