# A tick on one phone reaches the other

- **Date** — 2026-09-25
- **Branch** — `claude/realtime-list-sync-j1zunh`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

Two people shopping at once: ticking an item off on one phone must tick it off on the
other without anybody reloading. It meant "keep an open list live", not a push service;
the user said as much (no SignalR).

## The route

Read `list-items.tsx`, the offline hook and `public/sw.js` to see how a list already
redraws (a `router.refresh()` after a queue flush) and what the service worker would do
with a new GET under `/api/` (nothing: only `/api/photos/` is kept). Added a fingerprint
(`listVersion`), a route answering it, and `useListFollow` polling it. Unit,
integration and a two-context browser test; each passed first time.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | most | offline hook and service worker, to be sure a poll could not be answered from a cache |
| Building | small | |
| Tests | moderate | an e2e build is about two minutes |
| Review, CI, deploy | — | |

## What should have been quicker

Finding out whether a new `/api` GET would be touched by the service worker meant reading
`sw.js` itself; CLAUDE.md says it "never touches anything but GET" but not which GETs it
does touch. The answer (navigations to the kept pages, and the assets listed in
`isKeptAsset`) is short enough to have been one line there.

## What CLAUDE.md did not say

How an open page learns about another person's change — it didn't, before this. The new
section "An open list follows what the rest of the household does to it" says how now.

## Decided rather than known

- Polling every 3 seconds rather than a push. A few hundred tiny requests per open list
  per afternoon on Vercel; cheap for a household, but not measured.
- Only the list's own page follows. `/lists` and the dashboard still show counts as of
  their last load.
- A recipe renamed while its note sits on a list does not change the fingerprint (the
  hash carries recipe ids, not titles); the note catches up on the next real change.
