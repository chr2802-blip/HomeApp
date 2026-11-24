# A tab bar with chosen tabs, and a baby log

- **Date** — 2026-11-24
- **Branch** — `ccr-fe688281-tz992p`
- **PR** — not opened (asked for commits only)
- **Reached production** — not yet

## The idea

The tab bar had no room for a fifth tab. It became Home · two pins · + · Menu, the pins
chosen per person, with a drawer of every tab. Then a Baby tab: sleep, feeds and nappies
logged one-handed, with a timeline and charts.

## The route

Read the nav, settings and data layer → plan approved → design-canvas mockups approved →
four commits: navigation, baby model, registrations and overview, charts. Each one was
screenshotted at 390×844 in Danish before its tests were written.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | The plan and mockups settled the layout once |
| Reading the codebase | medium | Nav, auth's session shape, copy typing, homeDb creates |
| Building | most | The baby page and its sheets are the bulk |
| Tests | medium | Four e2e specs leaned on Tasks being in the tab bar |
| Review, CI, deploy | small | Full suite run once at the end |

## What should have been quicker

- **Opening a sheet for a screenshot needed a throwaway script every time.** `npm run
  screenshot` now takes `--press "<button name>"` (repeatable), which covered every sheet
  in this session.
- **`satisfies Record<string, Phrase>` without `as const` silently loses the slot types**,
  so `say(phrase, { n })` fails to compile with "Expected 1 arguments". Every existing copy
  file writes `as const satisfies`; nothing said why.
- **The back arrow's list of tab roots was a second list of the tabs** (`back-link.ts`)
  and drew an arrow on the new tab. It now reads `TAB_PATHS_BY_KEY`.
- **A creation through `homeDb` still needs `homeId` in `data`** for the types, though the
  extension stamps it — found by a type error, then by reading `pantry.ts`.

## What CLAUDE.md did not say

Written in this commit: the tab bar section (and that phone e2e tests should use Food or
Lists), the baby log section, `--press` for screenshots, and the in-bar "+" replacing the
greyed one. Not written, because it is now enforced by the type error it causes: the
`as const satisfies` on copy files.
