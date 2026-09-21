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

Only the browser suite disagreed, and it was right to: `e2e/list-amounts.spec.ts` had a
test named "a ticked item shows what was wanted, without a picker" asserting `×4` stayed
on a completed row — the exact behaviour this session was asked to change. Renamed it to
"ticking an item resets its amount to one, and shows no picker", asserted `×1` and the
stored value instead, and rewrote the one code comment (`list-items.tsx`) that said the
same old thing. A grep across `e2e/` for the pattern first (any other spec asserting an
amount survives a tick) found nothing else depending on it.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 5% | One sentence; the design doc for lists confirmed the direction was consistent with existing rules. |
| Reading the codebase | 20% | Tracing every path a tick can arrive by — form action, offline queue replay, optimistic UI — to find the one place to change and the two that had to agree with it. |
| Building | 10% | Four small, mechanical edits plus one comment and one test rename once the browser suite disagreed. |
| Tests | 15% | One integration test, one browser test rewritten. |
| Review, CI, deploy | 50% | Almost all of it standing up and then fighting this container's Postgres and Playwright, twice — see below. |

## What should have been quicker

**Standing up the test database, again — same cost as the previous session, still
unfixed.** No `node_modules`, no running Postgres: `npm ci`, `service postgresql start`,
`ALTER USER postgres WITH PASSWORD`, a throwaway `.env`. The previous session
(`2026-09-20-reel-caption-import.md`) named this exact cost and proposed writing the
bring-up sequence down; it wasn't, so this session paid it again from scratch, plus once
more mid-session when the container's Postgres had gone down on its own between turns
(silently — the only symptom was every integration test failing at connection). **This is
now the second session in a row to hit this; it has stopped being a note and gone into
CLAUDE.md's Commands section below, and into this file's "What CLAUDE.md did not say".**

**Chasing a self-inflicted process pileup cost more than the actual bug.** The Playwright
build in this container pins revision 1194 while `@playwright/test` wants 1243 — the same
mismatch the previous session hit and fixed by symlinking. That symlink alone wasn't
enough here: 1243's own internal layout renamed `chrome-linux/headless_shell` to
`chrome-headless-shell-linux64/chrome-headless-shell`, so the browser genuinely wasn't at
the path Playwright looked for, and the first two `git push` attempts (each retrying up to
4 times on failure, each retry re-running the whole `e2e` script) launched *concurrent*
copies of the build-and-test pipeline that stepped on each other's ports and on each
other's `homehub_test_w0_e2e` database. Untangling that — killing zombied `next start`
and `playwright test` trees, terminating stuck Postgres backends, dropping databases a
dead run's `DROP DATABASE ... WITH (FORCE)` never got to run — took longer than writing
`setItemDone`'s one-line fix. The lesson isn't "be more careful with backgrounded retry
loops" (that's what caused it); it's that a `git push` wrapped in a shell retry loop and a
pre-push hook that runs a 3-minute browser suite is a bad combination to background and
walk away from — verify the suite green in one foreground-or-single-background run first,
*then* push once, plainly.

## What CLAUDE.md did not say

**How to bring up Postgres and a working Chromium in this sandbox from cold**, which is
now two sessions' worth of the same rediscovery. Added under **Commands** below rather
than invented as a new section, since it belongs beside `npm run verify`:

- Postgres is a stopped `pg_lsclusters`-managed cluster already on disk — start it with
  `service postgresql start`, not `initdb`. It can also stop again mid-session with no
  warning; if every integration test starts failing to connect, check `pg_lsclusters`
  before anything else.
- `/opt/pw-browsers` ships whatever revision was baked into the image (1194 here), which
  drifts behind the revision `@playwright/test` in `package-lock.json` wants (1243 here).
  Rather than symlinking just the top-level revision folder (insufficient — the internal
  layout changed between these two revisions), mirror the whole tree with per-file
  symlinks under the new revision's expected directory name, for both `chromium-<rev>`
  and `chromium_headless_shell-<rev>`.

## Decided rather than known

- **The reset happens on every tick to `done: true`, not only when the amount was above
  one.** `setItemDone` is written to be idempotent — calling it twice with the same state
  leaves the same row — so folding the amount into that same unconditional write keeps
  that property rather than adding a branch that has to be told about it separately.
