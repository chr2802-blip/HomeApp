# A black app icon on Android, with no white ring

- **Date** — 2026-10-04
- **Branch** — `claude/home-app-android-border-97a80p`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"The home app has a white border on Android, make it all black." It meant the launcher
icon: Android set the dark rounded square on a white circle, because the manifest offered
only a `purpose: "any"` SVG. The fix is a full-bleed black `maskable` icon.

## The route

I read "border" as the phone's status and gesture bars, which CLAUDE.md covers at length
(the linen `--band`), and started making those strips black. The user said "No", then
"The app icon", then sent a screenshot of the app drawer. Then: a maskable SVG, PNGs
rendered with Playwright, manifest entries, and a unit test. Discarding the bar edits
with `git checkout` was refused by the permission classifier, so they are still in the
working tree, uncommitted, for the user to decide on.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | most of it | the wrong reading came first and got half built |
| Reading the codebase | short | theme and frame docs, all of it irrelevant in the end |
| Building | short | SVG, rendered PNGs, manifest |
| Tests | short | `app-icon.test.ts` |
| Review, CI, deploy | — | not pushed through a PR |

## What should have been quicker

Asking which border before building. "Border on Android" fits both the system bars and
the launcher icon, and CLAUDE.md's long section on the bars pulled me straight to the
wrong one. One question, or asking for a screenshot first, would have saved the whole
first half.

## What CLAUDE.md did not say

That the launcher icon is a manifest `maskable` question, and how to make PNGs with no
image tools in the container. Both are now under "Traps worth knowing".

## Decided rather than known

- Plain `#000000` behind the mark rather than the old `#0f172a`, because "all black" was
  the ask. The `any` SVG (desktop installs, notifications) is left as it was.
- PNG and not SVG for the maskable entries, because WebAPK minting is most reliable
  with PNG at 512.
