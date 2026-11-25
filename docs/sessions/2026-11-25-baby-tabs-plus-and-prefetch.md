# The baby tabs: one "+" on both, and the other tab kept fetched

- **Date** — 2026-11-25
- **Branch** — `ccr-dc31549d-634jqu`
- **PR** — not opened
- **Reached production** — not yet

## The idea

Asked first to disable the "+" on both baby tabs and to load both tabs at once. The "+"
turned out to be the only way to log a sleep with times, so the ask became: the same "+"
(and the same sheets) on Log and Charts, and each tab keeping the other fetched.

## The route

Read the baby page, the charts page and `SectionTabs` → found the "+" is the baby log's own
`CreateFab` with a choose drawer, and the charts page showed the tab bar's generic one →
asked the household what should happen to "log a sleep afterwards" → they kept the "+" and
asked for the same actions on both tabs → pulled the "+" and its sheets out into
`AddSheets`, the page's query into `loadBabyLog`, and added `useKeepWarm`/`useCatchUp`.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 15% | one question back to the household |
| Reading the codebase | 20% | where the "+" came from on each tab |
| Building | 35% | |
| Tests | 30% | a production build to see the prefetch at all |

## What should have been quicker

Seeing whether a prefetch happens needs a production build (`npm run e2e:build`): `npm run
dev` never prefetches, so a screenshot session cannot show it.

## What CLAUDE.md did not say

That the baby log's "+" is the only way to a manual sleep entry, and that a `Link
prefetch` is undone by every `router.refresh()`. Both are now in the baby section.

## Decided rather than known

- `FRESH_MS` (5s): how old a kept copy may be before the page asks again on arrival.
- Prefetching with `PrefetchKind.FULL`, imported from Next's internal
  `router-reducer-types` — the public `router.prefetch` takes it, but the enum is not
  re-exported anywhere public.
