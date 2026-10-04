# Section pill lit Supplies over the lists page

- **Date** — 2026-10-04
- **Branch** — `ccr-4e1afff8-oojsdk`
- **PR** — not yet
- **Reached production** — not yet

## The idea

A phone screenshot showed the Lists | Supplies pill on "Forråd" while the page
underneath was Lists. Asked how that can happen; the answer was a stale press in
`usePendingHref`, so it was fixed as well.

## The route

Read `section-tabs.tsx` and `use-pending-href.ts`. The press was kept as `{ href, from }`
and only ignored while the path differed from `from`, never cleared. The tab rows are in
the app layout and outlive every page, so returning to `/lists` brought the old press back.
The bottom nav and desktop links share the hook and had the same bug. The fix drops the
press during render once the path moves. A new spec in `animation.spec.ts` failed without
the fix and passed with it.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | minutes | the screenshot said it all |
| Reading the codebase | minutes | two files |
| Building | minutes | one line |
| Tests | most of it | `npm run setup` plus two e2e builds, to see the spec fail and then pass |
| Review, CI, deploy | — | |

## What should have been quicker

Two `e2e:build`s (~1 min each) just to run one spec before and after the fix. Unavoidable
while the e2e server serves `.next`.

## What CLAUDE.md did not say

Nothing missing. The cause was a state that "expired" only by comparison, in a component
mounted in a layout. That is worth remembering, but it is not a rule yet.

## Decided rather than known

A navigation that never lands (aborted, offline) still leaves the press pending until the
path changes. That is unchanged and was left alone.
