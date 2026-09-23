# Fix the "Ingredients" heading collapsing after "Add to list"

- **Date** — 2026-09-22
- **Branch** — `claude/headline-add-to-list-bug-mn6orb`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

Reported with a screenshot: pressing "Tilføj til liste" (Add to list) on a recipe page
turned the "Ingredients" heading into "INGRE / DIENT / S" — wrapped one character at a
time down to a sliver of a column, while the status note beside it read fine. Fix the
layout so the heading survives whatever length note the pantry sends back.

## The route

Read the screenshot, then `src/app/(app)/recipes/[id]/page.tsx`: the heading and
`AddToListMenu` share one `flex justify-between` row with neither side pinned. Read
`add-to-list-menu.tsx` to see where the long status line (`pantryNote`, joined onto
"Added to X") comes from — confirmed it only appears after a successful press, which is
why the bug only shows up *after* pressing the button rather than on first load. Found
`overflow-wrap: anywhere` on `body` in `globals.css`, there on purpose for pasted URLs and
long ingredient tokens — it also collapses a flex item's minimum width to one character,
which is what let the heading get squeezed instead of the note wrapping. Checked
`PageHeader` and the list detail page for the existing convention (the growing side gets
`min-w-0 flex-1`, the fixed side gets `shrink-0`) — this row had neither. Added `shrink-0`
to the heading, which is the short, fixed side here; the note already shrinks and wraps
fine on its own once it isn't losing space to the heading.

Verified with a hand-written HTML reproduction (Tailwind's CDN build didn't load through
the sandbox's proxy, so wrote the handful of relevant rules by hand instead) rendered
through the pre-installed Chromium — reproduced the exact "INGRE / DIENT / S" break before
the fix, confirmed one clean line after it.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 5 min | The screenshot named the exact broken heading. |
| Reading the codebase | 15 min | The recipe page, `add-to-list-menu.tsx`, `globals.css`'s `overflow-wrap: anywhere`, and the `shrink-0`/`min-w-0` convention in `PageHeader` and the list page. |
| Building | 2 min | One class added. |
| Tests | 15 min | `npm run setup` on a cold container, lint + `tsc --noEmit`, then a standalone HTML repro (the Tailwind CDN build 404'd through the proxy, so the relevant rules were hand-written) screenshotted before/after with the pre-installed Chromium. |
| Review, CI, deploy | — | Not yet pushed. |

## What should have been quicker

Reaching for `npx tailwindcss` or the app's own dev server to render the repro would have
been more representative than hand-rolled CSS, but the app needs a seeded home, user,
recipe and list to reach this screen at all — verifying the actual flexbox mechanics with
three hand-written rules was faster and just as conclusive, since the bug is generic CSS
box-sizing and not anything the app's own styling changes.

## What CLAUDE.md did not say

The `min-w-0 flex-1` / `shrink-0` split between a growing and a fixed flex sibling is
already the convention (`PageHeader`, the list detail page), but nothing calls out that
`overflow-wrap: anywhere` on `body` — needed for pasted URLs and long ingredient tokens —
also lowers every unpinned flex child's minimum width to one character, so a short heading
sharing a row with anything of unpredictable length needs `shrink-0` explicitly or it will
collapse instead of the wide sibling wrapping. Added a sentence to the `overflow-wrap:
anywhere` comment in `globals.css` saying so, since the next place this rule bites will be
another heading-plus-status row.

## Decided rather than known

- Fixed only the "Ingredients" heading's row, not `AddToListMenu` itself, since the two
  other call sites (`/pantry`, `/meals`) go through `PageHeader`, whose action slot is
  already wrapped in `shrink-0` — the bug is specific to this one hand-rolled row, not the
  component.
