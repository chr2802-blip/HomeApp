# Stop the importer throwing away recipes over a field it never asked the model for

- **Date** — 2026-09-21
- **Branch** — `claude/importer-tolerant-schema`
- **PR** — not yet opened
- **Reached production** — not yet (the bug it fixes did, in #85)

## The idea

"It gives me this on recipes that worked before: *Couldn't read that recipe just now*." That
is the importer's `unavailable` path, which is meant to mean no key or a dead API — and
neither was true. The real cause was the same trap this repo documented yesterday, in a
second place nobody checked.

## The route

Confirmed #85 was merged and live, so the message was real. Could not read the Vercel logs
(the connector is 403 on that scope), so instead of guessing, probed the thing that had
already gone wrong once: ran plausible model answers through `zodOutputFormat(...).parse()`
to see which the schema rejects. Four of ten — and the most likely of them,
`totalTimeMinutes: 0`, is what a model answers when a recipe states no time.

Then the fix bit back. Making the fields `.nullish()` stripped **every `.describe()`** from
the converted schema — caught only because an unrelated test asserted the unit list was in
there. Probed five orderings; `describe().nullish()` keeps both the guidance and the
tolerance.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 5m | The message named its own code path |
| Reading the codebase | 5m | Went straight to the schema; yesterday's session had named the hazard |
| Building | 20m | Schema, `cookingMinutes`, split log reasons, then the describe-ordering repair |
| Tests | 15m | Ten permitted answers, plus a description canary |
| Review, CI, deploy | 15m | Full verify |

## What should have been quicker

**The fix for this shipped yesterday, in one field out of two.** The session note for #85
records finding that the wire schema drops constraints, calls it "the strongest argument for
writing the boring compatibility test", and then fixes `unit` and stops. `totalTimeMinutes`
had `.int().positive()` sitting four lines away and was never looked at. The finding was
written down as a story about units instead of as a rule about schemas, and a story only
protects the example in it.

What would have caught it in the same hour: taking the discovery and asking "where else",
rather than "is the unit fixed". The probe that found it today is ten lines and would have
run yesterday just as well.

**Second, smaller:** the first fix silently dropped every field description, and only an
unrelated assertion noticed. A schema conversion that loses information without erroring
wants its own test, not a lucky one.

## What CLAUDE.md did not say

1. **That a structured output's schema asserts more on the way back than it asks for on the
   way out.** It said this about units. It now says it as a rule: assert only what is worth
   losing the import over, coerce the rest. In `CLAUDE.md` and at length in
   `docs/design/recipes.md`.
2. **That `.describe()` must precede `.nullish()`.** Now in both, with a test.
3. **Still open: nothing in this repo can read production logs.** Diagnosing this needed a
   log line neither the session nor the user could easily reach — the Vercel connector is
   403 on the project's scope. Worth fixing before the next production question, because the
   answer today came from re-deriving the bug rather than from reading what the app said.

## Added after the first fix: why a reel refused

The key turned out to be misspelled in Vercel (`ANTROPIC_API_KEY`), so the production
failure was never the schema bug at all — the bug is real and shipped in this branch, but it
had not been reached yet. With the key corrected, ordinary recipes import and reels still
fail, at stage one, with "Instagram and Facebook often refuse".

That sentence was all there was to go on, and it covers four different things:
Meta refusing outright, a login wall served as an ordinary 200, the eight-second limit
running out, and the embed page's markup moving. `readCaptionSource` returned a bare `null`
for every one of them and logged nothing. Only one of the four is something this repo can
change, so the difference decides whether there is any work here at all.

So each one now writes a `reel_caption_source` line — outcome, status, and for the
interesting case (answered 200, no caption) whether the body looks like a login wall and
whether the embed markup is still there. Running out of sources writes
`reel_caption_unreachable` with a count. No body is ever logged, only shapes read off it.

This is deliberately diagnosis and not a fix: the plausible causes range from a one-line
timeout change to "Meta blocks datacenter IPs and always will", and guessing between them
would mean building the wrong one.

## What the diagnostics then said

Both Instagram sources answered **200 with 632 KB**, no login wall, and neither a caption
element nor an `og:description` in any of it. That is not a refusal: it is the single-page
app, served to something that asked as a browser. The caption is in that page's JavaScript,
not its markup, and nothing that is not a browser will ever find it there.

So the fix is to stop asking as a browser. These sites do serve markup — to crawlers,
because a link with no preview is a link nobody shares. `CRAWLER_HEADERS` asks honestly, as
this app, with a URL to look it up at. Whether Instagram extends that to a crawler it has
never heard of is the open question, and the same log line will answer it.

Two things came out of that round that had nothing to do with reels:

- **The first diagnostics could not have settled it.** They said what came back but not
  *where it came from* — an embed page that redirected to the front door and one that
  answered in person looked identical. `landedOn` and `title` are in the line now. A
  diagnostic that cannot distinguish the hypotheses is half a diagnostic.
- **A real decoding bug, found by printing a header verbatim.** `contentType` came back as
  `text/html; charset="utf-8"` — with quotes, which is legal — and the regex captured them,
  handed `TextDecoder` a name it has never heard of, and fell back to UTF-8. Harmless when
  the page really is UTF-8, mojibake on a Danish page declaring `charset="iso-8859-1"`,
  which is the exact case that decoding was written for.

## Still open: a browser test that fails about one run in three

`pantry.spec.ts:81` — "the pantry is reached from the home's own name, and kept there" —
failed in two of roughly six full-suite runs today, and passed 24 out of 24 when run on its
own with `--repeat-each=4`. So it only goes wrong under the load of the whole suite, which
is why it has not been caught: nothing reproduces it on demand.

Not diagnosed, and deliberately not "fixed". I never managed to capture the assertion — the
failing run's `test-results` were cleaned by the next, passing one before I read them — and
inventing a repair for a failure I have not seen is how a timeout gets added to a race.
Playwright keeps a trace on failure, so the next occurrence is diagnosable if the artifacts
are read before anything else runs.

Worth noting against this branch specifically: it adds a stub server per browser worker, so
a two-worker run now starts four processes where it started two. That is a plausible
contribution to a timing-sensitive test on a container with no headroom, and it is not
proven — the test also wraps its own edit click in `retry`, which suggests it was marginal
before any of this.

## Decided rather than known

- **`isRecipe` defaults to `true` when the model omits it.** An answer that forgets the flag
  has still read something; the render refuses anything with no title and nothing to cook,
  so the safety net is downstream. The opposite default would refuse good recipes.
- **A fractional time is rounded rather than refused** (22.5 → 23). Nothing in the app shows
  half-minutes.
- **The log now separates `api_error` from `schema_rejected`**, by SDK error class rather
  than message text. The cook sees the same words either way — there is nothing better to
  offer them — but one of those passes on its own and the other is ours and will recur.
- **Whether reels can be made to work at all is still unknown.** The first round ruled out a
  block and a timeout: it is the app shell, so the question is now narrower — will Instagram
  serve markup to a crawler that is not one of the handful it knows? If not, the remaining
  levers are Meta's official oEmbed (an App Review process), a residential proxy, or a
  third-party mirror, and the honest answer becomes that the paste box is the feature.
- **The crawler identifies itself truthfully as HomeHubBot.** Sending `facebookexternalhit`
  is what demonstrably works and is impersonating somebody else's crawler; that is a call
  for the household to make, not for this file to make quietly.
- **Whether the schema bug was actually the user's failure: no, it was not.** It is a real bug
  that produces exactly this message on exactly this kind of recipe, and it is fixed either
  way; but if their log line says `no_api_key`, the cause was the key and this was a
  different bug found on the way.
