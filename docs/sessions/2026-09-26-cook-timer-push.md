# Cook-mode timers that ring on a locked phone

- **Date** — 2026-09-26
- **Branch** — `claude/cook-mode-timer-notifications-efw1s9`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

Asked: "timers in other apps show outside the app, notify, or ring an alarm — what can we
do?" It meant the timer has to reach a phone whose page is not running. For a web app that
is only a push sent from somewhere else at the right time. The person chose QStash for
that, and turned down handing the timer to the Clock app.

## The route

Answered the question first (Live Activities and alarms are native-only; push is what a
PWA gets). Then: SDK → `lib/cook-timer-push.ts` → two routes → cook-mode wiring →
integration + e2e tests → docs. `npm run verify` went green on the first full run apart
from `untranslated.test.ts` wanting the routes' JSON error strings in `ALLOWED`, and four
lint warnings from unused mock parameters.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | a question first, a build second |
| Reading the codebase | small | push, cook session, sw.js were each one file |
| Building | most | the in-flight id race (a timer stopped before its push id comes back) |
| Tests | medium | e2e has no VAPID keys, so the offer itself cannot render there |
| Review, CI, deploy | — | not yet |

## What should have been quicker

The untranslated-strings test caught the API route's `{ error: "Not a timer" }` only after a
full run. Every API route has needed an `ALLOWED` entry for the same reason, and nothing
says so before you write one. That is a note here rather than a CLAUDE.md rule until it
comes up again.

## What CLAUDE.md did not say

How cook-mode timers reach a locked phone. That is now a bullet under *A recipe is also
read at the hob*.

## Decided rather than known

- **No server-side row for a timer.** The QStash message id is kept on the browser's timer
  and used to cancel. A row would be a second copy of the timer.
- **Cancelling checks ownership by reading the message back from QStash** (one extra call)
  rather than signing the id. No new secret, and QStash is the authority on its own message.
- **The push always shows, even while the page is open on the counter.** The notification
  sound is what reaches somebody across the kitchen, and iOS penalises a push that shows
  nothing.
- **Ten minutes late is too late** (`STALE_AFTER_MS`). **A day is the longest timer**
  (`MAX_TIMER_MS`). **40 timers a quarter-hour** per person (`cook-timer` rate limit).
- **The callback address** is `APP_URL`, then `VERCEL_PROJECT_PRODUCTION_URL`, then the
  request's origin. Only `main` deploys, so the production address is this build.
- **Not verified against real QStash or a real iPhone**: no token in this container. The
  SDK calls (`publishJSON` with `notBefore`, `messages.get`/`cancel`, `Receiver.verify`)
  are mocked in the tests, so their real behaviour is taken on the SDK's documentation.
