# A pantry entry did not answer for a qualified ingredient line

- **Date** — 2026-09-23
- **Branch** — `claude/pantry-match-partial-ingredients-g886ft`
- **PR** — not yet
- **Reached production** — not yet

## The idea

Reported from three screenshots: a pantry stocked with "Spidskommen" and "Paprika" still
put "Tørret spidskommen" and "Røget paprika" on the shop, and "Salt og friskkværnet
peber" was only recognised as half-covered ("Salt"), never noticing the pantry also had
peber. It turned out to mean three things, only the first of which was asked for at
first: recognise the match at all (a line's key only ever compared whole, so a qualifier
on the ingredient hid a match that plainly should have fired); never *silently* act on a
match found that way, since a qualifier the household never typed into the pantry is a
guess, not a certainty, and has to be confirmed the same way a combined line only partly
stocked already is; and — from a fourth report, "Hakkede tomater på dåse" against a
pantry that had "hakkede tomater" — a qualifier is not always a word in front of the
ingredient. "På dåse" (in a tin) trails it.

## The route

Three passes. The first added `stockedMatch`, tried a line's key whole and then its
trailing words, and wired it into the three places that already asked `stocked.has(key)`
— which made a qualified line silently disappear off the list, same as an exact match.
Shipped, tested, pushed.

The second pass was a correction: asked directly whether that silence was wanted, and it
was not — a trailing-word match is a guess about what the household meant, and guesses
here are supposed to be asked about, not acted on (`docs/sessions/2026-09-20-pantry-
combined-lines.md` drew exactly that line for combined lines already). Rebuilt the
matching around one function, `matchLine`, that answers two questions per line at once —
which stocked keys matched at all, and whether every one of them matched *exactly* — so
`stripStocked` only ever skips a line without asking when `fullyExact` is true, and
`ambiguousLines` catches everything else that matched, single ingredient or combined line
alike.

The third pass was a second correction, from a report that arrived after the first two
had shipped: "hakkede tomater på dåse" against a pantry with "hakkede tomater" was not
being matched at all — not even flagged as ambiguous — because the qualifier trails the
ingredient rather than leading it, and the matching only ever dropped words from the
front. Generalised `matchedStockedKey` from "drop a leading run of words" to "find the
longest contiguous run of words, from any position, that the pantry has an entry for" —
which also means a pantry holding both "tomater" and "hakkede tomater" now answers with
the more specific one, since longer runs are tried first.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 15% | Each report was a screenshot or a sentence; the work was in seeing which string was failing to match which, and why the existing rule missed it. |
| Reading the codebase | 10% | `pantry.ts`'s existing conjunction-split machinery, confirming `wanted`'s keys are already `pantryKey`-normalised. |
| Building | 35% | Three passes: `stockedMatch`, then `matchLine`'s exact/ambiguous split, then generalising the word-run search to both directions. |
| Tests | 20% | Unit tests for each pass; the last pass's mattered most, since a leading-only search would have quietly passed the earlier tests forever. |
| Review, CI, deploy | 20% | `npm run setup` from a cold container (no Docker, no `.env`, and once a stopped Postgres cluster mid-session), then full `npm run verify`, three times. |

## What should have been quicker

**Not assuming a qualifier only ever comes before the ingredient it describes**, on the
first pass. Danish and English both put an adjective in front ("smoked paprika") far more
often than not, which is exactly the trap: the common case looked like the whole rule,
and "on dropped only from the front" made it into a docstring and a CLAUDE.md paragraph
before a fourth report showed a preposition doing the same job from behind ("på dåse").
The fix — searching every contiguous run instead of only a shrinking front-dropped one —
is barely more code; the cost was believing the narrower rule was finished. Nothing short
of a wider net of examples up front would have caught this, and none were offered, but
it is worth naming: a "the ingredient is always named last" assumption is the kind of
thing that is true until somebody describes how it was bought, not just how it was cut.

**Asking "should this be automatic or should it ask?" before writing the matching code**,
not after shipping the first version — CLAUDE.md's own combined-line feature already
answered that question for the sibling case ("neither answered for outright... nor
plainly new... asks rather than guessing"), so the same default should have been the
starting assumption rather than a correction raised after the first pass shipped.

## What CLAUDE.md did not say

The combined-line matching (`ambiguousLines`, the "Har I allerede noget af det?" dialog)
was built in an earlier session and never made it into CLAUDE.md at all — only into that
session's own note. Closed across this session's second and third passes, in the same
paragraph under "The household has a cupboard", written to cover the combined-line case
and the new qualifier-matching rule together: a key is answered for without asking only
when it matched exactly, and a qualifier can sit on either side of what it describes.

## Decided rather than known

- **The longest matching run wins when more than one stocked entry could answer for a
  line** ("hakkede tomater på dåse" against a pantry with both "tomater" and "hakkede
  tomater" is offered "hakkede tomater"). Reads as the more useful thing to tell the
  household, since it is the more specific claim; untested against a household that
  actually wants the shorter one preferred, which nobody has asked for.
- **A whole word is the unit that moves, never a substring** — the deliberate guard against
  "hvidløg" reading as "løg". Nobody asked for this case explicitly; it followed from the
  same worry the conjunction split already had about Danish compounds.
- **The dialog names both halves of a combined line once either is only qualifier-matched**
  ("Salt og friskkværnet peber" against a pantry with both shows "Salt and Peber"), rather
  than naming only the part that was not exact. Reads as "here is what the pantry has that
  might answer for this line", which seemed more honest than implying the exact half was
  somehow still in question.
