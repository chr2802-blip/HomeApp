# Timers that survive cooking two recipes at once

- **Date** — 2026-09-26
- **Branch** — `claude/recipe-switching-timer-ux-v1gotc`
- **PR** — first of two (the recipe switcher follows on top of it)
- **Reached production** — not yet

## The idea

Somebody cooked two recipes at once, jumped between their action modes, and the first
recipe's timers stopped. It turned out to mean: the timers were React state inside
`CookMode`, and the one saved cook session was cleared the moment that screen unmounted —
so walking to the second recipe was, as far as the code knew, "done cooking".

## The route

Read `CookMode`, `cook-session.ts`, `ResumeCooking` and the cook e2e spec. Replaced the
single session with a *kitchen* (`cooks`, `timers`, `open`) held by a provider in the app
layout, with pure transitions in `cook-session.ts` so the unit tests can drive two
recipes at once. `CookMode` reads and writes through it; a new `KitchenTimers` draws them
above the tab bar everywhere else. An older build's single session is read as one open
cook, so a deploy landing mid-dinner loses nothing.

The first e2e run failed: the test opened the second recipe with a fresh `page.goto`,
which — the first screen never having unmounted — is exactly what a killed page looks
like, and `ResumeCooking` pulled it back to the first recipe. Real, too (a bookmark to a
cook page mid-dinner would do it), so a fresh load already on a cook page is now left
alone.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | the cause was one line in `cook-mode.tsx` |
| Reading the codebase | small | |
| Building | moderate | the storage model, then the provider |
| Tests | moderate | one e2e round on the resume redirect |
| Review, CI, deploy | | |

## What should have been quicker

The e2e build before a single spec (`npm run e2e:build`) is most of the wall-clock of a
one-spec loop; there is no cheaper way to run one browser test against a change.

## What CLAUDE.md did not say

That action mode's "unmount clears the session" rule silently assumed one recipe at a
time. The rule is now rewritten as `open` plus the kitchen, in the action mode section.

## Decided rather than known

- Completing a recipe's last step takes it off the stove but leaves its timers running:
  the last step is as often "bake for 40 minutes" as anything.
- Finished timers stay until dismissed, and are let go after `RESUME_WITHIN_MS`.
- Inside action mode, pressing this recipe's own timer stops it (as before); pressing
  another recipe's goes to that recipe. Outside, a chip goes to its recipe and its cross
  stops it.
