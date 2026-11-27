# The baby tabs drawn side by side, so a swipe shows the other one at once

- **Date** — 2026-11-27
- **Branch** — `ccr-dc31549d-634jqu`
- **PR** — not yet
- **Reached production** — not yet

## The idea

After #201 (prefetching the other tab) the household said it still was not right: the
other tab has to be visible *while* the finger swipes, not after. That is a pager, not a
faster navigation — both tabs on one page, sliding under the finger.

## The route

Read `SectionTabs`' swipe and `PageTransition` → a sideways swipe could only ever drag the
page that was there, and the next one arrived after release → put both on `/baby`, the tab
in `?tab=`, and a new `SwipePager` that drags them → screenshots mid-swipe with a
throwaway CDP touch script → the pill did not follow (Next ignores a `replaceState` that
carries its own `history.state`) → the incoming page showed under the header when scrolled
(lift measured from the header's bottom) → e2e for pill and real touch swipe.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 10% | the first round answered the wrong question |
| Reading the codebase | 15% | how sections, swipe and page motion fit together |
| Building | 40% | |
| Tests | 35% | charts with no data draw no figure; aria-hidden hides from role queries |

## What should have been quicker

The first round (#201) prefetched, which could never satisfy "see it while swiping". Asking
"should the other tab be visible during the swipe, or just load faster?" up front would
have saved a whole PR. And `npm run screenshot` has no swipe step, so a CDP touch script
was written by hand to see the mid-swipe state.

## What CLAUDE.md did not say

That `history.replaceState(window.history.state, …)` is invisible to `useSearchParams`
(Next skips state it recognises as its own) and that a search-param change keeps a page's
client state while a path change remounts it. Both are now in the baby section, with the
pager convention.

## Decided rather than known

- The page off screen is clipped to one screen's height and lifted to the header's bottom;
  the scroll position after landing is chosen so the new page does not jump.
- Settings, Recipes/Plan and Lists/Supplies stay two addresses; only the baby section
  is a pager.
