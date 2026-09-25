# Cook mode and its timers survive the phone discarding the page

- **Date** — 2026-09-25
- **Branch** — `claude/cook-mode-timer-reset-ssfnt5`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

On an iPhone, leaving cook mode for ~30 minutes in other apps came back outside cook mode
with the timer gone. It meant: iOS discards the installed app's page and relaunches it at
the manifest's `start_url` (`/dashboard`), and everything cook mode held was React state.

## The route

Read `cook-mode.tsx` and the manifest; `start_url: "/dashboard"` was the answer. Timers
were already `endsAt`, so only persistence and a way back were missing. Added
`lib/cook-session.ts`, restore/save/clear-on-unmount in `CookMode`, `ResumeCooking` in the
app layout, clearing on logout, a unit test and an e2e test. `npm run verify` green first
time.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | The cause is the relaunch URL, not the timer maths |
| Reading the codebase | small | One component, one manifest |
| Building | medium | |
| Tests | medium | Full verify incl. e2e ~5 min |
| Review, CI, deploy | — | |

## What should have been quicker

Nothing written down said an installed app on iOS restarts at `start_url` after being
killed in the background, so "no longer in cook mode" first read like a routing bug. It
is now in CLAUDE.md under action mode.

## What CLAUDE.md did not say

That any state worth keeping across a backgrounded half hour must be in storage, because
the relaunch lands on `/dashboard`. Written into the action-mode section.

## Decided rather than known

- `RESUME_WITHIN_MS` is 2 hours after the last page turn or the last timer's end.
- A fresh load anywhere in the app redirects to the saved cook page, once per document.
- A timer that ended while the page was dead is shown as done on return; no notification
  is sent while the page is dead (that would need push, and is not attempted here).
- Not tested on a real iPhone — the e2e simulates the relaunch with a fresh load of
  `/dashboard`.
