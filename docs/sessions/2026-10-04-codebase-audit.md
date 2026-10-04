# A full audit of the codebase, and fixing what it found

- **Date** — 2026-10-04
- **Branch** — `ccr-304728af-ubhs56`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

"Time for a full audit — do all of it": security and tenancy, the house rules, the AI
readers, performance, maintainability, docs drift. It turned into an audit that fixes as it
goes, because most findings were small, testable and better closed than carried a fourth
time. The report is [`docs/audit-2026-10-04.md`](../audit-2026-10-04.md).

## The route

`npm run setup` (cold container, ~2 min) → baseline green (lint, types, `db:check`, 4,246
tests) in the background while reading the security surface: auth, every action, every
route, the importer → findings → fixes, one at a time, each with a test → the 10 affected
browser specs → report, CLAUDE.md, this note.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | a little | Proposed six phases first; "do all of it" |
| Reading the codebase | most | ~30k lines; the actions, routes and `lib/` read in full, components skimmed |
| Building | a third | 11 fixes, 2 migrations, ~60 tests |
| Tests | a quarter | The e2e build alone is minutes |
| Review, CI, deploy | — | Not yet |

## What should have been quicker

- **Finding that the lint rule was off took one command, once suspected** (`eslint
  --print-config`) — but nothing prompted the suspicion except reading `eslint.config.mjs`
  end to end. A guard that can lapse silently needs a test that it fires; there is one now.
- **The Supabase finding needed the README to confirm**, because nothing in `CLAUDE.md`
  said production's Postgres *is* the Supabase project behind Realtime. It says so now,
  beside `homeDb`.
- **Generating a migration's SQL** needed a hand-made shadow database (`prisma migrate
  diff --shadow-database-url`), and an empty migration directory made it fail with P3015.
  Make the directory *after* generating the SQL.

## What CLAUDE.md did not say

Written into `CLAUDE.md` in this commit:

- Production's Postgres is the Supabase project, a new table must turn RLS on, and
  `tests/integration/rls.test.ts` checks it (beside `homeDb`).
- Flat config replaces, never merges, a rule's options across blocks — spread `TENANCY`
  in any block that sets `no-restricted-syntax` (same place).
- A URL anybody else chose goes through `safeFetch` / `assertPublicUrl` (importer section).
- Logout removes the push subscription, before the session ends (offline section).

## Decided rather than known

Listed at the end of the report. The big one: S1 (Supabase Data API exposure) is judged
from Supabase's defaults, not from production — confirming it there would mean making
the attack.
