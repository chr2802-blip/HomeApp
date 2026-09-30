# Tidy the task list, and open a task from the front page

- **Date** — 2026-09-30
- **Branch** — `ccr-107b567a-32kidw`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"The task list is messy" and "pressing a task on the front page must lead to the task's
details page". There was no details page: pressing a card on `/tasks` opened the edit
sheet, and the dashboard row pressed to nothing. So the ask meant building `/tasks/[id]`.

## The route

Screenshot of `/tasks` as it was (a ~220px card per task: badges wrapping, notes, a
two-line history, then a whole footer row for "Mark done") → one `TaskRow` shared with the
dashboard's already-compact row, linking to a new `/tasks/[id]` → notes and history moved
onto that page → screenshots sent → e2e spec rewritten for the row's shape → Danish shot.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | "details page" did not exist yet |
| Reading the codebase | small | `TaskCard`, the dashboard's `DueTask`, the list page's header |
| Building | medium | |
| Tests | medium | most of `e2e/tasks.spec.ts` asserted on the old card's history line |
| Environment | large | setup waited on, a wait loop that matched itself, a stale `.next` |

## What should have been quicker

Getting to a first screenshot. A `pgrep -f dev-setup.mjs` wait loop matched its own shell
and ran to its 10-minute timeout; the dev server then answered 500 for every page after
`task-card.tsx` was deleted under it; and there is no seed that gives a home with members
and rows, so one was written by hand. All three are now in CLAUDE.md.

## What CLAUDE.md did not say

The three environment traps above (added under Commands), and that a task is one row with
its own page (added under the tasks section).

## Decided rather than known

- The rows on `/tasks` lost the notes and the "last done" line; both are on the task's
  page. The row's button says "Done" rather than "Mark done", as the dashboard's does.
- Edit/delete/snooze stay on the row's three dots *and* are on the task page's.
- The task page's back arrow goes to `/tasks` even when opened from the dashboard —
  `BackButton` walks the URL, as it does for lists and recipes.
