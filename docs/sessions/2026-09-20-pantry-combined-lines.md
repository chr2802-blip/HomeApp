# Combined ingredient lines the pantry only partly answers for

- **Date** — 2026-09-20
- **Branch** — `claude/pantry-duplicate-ingredients-jrirst`
- **PR** — not yet
- **Reached production** — not yet

## The idea

A recipe line naming more than one thing ("Salt og peber") was matched against the pantry
as one whole key, so it never recognised two separate entries ("Salt", "Peber") — even
where both were in stock, the combined line still went on the shop. It turned out to mean
two things: fix the case where every part *is* stocked (should behave exactly like a
single-item line), and, where the pantry only has some of it, ask rather than silently
guessing either way.

## The route

Diagnosed from the report, then built directly — no wrong turns worth naming, but one
thing surfaced only once the UI half was underway: `add-to-list-menu.tsx` is a client
component, and it needed a value import from `src/lib/pantry.ts` for the new field names
and `pantryNote`. That file imported `homeDb` at its top for `stockedKeys`, so the import
would have pulled a live Prisma reference into the client bundle. Caught by rebuilding and
comparing bundle sizes before and after splitting `stockedKeys` out into its own file
(`src/lib/pantry-stock.ts`) — `/recipes/[id]`'s First Load JS dropped from 134 kB to
118 kB, `/meals`'s from 133 kB to 116 kB, which is what the extra weight actually cost.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 10% | Reading `pantry.ts`/`shoppingText` to see the whole-line matching was deliberate, not a bug. |
| Reading the codebase | 20% | `ActionResult`'s shape, `AddToListMenu`'s self-managed transition (not `useActionState`), `Modal`/`ModalFooter` conventions. |
| Building | 35% | The split logic, the two-phase action return, the confirm dialog. |
| Tests | 20% | Unit, integration, and two new browser specs — plus discovering and fixing the client-bundle issue. |
| Review, CI, deploy | 15% | Environment had no Postgres or Playwright browsers wired up yet; see below. |

## What should have been quicker

Setting up a database and browser to verify against. This sandbox had neither Docker
running nor `DATABASE_URL` set, and Playwright's pinned browser revision didn't match
what was pre-installed — none of that is specific to this change, so every session
starting here pays it. Starting `postgresql` via `service`, pointing `DATABASE_URL` at a
locally created database, and passing `executablePath` to Playwright's launch options
got past both; see below for the durable fix.

## What CLAUDE.md did not say

Nothing about verifying a change actually reaches a client bundle cleanly — the codebase
already has one documented instance of this (`recipe-import.ts` pulling in `sharp`), but
the lesson was stated for that one file rather than as a general check. Worth adding: any
new import into a `"use client"` file from a module also used by server code is worth a
`npm run build` and a glance at the affected route's First Load JS, not just a passing
`tsc`.

This environment also has no committed instructions for standing up Postgres without
Docker (only `docker start homehub-pg` is documented) or for Playwright's browser/version
mismatch. Neither belongs in `CLAUDE.md` itself — both are properties of *this* sandbox,
not of the app — but a `.claude/` session-start hook that starts `postgresql` and points
`DATABASE_URL` at a local database, and that passes Playwright's `launchOptions.executablePath`
at the pre-installed browser, would spare the next session both diagnoses.

## Decided rather than known

- **What counts as "one thing" inside a line**: split only on "og" / "and" / "&", not on
  commas — commas are already spoken for as the preparation note. Untested against any
  recipe actually using a third conjunction; if one shows up, extending `CONJUNCTION` in
  `src/lib/pantry.ts` is the whole fix.
- **A line with some but not all parts stocked defaults to "still add" (every box
  starts checked)**, so ignoring the dialog behaves like a press always used to.
  Nobody asked for a different default — this is a guess at least surprising.
- **The pantry note's `pantryNote` function is reused verbatim for a single ambiguous
  line's caption**, rather than writing a second, shorter formatter — it already reads
  correctly for one or two names, and only the three-or-more "and 2 more" branch was
  never going to trigger from a single line's parts.
