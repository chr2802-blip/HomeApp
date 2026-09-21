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

## Decided rather than known

- **`isRecipe` defaults to `true` when the model omits it.** An answer that forgets the flag
  has still read something; the render refuses anything with no title and nothing to cook,
  so the safety net is downstream. The opposite default would refuse good recipes.
- **A fractional time is rounded rather than refused** (22.5 → 23). Nothing in the app shows
  half-minutes.
- **The log now separates `api_error` from `schema_rejected`**, by SDK error class rather
  than message text. The cook sees the same words either way — there is nothing better to
  offer them — but one of those passes on its own and the other is ours and will recur.
- **Whether this was actually the user's failure is still unconfirmed.** It is a real bug
  that produces exactly this message on exactly this kind of recipe, and it is fixed either
  way; but if their log line says `no_api_key`, the cause was the key and this was a
  different bug found on the way.
