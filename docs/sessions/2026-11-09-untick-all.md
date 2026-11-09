# Untick every item on a list at once

- **Date** — 2026-11-09
- **Branch** — `claude/bulk-uncheck-list-items-lmc1n1`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

"Remove every tick on a list in one go, not one at a time — a packing list is used again
later." It meant: put the ticked rows back as open rows, not delete them.

## The route

Read `list-items.tsx`, `list-writes.ts` and the list actions → added `setItemsUndone` and
`untickListItems` → optimistic `untick` change recorded as one queued `tick` op per row →
`aside` slot on `Collapsible` for a button on the "Completed" heading → screenshot of the
Danish packing list (needed a throwaway script: the screenshot tool cannot open a sheet)
→ integration and browser tests → noticed a queue over `MAX_OPS` would be refused whole
forever, and made the flush send in batches.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | medium | `list-items.tsx` is 850 lines; the queue lives in two files |
| Building | small | |
| Tests | medium | e2e needs a build first |
| Review, CI, deploy | — | |

## What should have been quicker

The throwaway screenshot script failed first on `DATABASE_URL`: `tsx` does not read
`.env`, `screenshot.ts` gets it from the npm script. `npx tsx --env-file=.env` is the fix.

## What CLAUDE.md did not say

That a throwaway importing Prisma is run with `npx tsx --env-file=.env` — added to the
Commands paragraph about throwaways.

## Decided rather than known

- The button lives on the "Completed" heading, visible while folded, rather than in the
  list's three-dot menu.
- It asks first (drawer, home colour), rather than acting at once with an undo.
- Unticked rows keep their positions rather than moving to the end like `restoreItem`.
