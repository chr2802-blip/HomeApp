# A clearer loading state for the recipe importer

- **Date** — 2026-09-21
- **Branch** — `claude/ai-loading-state-9izwoq`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

The AI recipe import (fetch a page or read a pasted caption, then have Claude write it
up) can now take a while, and the only sign of that was a small button whose label
changed to "Fetching…". A cook watching it could easily read that as nothing happening
and press it again, or give up. Asked for: make it obviously working.

## The route

Read `recipe-import-field.tsx` and `new-recipe-dialog.tsx` to find where the two round
trips (`handleFetch`, `handleCaption`) live, then looked at the existing spinner
convention (`submit-button.tsx`, `form-dialog.tsx`'s `DialogSubmitButton`) to match it
rather than invent a new one. Added a `stage` state so the status message can name which
of the two waits is in flight, a shared `Spinner`, a status block (`role="status"`,
`aria-live="polite"`) below the fields that only appears while pending, and disabled the
url/caption inputs and the "Paste the description instead" toggle for the duration so
the form does not look editable mid-request. Verified with `npm run lint`, `tsc
--noEmit`, the full `vitest` suite, and `e2e/recipe-import.spec.ts` (all 14 cases still
pass unchanged, since none of them asserted on the removed "Fetching…"/"Reading…" button
text in a way the added elements would break).

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 5 min | Reading the two components involved |
| Building | 15 min | Status block, disabled fields, shared spinner |
| Tests | 20 min | Container had no Postgres or a stale Chromium revision; both needed fixing before anything could run |
| Review, CI, deploy | — | Not yet pushed |

## What should have been quicker

Getting the test suite runnable at all was most of the session: Postgres was a stopped
cluster with no password set, and the pre-baked Chromium under `/opt/pw-browsers` was
revision 1194 while the lockfile's Playwright wanted 1243, with a different internal
directory layout (`chrome-linux` → `chrome-linux64`, `headless_shell` →
`chrome-headless-shell-linux64/chrome-headless-shell`). Both are exactly what CLAUDE.md
already warns about — the warning saved having to diagnose either from scratch, but
building the actual per-file symlink tree by hand still cost real time. A small script
under `scripts/` that does this mirroring in one call (given a target revision) would
turn a five-minute manual `ln -s` loop into one command, and is worth doing the next time
this comes up a third time.

## What CLAUDE.md did not say

Nothing new — this was the exact scenario the container-setup paragraph already
describes, and it held up.

## Decided rather than known

The wording ("The AI is writing it up — this can take up to 20 seconds.") is a guess at
a number that reads as reassuring rather than alarming; nobody measured the importer's
actual p95 latency for this session. If it runs meaningfully longer than 20 seconds in
practice, the copy should say so instead.
