# Session notes

One file per working session, named `YYYY-MM-DD-slug.md`, written from `TEMPLATE.md` and
committed with the work it describes.

## What these are for

A change to HomeHub goes idea → branch → `npm run verify` → PR → merge → production, usually
in one sitting. Git records what was built. Nothing records **where the time went** — and
that is the only half that can be improved, because the diff looks identical whether the
colour was found in one file or in four.

So the note is about the process, not the change. Somebody reading five of these in a row
should be able to say what to fix first. An entry that names no cost has not contributed to
that.

## Why one file per session

Never one growing log. Two sessions run at once, on two branches, and a shared file collides
on the same lines every time — a log that cannot be written from two branches at once is a
log that stops being written. A directory of dated files merges without anybody thinking
about it, and the file name sorts itself.

They are cheap to push: `docs/` is outside the pre-push hook's `CODE_PATHS`, so a session
note on its own skips the integration and browser suites.

## Reading them back

The two lines worth grepping:

```bash
grep -A4 "should have been quicker" docs/sessions/*.md
grep -A4 "CLAUDE.md did not say" docs/sessions/*.md
```

The first is the list of things that cost time. The second is the list of things the
codebase failed to explain about itself — and each of those that has been answered should
already be in `CLAUDE.md`, which is what turns this directory into something that compounds
rather than accumulates.

When the same answer appears in three entries, it is not a note any more. It is a
convention, and it belongs in `CLAUDE.md` or in a check that enforces it.

## How one gets written

`scripts/session-summary.mjs` is a pair of hooks wired up in `.claude/settings.json`:
`SessionStart` writes down the commit the session opened on, and `Stop` compares against it
and asks — once — if the session changed something and wrote nothing here. It asks and does
not insist; a hook that cannot be got past is a hook somebody switches off.
