# Recipe ratings, 1 to 5 hearts

- **Date** — 2026-09-26
- **Branch** — `claude/recipe-rating-system-aksnzx`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

Rate a recipe 1–5 hearts from its page; show the average on the card where "Includes a
video" used to be (time · rating). Clarified mid-session: **every rating counts**, the same
person included — the score evolves over time, it is not one opinion per person.

## The route

Read the recipe card, the detail page, `ListFavorite` (the nearest per-person, no-homeId
model) and `home-db.ts`. Started a one-row-per-person design; the user stopped it and said
ratings accumulate. Switched to one row per rating. Schema + migration, homeDb
classification, lint rule, storage breakdown, action, component, copy, unit + integration +
tenancy + e2e tests.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | per person vs per press was the one real question |
| Reading the codebase | medium | many places a new no-homeId model has to be named |
| Building | medium | |
| Tests | small | e2e build is the slow part |
| Review, CI, deploy | — | |

## What should have been quicker

A new model with no `homeId` has to be named in five places: `NO_HOME_ID` in
`home-db.ts`, the refuse list in `tests/unit/home-scoping.test.ts`, the lint rule in
`eslint.config.mjs`, the `breakdown` query in `src/lib/storage.ts`, and a tenancy test. Only
the first is enforced (by the unit test); the storage query in particular fails silently —
the rows are simply not counted. Found by grepping for `ListFavorite`.

`prisma migrate diff --from-migrations` fails with P3015 if the new, still-empty migration
directory already exists — create it after generating the SQL.

## What CLAUDE.md did not say

The checklist above for a no-homeId model. Not added as a convention yet — first time it
has cost anything; a test walking `storage.ts` against the schema would be the real fix.

## Decided rather than known

- Hearts in the home's `--accent`, not red (red is reserved for "about to be deleted").
- Average shown to one decimal, whole numbers without ",0".
- Ratings survive the rater's account being deleted (`userId` → null).
- No way to undo a mis-tapped rating; the buttons are disabled while a press is in flight.
- The rating card sits between the buttons and the ingredients on the recipe page.
