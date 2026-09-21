# Dialogs close on the browser's back button

- **Date** — 2026-09-21
- **Branch** — `claude/dialog-back-button-close-l00fph`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

Asked for: every dialog closeable with the browser's back button, especially a phone's
swipe-from-the-edge gesture, since a sheet that swallows that gesture instead of closing
reads as broken on a phone.

What it turned out to mean: pushing a history entry when a sheet opens is the easy half,
in `Modal` itself so every sheet in the app gets it at once. The entire rest of the
session was finding out that **popping that entry back off is not safe** in a Next.js App
Router app, because the router keeps its own client-side cache keyed to history entries,
and undoing a self-pushed entry with `history.back()` can silently undo a save made while
that entry was open.

## The route

Idea → build → full e2e suite → 21 failures, all in unrelated-looking specs (`lists`,
`list-amounts`, `pantry`, `photos`, `recipes`) → root-caused to `redirect()` never
returning, so a form that redirects never calls the close handler my code was consuming a
history entry on → fixed that, reran → 21 down to 1 → that one failure held up under a
`--repeat-each=8`, so not a flake → read `next/dist/client/components/app-router.js` to
find out why → second, deeper bug: even a save that does **not** redirect corrupts the
page on close, because `history.back()` restores a cached tree frozen before the save →
removed the self-triggered `back()` entirely, keeping only the open-time push and the
`popstate` listener → reran the specific case and the full suite clean.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 5% | One sentence, unambiguous |
| Reading the codebase | 10% | `Modal`, `use-form-action.ts`, every dialog wrapper |
| Building | 15% | The push/listen/close is small |
| Tests | 15% | Two e2e tests, one later cut once its guarantee was dropped |
| Diagnosing the two history bugs | 45% | Reading `app-router.js` to find the actual mechanism, not just the symptom |
| Review, CI, deploy | 10% | Three full e2e runs: baseline-with-bug, first fix, final |

## What should have been quicker

**Running the full e2e suite once, not three times, would have needed catching both bugs
from reasoning about the mechanism up front rather than from a failing assertion.** The
first bug (a redirecting action's `useFormAction` never resolving, so `onClose` never
fires — `use-form-action.ts` says so in a comment right there) was findable by reading
that file before writing `Modal`'s effect, not after. The second, deeper bug needed
reading Next's own router source to find `HistoryUpdater` and the `onPopState` handler in
`app-router.js`, which nothing in this codebase could have pointed at — that one really
did want the failing test.

The `--repeat-each=8` stress run before trusting a single green result is the thing worth
keeping: 21 failures collapsing to 1 looked exactly like "was mostly a flake, that
survivor probably is too", and running it once more would have said so. A repeat run
costs twenty seconds and is the difference between shipping a silent data-loss bug and
catching it.

## What CLAUDE.md did not say

**That `window.history.pushState`/`back()` are patched by the App Router, and any code
outside it that calls `history.back()` risks restoring a frozen, pre-mutation snapshot of
the current route.** Closed: the new "A sheet closes on back, and never pops itself"
section in `docs/design/ui-patterns.md` names the mechanism — `HistoryUpdater` only
keeps the *current top* history entry's cached tree live via `replaceState`; a
self-pushed entry sitting *below* a later mutation is frozen at the moment it stopped
being top, and traversing back to it with `history.back()` restores that frozen state
outright. This app had no reason to touch `window.history` directly before this session;
now that something does, the next thing that wants to is warned once rather than finding
out from a stress-tested delete button.

## Decided rather than known

- **The pushed entry is never consumed on a non-back close** (Cancel, the × button,
  Escape, a successful save) — only ever pushed on open, only ever popped by a real
  `popstate`. The first version consumed it to save a later, redundant back press; that
  costs correctness on every save, so it was worth an extra back press instead. Not
  reopened after the second bug confirmed the trade-off; flagged as the one thing worth
  revisiting if a later session finds a way to consume the entry that doesn't touch
  `history.back()` (a `router.refresh()` timed to land after Next's own restore was
  considered and set aside — too timing-dependent to trust without its own test).
