# A third four-pillar audit, and its first three fixes

- **Date** — 2026-09-23
- **Branch** — `claude/feature-audit-mqszv1`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

"A lot of features have been merged — time for a new audit, the same four pillars as
usual." That meant: the shape of `docs/audit-2026-09-20.md` (security, stability,
scalability, maintainability, housekeeping), every earlier finding re-checked, every
suite actually run, and nothing in the app changed. Then "yes" to fixing the first three:
T1 (instructions truncated on save), S1 (the AI limit only displayed), M2 (English left
in a Danish home).

## The route

Read the last audit to find what "as usual" meant → `npm run setup` in the background →
read the 28 PRs' diff against #78, weighted to what reaches a model or crosses a home →
full suites in the background while reading → PR and branch state from the GitHub API →
write-up → re-check every claim in the draft that said "I tried" or "I checked" against
what had actually been run. Two of them had not been and were reworded.

Then the fixes, each with a test first confirmed to fail on the old code: T1 (a mocked-SDK
unit test), S1 (the limit inside both readers, a rate limit in the two actions), M2. M2
was the loop: the audit's list came from a `grep` for `fail("…")` and JSX, and converting
it turned up the lists actions' own validation messages, the shared "too long" message,
the in-browser photo errors, Cancel, and the colour names — none of which that grep could
see. The guard test was prototyped as a script first, to see its false positives before
writing it down.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | "the same four pillars" is only defined by the previous audit's file |
| Reading the codebase | most | the importer, action mode and the language PRs |
| Building | the second half | M2 was three times the size the audit said |
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

A second cost, on the fixes: **the audit's own list of untranslated strings was
incomplete**, because it came from a grep shaped like the first two examples found. It was
an audit claim ("in a Danish home these still speak English") that read as exhaustive and
was not. The guard test is what makes the next such list exhaustive.

A third: **two browser flakes at push time, and a flake's evidence was destroyed by
the first thing done to investigate it.** The hook's first failing run left a trace;
re-running the one test with `--repeat-each` wrote over `test-results/` before the trace
was read, so that one is recorded as unexplained. The second time the trace was copied
out first, and it named the race in a minute (`tickOff` retrying a press that had already
worked). Establishing that `main` does not flake the same way cost two full suite runs in
a worktree — about ten minutes, and the only way to tell "this change" from "this suite".

## What CLAUDE.md did not say

That `createRecipe` and `updateRecipe` have five call sites, which
`2026-09-22-ai-loading-overlay.md` had already named as a gap and not closed. Now
written into the action-mode section, with the grep that lists them.

Also now written down, beside the rules they belong to: that the cook-steps reader only
ever answers for a whole recipe; that every paid model call is bounded per person and
per home, with the home's limit asked inside the readers; and that
`tests/unit/untranslated.test.ts` is `language.test.ts`'s other half, with "too long" said
by `readForm`. `FORMS.tooLong` had existed in both languages since PR 1 of the language
work and was never wired up — `readForm`'s own comment said the rest would "convert in PR
2", and nothing checked that it had.

## Decided rather than known

- T1 (instructions truncated at 12,000 characters, then saved over) is read off the code;
  no billed call was made to watch it happen.
- T2's worst-case durations are the code's own timeouts added up, not measurements.
- Severities are judgements, as they were in the last two audits.
- The rate limit for preparing reuses the login limiter's 8 per 15 minutes. A cook editing
  one recipe's steps nine times in a quarter of an hour loses the breakdown until they
  press "prepare" later; I judged that rare enough not to want its own number.
- The Danish wording of the new phrases is mine, and worth a native reader's glance —
  especially the six colour names (Skifer, Hav, Indigo, Violet, Blomme, Sand).
- `global-error` stays English: it renders with no layout and no session. Reading the
  cookie there by hand would be possible and is a larger change than this one.
