# iPhone users keep having to turn notifications back on

- **Date** — 2026-11-21
- **Branch** — `ccr-31ffa788-xxqv54`
- **PR** — not yet
- **Reached production** — not yet

## The idea

The report was "do notifications expire?". They do not, in this app. What happened was that
a subscription lost on either side was never put back: the browser losing it brought back
the "turn on" offer, and the server losing it left a browser reading "on" that heard nothing.

## The route

Read `push-client.ts`, `sw.js` and `push.ts`, explained the causes, then built the fix on
request. `readPushState` now heals once per page load (from `OfflineSupport`, on every page
of the app). It hands an existing subscription back to the server, and subscribes again
without asking when the permission is still granted. The push handler can no longer throw
before `showNotification`, and the worker resubscribes on `pushsubscriptionchange`.
Checked in Chromium with `PushManager` stubbed through an init script, in four cases:
granted but lost (resubscribed and sent), granted and present (sent again), never asked
(offer shown), and granted but refused without a press (offer shown).

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | small | push is three files |
| Building | small | |
| Tests | most of it | `npm run setup` from cold, then a throwaway browser script |
| Review, CI, deploy | — | |

## What should have been quicker

The throwaway browser check took three runs. The first used the wrong cookie name: it is
`homehub_session`, not `session`. The second failed because `tsx` compiles a function
passed to `addInitScript` with esbuild's `__name` helper, which the page does not have
(`__name is not defined`, swallowed as a page error). Passing the init script as a string
works.

## What CLAUDE.md did not say

The `addInitScript` trap. It is now under *Traps worth knowing*, together with the push
self-healing rule.

## Decided rather than known

- Whether WebKit lets `pushManager.subscribe` run without a press once permission is
  granted is not documented. The code tries, and falls back to the offer if refused. Only a
  real iPhone can confirm this.
- Healing re-claims the endpoint for whoever is signed in on every load. That is what
  `saveSubscription` already did on a press, and a shared tablet whose last user's session
  simply expired now stops hearing about that person's home.
- The test endpoint could not be saved here (no DNS in the container, so `assertPublicUrl`
  refuses it). Only the request carrying it to the server was observed.
