# One morning notification for all due tasks

- **Date** — 2026-11-26
- **Branch** — `ccr-b6a25989-23yvdt`
- **PR** — not yet
- **Reached production** — not yet

## The idea

The reminder job sent one push per due task, so a morning with five jobs was five pushes.
Now it is one per person per home: "4 opgaver forfalder", the body naming the oldest three
and "1 mere". A single task reads as before. Tagged per home so tomorrow's replaces today's.

## The route

Read the route, its integration test and `sw.js`'s tag handling; reused `namesInWords`
for the body; grouped recipients by identical task sets so an unassigned job is still one
send. Tests updated for the new `tag` and for a memberless home (now no send at all).
Pushed with `RISK=low`, and the hook ran the whole browser suite anyway.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | route + test + sw.js |
| Building | small | |
| Tests | small | `npm run setup` first — Postgres down, Prisma client stale |
| Review, CI, deploy | most of it | full browser suite on a first push of a new branch |

## What should have been quicker

The push: `RISK=low` was raised to `high` because the container's `origin/main` was
stale (#194 while the branch sat on #201), so the hook's merge-base diff counted seven
merged commits touching `prisma/`, `package.json` and `auth.ts` as this push's — ~11
minutes of browser tests for a change no page draws. I first misread it as "every new
branch is high" and wrote that into CLAUDE.md, then corrected it. The second, docs-only
push also ran the full suite with no "raised" line; not chased further.

Also: this note was first lost because it was chained with `&&` after a `git checkout -b`
that failed (the branch already existed and was checked out).

## What CLAUDE.md did not say

That a fresh container's `origin/main` can be stale, which inflates the hook's range for a
new branch. Added beside the `RISK` table: `git fetch origin main` before the first push.

`namesInWords` lives in `src/lib/pantry.ts` but is general ("A, B, C and 2 more") and is
now used by the reminder job too.
