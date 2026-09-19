# HomeHub

Lists, tasks and recipes for a household. Multi-tenant: everything belongs to a
**home**, and people belong to as many homes as they have been invited into. Next.js App
Router, Prisma, Postgres, on Vercel.

Read this before changing anything. Most of what follows exists because the alternative
was tried and caused a bug.

## Commands

```bash
npm run dev          # local dev server
npm run verify       # lint + types + all tests — what the pre-push hook runs
npm test             # vitest (unit + integration)
npm run e2e          # Playwright (builds the app first)
npm run db:studio    # browse the database
```

Integration and browser tests need the local Postgres: `docker start homehub-pg`.

## Conventions that are not optional

### A person belongs to homes, and reads one of them

`HomeMember` is the belonging: one row per person per home, carrying what they may do
**there**. Somebody in three homes has three of them, and is an admin in exactly the ones
that say so — running the flat is no licence over the summer house. `User.role` answers
only the remaining question, whether they look after the whole installation
(`PlatformRole`), because that one is not about any home.

`User.activeHomeId` is which of their homes is on screen and nothing more. It is a
pointer into the set, never the set itself, so **what somebody may reach is answered from
`user.homes`** — `canAccessHome` and `canAdministerHome` in `src/lib/access.ts` do exactly
that. Asking the active home instead answers "the one they happen to have open", which
looks like the same question and refuses the two homes they merely do not have open.

It is held loosely on purpose: a membership can be revoked while its owner is reading
somewhere else, so `getCurrentUser` checks it against the memberships and falls back to
the first home they joined. It writes nothing back — a page render is no place to start
correcting the database, and the next switch fixes it anyway.

Switching is `switchHome`, which moves the pointer and grants nothing. The header's name
becomes a menu once there is more than one to go to, `/homes` lists them, and that page is
also where somebody with no home at all is sent, because it is the only page with
anything to tell them.

### Administration is two different things, in two different places

**Admin** is a tab, and it is the super admin's alone: `/admin` holds the installation —
**System** (how the deployment itself is doing) and **Homes** (create, switch into, delete).
`requireSuperAdmin` guards all three pages.

Running one household is not that. It is `/settings`, reached from the home's own picture
and name in the header, and it follows the home on screen rather than the person:
`canAdministerCurrentHome`. Somebody who runs the flat and merely lives in the summer
house is offered Settings in one and not the other, and a tab would have been a tab
leading to a page they cannot open half the time.

An action is gated the same way, and this is where it is easy to get wrong.
`requireAdmin` answers only "do they run *a* home" — it is the gate on being offered
administration at all, never the answer to whether *this* home is theirs. An action
given a home id checks that id with `assertHomeAdmin`; an action that takes its home
from the session instead (the recipe-category ones do) asks `canAdministerCurrentHome`.
**Never pair `requireAdmin` with the active home**: that combination reads as a check
and admits an admin of the flat to everything in the summer house.

`/profile` is the third thing, and it belongs to nobody's home: a person's name,
password, picture and notifications, one page however many households they are in. It is
in the same menu because that menu is "this home, and me in it".

**The header's name is a menu for everybody**, not only for somebody with a home to switch
to — it is how Settings and Profile are reached. `HomeMenu` in
`src/components/home-menu.tsx` draws it; the list of other homes appears inside it only
when there is more than one, because a chooser with a single choice is furniture.

### A home is dressed in a colour, and it dresses the controls

`Home.theme` is one of a fixed set (`HomeTheme`), picked by that household's admins in
the Home card on `/settings`. Somebody in several homes needs to know which one is open
before they add milk to the wrong shopping list — the header says so in words, with the
household's picture beside them, and its colour is on every control below.

What each colour *is* lives in **`globals.css` and nowhere else**, as a block of five
variables per theme keyed by `[data-theme="NAME"]`. `src/lib/theme.ts` holds what they
are called, and `BAND` — the one colour CSS cannot reach, because `<meta
name="theme-color">` takes a literal. Anything showing a colour — a swatch in the picker, a dot beside a home
in the header's menu — carries that home's `data-theme` and reads `var(--accent)`, so it *is*
the colour rather than a copy that drifts. `tests/unit/theme.test.ts` reads the
stylesheet and fails if a theme has no block: an undefined variable leaves the element
wearing whatever the page already had, which looks like a theme that works.

The attribute goes on `<html>`, set by the **root layout** from the session. Not on a
wrapper inside the app: sheets and the three-dot panel are portalled into `<body>`, so
anything scoped to a div would leave every dialog in the previous home's colours.

**The frame is `--band`, and it does not follow the household — it is the one thing
about a theme that is not that theme's to choose.** It used to: each theme carried its
own pale tint, on the understanding that `<meta name="theme-color">` retints an
installed app's status bar on every request. It does not — the tag is read once and does
not repaint itself as somebody moves between homes, so the strip stayed whichever colour
loaded first while the header underneath it changed home under it, in five homes out of
six. `BAND` is now a single literal, not a `Record<HomeTheme, …>`, declared identically
in every theme block in `globals.css` and read by `generateViewport` for the meta tag —
the one painter that has to be told the colour in words, which is why it is worked out in
the root layout rather than declared there. It is `#e5e7eb`, not white: a frame drawn in
the page's own colour reads as no frame at all, which is the seam this exists to close by
another route.

**Each painter reaches a different edge.** The app is laid out under the phone's own
bars — `viewportFit: "cover"` — so the gesture bar at the bottom is inside the viewport
and the tab bar's band simply reaches it. On iOS the strip at the top comes from the
document's background, which is why `html` carries the band, and its glyphs stay the
phone's own dark ones through `appleWebApp.statusBarStyle: "default"`. On Android that
strip is tinted from the meta tag at launch. The manifest's `theme_color` reads once when
the app is installed and is the splash screen's colour — now the same literal as
everywhere else, so it is no longer the odd one out.

Laying out under the bars is a debt the layout pays back in three places, and
`tests/unit/theme.test.ts` holds all three together: the header pads past
`env(safe-area-inset-top)` so its row clears the clock, the tab bar pads past
`env(safe-area-inset-bottom)` so the tabs clear the gesture bar while the band behind
them fills it, and `main` clears both. Every inset is zero on a desktop, so getting one
wrong is invisible in a browser and obvious on a phone.

**The band is a pale, neutral tint, not a tint of any theme's accent.** It has nothing
left to be an accent tint *of* — it is the one colour every theme shares — and a light
one for the same reason it always was: the strip at the top holds the phone's own clock
and battery in dark glyphs and the header holds near-black words, and both have to stay
legible on it. Drawing the frame in an accent itself is a different change again: it
wants white header text, and on iOS a translucent status bar style, and it is not a
colour swap.

**The band is opaque, in every theme, and that is load-bearing.** It was `rgb(… / 0.85)`
so the header could frost what scrolled under it — and a frosted header is a different
colour every time the page moves, which a strip the phone paints can follow none of. The
unit test checks the alpha as strictly as the hex, and no theme block may bring back an
`--accent-soft` of its own: that would be a second colour for the same strip, and the
one the phone is told about is whichever of the two the header did not use.

**The colour dresses the controls, never the meanings inside them.** The primary button,
the active nav pill, the focus ring and the hairline under the header — and nothing
else, the band included: that one dresses no home at all any more. Green is still
"added", red "about to be deleted", amber "overdue", in every home; a household dressed
in one of those would be saying it on every screen, which is why none of the themes is
any of them and why `create` and `danger` keep their own colours.

**The one palette that is neither a home's colour nor a meaning is the charts'.**
`--chart-recipes`, `--chart-lists`, `--chart-tasks` and `--chart-rest` in `globals.css`
dress the storage donuts, and they are fixed: a slice is read rather than pressed, and in
the household whose accent happened to match it a slice would disappear into the Save
button below it — while a legend drawn in each home's own colours would mean one thing in
the flat and another in the summer house, about kinds that are the same in both. None of
the four is green, red or amber either, checked by `tests/unit/storage.test.ts` against
the same three `theme.test.ts` keeps out of the themes. The exception proves the rule: on
the super admin's across-homes ring a slice *is* a household, so it wears that
household's `data-theme` and reads `var(--accent)`, exactly as its dot does in the
header's menu.

The picker submits `THEME_FIELD`, checked against the set by `updateHome`. It is
optional there — a colour not mentioned is a colour left alone — because the other ways
into that action (a picture being replaced, a rename) are not about the colour. Unlike
`REPEAT_FIELD`, silence here changes nothing about what the record means.

### Home-scoped data goes through `homeDb`

```ts
const lists = await homeDb(user.homeId).list.findMany({ orderBy: { createdAt: "desc" } });
```

`src/lib/home-db.ts` carries the home into every query against a home-scoped model
(List, Task, Recipe, RecipeCategory, Invite, HomeMember, Photo) and stamps it onto
anything created. A query that forgets the home returns nothing rather than another
household's rows.

**Never hand-write `where: { homeId }` in a page or component.** A lint rule rejects
`prisma.list` and friends there. Use `prisma` directly only where crossing homes is the
point — the reminder job, the super admin's system view — and say so in a comment.

**User is not home-scoped, and `homeDb` refuses it** along with `ListItem`,
`ListItemSource`, `ListFavorite` and `RecipeCategoryLink`. None of the five carries a
`homeId`, so scoping would pass the query straight through — and `homeDb(id).user.findMany()`, which used to
mean "this home's people", would now hand back every account on the installation. A
household's roster is `homeDb(id).homeMember.findMany({ include: { user: … } })`, and a
list's items are an `include` on a list query that went through `homeDb`.

Being refused is the point, and the refusal is the whole protection: a model that reads
as though it belongs to a home but carries no `homeId` would be passed through
*unscoped*. `ListItem` was in exactly that position and `homeDb(id).listItem.findMany()`
returned every household's shopping.

So `home-db.ts` no longer keeps a list of what to scope. **Which models carry a home is
read from the schema** — a model has a `homeId` column or it does not, and Prisma
already knows — so that half can no longer drift. What remains by hand is `NO_HOME_ID`,
the judgement the column cannot express: of the models with no `homeId`, which read as
though they belong to a home (`refuse: true`) and which genuinely have nothing to do
with one (`refuse: false`).

**A model in neither is an error, not a default.** Adding one to the schema without
classifying it fails `tests/unit/home-scoping.test.ts` — no database, seconds, naming
the model and the decision — rather than silently returning another household's rows at
the first query. That test walks the schema rather than a list of its own, which is what
stops the list and the schema parting company again.

Permission checks live separately in `src/lib/access.ts`; `homeScoped` in
`src/lib/scoped.ts` fetches a single record and asserts access. `homeDb` does not replace
those — it removes the chance to ask the wrong question.

### A task is one of two things, and `intervalDays` is which

`null` is a one-off — done once and finished — and a number of days is the recurring
kind, which books itself in again each time it is completed. There is no third column
saying which: a flag beside the interval would be a second answer to the same question,
and the one that quietly disagrees is the one every list is then wrong about.

So "finished" means a one-off with `lastCompletedAt` set, and a recurring task is never
finished however many times it has been done. `FINISHED` and `UNFINISHED` in
`src/lib/tasks.ts` are that sentence as a `where` clause — **every query that means
"still to do" uses one of them**: the tasks page, the dashboard, the reminder job, the
overdue counts. A finished one-off keeps the date it was due, which is in the past for
ever, so a query that forgets reminds the household about it every morning until
somebody deletes it.

`UNFINISHED` is written as `{ NOT: FINISHED }` rather than the `OR` it is equivalent to,
because callers spread it beside clauses of their own and the reminder job already has
an `OR`. One key cannot collide; an `OR` would silently replace theirs.

Which kind is being written is submitted in its own field (`REPEAT_FIELD`), never
inferred from a blank interval — a number that failed to arrive would otherwise turn a
recurring task into a one-off with nobody saying so. A form that does not mention it is
read as recurring, which is what every task was before one-offs existed.

### Dates go through `src/lib/time.ts`

The household runs on one clock (`TIME_ZONE`, currently `Europe/Copenhagen`), never the
server's. Use `dueAtOn`, `dueAtDaysFrom`, `formatInZone`, `calendarDaysBetween`.

Never `new Date(...)` arithmetic, `getHours()`, or `toDateString()` for anything a person
sees. Those read the server's clock, which is UTC in production and something else on a
laptop — the same input then means different things in different places. Both test suites
run with `TZ=UTC` so this fails on the machine that wrote it rather than in CI.

### Pictures are shrunk in the browser, and checked again on arrival

A home, list, task and recipe can each carry one `Photo`, whose bytes live in Postgres.
`src/lib/downscale.ts` runs in the browser: it decodes what was picked, applies the EXIF
rotation, and redraws it at `MAX_EDGE` and `THUMB_EDGE`, so a phone photo never travels.
`src/lib/photo-file.ts` then reads the format and dimensions out of the bytes that arrive —
never out of the request's `Content-Type` — and refuses anything past the limits.

Never trust the browser's side of that. It is there so the upload is small, not so the
server can skip measuring.

Pictures upload to `/api/photos` the moment one is chosen; the form carries only the id, in
the field `PHOTO_FIELD`. Actions read it with `readPhotoChoice`, which looks it up through
`homeDb` — so another home's id is simply not found. An action that replaces or clears a
picture calls `discardReplaced`, and one that deletes the thing holding it calls
`discardPhoto`: nothing else can be pointing at it. An upload whose form was abandoned is
swept up by the next upload from that home.

Pages read `photoId` and nothing else. **Never `include: { photo: true }`** — that pulls
both copies of the bytes into a page that only needs a URL.

A person's own picture is the one that does not fit: `User` is not home-scoped and a
`Photo` is, so an avatar is filed under whichever home they were reading when they chose
it. Two things follow, and both are load-bearing. `Photo.users` exists so the sweep does
not take an avatar for an upload nobody finished and delete it an hour later. And
`/api/photos/<id>` serves a picture somebody is using as their own to anyone who shares a
home with them, wherever it happens to be filed — otherwise a housemate met in a second
home would see a broken image.

### How much room a household takes is measured by Postgres, not counted up here

`src/lib/storage.ts` answers "how big is this home", and because a picture's bytes live
in the database rather than in object storage that is a real question with a real number.
`/settings` shows one household its own, as a donut with the total in the hole; **Admin →
System** shows the super admin the same total cut two ways — by home and by kind — which
is one of the few places crossing homes is the point.

It is raw SQL because `pg_column_size` is the only thing that knows what a row occupies:
a value is stored compressed, and adding up `length()` on the way past reports the size of
something the database never wrote. **A whole row (`t.*`) for everything except `Photo`,
whose two blobs are measured column by column.** `pg_column_size` on a column reads the
size out of the TOAST pointer, while building the composite for a whole row fetches the
bytes back — so `pg_column_size(p.*)` would pull every picture in the home through the
connection in order to weigh it, on a page somebody is waiting for.

**A picture counts towards the thing showing it**, which is why the slices are Recipes,
Lists and Tasks and not Photos. A recipe's photo is a hundred times its text, so "Recipes:
40 MB" is something a household can act on and "Photos: 40 MB" is the same number with the
useful half taken out. What is left — the home record, its members and invites, the home's
own picture, the avatars filed here and the uploads nobody finished — is `rest`, drawn in
the one deliberately quiet colour.

The home is bound into the query rather than carried by `homeDb`, which scopes Prisma's
model calls and has nothing to say about raw SQL. `getHomeStorage` takes a home id and
filters the union by it; `getInstallationStorage` names no home at all and is the super
admin's alone.

**A kind is a name in TypeScript and a colour in `globals.css`, and nothing but
`tests/unit/storage.test.ts` holds the two together.** A `var(--chart-whatever)` nobody
defined resolves to nothing, which draws a slice with no stroke: the legend beside it is
still complete and still right, and the ring is simply short a piece. That is a chart
quietly lying about a total, which is worse than one that is visibly broken — and it is
the same failure a theme with no block in the stylesheet has, caught the same way.

### Form actions report what happened

Actions that read user input take `(previous, formData)` and return `ActionResult`:

```ts
export async function createThing(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const form = readForm(schema, formData);
  if (!form.ok) return fail(form.error);
  ...
  return ok();
}
```

Validation uses Zod through `readForm` (`src/lib/form.ts`), so the wording a person sees
sits beside the field. **Never bail out with a bare `return`** — that closes the dialog as
though it saved. Actions that only act on an id (toggle, delete, complete) keep a plain
`(formData)` signature; there is nothing to report.

### Editing and deleting live behind the three dots

Every stored thing — a list, a recipe, a task, a home, a member, a category — carries its
edit and delete in a `ContextMenu` (`src/components/context-menu.tsx`), opened by a button
of three dots. `ItemMenu` (`src/components/item-menu.tsx`) is the usual way in: give it the
id field both actions read, the record's name and the edit form's fields, and it owns both
sheets. **Never put a bare Delete button on a card.** A destructive button beside a link is
a destructive button that gets hit with a thumb.

The panel is drawn through a portal and positioned from the trigger's box on screen: the
cards it belongs to clip their own contents, so a panel rendered inside one is cut off. It
follows the page when that scrolls rather than closing — a scroll begun before the press is
delivered *after* it, and closing would shut the menu the press had just opened.

### A recipe is filed under one category or several

`RecipeCategoryLink` is the pairing, and a recipe has at least one: a lasagne is both a
weeknight dinner and Italian, and being made to choose means filing it under whichever
came to mind first and then failing to find it under the other. The recipes page shows it
under each of its headings — until a filter is on, where only the heading that was asked
for is drawn.

The picker sends one `CATEGORY_FIELD` entry per box ticked, so it is read with
`readCategoryChoice` rather than through the schema: `readForm` builds its object with
`Object.fromEntries`, which keeps only the last of a repeated field. An action checks
every chosen id through `homeDb` before writing, and **a recipe left under no heading is
refused** — it would still be saved, and simply not appear on the page that lists the
household's recipes.

A category that still holds recipes cannot be deleted, by the action and by the foreign
key both. Untick it on those recipes first.

### Ticking something off is the moment the list is for, and it is worth seeing

A tick used to happen where it could not be seen. The row was marked done and moved into
the completed section — closed, by default — inside the same render as the press, so the
box that was pressed was gone before it could show anything, and the only trace was the
pop on the **Completed** heading. That pop is still there; what it now pops for is a
movement whose first half is visible.

`SETTLE_MS` in `src/components/list-items.tsx` is how long a ticked row is held in the
open group before it moves: the box fills and pops, the words strike through, and the row
slides away to the right (`tick-off` in `globals.css`). The two numbers have to agree —
held for less and the row is cut off mid-slide, held for longer and a blank row waits.
It is a timer rather than an `animationend` listener because the row has to move even
where the animation never runs: a backgrounded tab, or somebody who asked the system for
less motion, where every duration in the app collapses to nothing. **Untick a settling
row and it simply stops settling**: the row is staying, and an animation about leaving
would be describing something that is no longer happening.

The press is handled in `handlePress`, beside the optimistic change rather than inside
it. React runs a form action in a transition, where an update may be held back a frame or
two, and the one thing feedback about a press must not be is late.

**A list's progress is drawn in `--chart-lists`, not in the home's colour and not in
green.** The accent dresses the controls, and a bar is read rather than pressed — in the
household whose colour happened to match, a full-width bar would read as one more long
flat button. Green is "added" everywhere else in the app, so a bar that turned green on
its last item would be saying that instead. It is the same blue the list's slice wears on
the storage donuts, which is the palette that exists for saying "this much of that".

The bar on the list's own page lives **inside `ListItems`**, not up beside the title: a
tick is optimistic, so the proportion has to be told by the same state the rows are.
Counted on the server it would sit one press behind every time, which is the one thing a
progress bar may not do. The cards on `/lists` and the dashboard draw the same bar from
stored counts, where there is no press to be behind. Everywhere it appears the same
proportion is already in words directly beside it, so the bar itself is `aria-hidden` —
a progressbar role there would only read the line twice. `data-progress` carries what it
claims, so a browser test can hold that against the width it is actually drawn at.

**Clearing the last item is celebrated once, and leaves nothing behind.** `Celebration`
throws confetti over the whole screen and takes itself off the page afterwards; `cheer`
in `src/lib/haptics.ts` is the longer buzz beside it, as `tick` is the short one for an
ordinary item. It fires from the press that empties the list, counted before the change
is applied — **a list emptied by deleting its rows reaches the same state and is not
celebrated**, because nothing was finished. The pieces are written out rather than
generated, so there is no randomness to reason about, and the overlay is
`pointer-events-none` throughout: a mis-tick stays undoable while it falls.

**Halfway is the quiet one.** Crossing half the list swells the bar once (`halfway`)
and says nothing in words — a sentence about being halfway through the shopping is a
sentence in the way of the shopping. Only upwards and only on the crossing, counted from
what the bar read before the press and what it will read after: a list ticked and
unticked around the middle would otherwise pulse on every press, which is movement that
has stopped meaning anything. The last item has the confetti instead, so this never
fires on a list of two.

**A ticked row says who got it, where there is anybody to tell apart.**
`ListItem.completedById` is written by `toggleListItem` and cleared again when the item
goes back — the mark answers "who is picking this up", which is a question about the
shop still to do, exactly like the recipe note beside it. `PersonMark` draws it: their
picture, or their initials, because a household where nobody uploaded one would
otherwise see the feature as simply missing. It is drawn only when the home has more
than one member (`shared`), since a mark saying "you" on every line is decoration, and
the name is carried into the optimistic tick (`me`) so the one row somebody is looking
at is not the only one that cannot say.

**A task is marked done at a button and nowhere else, so that is where the moment is
drawn.** A recurring task books itself in again and stays exactly where it was; there is
no row sliding anywhere. `TaskDoneButton` is the one component behind both places a task
is completed from — the card on `/tasks` and the row on the dashboard — and it rises a
tick out of the button (`stamp`) on the press, beside the same buzz a list item gets.
The spinner in `SubmitButton` says the answer has not arrived; the stamp says the press
was seen, and they are different jobs. **Reopening keeps a plain form**: an undo is not
an achievement.

### The household's week, and the weeks behind it

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
number was true and told nobody anything; a proportion has a top. The denominator is the
week's own work — everything finished since Monday plus everything due by the end of
today and still not done — and not the household's whole task list, which would put the
annual boiler service in the denominator of a shopping week. It is due by the *end of
today* rather than by this moment: a task due today is the household's work today, and
`DUE_HOUR` is only when the reminder goes out. Nobody's name is on any of it, which is
the same choice the streak makes: a weekly score with names on it turns the washing-up
into a thing worth being seen to do.

Ticking anything refreshes three views, not one (`refreshListViews`): the list's page,
the cards on `/lists`, and the dashboard the streak lives on.

`tests/unit/gamification.test.ts` holds the colours and the keyframes to the stylesheet,
the way `theme.test.ts` and `storage.test.ts` hold theirs — a `var()` nobody defined
draws an invisible fill, and an `animate-` class naming keyframes nobody wrote is an
element that simply appears. `e2e/animation.spec.ts` asks the browser what actually
played.

### An item can say which recipe put it there

`ListItemSource` pairs a list item with a recipe, and "Add to list" on a recipe page
writes them: every ingredient line goes onto the chosen list, and each item it touched
then names the recipe underneath itself. An item nobody attached to a recipe — typed
into the add box — has no row and says nothing, which is what makes the note worth
reading where it does appear.

Three rules decide what adding means, and they are what the integration tests pin down.
A line already on the list is **wanted once more**, so the amount goes up by one rather
than a second row appearing; a line **ticked off earlier comes back at one**, because
what a ticked row carries is what was bought last time; and the pairing is **one row per
(item, recipe)**, so the same recipe added twice bumps the amounts and still names
itself once while two recipes wanting onions name both.

**The note goes when the item is ticked off**, in `toggleListItem`. It answers "why is
this on my list", which is a question about the shop still to do — once the thing is in
the basket the recipe has been dealt with, and the row is only next week's vocabulary.
Putting the item back therefore brings back the item and not the note. The rows also go
with the recipe (`onDelete: Cascade`): a note pointing at a recipe that no longer exists
has nothing left to say.

Like `ListItem` it carries no `homeId`, so `homeDb` refuses it and pages read it as an
include on a list query that went through `homeDb`. Both ids the action is given — the
recipe's and the list's — are checked against the caller's homes, because one press
sends both.

### Tonight's dinner is cached for the day, not recomputed on every visit

`RecipeSuggestion` is one row per home: the recipe currently suggested, and the date (in
the home's own zone) it was picked for. The dashboard reads it, and picks a fresh one
only when that date is not today's — `src/lib/recipe-suggestion.ts` is the whole of that
logic. Without the row, opening the dashboard twice in an evening would show two
different dinners, which is not what "today's suggestion" means; a plain random pick on
every render would be simpler code for a feature that has to look like it remembers.

"Find new" replaces the stored pick rather than adding to it — `@id` on `homeId` makes
that the only shape the row can take — and prefers whichever eligible recipe is not the
one already showing, so the button visibly does something when there is anything else to
offer. Deleting the suggested recipe takes the row with it (`onDelete: Cascade` on both
sides), so a stale pointer is never left behind: the next visit just picks again, the
same as any other day nothing was stored yet.

A category's `excludeFromSuggestion` keeps its recipes out of the pool entirely — a
recipe filed under an excluded heading and an ordinary one is still excluded, because a
household that ticked "Baby food" for exactly this reason does not want it back for
having a second category. The checkbox lives beside the name on both the add and rename
forms in `RecipeCategoriesAdmin`, read the same way `List.trackAmounts` is: an unticked
box is absent from the form rather than present and false.

### A new recipe starts by asking how, not with a field buried in the form

`NewRecipeDialog` (`src/components/new-recipe-dialog.tsx`) is what the "New recipe"
button on `/recipes` opens, and it is a small choice before it is a form: **Start from
scratch** or **Import from a link**, because the two ways of beginning a recipe are a
decision the cook makes once, up front, not a field to notice partway down a form they
have already started filling in. `/recipes/new` and `/recipes/[id]/edit` are the plain,
unlinked pages this dialog's `RecipeFields`/`RecipeForm` grew from — they still work as
direct links, but the dialog is what the button actually opens, and it carries no import
step of its own.

The dialog has three steps (`"choose" | "url" | "form"`), all inside the one `Modal` so
opening it never feels like leaving the page: **choose** offers the two buttons above;
**url** is `RecipeImportField`, on its own rather than as a field on the create form,
because fetching is a side trip that may fail and folding it into the same submit as
saving would make one Save button mean two different things; **form** is the ordinary
`RecipeFields`, seeded with either nothing or whatever came back from the fetch. The step
resets to **choose** on every *open* rather than on close — resetting on close would
show the sheet flashing back to the choice screen while it is still animating away.

**The button reads the clipboard before it decides which step that is.** A cook who
copied a recipe's own link specifically to bring here did not copy it to be asked
"how do you want to start" — `clipboardRecipeUrl` checks, and a web address found there
sends `openFresh` straight to **url** with it already seeded, where `RecipeImportField`
starts the same fetch a press of the button would, once, on arrival. That check runs
*before* the sheet opens rather than after, so it is never seen choosing: opening on
**choose** and then jumping to **url** a moment later would show exactly the flash the
close-vs-open reset above exists to avoid. Anything else on the clipboard — nothing,
plain text, a browser that will not say (Safari has no `readText` at all; Chrome can
refuse silently when the page lacks focus) — is treated the same as if there had been
nothing to check, which is the ordinary **choose** screen this always showed. Choosing
**Import from a link** by hand always starts blank, even moments after an automatic
fetch from the clipboard found something: a deliberate press is not the clipboard
speaking again.

**Importing reads the page's own structured data rather than scraping it.**
`src/lib/recipe-import.ts` reads the `schema.org/Recipe` markup almost every recipe site
already publishes for search engines, in whichever of its two standard shapes that
site's own software produced: **JSON-LD**, one self-contained `<script>` block, read
first because there is nothing to gather; and **Microdata**, `itemscope`/`itemtype`/
`itemprop` attributes scattered across the page's own elements, read with `cheerio`
because a proper parser is what scattered attributes need. A page publishing both is not
unheard of, and one field missing from whichever came first is filled in from the
other — a recipe is refused only when neither has enough to cook from. A page with
neither, or with a name but nothing to cook, is refused rather than guessed at from
prose: a wrong guess dropped silently into the form is worse than a cook typing it in by
hand, which is what happens either way once the fields are left blank.

**A link that reaches a page with nothing to cook from is not a dead end.** `notARecipe`
on `ImportOutcome` marks exactly that failure — a reel, a shop page, anything the parser
above refuses — as distinct from a mistyped address or a page that would not load, which
are worth retrying as typed rather than abandoning. `NewRecipeDialog` turns that flag into
a "Start from scratch" button beside the error, which matters most when a clipboard link
sent the dialog straight to the **url** step with no **choose** screen already behind it
to fall back to. The flag, not the error string, is what the client checks:
`recipe-import.ts` pulls in `sharp` for the image work below, which cannot be bundled into
the client component showing the error, so nothing runtime from that module may be
imported there — only its types already were.

The link is fetched from this app's own server, not the cook's browser, so it is checked
the way a server fetching an address it was merely handed has to be: `isBlockedHost`
refuses the machine's own network (loopback, link-local, the private ranges) before
anything is requested, and the response's own `url` is checked again after redirects —
a page can send an outside address to an inside one. Size and time are both bounded,
because the page is whoever pasted the link's choice, not this app's.

**The recipe's own picture comes back too, fetched and stored the same way any upload
is.** `image` in JSON-LD or Microdata is usually relative to the page it was found on,
so it is resolved against the address this app actually landed on, not the link that
was pasted — and the result is checked by `isBlockedHost` exactly as the page's own
redirect is, because a page's markup pointing at an internal address is no more to be
trusted than a redirect doing the same. The bytes are downscaled server-side (in
`downscaleForStorage`, the one place in the app doing on the server what
`lib/downscale.ts` does in the browser, because there is no canvas here) to the same
`MAX_EDGE`/`THUMB_EDGE` and written through `storePhoto`, which measures them exactly as
it measures any other upload. A picture that cannot be fetched or does not survive that
check is left out, quietly — decoration for a recipe that is otherwise complete, never a
reason to refuse one that was.

Only the title, ingredients, instructions and picture come back from a fetch; the video
link and categories are the create form's own fields regardless of how it was reached,
since schema.org has nothing standard to say about either and they are this household's
choices to make either way.

### A sheet's actions stay on screen

`Modal` lays its contents out as a column: `ModalBody` scrolls, `ModalFooter` does not.
Every dialog puts its buttons — and the reason a submission was refused — in the footer,
so they are in view from the moment it opens. **Never put a form's buttons inside
`ModalBody`.** On a phone the sheet is the whole screen and the longer forms run well past
it; a Save button below the fold is a form people abandon believing it did not work.

### What is finished folds away

`Collapsible` (`src/components/collapsible.tsx`) is the heading that hides what is
behind it: a list's ticked-off items, the tasks a household has already done. Both are
worth keeping — one is next week's vocabulary, the other is the record that the job was
done — and neither is worth the screen it takes above what is still outstanding. It
always says how much is in there, because a heading hiding an unknown quantity is one
nobody opens, and it starts shut on every visit rather than remembering: what is
outstanding is what the page is for.

Pass `headingClassName` where what folds is a section of the page rather than part of a
card, and the trigger is wrapped in an `<h2>` — the page's outline must not depend on
whether the section happens to be open.

For the same reason a list card counts **open items, not all of them**. A shopping list
keeps everything ticked off, so a total climbs for ever and says the same thing about a
finished list as about one nobody has started.

### Movement says where you are going

`PageTransition` picks the animation from the two paths rather than from the link that was
pressed, so it is the same whether a recipe was reached by tapping its card, from a
bookmark or with the back arrow: going a segment deeper slides in from the right, coming
back out slides in from the left, and a move between tabs — sideways to both — rises
instead. Sheets come up from the bottom edge on a phone and scale in on a desktop.

Only the arriving page is animated; the one being left is gone the moment the router swaps
it. Everything here is CSS, and everything is switched off under `prefers-reduced-motion`
by the one rule at the end of `globals.css`.

Movement that arrives with the element — a page, a sheet, a row, a menu — is a **keyframe
animation**, not a transition between two sets of classes, because a transition only runs
from a state the browser has already painted and there is no paint between a sheet being
mounted and being opened. Which one a sheet plays is a media query in `globals.css`, not
`sm:` classes on the element. `e2e/animation.spec.ts` records what actually ran: a CSS
animation that quietly does nothing looks exactly like one that works.

### Forms submit through `useFormAction`, not the `action` prop

`src/components/use-form-action.ts`. React 19 clears an uncontrolled form once its action
resolves, which on a *rejected* submission throws away everything the person typed. The
hook uses `onSubmit` so values survive an error; only a successful add to a list resets.

### Tests gate everything

`.githooks/pre-push` checks the change before it leaves: lint, types and unit tests
always; the integration and browser suites only when `src/`, `prisma/`, `tests/`, `e2e/`,
`scripts/`, a lockfile or a build config changed. CI runs the full suite regardless, and
`npm run build` runs the unit tests. Pushing to `main` deploys, so a failing suite must
not reach the remote.

Integration and E2E use **separate** databases (`homehub_test`, `homehub_e2e`), created
automatically. They truncate between tests, and refuse to run against a database whose
name lacks the right suffix.

**Both suites run their files at the same time, and a worker owns a whole world.** The
plain names — `homehub_test`, `homehub_e2e` — are **templates**: migrated, and never run
against. Every worker gets a `CREATE DATABASE … TEMPLATE` copy of one, which takes about
a tenth of a second against nearly two for spawning the migration CLI again, and cannot
produce a database the migrations have not been applied to. The files truncate between
tests, so a shared database would have them emptying tables another file was halfway
through reading.

**A worker's database is keyed by something that cannot be shared by two of them at
once.** For vitest that is the **process id** — `VITEST_POOL_ID` looks like the right
thing and is not: two workers running at the same time are sometimes handed the same
one, which puts two files on one database, where they truncate each other mid-test and
deadlock trying. Playwright's `parallelIndex` *is* a real lease, so the browser suite
uses it. Copies are swept away afterwards, and again at the start of the next run, since
a run that is killed never reaches its own teardown.

The key goes *before* the suffix (`homehub_w7_test`, never `homehub_test_w7`) because the
suffix is the whole guard: every entry point refuses a database whose name does not end
in `_test` or `_e2e`, and a worker's copy has to be refused on the same terms.

**The browser suite gives each worker its own app server too**, on its own port, because
a server reads one database and one only. `e2e/helpers/servers.ts` says which worker gets
which. **Do not put `baseURL` in `playwright.config.ts`** — a value set there wins over
the one `e2e/helpers/fixtures.ts` picks per worker, and every worker then drives the
first worker's server while seeding its own database. That passes, because the seed is
the same either way, and hides every collision it causes. The build is the `e2e` script's
first half rather than the first server's command, because they all start at once and
none of them can start without it. `E2E_WORKERS` lowers the count on a machine that
cannot hold that many — a browser worker is a Next server and a Chromium, where vitest
sizes its own pool and takes a database per worker process as it goes.

**A password is hashed once per password, not once per user.** bcrypt at the cost the app
uses takes about a tenth of a second, and the fixtures make hundreds of people whose
password nobody varies — it was the single largest cost in both suites. The hash is real
and the cost factor is untouched; it is simply not recomputed. Likewise the browser
suite's `loginAs` puts the session cookie straight into the browser rather than filling
the login form, which `auth.spec.ts` still does by hand through `logInThroughForm`,
because there the form is the thing being tested.

A flaky test is worse than no test: it teaches everyone to press the button again. Fix the
race, do not add a timeout.

Two races are worth knowing about, because both passed on an idle machine and only
showed once the files started running at the same time. **A tick is optimistic**: the
item folds away the instant it is pressed, before the action has been answered, so a test
that navigates on that signal is racing its own write — wait on the stored row instead,
as the favourites and the list counts do. And **a wait for the page a save lands on must
not match the page the form is already on**: `/recipes/new` satisfies
`/recipes/[a-z0-9]+$`, so that wait was answered the moment it was asked and the test
walked on mid-save. `SAVED_RECIPE` in `e2e/helpers/fixtures.ts` is that pattern written
so it cannot.

## Deployment

Only `main` deploys — `vercel.json` disables every other branch. **There are no preview
deployments**, deliberately: they ran migrations against, and served from, the production
database.

Production: **https://home-app-three-virid.vercel.app**. Other Vercel addresses for this
project are frozen snapshots of one build and will show stale commits forever. The
deployed commit is shown on **Admin → System**.

Migrations run inside the production build (`prisma migrate deploy`). A bad migration
therefore presents as a failed build, on a commit already on `main`, and there is no
rollback path.

`npm run db:check` closes the cheap half of that: it replays the migrations into a
throwaway `_shadow` database and fails if `prisma/schema.prisma` says anything they do
not. It runs in the pre-push hook and in CI, takes about two seconds, and catches a
schema edited without a migration — which the test suites only catch where a test
happens to touch the model. What it cannot catch is a migration that is valid against an
empty database and fails against a full one (a `NOT NULL` column on a populated table, a
unique index over values already duplicated); both suites migrate from empty, so one of
those still wants trying against a copy of production first.

## Observability

**Admin → System** (super admin) shows database health, the reminder job's recent runs,
content totals, how the stored bytes divide between the homes and between the kinds of
thing in them, and the slowest queries of the last day. Home admins see whether reminders
are reaching their own household, and what their own home is storing.

The reminder job writes a row before it starts work, because a schedule that silently
stops looks exactly like a week with nothing due. `/api/health` gives an uptime monitor a
verdict anonymously, and the detail behind it to a caller presenting `CRON_SECRET`.

Request failures are logged as JSON lines via `src/instrumentation.ts`, not stored.
Queries over `SLOW_QUERY_MS` are recorded and pruned after a week.

## Traps worth knowing

- **Tailwind v4 writes movement as `translate`, `scale` and `rotate` — not `transform`.**
  So `scale-110` changes the `scale` property, and anything easing only `transform` eases
  nothing while looking entirely correct: `transition` and `transition-transform` name all
  four and are safe, but an arbitrary `transition-[…]` list, or a hand-written `transition`
  in `globals.css` such as `.pressable`, has to name the property that actually changes.
- **Hydration has no DOM signal.** A widget's markup looks identical before and after
  React attaches listeners. Browser tests of interactive widgets must wait on something
  the widget itself emits — the drag tests wait on dnd-kit's announcements, and a context
  menu's trigger grows `data-ready` once it can actually open.
- **Prisma accepts a non-unique field in `where`** on `findUnique`, `update` and `delete`,
  returning null or `P2025` on mismatch. That is what makes `homeDb` work everywhere.
- **A required relation between two cascade-deleted models wants `NoAction`, not
  `Restrict`.** `RecipeCategoryLink.categoryId` is required, and deleting a home cascades
  to its recipes, its categories and the pairings between them in one statement. Postgres
  checks `Restrict` the instant the referenced row goes, so that ordering can fail;
  `NoAction` is checked once the statement is finished, by which point every side is gone.
  Both still refuse to delete a category that holds recipes, which is the point of having
  the constraint.
- **A picture is served, not embedded.** `/api/photos/<id>` checks the session and answers
  404 for another home's id. The response is `private, immutable` for a year, which is
  sound — replacing a picture writes a new row with a new id — but it means a browser can
  answer a repeat request out of its own cache, so a test about what the *server* will
  serve has to ask with `cache: "no-store"`.
- **The unit tests read the schema through the generated client, so `prisma generate`
  runs first in `npm run build`.** `home-scoping.test.ts` walks `Prisma.dmmf`, which is
  whatever was last generated — and Vercel restores `node_modules` from the previous
  deployment's cache and skips the install scripts, so without generating first the
  tests are asked about the *previous* commit's schema. That fails the build on a test
  naming a model sitting right there in `schema.prisma`, which reads like a bad test
  rather than a stale client. It is also why the failure cannot happen locally: a
  checkout that has run `npm ci` has generated from the schema in front of it.
- **`vercel.json` is schema-validated.** An unknown key can fail the deploy; keep
  explanations in the README.
- **On Windows, `npx.cmd` cannot be spawned without a shell.** Invoke a CLI's entry point
  with `node` instead (see `tests/setup/global.ts`).
- **`npm audit` reports build-time-only advisories** in Prisma's CLI and Next's PostCSS.
  `audit fix --force` downgrades Prisma and breaks the build. Leave them.

## Working style

Open a branch, keep `npm run verify` green, and open a PR rather than pushing to `main`.
Explain in the PR what changed and why, and flag anything you decided rather than knew.
