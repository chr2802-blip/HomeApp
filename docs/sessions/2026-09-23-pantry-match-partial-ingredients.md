# A pantry entry did not answer for a qualified ingredient line

- **Date** — 2026-09-23
- **Branch** — `claude/pantry-match-partial-ingredients-g886ft`
- **PR** — not yet
- **Reached production** — not yet

## The idea

Reported from three screenshots: a pantry stocked with "Spidskommen" and "Paprika" still
put "Tørret spidskommen" and "Røget paprika" on the shop, and "Salt og friskkværnet
peber" was only recognised as half-covered ("Salt"), never noticing the pantry also had
peber. It turned out to mean two things, only the first of which was asked for at first:
recognise the match at all (a line's key only ever compared whole, so a modifier in front
of the ingredient hid a match that plainly should have fired), and — raised only once the
first cut shipped — never *silently* act on a match found that way. A modifier the
household never typed into the pantry is a guess, not a certainty, so it has to be
confirmed the same way a combined line only partly stocked already is.

## The route

Two passes. The first added `stockedMatch`, tried a line's key whole and then its
trailing words, and wired it into the three places that already asked `stocked.has(key)`
— which made a modifier-qualified line silently disappear off the list, same as an exact
match. Shipped, tested, pushed.

The second pass was the correction: asked directly whether that silence was wanted, and
it was not — a trailing-word match is a guess about what the household meant, and guesses
here are supposed to be asked about, not acted on (`docs/sessions/2026-09-20-pantry-
combined-lines.md` drew exactly that line for combined lines already). Rebuilt the
matching around one function, `matchLine`, that answers two questions per line at once —
which stocked keys matched at all, and whether every one of them matched *exactly* — so
`stripStocked` only ever skips a line without asking when `fullyExact` is true, and
`ambiguousLines` catches everything else that matched, single ingredient or combined line
alike. That unified the two call sites that used to run separate logic (a bare key check,
then a conjunction split) into one shared idea of what "matched" means, which is a
simplification the first pass didn't have a reason to make until the second pass needed
both call sites to agree on where the exactly/not-exactly line falls.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 15% | The screenshots showed the symptom; reading `shoppingText`/`pantryKey` to see exactly which string was failing to match which. |
| Reading the codebase | 10% | `pantry.ts`'s existing conjunction-split machinery, confirming `wanted`'s keys are already `pantryKey`-normalised. |
| Building | 30% | First pass (`stockedMatch`), then the second pass's `matchLine` rebuild once "must ask" replaced "should answer for". |
| Tests | 20% | Unit tests for both passes; the second pass's mattered more, since it is what actually proves the dialog fires. |
| Review, CI, deploy | 25% | `npm run setup` from a cold container (no Docker, no `.env`), then full `npm run verify`, twice. |

## What should have been quicker

**Asking "should this be automatic or should it ask?" before writing the matching code**,
not after shipping the first version. The two behaviours share almost all of their logic
— finding the match is the hard part, and autotomatic-vs-ask is one boolean once you have
it — so the rebuild cost was small, but it was a second review-and-verify cycle that a
single clarifying question up front would have folded into the first. The tell was in the
report itself: "it does not understand that it both contains peber and salt" is about
*recognising* a match, and says nothing about whether recognising one should be silent —
CLAUDE.md's own combined-line feature already answers that question for the sibling case
("neither answered for outright... nor plainly new... asks rather than guessing"), so the
same default should have been the starting assumption here rather than the correction.

## What CLAUDE.md did not say

The combined-line matching (`ambiguousLines`, the "Har I allerede noget af det?" dialog)
was built in an earlier session and never made it into CLAUDE.md at all — only into that
session's own note. Closed in this session's second pass, in the same paragraph under
"The household has a cupboard", written to cover both the combined-line case and the new
modifier case together as one rule: a key is answered for without asking only when it
matched exactly.

## Decided rather than known

- **Only a *leading* run of words is ever dropped**, never a trailing one: a recipe names
  the ingredient last far more often than the other way round ("smoked paprika", not
  "paprika smoked"). Untested against a recipe that puts the modifier after the noun with
  no comma; if one turns up, it needs its own rule rather than silently stretching this one.
- **A whole word is the unit that moves, never a substring** — the deliberate guard against
  "hvidløg" reading as "løg". Nobody asked for this case explicitly; it followed from the
  same worry the conjunction split already had about Danish compounds.
- **The dialog names both halves of a combined line once either is only modifier-matched**
  ("Salt og friskkværnet peber" against a pantry with both shows "Salt and Peber"), rather
  than naming only the part that was not exact. Reads as "here is what the pantry has that
  might answer for this line", which seemed more honest than implying the exact half was
  somehow still in question.
