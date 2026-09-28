# Pantry "Add to list" as an icon, only under "Only run out"

- **Date** — 2026-09-28
- **Branch** — `ccr-81d98f43-0wzrff`
- **PR** — not opened
- **Reached production** — not yet

## The idea

The labelled "Add to list" button beside the pantry's title took too much room. Use the
recipe ingredients' cart icon instead, beside the "· N run out" line, drawn only while the
"Only run out" filter is on.

## The route

Read `AddToListMenu`, the pantry page and `PantryShelves`; passed the menu (in `sheet`
mode) into `PantryShelves` as an `addToList` node; updated the one e2e test that pressed it
and the CLAUDE.md paragraph that described where it was drawn. One screenshot through a
throwaway spec, pantry e2e and unit suites green.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | Screenshot made it plain |
| Reading the codebase | 3 min | |
| Building | 3 min | |
| Tests | 10 min | `npm run setup` then `e2e:build` for the screenshot |
| Review, CI, deploy | — | |

## What should have been quicker

The screenshot: `npm run db:seed` needs `SUPER_ADMIN_*` env and seeds no household, so a
dev-server shot of a populated pantry meant building for e2e and writing a throwaway spec
on the fixtures instead. A seeded dev home would have saved the build.

## What CLAUDE.md did not say

That `db:seed` is not enough to screenshot a page with data; the throwaway e2e spec (copy
the helpers from the page's own spec, add `test.use({ viewport })`) is the route that works.

## Decided rather than known

- Under the filter the icon is drawn whatever the count, kept from the old "optimistic
  quantities" reasoning.
