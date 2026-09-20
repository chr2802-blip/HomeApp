# Ticking an item resets its amount to one

- **Date** — 2026-09-20
- **Branch** — `claude/list-item-amount-reset-jann9w`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

"When a list item is ticked the amount must reset to one." A ticked "3 milk" should read
as an ordinary "1 milk" the next time it is wanted, the same way `restoreItem` already
resets a ticked-off row's amount when it is typed back onto the list. It turned out to be
the mirror of a rule already in `docs/design/lists.md` ("a line ticked off earlier comes
back at one"), just applied one press earlier — at the tick rather than at the return.

## The route

Found the single point every tick already goes through, `setItemDone` in
`src/lib/list-writes.ts` — used by `toggleListItem` and by the offline queue's endpoint
alike, which is exactly the "neither decides separately what a tick means" rule the file's
own comment states. Added the amount reset there, then followed the two places that
optimistically predict what that write will do before it lands: the in-memory `applyTo` in
`list-items.tsx` (the immediate tap) and `applyPending` in `offline-ops.ts` (replaying a
queued tick against a stale server snapshot). Missing either would have shown the old
amount for a beat, or for as long as a phone stays offline.

Wrote one integration test asserting the reset survives both a tick and a subsequent untick
(the untick leaves the freshly-reset amount alone, on purpose — putting it back is not a
second opinion about how many are wanted). `npm run verify`'s pieces all ran clean:
lint, `tsc --noEmit`, the full unit and integration suites, `db:check`.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 10% | One sentence; the design doc for lists confirmed the direction was consistent with existing rules. |
| Reading the codebase | 30% | Tracing every path a tick can arrive by — form action, offline queue replay, optimistic UI — to find the one place to change and the two that had to agree with it. |
| Building | 15% | Three small, mechanical edits. |
| Tests | 15% | One integration test in the existing `toggleListItem` block. |
| Review, CI, deploy | 30% | Standing up Postgres in a bare container to actually run the integration suite rather than trusting the diff. |

## What should have been quicker

**Standing up the test database again.** This container arrived with no `node_modules`
and no running Postgres, despite a local cluster (`pg_lsclusters` showed one, stopped) and
a script (`scripts/test-db.mjs`) that assumes one is reachable. `npm ci`, `service
postgresql start`, an `ALTER USER postgres WITH PASSWORD`, and a throwaway `.env` were all
needed before `npm run verify`'s DB-touching third could run at all — the same shape of
cost the previous session's note (`2026-09-20-reel-caption-import.md`) already named for
Playwright. That note's fix (a written-down bring-up sequence) covers Postgres too; adding
Postgres's own three lines there rather than duplicating a new "getting started" section
here.

## What CLAUDE.md did not say

Nothing new — this session's gap (bringing up Postgres in a bare container) is the same
one the previous session already wrote down under **What CLAUDE.md did not say** in
`2026-09-20-reel-caption-import.md`, just missing the one detail this session needed: the
container's Postgres is a `pg_lsclusters`-managed cluster, started with `service
postgresql start` rather than `initdb`/`pg_ctl` from scratch, since the data directory
already exists.

## Decided rather than known

- **The reset happens on every tick to `done: true`, not only when the amount was above
  one.** `setItemDone` is written to be idempotent — calling it twice with the same state
  leaves the same row — so folding the amount into that same unconditional write keeps
  that property rather than adding a branch that has to be told about it separately.
