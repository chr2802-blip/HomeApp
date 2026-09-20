# <what was asked for, in a few words>

- **Date** — YYYY-MM-DD
- **Branch** — `claude/...`
- **PR** — #NN
- **Reached production** — commit on `main`, or "not yet"

## The idea

What was asked for, and what it turned out to mean. Two lines. If those are different
things, that difference is usually the first entry under "what should have been quicker".

## The route

Idea → production as it actually went, not as it was meant to go. Name the loops: a file
read twice, a test written twice, a review round, a red CI, a question that had to go back
to a person and wait.

## Where the time went

Rough is fine — the shape is the point, not the minutes.

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | | |
| Reading the codebase | | |
| Building | | |
| Tests | | |
| Review, CI, deploy | | |

## What should have been quicker

**The one answer this file exists for.** Name the cost, not the feeling: what was done
twice, looked up twice, or found out after it mattered. "Nothing" is a diary entry — if a
session really cost nothing it should not have needed the row above.

## What CLAUDE.md did not say

The thing this session had to work out that the next one should simply be told. Where the
answer is now known, write it into `CLAUDE.md` in the same commit and say where. Where it
is not, say why not — a question nobody has answered yet is still worth the next session
knowing about.

## Decided rather than known

Anything chosen without an answer to check it against. Same list the PR flags; keeping it
here as well is what lets somebody find, months later, which guess the bug came from.
