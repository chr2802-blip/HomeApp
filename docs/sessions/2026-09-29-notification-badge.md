# A house in the status bar instead of a white square

- **Date** — 2026-09-29
- **Branch** — `ccr-e963886f-vubukg`
- **PR** — not opened
- **Reached production** — not yet

## The idea

Notifications showed a plain white square in the phone's top bar; show a house instead.
The square was the push's `badge`, which was the full app icon (`/icon.svg`).

## The route

Found `badge: "/icon.svg"` in `public/sw.js`'s push handler. Android draws a badge from
its alpha channel only, so the icon's opaque rounded square became a solid white square.
Drew `public/badge.png` — the same house path as `icon.svg`, white on transparency, 96×96
— and pointed the badge at it. PNG rather than SVG because Chrome on Android does not
draw an SVG badge. Added it to the service worker's kept assets beside `icon.svg`.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | minutes | one grep |
| Reading the codebase | minutes | |
| Building | ~10 min | no image tool in the container; the PNG was rasterised by a throwaway Python script |
| Tests | setup + verify | cold checkout, `npm run setup` |
| Review, CI, deploy | — | |

## What should have been quicker

Making a PNG: the container has no ImageMagick, rsvg or PIL, so a ten-second icon export
became a hand-written rasteriser. Next time, render the SVG with the Playwright Chromium
that `npm run setup` already stands up.

## What CLAUDE.md did not say

That a notification badge must be a separate alpha-only image. Now said in a comment on the
`badge` line in `public/sw.js`, which is where anyone changing it will be looking.

## Decided rather than known

- 96×96 with ~6px padding. Android scales it down to 24dp; not checked on a real phone
  from here. The `icon` (large picture beside the text) is left as the app icon.
