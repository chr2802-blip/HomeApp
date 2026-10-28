# A search box on the tasks page

- **Date** — 2026-10-28
- **Branch** — `claude/task-search`
- **PR** — see branch
- **Reached production** — not yet

## The idea

"Jeg vil gerne have en søgebar i opgavelisten" — the lists' search box, on `/tasks`.
It searches a task's name, notes and who it is for.

## The route

Read `/tasks` and `ListDirectory`'s box → noticed the tasks page is a server page whose
rows carry server actions, so the box could not simply filter an array the way the lists'
does → a client `TaskSearch` that decides which ids match and tells the rows through
context; a row left out is `hidden`, like the pantry's → screenshot (EN/DA) → e2e tests
→ verify → PR. No loops.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 1 min | |
| Reading the codebase | 5 min | the lists' and pantry's searches |
| Building | 10 min | |
| Tests | 10 min | e2e build + run, ~2 min of it waiting |
| Review, CI, deploy | — | |

## What should have been quicker

The screenshot of a typed search needed a throwaway copy of `scripts/screenshot.ts`
(one `sed` line), because `screenshot` cannot type into a field. Cheap, but it is the
second thing after "open a sheet" that every UI change wants.

## What CLAUDE.md did not say

`divide-y` draws its rule under every child but the last *in the DOM*, so once the last
row is `hidden` the last visible one keeps a line under it. Written into *Traps worth
knowing*.

## Decided rather than known

- What is searched: name, notes, assignee's name. Not the rhythm or due date.
- A search leaves "Done (n)" shut and counts only the matches on it, as the lists' does.
- The box is drawn once a home has any task at all, including only finished ones.
