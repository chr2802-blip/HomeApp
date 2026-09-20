# The week's meals, and tonight's dinner

Moved out of CLAUDE.md, which keeps the rules. This is the reasoning behind them.

## The week's meals are a row per day, and the row is the decision

`MealPlan` is one row per home per day, and which of its two optional columns is filled
is what it says: `recipeId` is what is being cooked, `leftoverOf` is the earlier day
being eaten again, and **neither is a night out**. A day nobody has planned has **no row
at all** — so "nothing planned" and "eating out" are the presence or absence of the row
rather than two columns that can disagree about the same evening, which is the same
reason a task has no flag beside its interval. `@@id([homeId, date])` is the whole shape:
replanning a day overwrites it, and the table is bounded by the days a household has
actually planned.

**The two columns are never both filled, and nothing in the database says so.** A check
constraint would be drift `db:check` cannot see in `schema.prisma` — it replays the
migrations and compares, and a constraint Prisma's schema language cannot express reads
as a difference — so the invariant is `planMeal`'s to keep and
`tests/integration/meals.test.ts`'s to hold. Both are written on **every** save, never
only the one the choice filled: a day going from leftovers to a recipe has to put the
pointer down on the way past. Every reader asks `recipeId` first, so a row that somehow
held both would read as the meal it names rather than as nothing at all.

`date` is the day in the home's own zone as `"yyyy-MM-dd"`, like `ClearedWeek.week` and
for the same reason — Thursday's dinner is Thursday's wherever the server is, and an
instant stored at midnight somewhere else lands on Wednesday for half the year. The
week's rows are fetched by naming its seven days (`weekDays`), which is what the column
is stored as sortable text for.

**A deleted recipe takes the day's plan with it** (`onDelete: Cascade`, where every other
optional relation in the schema uses `SetNull`): null means "eating out", so a plan left
behind as null would turn Thursday into a night out nobody chose. Cascading puts the day
back to nothing planned, which is exactly where it was before.

Every state arrives through **one** `PLAN_FIELD`, read by `planMeal`: a recipe id, and
`PLAN_OUT`, and `PLAN_LEFTOVERS` followed by the day being eaten again, and empty for the
day going back to nothing (which deletes — a row saying "nothing planned" would be a
second way of saying what no row already says). A tick beside a recipe picker could say
"eating out" and name a recipe at once, and something would then have to decide which the
household meant; leftovers would be a second such tick, able to disagree with the first.
The recipe id is checked through `homeDb`, so another home's recipe is simply not found,
and the clear is a `deleteMany` through the same client: it carries only a date, and
unscoped it would clear that day for every household on the installation.

**Leftovers point at a day, not at a recipe, and the pointer is a plain string.** The
target is this table's own composite key, and a self-relation on it could not be
`SetNull` — the home is half of that key and is not nullable — so the cascade would have
to delete Wednesday because Tuesday changed. Pointing at the day is also the truer
sentence: "Wednesday is Tuesday's leftovers" stays true whatever Tuesday turns out to be,
so replanning Tuesday takes Wednesday with it rather than leaving it naming a meal nobody
is cooking. A pointer that resolves to nothing — the day cleared, or cooked in a week not
on screen — still says **"Leftovers"**, which is the half of it that is still true and
the half that matters at six o'clock.

`planMeal` checks the two things that make the pointer a sentence, both against the
stored row rather than against what the form believed: the day must be **earlier** (which
is what leftovers means, and is also what makes a cycle unwritable without anyone keeping
a second thought about chains), and it must be a day this home is **cooking**, since
leftovers of a night out is not a sentence. The picker only offers days that pass both,
so an option the action would refuse is never drawn — and it reaches one day back past
the Monday on screen, because a week that could not see the Sunday before it would be the
one week in seven where living off the roast disappeared.

**The picker is a list of radios, not a `<select>` and not a combobox.**
`MealPicker` (`src/components/meal-picker.tsx`) draws it. A native picker holds one line
of text per row, which is no way to tell two hundred recipes apart, and it cannot be
searched — a household with a full collection was being asked to scroll all of it. An
ARIA combobox would draw the same rows and is a pile of roles and keyboard handling to
get subtly wrong, with no other one in this app to copy from. Radios sharing a `name`
are already a single-choice group both browsers and screen readers understand, and they
keep the whole control **to one field**: every state a day has still arrives through
`PLAN_FIELD`, exactly as it did through the `<select>`.

**The circle is drawn, not hidden behind the row.** An `sr-only` input under a tinted
border says "chosen" to somebody who can see it and nothing to a thumb looking for what
to press — and it cannot be clicked at all, which is how the browser suite found it.

**The order is what makes a long collection usable, more than the search box is.**
Searching only helps somebody who already knows what they want. The groups are for
everyone else: the two plain choices, then **Leftovers**, then **Suggested**, then
**Recently planned** (`RECENT_COUNT` of them, read back over `RECENT_LOOKBACK` rows of
plans strictly before the week on screen — a plan for next month is not something the
household has *been* cooking), then everything else alphabetically. A home keeps about
ten recipes in rotation however many it has saved, so **Recently planned** is what means
most picks never reach the search box at all.

**The groups are a partition, not a set of views.** A recipe is claimed by the first
group that wants it and is not drawn again below: one lasagne under both *Suggested* and
*All recipes* reads as the sheet having lost count rather than as two good reasons to
cook it.

**The chosen row always survives the filter, whatever is typed.** A radio that leaves the
page takes its value out of the form with it, and a `PLAN_FIELD` that arrives empty does
not mean "no change" — it means "nothing planned", which **deletes the day**. Searching
is not a way to clear an evening. That is also why "nothing matches" is counted from the
hits rather than from what is left on screen: a list down to the chosen row alone has
still found nothing.

Search reads the ingredients and the description as well as the title, for the reason
`RecipeDirectory` does — a cook's question is more often "what can I do with the feta"
than "what was that recipe called" — and it filters on the client, because the recipes
are already on the page and a round trip per keystroke would feel worse than scrolling.
The box does **not** autofocus: on a phone the sheet is the whole screen, and a keyboard
opening with it buries the list somebody has just asked to see. Nothing is virtualised,
because two hundred rows is nothing for the DOM and `RecipeDirectory` already draws every
recipe in the home on one page.

**An empty day is offered up to three recipes, as a group inside that list.** They were
chips above a `<select>` while the list below them could not draw a reason — two
different ways of choosing a recipe, in one sheet. Now that every row can,
a suggestion is simply a recipe the list has a reason to put first.
`src/lib/meal-suggestions.ts` ranks them and is a pure function with no database in it,
so `tests/unit/meal-suggestions.test.ts` can hold the part that can be wrong while
everything else works. Two things it does are the whole of why it is worth having:

- **It ranks by the share of a recipe that comes free, not by how few things it adds.**
  Fewest-new sounds like the same question and is not — it is won every time by whichever
  recipe has the shortest ingredient list, so a three-line dish sharing nothing beats a
  twelve-line one needing two things. The ratio asks what the household is actually
  asking.
- **It drops staples first.** Salt, oil, butter and flour are in everything, so without
  that every recipe overlaps every other and the ranking is noise wearing a number. What
  counts as one is derived rather than declared (`STAPLE_SHARE` of the home's own
  recipes, and no opinion at all below `STAPLE_MINIMUM` of them, where the share is a
  small sample rather than a cupboard): a household should not have to maintain a list of
  its own kitchen for the suggestions to be worth reading.

Matching is `shoppingText` from `lib/recipes.ts`, the same normalisation
`addRecipeIngredients` dedupes a shopping list with — so two recipes overlap here exactly
where their lines would have landed on one row of the shop. **No global item catalogue
was needed for any of this**, and the way to find out whether one would help is which
lines this fails to group.

The ranking is worked out once for the week rather than per day, because the basket is
the week's: every empty day is being asked the same question, and it answers differently
as the week fills. Ties break on fewer new ingredients and then on the title, so the same
week always offers the same three — a suggestion that moved between two renders is one
nobody could take a second look at. An empty basket offers **nothing at all**: with no
week to share with, "best" could only mean "shortest", which is a ranking of recipes by
how little they are, and the recipes page already lists every one of them. Nothing is
ever written on the household's behalf — choosing a suggestion is the same as scrolling
to that name in the list, and the Save button is still theirs.

The day's trigger carries `data-ready` once its handler is attached, because hydration
leaves no mark of its own: without it a browser test presses a static page, which passes
on an idle machine and fails whenever one is busy.

`/meals` is a tab, between Tasks and Recipes — the plan beside the collection it draws
from. The week is in the address (`?week=`, read through `weekStartOn`), so it is a place
that can be shared, bookmarked and reached with the back arrow, and the page stays on the
server with no week held in a component's state. Any day of a week is a link to that week
because the value is normalised to its Monday, and a day that never existed
("2026-02-31") falls back to the live week rather than drawing seven days of arithmetic
nobody can read. Pressing a day's row opens its sheet: there is exactly one thing to do
with a day, so a three-dot menu would be a menu of one entry standing in front of it.

## Tonight's dinner is today's row on the meal plan, not a pick kept apart from it

It used to be: `RecipeSuggestion` was one row per home, a pick with nothing to do with
whatever `/meals` said about the same evening — a household could tell `/meals` it was
eating out tonight and still see a suggested recipe on the dashboard, two different
answers to the same question. `tonightsDinner` in `src/lib/recipe-suggestion.ts` reads
today's `MealPlan` row instead, so the two pages agree because they are reading the same
one.

**A day already decided is shown as it was decided, and "Find new" is offered only where
it would not be arguing with the household.** A recipe — auto-picked by this component or
chosen by hand on `/meals`, the row cannot tell the two apart and does not need to — is a
suggestion, so the button replaces it. Leftovers and a night out are not: the row says
what the leftovers are the leftovers of (or nothing at all for a night out, the same
"absent entirely" the dashboard uses for a heading with nothing behind it), and stops
there, the same reason `/meals` never draws a suggestion beside a day already planned.

**A day with no row yet is where the auto-pick belongs.** One eligible recipe — the same
pool `excludeFromSuggestion` narrows for `/meals`' own suggestions — is written into
`MealPlan` as today's `recipeId` before this returns, so a second visit the same evening
shows the same dinner rather than a fresh coin flip, and `/meals` shows the same plan for
today the moment either page is opened next. A plain random pick on every render would be
simpler code for a feature that has to look like it remembers, and would leave `/meals`
not knowing what the dashboard had just decided on the household's behalf.

"Find new" replaces `recipeId` for today rather than adding to it — `@@id([homeId,
date])` on `MealPlan` already makes that the only shape a day's row can take — and
prefers whichever eligible recipe is not the one already showing, so the button visibly
does something when there is anything else to offer. It revalidates `/meals` alongside
the dashboard, because a household glancing at the week right after pressing it would
otherwise see yesterday's pick. Deleting the planned recipe takes the day back to nothing
planned (`onDelete: Cascade` on `MealPlan.recipe`, the same as any other recipe deleted
out from under a plan), so a stale pointer is never left behind: the next visit just
picks again, the same as any other day nothing was stored yet.

A category's `excludeFromSuggestion` keeps its recipes out of the pool entirely — a
recipe filed under an excluded heading and an ordinary one is still excluded, because a
household that ticked "Baby food" for exactly this reason does not want it back for
having a second category. The checkbox lives beside the name on both the add and rename
forms in `RecipeCategoriesAdmin`, read the same way `List.trackAmounts` is: an unticked
box is absent from the form rather than present and false.
