# The reel importer still refuses, with the diagnostics now saying why

- **Date** — 2026-09-21
- **Branch** — `claude/reel-caption-importer-errors-9nzdtx`
- **PR** — not yet
- **Reached production** — not yet

## The idea

A production log, pasted in with no question attached: `reel_caption_unreachable` for an
Instagram reel, two sources tried, both `no_caption`. The ask was "make the importer work",
and what it turned out to mean was reading the two `reel_caption_source` lines the previous
session had added for exactly this moment and following what they said.

They said more than they looked like they said. Both bodies were 200 OK, ~636 KB, no login
wall, `hasCaptionElement` false, `hasOgDescription` false — and **635,995 against 635,960
bytes**. Thirty-five bytes apart, which is the length of the two addresses appearing inside
them and nothing else. The embed page and the post page were serving the same application
shell. Asking as a crawler, which was last session's fix, had changed nothing.

So the caption was not in either of the two places the parser looks. The question became
where an application shell keeps the post it is about to render, and the answer is: inlined
as JSON in a `<script>` tag, because a page that fetched it separately would render a frame
late.

## The route

Read the log → read `reel-import.ts` and `recipe-import.ts` → tried to fetch the reel to
confirm (the sandbox proxy refuses Instagram, so the byte counts in the log were the only
evidence available and had to carry the whole diagnosis) → `captionFromEmbeddedJson` →
tests → the `/p/` address and two more diagnostic fields → docs.

One loop, and a short one: `npm ci` had not been run in this container, so the first test
run failed on a missing `dotenv` rather than on anything in the diff.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 10% | The log was the whole brief; the byte counts were the finding |
| Reading the codebase | 25% | Two modules, both long and both well commented — the comments were faster than the code |
| Building | 30% | Brace matching rather than patterns, and one level of JSON unescaping |
| Tests | 25% | Fixtures built with `JSON.stringify` so the escaping is real |
| Review, CI, deploy | 10% | |

## What should have been quicker

**Confirming the diagnosis against the live page, which was not possible at all.** The
sandbox's proxy refuses instagram.com, so there was no way to fetch the shell and look for
`edge_media_to_caption` in it. Everything here is inferred from two byte counts and from
what an application shell must do to render without a second round trip. It is a well
supported inference and the parser is written to be wrong harmlessly — an unknown shape
falls through to the paste box exactly as before — but it is still an inference, and a
single `curl` would have settled it.

What cost the second most was the previous round of this. The diagnostics that made this
session's diagnosis possible were themselves a whole session's work, shipped without a fix
because there was nothing yet to fix with. That was the right call and it should be said
out loud: **the log line was the deliverable, and it paid for itself one deploy later.**

The third thing: `npm ci` is not run for you in a fresh container. Ninety seconds, but it
presents as a test failure in `vitest.config.mts` and reads for a moment like the diff.

## What CLAUDE.md did not say

Two gaps, both closed in this commit.

**Where a reel's caption actually lives, and in what order to look.** CLAUDE.md described
`reel-import.ts` as "the addresses worth asking" and said nothing about the reading, so the
three places a caption can be — and the fact that the order is the order in which each
stopped working — had to be reconstructed from the module. Now a bullet under *An import is
two stages*, with the brace-matching rule beside it.

**That a caption must never be parsed with a regex.** This was not written anywhere and is
the kind of thing a future session gets wrong in one line: a caption is free text holding
quotes, braces and escaped newlines, so a pattern that reads one truncates the next at its
first `"`. Now stated in CLAUDE.md and argued in `docs/design/recipes.md`.

A third gap is named rather than closed, because nobody knows the answer: **there is no
written account of what a container can and cannot reach.** The proxy refusing Instagram
was found by trying it. A line somewhere saying which outbound hosts a sandbox session can
use would have saved the attempt and, more usefully, set expectations about what any
network-facing fix can be verified against from here.

## Decided rather than known

- **That the shell carries the post as JSON.** Inferred, not observed — see above. The
  three key shapes (`edge_media_to_caption`, `caption.text`, `caption_text`) are the ones
  Instagram's payloads have used; if the current one uses a fourth, this finds nothing and
  the cook gets the same paste box they get today. `hasInlineMediaJson` in the log is what
  will say which of those two happened.
- **Asking `/p/<code>/embed/captioned/` as well.** A reel is also a post and the two
  addresses need not be served by the same thing, so it is worth one request — but only a
  guess that it differs. It costs a third source on the failing path; worst case is now 24 s
  of fetching, against the `maxDuration = 60` already on `/recipes`.
- **Not going further than reading the page.** There are routes that would more reliably
  get a caption out of Meta — deriving the numeric media id from the shortcode and calling
  the private v1 endpoint with a borrowed `X-IG-App-ID`, say. That is a different thing from
  what this module does: it stops being "read the page they served us" and becomes
  "impersonate their client", which the module's own stated position rules out. Flagged
  here rather than taken, because it is the household's call and not this session's.
