# An audit of the AI flows, and everything it found

- **Date** — 2026-09-25
- **Branch** — `claude/ai-flows-audit-09uzb0`
- **PR** — see the branch's PR
- **Reached production** — not yet

## The idea

"The flow works; the fake loader stops midway now the average is ~7s — anything else?"
Audit first, then "do all of it": loader pacing, a timeout budget that could outrun the
route, the picture fetched after the reader, a silent rate limit, no quality eval, and
smaller drift.

## The route

Read both readers, the overlay, the import pipeline, the actions, rate limiting and
metering; wrote the findings up; then built them in one branch. The one loop: two existing
tests asserted the old rule ("never fetches the picture for a page the reader refused"),
which the parallel fetch deliberately changes — rewritten to the new rule (fetched, never
stored). The eval could not be run against the real API (no key in this container); it was
smoke-run against `e2e/helpers/anthropic-stub.mjs`, whose echoing answers break the rules,
and the scorecard caught every one — which is what says the checks can fail.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | |
| Reading the codebase | some | two readers, the import, the overlay, the actions |
| Building | most | the eval's cases and checks were the longest part |
| Tests | some | a clock-controlled browser test for the finish; the timeout-budget test |
| Review, CI, deploy | — | |

## What should have been quicker

Nothing connected the loader's pacing to the model's speed: `expectedSeconds: 20` was set
for Sonnet with thinking, and the switch to Haiku (#130) changed the wait without anything
pointing at the number that paces it. Likewise the 25s/30s timeouts were sized for Sonnet
and never re-added against `maxDuration` together with the SDK's retry. Both are now
written down beside the model choice in CLAUDE.md, and the timeout sum is a unit test.

## What CLAUDE.md did not say

- That the loader's `expectedSeconds` follows the model (now under "A new recipe starts
  by asking how").
- That the readers' timeouts, retries, caption sources and `maxDuration` form one budget
  (now under "An import is two stages", held by `tests/unit/ai-readers.test.ts`).
- That there was no way to measure the readers' quality — there is now: `npm run eval:ai`.
- The prompt-caching paragraph still described the Sonnet settings; corrected.

## Decided rather than known

- `expectedSeconds` 8 for a save, 10 for an import, from the ~7s median the household
  reported rather than a query. Reading the live median on every recipe page render (a
  percentile over 30 days of `AiUsage`, threaded through five call sites) was judged not
  worth it to pace a decorative bar; the number is a line to change when the model does.
- Timeouts 15s per attempt with one retry kept: the retry is worth it for an overloaded
  API, and 3 caption sources × 8s + 2 × 15s = 54s still fits 60s.
- `FINISH_MS` 300ms: long enough to see the bar reach the end, short enough not to be a
  wait of its own. It also delays a refusal's message by that much.
- `"prepare"` rate limit 30 per quarter-hour, since a save over it degrades silently; the
  monthly allowance bounds the spend. Only `prepare` was raised — `import` stays at 8.
- The monthly allowance can be overshot by calls in flight at once. Left, and documented
  in `ai-usage.ts`: reserving cost up front is a second write per call for a limit of a
  few kroner.
- The eval's cases and checks are mine: seven recipes, loose regex checks drawn from
  `ingredientRules`. They have never been run against the real model, so the first real
  run may show a check that is too strict rather than a model that is wrong.
