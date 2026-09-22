# A home has a language (PR 1: the column, the voice, the importer)

- **Date** — 2026-09-22
- **Branch** — `claude/home-language-recipe-translation-d00qa8`
- **PR** — not yet opened
- **Reached production** — not yet

## The idea

A household should pick Danish or English for the app, and an imported recipe should be
read into whichever language the household reads — translated where the source was in
the other one, left alone where it already matches. Planned in one sitting with Opus,
built in a second with Sonnet against the plan's file.

That split held. The two sessions never had to renegotiate a decision — every place the
plan said "do X, not Y, because Z" is exactly what got built, and the handful of
adjustments (below) were the plan meeting real code, not the plan being wrong.

## The route

Planning was thorough enough that execution was close to a straight line: schema and
migration, `src/lib/language.ts` beside `theme.ts`, the `say`/`Phrase`/`Plural`
machinery, the session and root layout, the picker, the frame (nav + home menu), the
pantry vertical whole, `src/lib/time.ts`'s machine/person split, the importer's language
threading, the service worker's language-aware cache drop, tests, docs. One real bug
along the way: `SlotsIn<P>`'s first draft tried to compute a phrase's slot names from
`P[HomeLanguage]` (indexing by the union of both language keys at once), which TypeScript
would not narrow inside the generic — fixed by reading only `P["EN"]` to compute the
shape, since a phrase's two languages already have to agree on their own keys to
type-check as `Phrase | Plural` at all.

The other loop was mechanical rather than a wrong turn: every existing call site of
`renderNormalized`, `fetchRecipeFromUrl`, `importPastedCaption`, `namesInWords`,
`pantryNote`, `dueLabel` gained a required `language` argument, which is by design (a
forgotten language is a compile error, not a silent English default) but meant ~120 test
call sites across four files needed the same mechanical edit. Scripted with `python3 -c`
regex passes rather than by hand, with the handful the regex could not reach (a
`javascript:alert(1)` string with a `)` inside it defeating a naive non-greedy match)
fixed individually.

## Where the time went

| Stage | Roughly | Notes |
| --- | --- | --- |
| Understanding the ask | small | The four clarifying questions up front (symmetric translation, unit handling, switching behaviour, default) were the leverage — they turned into "decisions already taken" the plan never had to revisit. |
| Reading the codebase | large | Three parallel Explore agents (theme pattern, import pipeline, i18n surface) plus a fourth Plan agent for the catalogue's shape, all before any code. |
| Building | large | The machinery (`say.ts`, `language.ts`, the provider) was quick; threading `language` through every existing call site it touched was the bulk of the time. |
| Tests | medium | Mostly mechanical signature updates; the two new test files (`language.test.ts`'s structural walk, `copy.test.ts`'s worked examples) were quick to write once the pattern from `home-scoping.test.ts` was in hand. |
| Review, CI, deploy | — | Not yet run. |

## What should have been quicker

**Deciding, mid-build, how large PR 1's actual footprint should be.** The plan named
"the frame and the pantry, whole" as PR 1's screens, but `AddToListMenu` — shared by the
recipe page, the meal plan and the pantry — calls `pantryNote` directly, so converting
the pantry vertical meant converting that shared component too, which meant its label
("Add to list") now speaks Danish on the recipe page and meal plan as a side effect,
before either of those screens is otherwise touched. That is the right outcome (the
component could not be half-converted) but it was worked out by hitting the import
while writing the pantry page, not by the plan naming it. A plan for a screen conversion
should say explicitly which shared components that screen pulls in, the same way it
already names the lib modules.

## What CLAUDE.md did not say

Nothing new about the *existing* rules — the theme pattern, `homeDb`, `readForm` were
all documented well enough to follow without guessing. What was missing is now written:
`CLAUDE.md` gained "A home is read in a language, and it dresses the words" and a
correction to the import section's stale "the recipe keeps its own language, never
translated" line, in this same commit.

## Decided rather than known

- **`readForm`'s validation-message helpers (`requiredText`, `optionalText`, `bodyText`,
  `tooLong`) were *not* converted to take a `Say` this PR**, despite the plan's table
  saying they would. Making them functions of `say` would force every action file in the
  app to thread a language through immediately, not just the two converted here
  (`pantry.ts`, `admin.ts`) — a much larger blast radius than "the pantry, whole" implies.
  Instead `readForm` took an *optional* `language` parameter (defaulting to English) for
  its own one fallback message, and the two converted schemas became functions of `say`
  individually. The other action files keep their English literals until PR 2 converts
  their screens, which is consistent with the "screens PR 1 does not touch keep their
  English literals" rule — just not literally the shape the plan's table described.
- **`Admin → System` reads in the super admin's own active home's language**, not left
  English and not asked as a separate question, since it already reads `homeTheme` from
  the same session for the frame around it. Not one of PR 1's converted screens by the
  plan's own accounting, but its two `formatInZone` calls had to become `readInZone`
  calls once the machine/person split landed, so they took a language argument along the
  way.
- **The pantry's `ItemMenu` (its "Edit"/"Delete" wording) was left unconverted.** It is
  a shared component well outside the pantry, and `pantry-row.tsx` only supplies the
  strings genuinely specific to a pantry row (the remove title, the remove message, the
  confirm label) — the menu's own generic labels stay English until `ItemMenu` itself is
  converted in PR 2.
