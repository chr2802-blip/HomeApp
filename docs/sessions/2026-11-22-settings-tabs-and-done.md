# Settings in tabs, and a tab of who has done what

- **Date** — 2026-11-22
- **Branch** — `ccr-2f45b20d-41zbwg`
- **PR** — not yet
- **Reached production** — not yet

## The idea

"Split Settings into tabs like the Swingkings app, and add a tab showing completed tasks
across the home's members." The second half meant a new table: nothing recorded *who*
pressed Done, only when the task was last done.

## The route

Read Swingkings' `TeamSettingsScreen`/`SwipePages`, then found HomeHub already had the same
idea as `SectionTabs` (Recipes | Plan) — reused that instead of porting a second swiper.
Split `/settings` into a layout and five pages, added `TaskCompletion`, a demo history, and
the Done tab. First screenshot showed "Categori…" and "Medlem…" truncated in the pill →
shorter labels. Fourteen e2e specs went to `/settings` for things that moved tabs; one
theme test read the new pill as a second tab bar.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | medium | Swingkings' tabs vs HomeHub's section pill |
| Building | medium | |
| Tests | medium | finding every e2e that visited `/settings` for something that moved |
| Review, CI, deploy | — | |

## What should have been quicker

Finding which e2e specs depended on what was on `/settings`: a grep for the path lists
fifteen files, and each had to be read to see which tab its assertions now live on. And
the theme spec's "every painted nav" rule broke on a page that had never had a section
pill — written down under *Traps* now.

## What CLAUDE.md did not say

That `<Card className="p-0">` does not remove the padding (the members card had been
drawn padded all along) — now under *Traps*. How Settings is split, and that its actions
revalidate the layout — now under *Administration is two different things*.

## Decided rather than known

- The tab grouping and names (Home · People · Categories/Sorting · Done · Status).
- A 90-day window for the tally (first 30, changed to 90 at the household's request), and the latest 20 presses listed.
- The tab is admin-only, as all of Settings is; members do not see the counts.
- `TaskCompletion.title` is copied at the press, and both relations `SetNull`, so credit
  survives the task being deleted or the person leaving.
- `reopenTask` removes the newest completion row; existing completions before this change
  are not back-filled (there is nothing to fill them from).
