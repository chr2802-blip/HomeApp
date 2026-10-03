# Rethink the bottom navigation — first rough version

- **Date** — 2026-10-03
- **Branch** — `ccr-b33675cd-a8njj9`
- **PR** — none yet (rough version shown as screenshots, waiting on feedback)
- **Reached production** — not yet

## The idea

The tab bar had five tabs (six for the super admin), and some were closely tied (Meals and
Recipes). Asked how it would look starting over. It became four tabs, each an area with
segments: Home · Food/Mad (Recipes | Plan, opening on Recipes) · Lists/Lister (Lists | Forråd) · Tasks. The pantry
becomes "Forråd"/Supplies because it now holds non-food too (toilet paper).

## The route

Two rounds of discussion in chat, then a rough build: nav items carry `also` paths for
their other segments, a `SectionTabs` switcher is drawn in the app layout on a segment's
top-level page, `BackButton`'s roots include the new segment pages, and the pantry's title
is renamed. Seeded a dev DB with an EN and a DA home and took 390×844 screenshots. Three browser
specs (the meals tab, the Danish pantry title, the page-animation walk) failed the first push and
were updated; the e2e specs that walk the old tabs will need updating once the design settles.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | Design question first, build later |
| Reading the codebase | small | nav-items/bottom-nav/back-button were easy to find |
| Building | small | |
| Screenshot setup | most of it | seed script failed twice, then a dev overlay over the tab bar |
| Tests | none yet | |

## What should have been quicker

The throwaway seed. It failed first on a theme name that doesn't exist (`SAGE`), then on
`List` needing `createdBy`, and each attempt needed a TRUNCATE in between. Then Next's dev
overlay covered the tab bar, the one thing being shown, and finding out it was a hydration
warning this change didn't cause took two more scripts. A committed screenshot helper with a
known-good seed would remove all of that. That's still the open gap CLAUDE.md names.

## What CLAUDE.md did not say

That `List` needs `createdBy`, the real `HomeTheme` names, and that the dev overlay comes
from a hydration warning that predates this change, plus how to hide it. All three are now
in the "dev database for screenshots" paragraph of CLAUDE.md.

## Decided rather than known

- Tab names were settled by the user after the first screenshot: Mad and Lister (not
  Indkøb), and Mad opens on Opskrifter rather than the plan.
- The switcher is a pill-style segmented control; segment links use `replace`, so back
  doesn't walk the segments.
- The pantry stays `/pantry` and `PantryItem` internally; only the visible name changed.
