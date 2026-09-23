# A third four-pillar audit

- **Date** — 2026-09-23
- **Branch** — `claude/feature-audit-mqszv1`
- **PR** — not opened yet
- **Reached production** — not yet (docs only)

## The idea

"A lot of features have been merged — time for a new audit, the same four pillars as
usual." That meant: the shape of `docs/audit-2026-09-20.md` (security, stability,
scalability, maintainability, housekeeping), every earlier finding re-checked, every
suite actually run, and nothing in the app changed.

## The route

Read the last audit to find what "as usual" meant → `npm run setup` in the background →
read the 28 PRs' diff against #78, weighted to what reaches a model or crosses a home →
full suites in the background while reading → PR and branch state from the GitHub API →
write-up → re-check every claim in the draft that said "I tried" or "I checked" against
what had actually been run. Two of them had not been and were reworded.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | "the same four pillars" is only defined by the previous audit's file |
| Reading the codebase | most | the importer, action mode and the language PRs |
| Building | — | read-only |
| Tests | none of mine | setup ran in the background; the suites ran while I read |
| Review, CI, deploy | small | |

## What should have been quicker

**Nothing in the environment, for the first time in these notes.** `npm run setup` took
a cold container, stopped Postgres and a two-revision Chromium mismatch to a passing
browser launch in one command, which is the thing seven earlier notes named as their
biggest cost. Worth saying because it is the loop working.

What did cost time: **"the same four pillars as usual" is defined only by the previous
audit document**, which is 50 KB long. There is no short statement of what an audit here
covers, so the first step of every audit is reading the last one in full.

## What CLAUDE.md did not say

That `createRecipe` and `updateRecipe` have five call sites, which
`2026-09-22-ai-loading-overlay.md` had already named as a gap and not closed. Now
written into the action-mode section, with the grep that lists them.

## Decided rather than known

- T1 (instructions truncated at 12,000 characters, then saved over) is read off the code;
  no billed call was made to watch it happen.
- T2's worst-case durations are the code's own timeouts added up, not measurements.
- Severities are judgements, as they were in the last two audits.
