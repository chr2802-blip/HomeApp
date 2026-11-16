# The frame from Swingkings: page motion, the "+" in the tab bar, swipes, viewer, banner

- **Date** — 2026-11-16
- **Branch** — `ccr-a02bc432-7mj03k`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

Bring HomeApp's frame up to what the sibling Swingkings app had grown: pages that slide
in from the side their tab is on and open/close inside a tab, the page's "+" in the middle
of the tab bar, a gliding tab light, header and tab bar that go with the scroll, a back
arrow that steps back through history and slides in, an edge swipe back, swiping between
a section's pages, a full-screen pinch-zoom picture viewer and a banner on the dashboard.
Mid-way: Admin out of the tab bar and into the menu under the home's name.

## The route

Read both apps' frame components side by side → ported page motion, back arrow, tab bar,
"+" → first screenshot → two questions answered (the "+" in the home's colour, a Create
drawer on the dashboard) → Admin moved → section swipe, viewer, banner → unit and e2e.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | "everything from Swingkings" needed a list first |
| Reading the codebase | medium | two apps' versions of the same components |
| Building | most | nine pieces, each touching `globals.css` and the layout |
| Tests | medium | e2e animation names changed with the new motion model |
| Review, CI, deploy | — | |

## What should have been quicker

Porting meant translating Swingkings' vocabulary (`--band-*` tokens, `ActionMenu`,
`modal-history.ts`) into HomeApp's (`--accent`, `ItemMenu`, `popOwnEntry` in `modal.tsx`)
one file at a time. The two apps solve the same frame problems with different names, and
nothing says which is which; a short map would have saved most of the reading.

The demo household had no picture anywhere, so the viewer could not be screenshotted
without a seed change — now `db:demo` puts one on the first recipe.

## What CLAUDE.md did not say

- That a `replace` link has to tell the back arrow (`replacingNext`) — now in *Sheets,
  folds, movement*.
- That something floating above the tab bar needs `app-above-bar` once the bars move with
  the scroll — now there too.

## Decided rather than known

- Admin went into the home menu as its last entry, below Profile.
- The dashboard's "+" opens a drawer of links that open the other pages' own sheets
  (`?new`) rather than copies of those sheets on the dashboard.
- The banner is the dashboard's existing opening on the header's linen, not a photograph:
  the rule that the first screen holds the week, dinner, what is due and the lists still
  holds, and `e2e/suggested-recipe.spec.ts` still passes.
- The edge swipe is only in the installed app; the section swipe works in a browser too.
