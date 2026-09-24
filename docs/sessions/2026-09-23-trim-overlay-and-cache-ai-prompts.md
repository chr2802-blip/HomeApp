# Trim the import overlay's stage lines; cache, then revert, the AI prompts

- **Date** — 2026-09-23
- **Branch** — `claude/loader-time-estimation-x4klpq`
- **PR** — #125 (merged; the caching half was reverted in #126)
- **Reached production** — yes — and broke recipe creation there for about the length of
  this session, until the revert below shipped

## The idea

Three asks in sequence: explain what the loader's per-step time estimation is for, explain
every place the app calls the model so the user could judge what to cut, then act on two of
those findings — trim `AiOverlay`'s decorative stage list, and add prompt caching to the two
model calls for real latency/cost, not just perceived speed. The trim was fine. The caching
change was not: it shipped to production (PR #125 was squash-merged after a second commit
had already been pushed to this branch, so its diff carried both changes under one PR title),
and every recipe creation the user tried afterward timed out. This session's fourth ask was
"make the AI part faster"; the honest answer, in hindsight, is that this session should not
have shipped a change to the exact shape of a paid external request without any way to run
it against the real API first.

## The route

Read `ai-overlay.tsx`, `recipe-normalize.ts`, `cook-steps.ts` and the copy/overlay call sites
to confirm there are exactly two model calls and that the stage list is cosmetic; trimmed
`recipeImportOverlay` from six stage lines to four. Added `cache_control: { type: "ephemeral"
}` to the system prompt in both `normalizeRecipe` and `prepareCookSteps`, checked the SDK's
`system` typing accepted a content-block array, fixed the one unit test that asserted `system`
was a bare string, and ran the full suite three times (see the flaky-test note already folded
into CLAUDE.md) — all green, because the suite's browser tests run against
`e2e/helpers/anthropic-stub.mjs`, never the real Anthropic API, so nothing in this session's
own verification could have caught a real-API-only regression.

Pushed. A PR (#125) got opened and squash-merged onto `main` — carrying both commits' diffs,
since the second was pushed before the merge — and it deployed, because only `main` deploys.
The user then reported the recipe-import failure message, twice, on production. Vercel's own
runtime-log and runtime-error endpoints returned 403 for this session's token (SSO-scoped,
`get_project` worked but `get_runtime_logs`/`get_runtime_errors`/`list_deployments`/
`filter_project_envs` did not), so the only diagnostic available was the one log line the
user pasted in: `{"reason":"api_error","detail":"Request timed out."}` — the SDK's
`APIConnectionTimeoutError`, thrown only after `NORMALIZE_TIMEOUT_MS` (25s) *and* the retry
are both exhausted. Two failures out of two attempts, immediately after the only relevant
code change, with no way to test the real API from this sandbox (no `ANTHROPIC_API_KEY` here
either) — that was enough to act on: merged `main` back into the branch (to pick up an
unrelated pantry PR that had landed in the meantime), reverted `system` back to a plain
string in both readers, reverted the matching test, and is pushing this as the fix.

**The mechanism was confirmed afterward, against Anthropic's own documentation, once the user
asked "why slower, when it should be faster."** The `claude-api` skill's prompt-caching guide
says plainly that a cache write is not a no-op — on a cache miss the API still runs the full
prefill *and* additionally persists it to the cache, and a cold write on a large prefix is
"noticeably slow" (the guide's own words, in the section on when pre-warming is worth it).
That only pays for itself when the *same* prefix is read again inside the TTL (5 minutes by
default) — and this app's traffic doesn't do that: a household imports or saves "a handful of
recipes a week" (the code's own words, in `recipe-normalize.ts`), so a repeat call for the same
language inside five minutes is rare across the *whole installation*, not just one home. So
nearly every real call was a cold write: paying the write's latency tax and its 1.25× price,
never the 10×-cheaper read — on top of a baseline that was already close to
`NORMALIZE_TIMEOUT_MS` (25s, non-streaming, with `thinking: adaptive` + `effort: medium`
already spending real time by design). That is enough to explain two-for-two timeouts without
any unrelated cause. **This is a documented mechanism, not a production measurement** — nobody
saw `cache_creation_input_tokens` on a real request, because there was no way to. The
confidence here comes from the guidance matching the failure exactly, not from telemetry.

Asked "so how do we make it faster", the answer was to measure first rather than guess a
second time: `AiUsage.durationMs` (nullable — every existing row predates it) now records
each call's wall-clock time, retries included, from both readers. **It only sees calls that
came back**: a call that times out never gets a response, so never gets a row. The timeouts
themselves are still only in the `*_unavailable` log lines, and a slow tail in this column
will always look shorter than the truth.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 2 min | Three sequential, unambiguous requests |
| Reading the codebase | 6 min | Overlay + both readers, plus the SDK's `system` typing |
| Building (caching) | 5 min | Two `system` edits, one test fixed to match the new shape |
| Tests | ~20 min | Three full verify/pre-push runs, each carrying an unrelated e2e flake |
| Review, CI, deploy | fast | Squash-merged into `main` faster than expected, carrying an unfinished second change under the first commit's PR title |
| **Incident + revert** | ~15 min | User reported the failure; no real-API diagnostic available in this sandbox (no key, Vercel log/error endpoints 403); reverted on correlation + designed-for timeout semantics rather than a confirmed root cause |

## What should have been quicker

Nothing about *finding* the flaky e2e pattern was slow — that was three genuine confirmations
of one real fact, now written down. The actual cost was structural: shipping an unverifiable
change (this sandbox cannot call the real Anthropic API — no key, and the e2e suite always
talks to a stub) straight to the feature that a design-conscious codebase like this one leans
on most heavily, without a staging step. There is no preview deployment here by design
(CLAUDE.md already says why), so "verified" for anything touching the Anthropic SDK's request
shape currently means "passed against a stub that cannot represent this class of bug" — that
gap should have been named out loud before pushing, not after production broke.

## What CLAUDE.md did not say

Two things, both now written in, under "An import is two stages" in the recipe-import section:

1. **That a change to the *shape* of a request sent to Anthropic (not just its content)
   cannot be verified by this repo's own test suite** — the e2e stub only checks that the app
   handles whatever the stub returns, never whether the real API accepts the request at all.
2. **That neither reader's system prompt is a candidate for prompt caching**, and why: the
   traffic shape (sparse, per-household, rarely two calls for the same language inside five
   minutes) means a cache write happens on nearly every call and a cache read almost never
   does — the opposite of what caching is for. This is the rule "never touch `system`'s shape"
   would have overcorrected into; the actual rule is narrower and now has a reason attached,
   which is the whole point of writing it down rather than just reverting.

## Decided rather than known

The mechanism (cold cache writes, near-timeout baseline, sparse traffic never warming the
cache) is inferred from Anthropic's own documented caching behavior matching the failure
exactly — not from a production measurement. Nobody read `cache_creation_input_tokens` off a
real request; Vercel's log/error/env endpoints all 403'd for this session's token, and there
is no `ANTHROPIC_API_KEY` in this sandbox to reproduce with. If someone with real API access
ever wants to close that last gap, the confirming test is cheap: two identical calls a few
seconds apart, same language, and check `usage.cache_read_input_tokens` on the second — this
note predicts it will be non-zero at, say, 30 seconds apart and never at 6 minutes apart. That
would turn "matches the documented mechanism" into "measured."
