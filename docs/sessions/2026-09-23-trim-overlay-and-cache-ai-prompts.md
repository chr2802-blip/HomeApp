# Trim the import overlay's stage lines; cache, then revert, the AI prompts

- **Date** — 2026-09-23
- **Branch** — `claude/loader-time-estimation-x4klpq`
- **PR** — #125 (merged; the caching half was reverted afterward, see below)
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

**The caching idea itself was not disproven, only shipped irresponsibly.** Nothing found here
says content-block `system` with `cache_control` is wrong against the real API — the SDK's
own types accept it, and Anthropic's docs describe exactly this shape. What's known is:
whatever changed, recipe creation broke twice in a row in production the moment this went
out, and reverting was the fastest way to stop that regardless of whether caching turns out
to be the actual cause once someone can test it against a real key.

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

That a change to the *shape* of a request sent to Anthropic (not just its content) cannot be
verified by this repo's own test suite, because the e2e stub only checks that the app handles
whatever the stub returns — it says nothing about whether the real API accepts the request at
all. `cache_control` on `system` is documented, SDK-typed, and still broke something in
production immediately. **Not written into CLAUDE.md yet, on purpose**: this note names the
gap, but doesn't have a confirmed root cause to turn into a rule — "never touch `system`'s
shape" would be overcorrecting for one unconfirmed incident. If a future session repeats this
class of mistake, or confirms what specifically went wrong here, that is what earns the
CLAUDE.md line.

## Decided rather than known

That the timeout was caused by the caching change, rather than an unrelated Anthropic-side or
Vercel-side hiccup that happened to coincide with the deploy, is inferred from correlation
(two failures out of two attempts, immediately after the only relevant code change) and from
having no way to check further (Vercel's log/error/env endpoints all 403'd for this session's
token; no local API key to reproduce with). The revert is the safe move either way — it costs
nothing if caching turns out to be innocent — but whoever reads this next should know the
root cause is still not confirmed, only acted on.
