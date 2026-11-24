# Carry on a finished breast feed or sleep

- **Date** — 2026-11-24
- **Branch** — `claude/optimistic-bohr-57ueci`
- **PR** — not yet
- **Reached production** — not yet

## The idea

"Save the times, e.g. a breast feed, and then start it again." Read as: a feed finished
with "Done · save" can be carried on as the same feed, timer picking up from its stored
sides, rather than starting a new one.

## The route

Read the baby action, lib and log component → `resumableFeed` in `src/lib/baby.ts`,
`resumeFeed` action, a "Carry on" card in the feed sheet → demo seed row for a feed finished
ten minutes ago → two screenshots sent → open questions back to the user (window length,
start immediately or paused, sleep too). Committed as a first rough version; tests not
written yet, pending the answers.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | one ambiguous sentence; interpreted, then asked with a screenshot |
| Reading the codebase | small | baby code is three files and well commented |
| Building | small | |
| Tests | small | unit for the window and `sleptMs`, integration for both resumes |
| Review, CI, deploy | — | |

## What should have been quicker

Nothing was done twice. The only wait was the cold `npm run setup` (npm ci) at session
start, run in the background while reading.

## What CLAUDE.md did not say

`--press` found only buttons, so a three-dot menu's "Edit" (a `menuitem`) could not be
reached for a shot of an edit sheet. `scripts/screenshot.ts` now finds menuitems too, and
the Commands section says so.

A first push was started in the background and then the tree edited under it; the
pre-push hook tests the working tree, not the commit, so it had to be killed. Push only
once the tree is what is being pushed.

## Decided rather than known

- 30 minutes (`RESUME_WITHIN_MS`) for both, the user's number.
- Carrying on leaves the timer paused; the next press on a side starts it.
- A sleep's awake time is one number, not a list of wakings; the charts take each day's
  share of it proportionally, since where it fell is not kept.
- The sleep button asks "carry on / new" only inside the window; outside it, one press as
  before.
