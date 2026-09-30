# "What can we cook?" from the pantry, and shopping lists grouped by aisle

- **Date** — 2026-09-30
- **Branch** — `ccr-ec7456ac-g5crww`
- **PR** — see the branch's PR
- **Reached production** — not yet

## The idea

Started as "suggest some features"; the user picked two. A pantry button showing the five
recipes that use most of what is in, with extra ingredients typed in for the moment; and a
per-list setting that groups a shopping list by the shop's aisles.

## The route

Suggestions → user picked two → asked two scoping questions up front (how an aisle is
decided: word list + AI + remembered; fixed aisle order) → built the pantry sheet → first
screenshot → built aisles (schema, migration, word list, fourth AI reader, move drawer,
grouped rendering) → screenshot showed the list *not* grouped → restarted the dev server →
grouped. Pushed as work in progress; the user's one change was to make the pantry button an
icon. Then tests (unit, integration, one browser spec), English screenshot, PR.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | Two `AskUserQuestion`s settled the aisle design before any code |
| Reading the codebase | medium | pantry matching, meal ranking, list rows, version hash, pantry-sort reader |
| Building | most | aisle grouping touches schema, version hash, route, page, rows, a reader |
| Tests | medium | two small fixes: `shoppingText` capitalises, `submit` takes fields not FormData |
| Review, CI, deploy | small | pre-push hook ran the full suite |

## What should have been quicker

- **A stale dev server after a schema change cost a screenshot round.** `prisma generate`
  ran, but the already-running `next dev` kept the old client, so `list.groupByAisle`
  read as `undefined` and the page silently drew the ungrouped list. No error anywhere.
- **The screenshot throwaway was written from scratch again** (login, seed a home with
  recipes/pantry/list). Still no committed helper; CLAUDE.md already notes this gap.
- **The pre-push hook's browser build broke the running dev server** (it builds into the
  same `.next`), so the next screenshot's login answered 500. Cost a restart and a
  `rm -rf .next`; now in CLAUDE.md beside the first one.
- **The throwaway seed script sat in the repo root and failed the pre-push lint.** Put
  throwaways in the scratchpad, or name them outside `src`/`tests`/`e2e` *and* outside the
  root — ESLint walks the root.
- The auto-mode classifier refused several Bash calls transiently at the start; read-only
  tools carried on meanwhile.

## What CLAUDE.md did not say

That a running `npm run dev` must be restarted after `prisma generate`, and cleaned
(`rm -rf .next`) after anything builds into `.next` — both now in CLAUDE.md under
*Commands*, beside the `pkill` line. The two features' own rules are new sections too.

## Decided rather than known

- Cook-from-pantry drops derived staples (`staplesOf`) from both "have" and "missing", and
  counts a qualifier-dropped match ("røget paprika" ← "paprika") as having it.
- It includes recipes in categories excluded from dinner suggestions.
- Aisle memory is per home, keyed by `pantryKey`, not per list.
- Unplaced items are drawn first; dragging is off on a grouped list (user agreed).
- The pantry button is an icon (user asked), with the label as its accessible name.
- The aisle reader's rate limit is 40 per window (`"aisle-sort"`), silent when exceeded.
