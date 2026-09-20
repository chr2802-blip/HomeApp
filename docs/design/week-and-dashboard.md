# The household's week, and the dashboard that shows it

Moved out of CLAUDE.md, which keeps the rules. This is the reasoning behind them.

## The household's week, and the weeks behind it

`ClearedWeek` is one row per home per week in which a list was cleared, written by the
tick that empties one (`recordListCleared`). **A list emptied by deleting its rows
writes nothing** — the same rule the confetti follows, for the same reason. `week` is
that week's Monday in the home's own zone as `"yyyy-MM-dd"`, never an ISO week number:
the week before a Monday is the Monday seven days earlier and nothing else, while
`2027-W01` follows `2026-W52` and is arithmetic that goes wrong once a year.
`@@id([homeId, week])` is the whole shape — a second list cleared in the same week
raises `count` rather than adding a row, which also bounds the table.

`homeStreak` in `src/lib/streak.ts` walks back from the live week while there is no gap.
**A run counts as alive when it reaches this week or the last one**: the week being
lived in is not over, so a household that cleared something on Saturday and has not been
shopping since has broken nothing. `streakLine` is the sentence, and it is a unit test
of its own because that is the part that can be wrong while everything else works — a
run of one is not called a run, and a live run with nothing in the current week says so,
which is the whole of what a streak is for.

**`WeekProgress` on the dashboard replaced "N tasks completed in the last 7 days".** The
number was true and told nobody anything; a proportion has a top. Nobody's name is on
any of it, which is the same choice the streak makes: a weekly score with names on it
turns the washing-up into a thing worth being seen to do.

`weekWorkload` in `src/lib/week.ts` is what it counts, and **every task falls on exactly
one side of it**. That is the whole difficulty: a recurring task is never finished, so
"completed this week" and "still owed" are not opposites the way they are for a one-off.
Emptying the bins on Monday when they come round again on Wednesday is a job done and a
job owed, and counting it as both makes a household with one task read "1 of 2". So
**being owed wins** — a task due again before the week is out is this week's work still,
whatever was done to it on Monday, and one with nothing due until next month is done
with as far as this week goes.

**Owed means the whole week, not the part of it that has happened.** A recurring task
due on Friday is this week's work on Monday morning; a denominator that grew by one
every time a day turned over would be a bar that fell back each morning however much the
household got through. The bound is the instant next Monday begins — one exclusive
comparison, no last-millisecond arithmetic — and everything overdue from before this
week is inside it, because a job nobody has done since March is owed today whatever week
it first came due in. Counting every task in the home instead would put the annual
boiler service in the denominator of a shopping week.

`weekWorkload` takes the clock as an argument so `tests/integration/week.test.ts` can
say Wednesday and mean Wednesday. Every case there is a recurring task, because the
one-off is the easy half.

Ticking anything refreshes three views, not one (`refreshListViews`): the list's page,
the cards on `/lists`, and the dashboard the streak lives on.

## The dashboard is a page about what needs attention, and the first screen is all of it

Almost nobody scrolls a dashboard. What is above the fold on a phone *is* the page, so
every block on it is spending the only screen there is, and decoration pays the highest
rent.

**Tonight's dinner is a row, not a hero.** It opened with the recipe's photograph across
the full width — about two hundred pixels at a phone's 16:9 — and with the title, the
description and a full-width "Find new" underneath, the suggestion took half the first
screen. It is now built like a list card: thumbnail, title, one line of description
(`line-clamp-1`, because an imported recipe's description runs to a paragraph), and the
button beside them. The appetising photograph is one tap away on the recipe's own page,
where somebody who has decided to cook it is going anyway.

**The home's picture is `short` on the dashboard** and full height on a recipe page,
where the picture is what the page is about. It is a prop rather than a height in
`className` for the reason `Card`'s `padded` is: two height utilities, and which wins is
decided by their order in the stylesheet, not in the class attribute.

**`PageHeader` only clears its description past the row when there is a control to
clear.** That gap exists so a line of grey text does not run up against the button
opposite it — on a page with nothing on the right of its title, it is just a gap.

**The order of the blocks is what each one asks of you.** The week, then what is due
for you, then what is due for somebody else, then the dinner, then the lists. The
suggestion used to open the page and is now below the tasks: it is a decision to make
this evening, not a job that is late, and nothing else on the page is a job at all.

**A due task is two rows: what it is, then what to do about it.** The thumbnail, the
title, the repeat line, the due badge, the Done button and the three dots all shared one
row, and the only one of the six that could give up any width was the title — the badge
and the button are as wide as their own words whatever the screen. On a phone that left
the name a column narrow enough to break a word down the middle, which is the one thing
on the card somebody actually reads. The name now has a row to itself beside the
thumbnail, with the menu in the corner above; the badge and the button share the row
under it, the date read from the left and the press made from the right. It costs about
the height the wrapped title was costing anyway, which is why the first screen still
holds everything `e2e/suggested-recipe.spec.ts` checks for.

**Due for someone else is folded away, with its count on the heading.** It is
information rather than a job — the clearest case on the page of something worth
knowing and not worth a card each. The "Done" button inside it stays, because naming
somebody decides who is reminded and not who is allowed to do the job, and the fold
starts shut like every other `Collapsible`.

**The lists stop at `DASHBOARD_LISTS` and offer the rest.** Four is two rows on a
desktop and the last block on the page; a fifth and a sixth are below the fold either
way, where the Lists tab reaches them in one press. The recent query takes one more
than it draws, which is how the section knows to show "See all" without counting every
list in the home to find out. A household's favourites are rarely that many — what this
stops is the home with a dozen lists pushing everything else off the screen.

`e2e/suggested-recipe.spec.ts` holds the result: the dinner section stays under 160px,
and the week, the dinner, what is due and the lists are all on one 390×680 screen. The
number is loose on purpose — what it catches is a hero coming back, not a line of
padding.

`tests/unit/gamification.test.ts` holds the colours and the keyframes to the stylesheet,
the way `theme.test.ts` and `storage.test.ts` hold theirs — a `var()` nobody defined
draws an invisible fill, and an `animate-` class naming keyframes nobody wrote is an
element that simply appears. `e2e/animation.spec.ts` asks the browser what actually
played.
