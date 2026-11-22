# Dashboard shows only tasks due today or overdue

- **Date** — 2026-11-22
- **Branch** — `ccr-8aa6d495-hvpr7n`
- **PR** — none yet
- **Reached production** — not yet

## The idea

The dashboard's "Today" listed every task due within three days. Now it lists only what
is due today or already overdue; later work is on `/tasks`.

## The route

Found the query (`soon = now + 3 days`) in `dashboard/page.tsx`, swapped it for
`endOfDayInZone(now)` — the bound the reminder job already uses. One e2e test asserted
a snoozed task stayed on the dashboard as "Due tomorrow"; it now asserts the row leaves.
Screenshot, tsc, lint, `tasks.spec.ts` + `suggested-recipe.spec.ts` green.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | |
| Reading the codebase | 2 min | one grep found it |
| Building | 1 min | |
| Tests | 5 min | `npm run setup` + build for e2e |
| Review, CI, deploy | — | |

## What should have been quicker

Cold-checkout setup (`npm ci`, Postgres) was most of the wall-clock for a two-line change.
`npm run setup` handled it unattended, so nothing to fix.

## What CLAUDE.md did not say

That the dashboard's due window was three days. Now written under the dashboard section.
