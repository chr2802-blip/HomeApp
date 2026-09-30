# Lists update on other phones at once, through Supabase Realtime

- **Date** — 2026-09-26
- **Branch** — `claude/realtime-list-supabase-fzk2e2`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

An open list followed the household by polling every 3s; the ask was to investigate
Supabase Broadcast and then build it with private channels per home. It became: a write
pushes a list id on `home:<homeId>`, the phone asks the existing version route at once,
and the poll stays underneath at 30s.

## The route

Investigation first (supabase.com is blocked from the container; the docs were read from
`supabase/supabase` on GitHub, and the batch endpoint's `private` field confirmed in
`supabase/realtime`'s source). Then server helper → every list writer → token route →
browser client → guarded migration (exercised against a mock `realtime` schema in a
scratch database) → unit and integration tests → `npm run verify` green, e2e included.
A smoke test of realtime-js against a fake Phoenix server then found two bugs no suite
could: an `https://` socket address, and a join that went out without its token.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | `revalidatePath(\`/lists/…\`)` was already the chokepoint |
| Building | medium | |
| Tests | medium | the smoke test against a fake socket server was the valuable one |
| Review, CI, deploy | — | not yet |

## What should have been quicker

Finding out how realtime-js behaves without supabase-js around it. Both bugs were in
the gap between the two libraries, invisible to every suite (they never load the socket),
and only a throwaway fake server showed them. A second change here will want the same
harness; it lives only in this note's description, not in the repo.

## What CLAUDE.md did not say

That there was any push at all is now written in "An open list follows…", including the
two realtime-js traps and that no suite talks to a real Realtime.

## Decided rather than known

- Nudge from the server after the write (`after`) rather than a `realtime.send` trigger.
- A private channel per home rather than per list; token lists all of a person's homes
  plus the one on screen (for a super admin); 15-minute token lifetime.
- The migration warns rather than fails when the policy cannot be created, so a Supabase
  permission surprise cannot break a production build — at the cost of a silent fallback
  to polling. Not verified against a real Supabase project: whether `postgres` may
  `CREATE POLICY` on `realtime.messages` is what Supabase's docs say, not what was tried.
- `SUPABASE_JWT_SECRET` as HS256; a project fully migrated to asymmetric signing keys with
  the legacy secret revoked would refuse these tokens.
- 30s fallback poll while joined.
