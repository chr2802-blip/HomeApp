# Production build failed on a unit test's cold import

- **Date** — 2026-09-25
- **Branch** — `claude/cook-mode-timer-reset-ssfnt5`
- **PR** — see branch
- **Reached production** — not yet

## The idea

The deploy of `046c31f` (#133, cook-mode resume) failed in `npm run build`. The failing
test was `ai-readers.test.ts > names a priced model…`, which #133 did not touch: it timed
out at 5000ms.

## The route

Vercel's build log could not be read from the session (the connector had no access to
the `chris-gri-ll` team scope). The full `npm run build` passed locally, so the failure
looked environmental, and the log had to come from the user. It showed the timeout. The
test called `vi.importActual("@/lib/ai-usage")` inside its body, which loads the Prisma
client cold: 1667ms locally with nothing else running, past 5s on Vercel's build machine.
Moved to file level: 2ms.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | medium | No log access; reproduced the build locally first |
| Reading the codebase | small | |
| Building | small | One line moved |
| Tests | small | |
| Review, CI, deploy | — | |

## What should have been quicker

Reading the build log. The Vercel connector answered 403 for the team scope, so a round
trip to the user was the only way to see which step failed. Reconnecting the connector
with team access would have made this one call.

## What CLAUDE.md did not say

That a test's timeout covers dynamic imports in its body, so a cold Prisma client import
can fail the production build on its own. Added under *Tests gate everything*.

## Decided rather than known

- That the machine's load, not a hang, was the cause: the test passes in 1.7s cold
  locally and nothing in it waits on I/O once the SDK is mocked.
