# Untick everything on a list at once

- **Date** — 2026-11-08
- **Branch** — `claude/untick-all-list-items`
- **PR** — see the PR this note ships in
- **Reached production** — not yet

## The idea

Put every ticked item on a list back on it in one press, for lists that are used again —
a packing list taken out for the next trip — instead of unticking row by row.

## The route

Read `list-items.tsx`, `actions/lists.ts` and `list-writes.ts`, then built: a server
action (`untickAllListItems`), an optimistic `untickAll` change, an "Untick all" button
at the end of the "Completed (n)" heading behind a confirmation, copy in both languages,
and integration tests. Not run here — see below.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | most of it | CLAUDE.md is long; the lists sections were what mattered |
| Building | small | |
| Tests | written, not run | |
| Review, CI, deploy | CI | |

## What should have been quicker

The container had no `node_modules` and no network for `npm ci`, so `npm run setup`,
`npm run verify` and the screenshot route could not run at all. The PR leans on CI for
lint, types and the suites, and no screenshot went to the user before the PR.

## What CLAUDE.md did not say

Nothing new about the code. The missing piece is environmental: a session with package
installs switched off cannot verify anything locally, which CLAUDE.md assumes it can.

## Decided rather than known

- **Online-only, not queued.** Like a delete or a drag: a bulk change would need a rule
  for what another phone ticked meanwhile.
- **Asked first, with a home-coloured (not red) confirm.** Nothing is deleted, but a slip
  undoes a whole shop's ticks. `ConfirmButton` gained `confirmVariant` for this.
- **Amounts are left as they are**, matching a single untick (`setItemDone`).
- **Not counted towards the week** — nothing was finished.
- **Placed on the "Completed" heading** (`Collapsible` gained an `aside` slot) rather
  than in the list's three dots, so it is visible exactly when there is something ticked.
