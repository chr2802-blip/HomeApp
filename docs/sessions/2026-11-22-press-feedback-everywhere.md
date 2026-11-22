# Press feedback on everything pressable, as in Swingkings

- **Date** — 2026-11-22
- **Branch** — `ccr-62b5e018-glaq7f`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

Bring over Swingkings' "every press is felt, and every target is at least 32 by 32"
(its commit 252d8bd): the shade on cards, `press-text`, `press-photo`, `tap-inline`, a
unit test reading the source and a browser test measuring the pages.

## The route

Copied the CSS, the unit test and the e2e audit helper nearly word for word, then fixed
what each one named: 39 pressables without a class, then 9 kinds of element under 32px
(the list's tick box, the amount stepper's ± at 24px wide, collapsible headings, the
header's home menu and Log out, "Sort with AI"). The browser spec reuses `db:demo`'s
household, which meant splitting `scripts/demo-seed.ts` into the seeding
(`demo-household.ts`, `seedDemo(prisma)`) and the command.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | short | the Swingkings commit says it all |
| Reading the codebase | short | |
| Building | medium | 39 + 9 fixes, each a class or a size |
| Tests | medium | the browser spec hung twice before it measured anything |
| Review, CI, deploy | | |

## What should have been quicker

The browser spec's sheet step hung on the dashboard's "+" ("element is not stable",
"detached") for two full 3–5 minute timeouts. The cause: the page list had already opened
`/recipes/<id>/cook`, and `ResumeCooking` sends a fresh load of any page back to an open
cook. Any spec that visits action mode and then another page in the same browser meets it.

## What CLAUDE.md did not say

That visiting action mode in a test leaves a cook "open" in `localStorage`, which moves the
next page load. Noted in the spec's comment; worth a line under action mode if it bites
again.

## Decided rather than known

- The amount stepper's ± are 32px wide on a phone too (were 24px, `sm:w-8`): a long item
  name now wraps a line sooner on a list.
- A list item's tick box keeps its 20px look inside a 32px button with a negative margin,
  so rows do not grow; the item's name button the same way (`-my-1 min-h-8`).
- Collapsible headings, the home menu, Log out and "Sort with AI" simply grew to 32px tall.
- The audit runs on the English demo home only, at 390×844.
