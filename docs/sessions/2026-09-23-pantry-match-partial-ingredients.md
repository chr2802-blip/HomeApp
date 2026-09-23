# A pantry entry did not answer for a qualified ingredient line

- **Date** — 2026-09-23
- **Branch** — `claude/pantry-match-partial-ingredients-g886ft`
- **PR** — not yet
- **Reached production** — not yet

## The idea

Reported from three screenshots: a pantry stocked with "Spidskommen" and "Paprika" still
put "Tørret spidskommen" and "Røget paprika" on the shop, and "Salt og friskkværnet
peber" was only recognised as half-covered ("Salt"), never noticing the pantry also had
peber. All three are the same gap — `stockedMatch` (new; previously the check was a bare
`stocked.has(key)`) only ever compared a line's key whole, so a recipe's own modifier in
front of the ingredient ("tørret", "røget", "friskkværnet") was enough to hide a match
that plainly should have fired.

## The route

Read `pantry.ts` and `recipes.ts` first to confirm the exact-key design was deliberate
(it is — CLAUDE.md's "what matches is key, not name") and not itself the bug; the bug was
that nothing tried a second, narrower key before giving up. Fixed by trying the line's own
trailing words, one leading word dropped at a time, against the stocked set — "tørret
spidskommen" → "spidskommen" is the second try. Wired through all three read sites
(`stripStocked`, `ambiguousLines`, and `matchParts`'s per-half check), so a combined line's
halves get the same leniency a single-item line does. No wrong turns; the one thing worth
checking twice was Danish compounds ("hvidløg") not being mistaken for a match on one of
their parts ("løg") — covered by only ever dropping whole words, never a substring, and now
held by a unit test.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | 20% | The screenshots showed the symptom; reading `shoppingText`/`pantryKey` to see exactly which string was failing to match which. |
| Reading the codebase | 15% | `pantry.ts`'s existing conjunction-split machinery, confirming `wanted`'s keys are already `pantryKey`-normalised before `stockedMatch` sees them. |
| Building | 20% | `stockedMatch`, and swapping the three `stocked.has(key)` call sites for it. |
| Tests | 15% | Unit tests for the two reported cases, the combined-line case, and the compound-word non-match. |
| Review, CI, deploy | 30% | `npm run setup` from a cold container (no Docker, no `.env`), then full `npm run verify`. |

## What should have been quicker

Nothing unusual here — `npm run setup` did what its own documentation says it does.

## What CLAUDE.md did not say

The combined-line matching (`matchParts`/`ambiguousLines`, the "Har I allerede noget af
det?" dialog) was built in an earlier session and never made it into CLAUDE.md at all —
only into that session's own note. Closed in this commit alongside the new trailing-word
rule, in the same paragraph under "The household has a cupboard", so both are written down
together rather than the gap simply moving.

## Decided rather than known

- **Only a *leading* run of words is ever dropped**, never a trailing one: a recipe names
  the ingredient last far more often than the other way round ("smoked paprika", not
  "paprika smoked"). Untested against a recipe that puts the modifier after the noun with
  no comma; if one turns up, it needs its own rule rather than silently stretching this one.
- **A whole word is the unit that moves, never a substring** — the deliberate guard against
  "hvidløg" reading as "løg". Nobody asked for this case explicitly; it followed from the
  same worry the conjunction split already had about Danish compounds.
