# Align press feedback across every pressable card

- **Date** — 2026-09-22
- **Branch** — `claude/list-card-frontpage-feedback-f9fbba`
- **PR** — not yet
- **Reached production** — not yet

## The idea

Asked, after the previous change on this branch, whether the dashboard list card's new
press feedback matched every other pressable card in the app. It did not: three different
implementations existed, one of them (`TaskCard`) with no `:active` feedback at all.

## The route

Grepped every `active:scale-*`/`active:bg-*` usage and every `<Card` in the app, sorted
them into the two structural patterns that already made sense (whole card is the link vs.
a link sharing the card with something else that must stay independently pressable), and
found the two places that broke pattern rather than following it on purpose: the admin
entry cards used `0.99` where every other whole-card link uses `0.98`, and `TaskCard`'s
open-sheet button had a `hover` state but no `active` one, so pressing it on a touch
screen — the primary surface — showed nothing at all.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 2 min | Re-reading the previous turn's audit |
| Reading the codebase | already done | Carried over from the audit in the same session |
| Building | 3 min | Two one-line class changes |
| Tests | ~6 min | Full `npm run verify`, including killing a duplicate stray run |
| Review, CI, deploy | — | not yet |

## What should have been quicker

Nothing here — the audit in the previous turn had already found and located both fixes,
so this was just applying them.

## What CLAUDE.md did not say

Press feedback (`pressable` plus `active:scale-*`, and `active:bg-*` where the link is a
sub-region of a card rather than the whole thing) is a convention with two real shapes but
no written rule distinguishing them, and nothing said `TaskCard`'s button was an
intentional exception. Worth a line in `docs/design/ui-patterns.md` if a third
inconsistency turns up.

## Decided rather than known

Standardised on `active:scale-[0.98]` (already used in two of the three whole-card-link
sites) rather than `0.99`. For `TaskCard`, chose `active:bg-slate-100` — one step darker
than its existing `hover:bg-slate-50` — rather than reusing `active:bg-slate-50` verbatim,
because unlike the other two "region inside a card" sites, this one already has its own
hover state and needs its active state to still read as a change from it (the same
hover→active step `back-button.tsx` already uses).
