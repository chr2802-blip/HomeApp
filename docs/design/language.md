# A home's language, and why the catalogue is shaped the way it is

Moved out of CLAUDE.md, which keeps the rules; this is why they are the rules. The short
version lives under "A home is read in a language" there.

## Why the home, and not the person

A person belongs to several homes, and a home already has a colour it wears for
everybody in it — `Home.theme`, reasoned about in `theme-and-frame.md`. Language follows
the same shape for the same reason: what colour the milk list is drawn in, and what
language it is written in, are both facts about the household reading the screen, not
about whoever happens to be signed in. A person who runs the flat in Danish and merely
visits a Norwegian in-law's summer house should read that second home in whatever it
speaks, the same as they see its colour rather than their own.

The alternative — a language on `User` — was never seriously on the table, for the same
reason `User.activeHomeId` is a pointer rather than a permission: it answers a different
question from the one being asked. "What does this household sound like" and "what does
this person prefer to read" are both real questions, and this app has never needed the
second one. If it ever does, it is a second field with a second fallback, not a
replacement for this one.

## Why a phrase is its languages, written on one line

The obvious shape is an English file and a Danish file beside it — `en.ts`, `da.ts`,
maybe a shared key type generated from the first. It was rejected before it was
written, because it has a name: an *English master and a translated copy*, and the copy
is the half every review of the English change skips. A PR that adds a sentence to
`en.ts` compiles and ships; the missing Danish half is not a type error, not a broken
build, not even a lint warning under that shape — it is a runtime fallback, silently
speaking English to a household that asked not to, discovered by whoever next opens that
screen in Danish and wonders why one line did not follow the rest.

Writing `{ EN: "…", DA: "…" }` as one literal removes the possibility structurally rather
than by discipline. The two halves are typed together, so a missing one is a
`Property 'DA' is missing` error at the phrase's own definition, not somewhere three
files downstream where a component tries to read it. They are reviewed together, because
a diff that adds a phrase shows both languages on adjacent lines rather than in two
files a reviewer has to open side by side. And they are — this is the part a generated
key-union cannot give you — *written* together, by the same person, in the same sitting,
which is the only real defence against a translation that technically exists and reads
as though it was typed by someone in a hurry to make the compiler stop complaining.

## Why phrases are values and not key strings

`t("pantry.title")` is the shape most i18n libraries reach for, and it was rejected for
a reason specific to this codebase rather than a general objection to the pattern: this
app already refuses a second source of truth for the same question, everywhere else. A
runtime key is exactly that — a string the compiler cannot check against anything, whose
only witness that it resolves to something is the catalogue actually containing it at
the moment the code runs. `say(PANTRY.title)` is a plain import. A typo is
`Property 'titel' does not exist`, at the call site, before the test suite runs, rather
than an empty string on a page in production. And the import graph becomes a map of
which screens say what: a phrase nothing imports is a greyed-out export in an editor,
not a live key a script has to grep for.

The cost is real and was weighed rather than missed: every phrase has to be imported by
name, the way `MIN_AMOUNT` or `THEME_LABELS` already are. That is judged a fair trade for
a catalogue of a few hundred short entries, and it is also what keeps a client
component's bundle to the areas it actually imports — `PANTRY` pulls in forty phrases,
not six hundred, because a key-string catalogue would have to ship whole for the lookup
to work at all.

## Why the conjunction is never a phrase of its own

`namesInWords` in `src/lib/pantry.ts` is the hardest sentence in the app, and it earned
that status by nearly being built wrong twice. The first instinct is `AND = { EN: "and",
DA: "og" }`, glued onto a joined list with `+`. It reads as an obvious win — one phrase,
reused everywhere a list needs joining — and it is exactly backwards: "and" is not a
word with a fixed place in a sentence, it is part of the *shape* of a list in a given
language, and the shape is what varies. `PANTRY.lastTwo` — `"{most} and {last}"` in
English, `"{most} og {last}"` in Danish — is that shape, expressed as a phrase with two
slots rather than a word with none. The difference matters the day a third language
puts its conjunction somewhere else, needs a different one before a vowel, or takes an
Oxford comma the others do not: all three are differences in the *shape*, and a bare
conjunction glued on from outside could not have expressed any of them, because the
shape was never written down — it was assumed, in the code that did the gluing.

## Why a `src/lib` module takes the language rather than reaching for it

`homeDb(homeId)` already carries the home into a query so a page cannot forget it.
`weekWorkload(…, now)` already takes the clock as an argument so a test can say
Wednesday and mean Wednesday. `sayIn(language)` and every pure function built on it —
`pantryNote(covered, language)`, `dueLabel(dueAt, language, now)` — follow the identical
shape, and for the identical reason: the alternative is an ambient value some global
reads off the request, which works beautifully until the caller is not a request. The
reminder job has no session — it notifies several homes in one run, each in its own
language, and an ambient `t()` could not express "the language of the home this task
belongs to" without secretly becoming a parameter anyway. `/accept-invite` has to speak
the *inviting* home's language to someone who is not a member of any home yet, so
"whoever is signed in" is not merely unavailable there, it is the wrong question. A
value passed explicitly answers both; a value read from context answers neither.

This is also what makes one `Say` API do for both server and client, rather than a
`t()` on one side and a `useT()` on the other: `sayIn(user.homeLanguage)` on a server
page and `sayIn(useLanguage())` in a client component are the same call with the
language coming from a different place, and a `src/lib` function that only ever takes
the bare code works identically wherever it is called from.

## Why switching rewrites nothing

The pantry's key, a recipe's stored ingredient lines, a list item's text — all of it is
written once, in whichever language was current at the time, and none of it moves when
a home's language changes. The alternative was on the table for about as long as it
takes to say "re-run every stored recipe through the model" before the two costs became
obvious. It is a real bill against the household's own AI spend (`src/lib/ai-usage.ts`'s
monthly ceiling), charged for work nobody asked for at the moment they asked for it. And
it changes an ingredient's own words — the pantry's `key` is a normalisation of exactly
that text, so rewriting a recipe's ingredients after the fact would strand every pantry
entry matched against the old wording, silently, on a switch that looked like a
cosmetic preference. "Change only what happens next" costs nothing to build and nothing
to explain: the picker's own hint line says it, and it is true the moment it is read.

## What a third language would actually cost

Nothing here is built for exactly two languages by accident, but the shape does not
assume two either. `HomeLanguage` gains a member, `LANGUAGE_LABELS` and `HTML_LANG` and
`DATE_LOCALES` in `src/lib/language.ts` fail to compile until each has an entry, and
`tests/unit/language.test.ts` — which walks every phrase in `src/lib/copy/`, not a list
of its own — starts failing one test per phrase, naming which one has no form for the
new language, until every catalogue file has been given one. That is real work, on the
order of the size of the catalogue, and it is meant to be: a language this household's
recipes are never written in is not a form field, and the type system saying so at every
site that needs an answer is the whole point of the `Record<HomeLanguage, …>` shape in
the first place.
