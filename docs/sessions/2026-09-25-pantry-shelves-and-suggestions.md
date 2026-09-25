# Pantry shelves, add-box suggestions, and the unit in a sheet

- **Date** — 2026-09-25
- **Branch** — `claude/pantry-categories-suggestions-sn74hb`
- **PR** — not opened yet
- **Reached production** — not yet

## The idea

"The pantry is one long flat list; group it into categories, stop me adding what is
already there, and could AI help — suggest a category or a unit?" Mid-session: "move the
units into an edit dialog too, to give the list more room." That second ask turned out to
be the same sheet the shelves needed, so both went behind the three dots together.

A follow-up in the same session: "add search/filter too" — a search box and an "Only run
out" switch over the shelves.

## The route

Read the pantry end to end (schema, actions, page, row, quantity field), then the list's
add box (the model the user named for suggestions), then the two AI readers and their
guards. Built schema → catalogue → sorter → actions → components → page, then tests. The
e2e run found two real bugs rather than test problems: the suggestion listbox borrowed the
input's own label (two elements answering to one name), and the open list sat over the
Add button. A screenshot at 390px found the third: "sa" suggested garam masala before
salt, so word-start matches now come first.

The filter moved the shelves into a client component (`PantryShelves`), which is also
what changed "show it" from a direct scroll into an event: the row it points at may be
one the filter is hiding. Postgres had stopped between the two asks; `npm run setup`
brought it back, as CLAUDE.md says.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | The mid-session message changed the row's layout, not the plan |
| Reading the codebase | medium | How AI readers are bounded is spread over four files |
| Building | large | Nine files touched plus two new libs and three new components |
| Tests | medium | One e2e round for the label clash, one for a visually-hidden radio |
| Review, CI, deploy | — | not yet |

## What should have been quicker

**Finding out everything a new AI reader has to satisfy.** The rules are real and all
written down, but across CLAUDE.md's import section, `ai-usage.ts`, `ai-readers.test.ts`,
the e2e stub's dispatch and `ai-spend.tsx`'s `FEATURE_NAME` — the last of which nothing
would have failed on (an unnamed feature shows its raw string on Admin → System). A
checklist for "adding a model reader" would have saved reading all five to be sure.

## What CLAUDE.md did not say

- The pantry section described the unit picker on the row; rewritten for the sheet, the
  shelves, the catalogue-then-model split and the add box.
- Nothing said that a paid call nobody watches needs no `AiOverlay`. The AI-wait rule is
  phrased as "every AI wait", which is right, and the pantry's background sort is the first
  call that is not a wait. Written into the pantry section rather than generalised, since it
  is one case so far.

## Decided rather than known

- **A fixed set of shelves**, not household-defined headings like recipe categories.
- **Null means "not sorted yet" and `OTHER` means "decided: nowhere in particular."**
- **The model files shelves only, never units** — a stored null unit may be deliberate.
- **The sort after an add runs in the background** with no overlay; the heading's button,
  which somebody does watch, draws `AiOverlay` only when the model will actually be asked.
- **Per-person rate limit `"pantry-sort"`** reuses the login-attempt window (8 per 15 min),
  spent only when the model is asked. Adding many unknown names fast can outrun it; they
  wait under "Not sorted yet" for the button.
- **The filter also matches the shelf's name**, and hides rather than unmounts rows; it is
  not remembered between visits.
- **The catalogue's contents** (≈75 goods, their shelves and units) are my judgement of a
  Danish/English kitchen, e.g. garlic and lemons on the fridge shelf, onions under Other.
