# A page opened from far down another starts at the top

- **Date** — 2026-10-04
- **Branch** — `ccr-c689a85b-oespk8`
- **PR** — not opened
- **Reached production** — not yet

## The idea

Pressing something far down a page opened the next page at the same scroll position. A
new page should start at the top; only going back should return to where you were.

## The route

Read `PageTransition` and the app layout (the window scrolls, header is sticky), wrote
`useScrollOnArrival`, wrote `e2e/scroll.spec.ts`, then ran it against the code *without*
the fix to see the bug — and it did not reproduce in Chromium: forward navigation already
reset to the top on every route probed (lists, recipes, tasks, dashboard, at phone size
with touch, and lists of every length from one screen to three). The one failing case was
the header's back arrow, which is a link up a segment and so landed at the top instead of
where the page was left. Kept the explicit reset anyway; one contention flake in
`dialogs.spec.ts`, passed alone three times.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | `PageTransition`, `BackButton`, `Modal`'s `popOwnEntry` |
| Building | small | |
| Tests | most of it | three throwaway probe specs trying to reproduce the forward case |
| Review, CI, deploy | — | |

## What should have been quicker

Trying to reproduce a phone-only bug in Chromium. The report almost certainly comes from
a phone (iOS Safari or the installed app), and this container has only Chromium — no
WebKit — so the probing could never have confirmed it. Asking which page and which
device first would have cost one round trip and saved three probe runs.

## What CLAUDE.md did not say

That scroll on navigation is the router's heuristic, not a guarantee — now a bullet under
*Sheets, folds, movement* beside `PageTransition`.

## Decided rather than known

- The forward-navigation bug is assumed to be the router's "first element already in
  view" early exit (or a WebKit difference in it); it was not reproduced here.
- The header's back arrow counts as "back" and restores the remembered position, though
  it is technically a forward navigation to the parent URL.
