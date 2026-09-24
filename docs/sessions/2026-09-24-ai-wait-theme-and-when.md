# The AI wait in the home's colour, and only when the AI works

- **Date** — 2026-09-24
- **Branch** — `claude/loading-screens-ai-loader-qi7exd`
- **PR** — see the branch's PR
- **Reached production** — not yet

## The idea

Follow-up to #122: the full-screen loader should use only the home theme's colours, and
appear only when a save actually calls the AI.

## The route

Built both halves on the old branch, including a server-side skip of my own (a `readIn`
language on `cookSteps`). When asked to open the PR, `main` had meanwhile merged #123,
which had already made the save skip the reader for an unchanged recipe (`IN_FORMAT`,
`isInFormat`) and an untouched import (a signed reading token). The cherry-pick conflicted
on exactly that. Dropped my server rule, moved `main`'s comparison into `readingStands` in
`src/lib/cook.ts`, and pointed the form's wait at it through `needsReading`.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | some | `readForSaving` read every save |
| Building | most | then half of it rebuilt on `main`'s rule |
| Tests | some | a stale Prisma client after rebasing looked like type errors |
| Review, CI, deploy | — | |

## What should have been quicker

Building a server-side skip that `main` was building at the same time in another session.
A `git fetch origin main` before starting the second half would have shown #123 in flight.
And after moving onto a newer `main`, `npx prisma generate` before `tsc`: the pantry's new
columns showed up as a dozen type errors that had nothing to do with this change.

## What CLAUDE.md did not say

That the AI wait's visibility and the save's skip are one rule — now written under "A new
recipe starts by asking how".

## Decided rather than known

- Colours: `--accent`, `--accent-hover` and `color-mix`es of the accent with white only.
- For a create, the form trusts an import's `reading` while the lines are unchanged; the
  server still verifies the token, so a token that fails there shows no wait for a save
  that does read — rare, and the opposite error from the one asked about.
- Rate limits, a missing key and the monthly cap are known only to the server, so the wait
  can still show briefly for a save the server then declines to read.
