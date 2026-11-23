# A more distinctive logo

- **Date** — 2026-11-23
- **Branch** — `ccr-7ccdb03d-ms9typ`
- **PR** — not yet
- **Reached production** — not yet

## The idea

The icon was a generic house on dark slate. Asked for something more its own. Four sketches
went out (h-as-house, roof + tick, heart in house, pot with a roof); the household asked for
roof + tick combined with the pot, and picked the line version: a roof resting on a pot with
a tick inside — home, recipes and lists in one mark.

## The route

Sketches as SVG in the scratchpad → comparison sheet screenshotted with Playwright → choice
→ three combinations → choice (E3) → `public/icon.svg`, `public/icon-maskable.svg`, and every
raster drawn from them by the new `scripts/render-icons.mjs`.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | short | Two rounds of screenshots settled it |
| Reading the codebase | short | Icons are four files and one test |
| Building | most | Drawing and rendering variants |
| Tests | short | `app-icon.test.ts` pinned the old black background literally |
| Review, CI, deploy | — | |

## What should have been quicker

`page.setContent` cannot load `file://` images, so the first preview sheet came back empty
and had to be written to a file and navigated to. The favicon had no recipe for being
rebuilt without ImageMagick; it is now packed by hand as PNG-in-ICO in the script.

## What CLAUDE.md did not say

How to re-render the raster icons — it said "a throwaway script". There is now
`scripts/render-icons.mjs`, named in CLAUDE.md under the Android icon trap.

## Decided rather than known

- Background `#2f2a3a` (a warm, near-black plum) and the tick in `#e8a93b`. The tick is amber,
  which inside the app means "overdue" — the rule is about the app's meanings, not its mark,
  so it was left; worth revisiting if it reads wrong beside an overdue task.
- The maskable mark is scaled to 82% so the roof's ends clear Android's circle with room.
- The test now accepts any opaque full-square background rather than exactly `#000000`.
