# The list's bar fills up when the list is opened

- **Date** — 2026-10-04
- **Branch** — `ccr-d9c4f988-hcm8n2`
- **PR** — not opened
- **Reached production** — not yet

## The idea

"Make the progress bar dynamic: 0% when I enter, 100% when everything is ticked." The bar
already tracked ticks live. What was meant, once two readings were put back to the user,
was that the bar should fill from empty up to where the list is when the page opens,
rather than appearing already part way along.

## The route

Asked which of two readings was meant (fill-in on arrival, or a per-visit 0% baseline,
advised against). Then `npm run setup`, the change (a `fillIn` prop on `ProgressBar`, a
`from`-only keyframe), a seed script, screenshots, an e2e assertion, and `verify`.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | short | one round of clarification |
| Reading the codebase | short | `ProgressBar` and its comments said everything |
| Building | short | |
| Tests | medium | screenshot loop, below |
| Review, CI, deploy | — | |

## What should have been quicker

The screenshot. The first script measured the fill's width well after a dev-mode page
had compiled and the 0.6s animation had finished, which looked like the CSS not applying
and cost three diagnostic runs. Slowing animations through CDP
(`Animation.setPlaybackRate`) fixed it at once. The seed script also failed once on
`List.name`, which is `title`.

## What CLAUDE.md did not say

Both of the above, now written in: the CDP playback-rate trick under *Show the change on
screen first*, and `List`'s `title` beside the seed-script notes. The new behaviour itself
is a clause in the ticking-off section.

## Decided rather than known

- 600ms with a 120ms delay, ease-out. Long enough to read as filling, short enough not to
  be in the way on every visit.
- Only the list's own page fills in; the cards and the dashboard do not.
