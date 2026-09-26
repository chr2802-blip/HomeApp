# Back after a sheet lands on the same page

- **Date** — 2026-09-26
- **Branch** — `claude/browser-back-dialog-issue-37j7wd`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"Browser back after opening a dialog/drawer goes back on the same page." That was the
documented cost of `Modal` leaving its pushed history entry in place after a Cancel or a
save — so the fix had to remove the entry without bringing back the stale-snapshot bug
that rule existed to prevent.

## The route

Read `modal.tsx` and `docs/design/ui-patterns.md` → read Next 15.5's `app-router.js`
(its `popstate` handler, its patched `pushState`/`replaceState`, `HistoryUpdater`) →
popped the entry with a traverse the router never hears → two browser tests, confirmed
red on the old `Modal` and green on the new → docs.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | The design doc named the exact trade-off |
| Reading the codebase | most | Next's router internals, to learn what a `popstate` restores and when custom history state survives |
| Building | small | |
| Tests | medium | Two `e2e:build`s — one to prove the tests fail without the fix |
| Review, CI, deploy | — | |

## What should have been quicker

Finding out that a server action's revalidation **rewrites the current entry's history
state without the sheet's `homehubModal` marker** (`preserveCustomHistoryState: false` in
Next's server-action and refresh reducers). The first design keyed "is this still my
entry" on that marker and would have silently done nothing after every save; it is keyed
on the address instead.

## What CLAUDE.md did not say

That custom `history.state` does not survive a server action or `router.refresh()` in
this Next version. Now said in `docs/design/ui-patterns.md` by implication (the address
guard); worth a line of its own if anything else starts storing state in history.

## Decided rather than known

- Swallowing the router's `popstate` relies on registering a capturing listener at module
  load, before the router mounts. Held by the two tests in `e2e/dialogs.spec.ts`, not by
  anything in Next's contract.
- The forward entry left behind by the pop is harmless (same page, current tree) and not
  worth removing.
