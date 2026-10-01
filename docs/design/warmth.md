# A home should feel like somebody's home

The rules are in `CLAUDE.md` under *A home should feel like somebody's home, not like an
app*. This is why each of them is the rule.

## What "generic" was

Looking at the screens side by side, the feeling had four causes, and none of them was a
missing feature:

- **Cold neutrals.** Every grey was Tailwind's blue-tinted `slate` on a near-white page —
  the palette of an office dashboard.
- **The same empty tile everywhere.** A list, a task and a dinner without a picture each
  drew a grey square with a grey glyph: the one place a row could have had a personality,
  spent on a placeholder.
- **One voice.** A rounded face on headings only, too close to the system font to read as
  a choice.
- **Correct, flat words.** "Hi Anna", "0 open", "No tasks yet — add the first one above."

## Why the palette is redefined rather than replaced

Four hundred uses of `slate` across the codebase could have been rewritten to a warm
family. Redefining the scale instead means the change is one block, a new screen written
the ordinary way comes out warm, and there is no second neutral family for a screen to
be a shade colder in. Each step was checked against the old step's contrast on white:
500 and up still clear 4.5:1 as words on a card, on the page and on the band.

`white` is redefined as well, to the card's cream. Pure white cards on a cream page read
as holes cut in it. The band had to move with the page — `#e5e7eb` beside cream was a
grey stripe — and it is still one opaque literal in every theme, for the reasons in
`theme-and-frame.md`; only its value changed.

## Why a face is guessed and not stored

The alternative was to fill `emoji` for every existing list at migration time. That makes
the column two things — a choice somebody made, and a guess nobody made — and the guess
then stops following the title the day somebody renames "Groceries" to "Hardware". Null
as "nobody chose" keeps the column one answer, and `faceOf` makes the guess at the moment
of drawing. The guess uses substrings rather than whole words (Danish compounds carry no
space) and is deliberately conservative: a wrong face is a funny picture, but a stream of
them is noise, so the keyword list prefers guessing nothing.

The choices are a fixed set because a form can say anything, and a tile that drew
whatever arrived would draw a paragraph. Anything outside the set is ignored rather than
refused, so a bad picture never costs somebody the rest of what they typed.

## Why the day's line is decided before it is worded

A rotating cheerful line is easy to make dishonest: "A quiet day at home" above three
overdue jobs is the app not paying attention. So the situation is chosen first and
plainly, and only then is one of three phrasings picked — by the household's calendar
day, so everybody in the home reads the same sentence and it does not change on refresh.
It shares a line with the streak because the header's height is shared with the week's
ring, and `e2e/suggested-recipe.spec.ts` holds the whole of "Today" to one screen.

## Why the seasons are opt-in

A picture beside the household's name that nobody asked for is the app decorating
somebody else's home. Off by default, switched on in the Home card beside the colour and
the language, which are the other two things about how a home presents itself. Easter is
left out because it moves; a date table that needs updating each year is one that is
quietly wrong the year nobody did.
