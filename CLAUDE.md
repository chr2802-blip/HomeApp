# HomeHub

Lists, tasks and recipes for a household. Multi-tenant: everything belongs to a
**home**, and people belong to as many homes as they have been invited into. Next.js App
Router, Prisma, Postgres, on Vercel.

Read this before changing anything. Most of what follows exists because the alternative
was tried and caused a bug.

## Commands

```bash
npm run dev          # local dev server
npm run verify       # lint + types + schema check + all tests — what the pre-push hook runs
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

**The colour dresses the controls and the household's own progress, never the meanings
inside them.** The primary button, the active nav pill, the focus ring, the hairline
under the header — and the bar along the bottom of a list card, which is the one thing
here that is not a control: a household's way through its own lists is that
household's, and it was the last fixed colour on those pages that belonged to no home.
Nothing else, the band included: that one dresses no home at all any more. Green is
still "added", red "about to be deleted", amber "overdue", in every home; a household
dressed in one of those would be saying it on every screen, which is why none of the
themes is any of them and why `create` and `danger` keep their own colours — and why a
bar in the home's colour cannot accidentally say one of the three.

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

**"Not today" is one press, and it writes one column.** `snoozeTask` moves `nextDueAt`
to tomorrow morning and touches nothing else: the interval stays, `lastCompletedAt`
stays, and nothing records that the task was put off — a task deferred three times is
still a task nobody has done, which is what its due date already says. A counter beside
it would be a second answer to the same question, the way a flag beside the interval
would be. `lastNotifiedAt` is left alone too, because it is the reminder job's own
bookkeeping: clearing it asks for a second push today about the very thing somebody has
just said they are not doing today, and tomorrow's run is past the job's cutoff anyway.

It is offered only where "not today" could mean anything — `isSnoozable`, which is a
task due today or overdue and not a finished one-off. On something due next week,
snoozing to tomorrow would be pulling it *forward*, so the entry is not drawn; the
action guards the same case from the other side by never moving a date earlier than it
already is, because a card left open on a phone overnight is a card offering yesterday's
answer. It lives in the three dots on `/tasks` and in a menu of its own on the
dashboard's due rows, rather than as a button beside Done: two buttons the same size
next to each other is how a job gets marked done by a thumb aiming at "later".

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

**A list's progress is drawn in the home's own `--accent`, and not in green.** It was
`--chart-lists`, on the reasoning that the accent dresses controls and a bar is read
rather than pressed — but `edge` below took the bar out of the card's padding and into
the card's own bottom, where there is nothing left for it to be mistaken for. Green is
"added" everywhere else in the app, so a bar that turned green on its last item would be
saying that instead; no theme is green, red or amber either, so the home's colour cannot
say one of them by accident. The storage donuts keep the chart palette: those are about
kinds that mean the same thing in every household, and this is about one household's own
week.

**On a card the bar is `edge`: flush along the bottom, full width, no radius of its
own** — the card rounds it off, which is why a card carrying one is `relative
overflow-hidden` (the three-dot panel is portalled, so clipping costs it nothing). A
card is one thing, and a rounded bar floating in its padding reads as a second thing
sitting on it. It is thinner there than the free-standing one because on the edge it is
a rule rather than a readout: the words above it carry the number.

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

### The dashboard is a page about what needs attention, and the first screen is all of it

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

### A list works in a shop, where there is no signal

The one screen this app is read on with no connection is a shopping list, so that is the
one screen that keeps working without one. Two halves, and they are deliberately
independent: **the page comes back from the service worker**, and **the ticks come back
from IndexedDB**.

**Every queued change says what the row should end up as, never what to do to it.** A
tick carries `done: true` rather than "flip", and an amount carries the number rather than
a step — `OfflineOp` in `src/lib/offline-ops.ts`. That is the whole reason a queue can be
sent at all: a phone that sent a batch and never heard the answer sends it again, and the
second arrival has to land on the same row as the first. A queue of flips and increments
has to arrive exactly once, which is a promise no phone in a supermarket can keep. An
**add** carries a row id chosen in the browser for the same reason: the row is created
under it, so a replay finds it already there instead of adding a second one.

**Only ticks, adds and amounts are queued.** A delete and a drag stay online-only and
simply come back when there is nothing to run them against, which reads as what it is.
Both are kitchen-table edits rather than aisle ones, and both would need a rule for what
two phones disagreeing about an order, or about a row one of them has already removed,
means. An op kind is not free — it is another way for two people to mean different things
by the same list.

**The writes live in `src/lib/list-writes.ts`, and the actions and the queue's endpoint
share them.** `setItemDone`, `addItem` and `setItemAmount` are what a tick *is*; the
actions in `src/app/actions/lists.ts` still do what an action does (check the caller's
home, refresh the three views) and `POST /api/lists/sync` does the same checks its own
way. What neither of them does is decide separately what a tick means. `setItemDone` also
guards the one thing that is not idempotent: **a week is counted only when the tick
actually changed the row**, so a queue sent twice does not report the shop twice.

**The endpoint is a route, not a server action, and that is the point.** An action's
identity belongs to the build that generated it, and the premise here is a browser that
has been away — possibly across a deploy — still holding something it has to be able to
send. It answers per op, because the browser has to tell "sent" from "will never be
sent": an applied op and a refused one both leave the queue, while a request that fails
outright leaves **all** of them in it. One bad op must never take the other nineteen with
it, which is why `applyQueuedOps` rejects rather than throws.

**The queue empties itself by asking, not by trusting.** `useOfflineList` keeps three
things apart: ops still queued (drawn over the server's rows by `applyPending`), ops the
server has just taken — **held** in front of the rows until the page has been re-rendered
with them, so a reconnection does not show the ticks flicking off and on again — and
ops the server already agrees with, which `reconcile` drops. An op somebody else in the
home made first disappears the same way, which is correct: the item is off the list, and
who did it is not what the queue was for.

**A browser that says it is online is not evidence.** `record` keeps a change when
`navigator.onLine` is false *or* when the request rejects with a `TypeError`, which is
what a request that never arrived looks like; anything else that comes out of an action is
the server having answered and is not this layer's business. Equally, a flush that carried
nothing proves nothing — it is also what a failed send looks like — so it never claims the
connection is back. `QueueStatus` says which of these the list is in, because a household
that is not told cannot tell a list that saved their shopping from one that quietly lost
it, and will stop trusting the ticks either way.

**`public/sw.js` has two jobs now**, because a browser allows one worker per scope: the
push handlers it always had, and keeping the pages a household opens while out. Pages are
**network-first** — nothing kept is ever served in front of a working network — and only
`/dashboard` and the lists are kept, the dashboard because that is where an installed app
opens and without it a phone with no signal would never reach the lists at all. Assets
are cache-first because their names carry a hash of their contents, **except** where the
request explicitly asked for no cache: a caller doing that is asking the server, and is
usually asking *about* the server, which is what `photos.spec.ts` does. The worker never
touches anything but GET; a worker that replayed POSTs would be a second, invisible copy
of the queue with no way to tell the page what it had done.

**It is registered from the app layout, on every page.** It used to be registered only by
somebody turning notifications on, which was fine while push was all it did — but what
keeps a list readable has to be in place *before* the signal goes, and a worker installed
in an aisle has kept nothing.

**Logging out takes this browser's copy of the household with it.** The login page drops
both the kept pages, each of which carries one person's rendered home, and the queue,
whose ops name rows only that session could see. Whoever opens the browser next is
somebody else until they have proved otherwise, and finding the last person's shopping
there is worse than losing a tick that a dead session could no longer send anyway.

`e2e/offline-lists.spec.ts` drives a browser that is genuinely offline (`setOffline`),
because a page that survives losing its connection and one that merely looks as though it
would are identical until something actually fails.

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

### The week's meals are a row per day, and the row is the decision

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

### Tonight's dinner is today's row on the meal plan, not a pick kept apart from it

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
nothing to check, which is the ordinary **choose** screen this always showed.

**A browser that will not say is not always a browser that says so**, which is why that
read is raced against `CLIPBOARD_GRACE_MS`. `readText()` can sit unresolved behind a
permission decision nobody is going to make — a headless Chromium with the permission
ungranted does exactly this — and since the sheet opens *after* the check, a promise
that never settles is a "New recipe" button that does nothing at all: no sheet, no
error, nothing to see. Not waiting past half a second turns that back into the same
"nothing to prefill" every other unanswerable clipboard is. The browser suite pins it
with a `readText` stubbed to never settle, because a browser that merely *refuses* —
which is what CI's does — takes the `catch` and never visits this path. Choosing
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

The title, ingredients, instructions, picture and total time come back from a fetch; the
video link and categories are the create form's own fields regardless of how it was
reached, since schema.org has nothing standard to say about either and they are this
household's choices to make either way. Time is a schema.org field like the others, read
as `totalTime` where a site publishes it and as `prepTime` plus `cookTime` where it does
not — both in `PT1H30M`-style ISO 8601, the one shape the standard allows. Recorded as a
single number of minutes rather than kept as prep and cook apart, because nothing in this
app answers a question the two would disagree about: the recipe list's own time filter
(`RecipeDirectory`) is a straight "under 30 minutes or not", the same question a cook
actually has on a Tuesday, and offered only once something in the home has a time to
filter by.

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

**All of that plumbing is `scripts/test-db.mjs`, once, for both suites** — making the
template, migrating it, copying it per worker, sweeping the copies up, truncating between
tests. It was written out twice, differing only in which suffix it looked for, and the
pair that has to agree is not within a suite but across them: `workerDatabaseUrl` writes
a copy's name and the sweep has to recognise it again, including the copies a killed run
left behind. `workerDatabasePattern` beside it is that second half, so the two cannot
drift. The module is plain JavaScript and uses no `import.meta`: vitest loads it as ESM,
Playwright compiles the file importing it to CommonJS.

**A worker's database is keyed by something that cannot be shared by two of them at
once.** For vitest that is the **process id** — `VITEST_POOL_ID` looks like the right
thing and is not: two workers running at the same time are sometimes handed the same
one, which puts two files on one database, where they truncate each other mid-test and
deadlock trying. That holds only while a worker *is* a process, which is why the
integration project says `pool: "forks"` rather than inheriting whatever the default is:
a pool of threads shares one pid and brings the collision straight back. Playwright's
`parallelIndex` *is* a real lease, so the browser suite uses it. Copies are swept away
afterwards, and again at the start of the next run, since a run that is killed never
reaches its own teardown — **except one whose process is still alive**, asked of the
operating system rather than assumed, so `npm test` alongside an open `npm run test:watch`
does not drop the watcher's databases on the way past.

The key goes *before* the suffix (`homehub_w7_test`, never `homehub_test_w7`) because the
suffix is the whole guard: every entry point refuses a database whose name does not end
in `_test` or `_e2e`, and a worker's copy has to be refused on the same terms.
`tests/unit/test-db-url.test.ts` holds every one of those rules — the suffix guard, the
key's position, the sweep's pattern matching the copies and nothing else — in
milliseconds and without a database, because the alternative way to find out that this
module disagrees with itself is a suite that has already started deleting.

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
race, do not add a timeout. An `it.only` left in is the same failure by another route — a
file reduced to one test, reading as a pass — so CI refuses one in either suite
(`forbidOnly` for Playwright, `allowOnly` for vitest).

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

### Every session leaves a note behind

A change here goes idea → branch → `npm run verify` → PR → merge → production, usually in
one sitting. Git records what was built. Nothing records **where the time actually went**,
which is the only half that can be made faster — the diff is identical whether the colour
was found in one file or in four, so twenty minutes spent working out which file owned it
leaves no trace at all and nobody ever fixes it.

So every session that changed anything writes one file into `docs/sessions/`, named
`YYYY-MM-DD-slug.md`, from `docs/sessions/TEMPLATE.md`. **One file per session, never one
growing log**: two sessions on two branches collide on the same lines every time, and a log
that cannot be written from two branches at once is a log that stops being written.

It is committed **with** the work it describes, not afterwards, and that is what makes it
honest — a note written a week later is a note about what the diff says, which is the half
that was already recorded. It costs nothing to push either: `docs/` is outside the pre-push
hook's `CODE_PATHS`, so a session note on its own skips the integration and browser suites.

**The line that earns the whole file is "what should have been quicker".** Everything above
it is context for it. A session that answers "nothing" has written a diary entry; the
question the file is asking is what somebody reading five of these in a row would fix first,
and an entry naming no cost contributes nothing to that.

**A gap in this file is a finding, not an excuse.** The commonest reason a session is slow
is that something it needed to know about this codebase was not written down — which is
exactly what the rest of CLAUDE.md is for. So the note names the gap and the same PR closes
it wherever the answer is now known. That is the difference between a log that compounds and
one that merely accumulates: the next session reads the convention instead of rediscovering
it. When the same gap turns up three times it has stopped being a note, and wants a
convention here or a check that enforces it.

`scripts/session-summary.mjs` is the pair of hooks behind it, wired up in
`.claude/settings.json`: **SessionStart** writes down the commit the session opened on and
**Stop** compares against it. What counts as this session's work is measured from that
commit and not from `main` — a checkout whose `origin/main` is a hundred commits stale is
every shallow clone and every fresh container, and a hook that reports a hundred files is a
hook nobody reads. It asks **once**: `stop_hook_active` ends it, because a hook that cannot
be got past is a hook somebody switches off, and then nothing is logged at all.
