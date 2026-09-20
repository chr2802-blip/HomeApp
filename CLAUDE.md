# HomeHub

Lists, tasks and recipes for a household. Multi-tenant: everything belongs to a
**home**, and people belong to as many homes as they have been invited into. Next.js App
Router, Prisma, Postgres, on Vercel.

Read this before changing anything. Every rule below exists because the alternative was
tried and caused a bug.

**This file is the rules. [`docs/design/`](docs/design/) is why they are the rules** — the
reasoning, the thing that was tried first, and what broke. Follow a link when a rule looks
arbitrary or when you are about to change the thing it governs; you do not need to read
them to work here. Nothing was deleted in the move: what a rule below summarises is set
out in full over there.

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

`Home.theme` is one of a fixed set (`HomeTheme`), picked by that household's admins in the
Home card on `/settings`, and named in the header so nobody adds milk to the wrong list.

- **What each colour *is* lives in `globals.css` and nowhere else**, as a block of five
  variables per theme keyed by `[data-theme="NAME"]`. `src/lib/theme.ts` holds only what
  they are called, and `BAND`, which CSS cannot reach.
- **Anything showing a colour carries that home's `data-theme` and reads `var(--accent)`**,
  so it *is* the colour rather than a copy that drifts.
- **The attribute goes on `<html>`, set by the root layout from the session.** Not on a
  wrapper inside the app: sheets and the three-dot panel are portalled into `<body>`.
- **`--band` is one literal (`#e5e7eb`), declared identically in every theme block, and
  opaque.** It does not follow the household. No theme block may bring back an
  `--accent-soft` of its own — that would be a second colour for the same strip.
- **The colour dresses the controls and the household's own progress, never the meanings
  inside them.** Green is "added", red "about to be deleted", amber "overdue", in every
  home, and none of the themes is any of the three.
- **The charts' palette is fixed** (`--chart-recipes`, `--chart-lists`, `--chart-tasks`,
  `--chart-rest`) and none of the four is green, red or amber either. The exception is the
  super admin's across-homes ring, where a slice *is* a household and wears its `data-theme`.
- The app is laid out under the phone's bars (`viewportFit: "cover"`), so the header, the
  tab bar and `main` each pad past their own `env(safe-area-inset-*)`. Every inset is zero
  on a desktop, so getting one wrong is invisible in a browser and obvious on a phone.
- `THEME_FIELD` is optional in `updateHome`: a colour not mentioned is a colour left alone.

`tests/unit/theme.test.ts` reads the stylesheet and fails if a theme has no block, holds
the band's alpha as strictly as its hex, and holds all three insets together.
**Why each of these is the rule, and what broke before it was — five paragraphs of it — is
in [`docs/design/theme-and-frame.md`](docs/design/theme-and-frame.md).**

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

`src/lib/storage.ts` answers "how big is this home", in raw SQL because `pg_column_size` is
the only thing that knows what a row actually occupies.

- **A whole row (`t.*`) for everything except `Photo`, whose two blobs are measured column
  by column.** `pg_column_size(p.*)` builds the composite and so fetches every picture in
  the home through the connection in order to weigh it.
- **A picture counts towards the thing showing it**, which is why the slices are Recipes,
  Lists and Tasks and not Photos. What is left over is `rest`.
- The home is bound into the query rather than carried by `homeDb`, which scopes Prisma's
  model calls and has nothing to say about raw SQL. `getInstallationStorage` names no home
  at all and is the super admin's alone.
- **A kind is a name in TypeScript and a colour in `globals.css`**, and only
  `tests/unit/storage.test.ts` holds the two together.

**[`docs/design/storage.md`](docs/design/storage.md) has the reasoning.**

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
edit and delete in a `ContextMenu`, opened by a button of three dots; `ItemMenu` is the
usual way in. **Never put a bare Delete button on a card.** The panel is drawn through a
portal and positioned from the trigger's box, because the cards clip their own contents,
and it follows the page when that scrolls rather than closing.

**[`docs/design/ui-patterns.md`](docs/design/ui-patterns.md) says why.**

### A recipe is filed under one category or several

`RecipeCategoryLink` is the pairing, and a recipe has at least one.

- The picker sends one `CATEGORY_FIELD` entry per box ticked, so it is read with
  `readCategoryChoice` rather than through the schema: `readForm` builds its object with
  `Object.fromEntries`, which keeps only the last of a repeated field.
- An action checks every chosen id through `homeDb`, and **a recipe left under no heading is
  refused** — it would be saved and then not appear on the page that lists the recipes.
- A category that still holds recipes cannot be deleted, by the action and the foreign key
  both.

**[`docs/design/recipes.md`](docs/design/recipes.md) has the rest.**

### Ticking something off is the moment the list is for, and it is worth seeing

- `SETTLE_MS` in `src/components/list-items.tsx` and the `tick-off` animation in
  `globals.css` **have to agree**. It is a timer rather than an `animationend` listener
  because the row has to move where the animation never runs — a backgrounded tab, or
  reduced motion. **Untick a settling row and it simply stops settling.**
- The press is handled in `handlePress`, **beside** the optimistic change rather than inside
  it: React runs a form action in a transition, and feedback about a press must not be late.
- **A list's progress is drawn in the home's own `--accent`, not in green.** On a card the
  bar is `edge` — flush along the bottom, full width, no radius of its own — so a card
  carrying one is `relative overflow-hidden`.
- The bar on a list's own page lives **inside `ListItems`**, so the proportion is told by
  the same state the rows are. Everywhere it appears it is `aria-hidden`, because the same
  number is already in words beside it, and `data-progress` carries what it claims.
- **Clearing the last item is celebrated once**, counted before the change is applied — so a
  list emptied by deleting its rows is **not** celebrated. Crossing halfway swells the bar
  and says nothing in words.
- **A ticked row says who got it** (`PersonMark`), drawn only where the home has more than
  one member.
- **A task is marked done at `TaskDoneButton` and nowhere else**, which is the one component
  behind both places. **Reopening keeps a plain form**: an undo is not an achievement.

**[`docs/design/lists.md`](docs/design/lists.md) has the reasoning, at length.**

### The household's week, and the weeks behind it

- `ClearedWeek` is one row per home per week in which a list was cleared, written by the
  tick that empties one. **A list emptied by deleting its rows writes nothing.**
- `week` is that week's Monday in the home's own zone as `"yyyy-MM-dd"`, **never an ISO week
  number** — `2027-W01` follows `2026-W52` and is arithmetic that goes wrong once a year.
  `@@id([homeId, week])` bounds the table.
- `homeStreak` walks back while there is no gap, and **a run counts as alive when it reaches
  this week or the last one.** `streakLine` is a unit test of its own.
- `weekWorkload` in `src/lib/week.ts` is what the dashboard's bar counts, and **every task
  falls on exactly one side of it**. A recurring task is never finished, so "done this week"
  and "still owed" are not opposites — **being owed wins**. Owed means the whole week, bound
  by the instant next Monday begins. It takes the clock as an argument so a test can say
  Wednesday and mean Wednesday.
- **Ticking anything refreshes three views, not one** (`refreshListViews`).
- **Nobody's name is on the week or the streak**: a weekly score with names on it turns the
  washing-up into a thing worth being seen to do.

**[`docs/design/week-and-dashboard.md`](docs/design/week-and-dashboard.md) covers this and
the dashboard's layout.**

### The dashboard is a page about what needs attention, and the first screen is all of it

Almost nobody scrolls a dashboard, so every block is spending the only screen there is.

- **The order of the blocks is what each one asks of you**: the week, what is due for you,
  what is due for somebody else (folded, count on the heading), the dinner, then the lists.
- **Tonight's dinner is a row, not a hero.** The appetising photograph is one tap away.
- **The lists stop at `DASHBOARD_LISTS` and offer the rest**, and the query takes one more
  than it draws so the section knows without counting every list in the home.
- The home's picture is `short` here and full height on a recipe page — a prop, not a height
  in `className`, because which of two height utilities wins is decided by the stylesheet.
- `e2e/suggested-recipe.spec.ts` holds the result: the dinner section under 160px, and the
  week, the dinner, what is due and the lists all on one 390×680 screen.

**[`docs/design/week-and-dashboard.md`](docs/design/week-and-dashboard.md) says why each.**

### A list works in a shop, where there is no signal

Two deliberately independent halves: **the page comes back from the service worker**, and
**the ticks come back from IndexedDB**.

- **Every queued change says what the row should end up as, never what to do to it** — a
  tick carries `done: true`, not "flip" — and an **add carries a row id chosen in the
  browser**. That is the whole reason a queue can be sent twice.
- **Only ticks, adds and amounts are queued.** A delete and a drag stay online-only: both
  are kitchen-table edits, and both would need a rule for two phones disagreeing.
- **The writes live in `src/lib/list-writes.ts`**, shared by the actions and the queue's
  endpoint, so neither decides separately what a tick means. `setItemDone` counts a week
  **only when the tick actually changed the row**.
- **The endpoint is a route, not a server action**, because the browser may have been away
  across a deploy. It answers per op, and `applyQueuedOps` **rejects rather than throws** —
  one bad op must never take the other nineteen with it.
- **A browser that says it is online is not evidence**, and a flush that carried nothing
  proves nothing, so it never claims the connection is back.
- `public/sw.js` has two jobs. Pages are **network-first** and only `/dashboard` and the
  lists are kept; assets are cache-first **except** where the request asked for no cache.
  **It never touches anything but GET.** It is registered from the app layout, on every page.
- **Logging out takes this browser's copy of the household with it**: the kept pages, the
  queue, and the household's pictures in the asset cache.

`e2e/offline-lists.spec.ts` drives a genuinely offline browser, and
`e2e/logout-forgets.spec.ts` asks what is left in Cache Storage afterwards.
**[`docs/design/offline.md`](docs/design/offline.md) has the reasoning.**

### An item can say which recipe put it there

`ListItemSource` pairs a list item with a recipe, and "Add to list" on a recipe writes them.

- A line already on the list is **wanted once more**, so the amount goes up by one; a line
  **ticked off earlier comes back at one**; and the pairing is **one row per (item, recipe)**.
- **The note goes when the item is ticked off**, in `toggleListItem`: it answers "why is this
  on my list", which is a question about the shop still to do. Putting the item back brings
  back the item and not the note.
- It carries no `homeId`, so `homeDb` refuses it and pages read it as an include. Both ids an
  action is given are checked against the caller's homes, because one press sends both.

**[`docs/design/lists.md`](docs/design/lists.md) has the reasoning.**

### The week's meals are a row per day, and the row is the decision

- `MealPlan` is one row per home per day. `recipeId` is what is being cooked, `leftoverOf`
  is the earlier day being eaten again, and **neither is a night out**: **a day nobody has
  planned has no row at all**. `@@id([homeId, date])` is the whole shape.
- **The two columns are never both filled, and nothing in the database says so** — a check
  constraint would be drift `db:check` cannot see. It is `planMeal`'s to keep and
  `tests/integration/meals.test.ts`'s to hold, and **both are written on every save**. Every
  reader asks `recipeId` first.
- `date` is the day in the home's own zone as `"yyyy-MM-dd"`, like `ClearedWeek.week`.
- **A deleted recipe takes the day's plan with it** (`onDelete: Cascade`, where every other
  optional relation in the schema uses `SetNull`): null means "eating out".
- **Every state arrives through one `PLAN_FIELD`**, and an empty one **deletes the day**.
- **Leftovers point at a day, not at a recipe, and the pointer is a plain string.** The day
  must be **earlier** and one this home is **cooking**, checked against the stored row.
- The picker is a list of radios, not a `<select>` and not a combobox, and **the chosen row
  always survives the filter** — a radio that leaves the page takes its value with it.
  **The groups are a partition, not a set of views.** The circle is drawn, not hidden behind
  the row. The search box does not autofocus.
- `src/lib/meal-suggestions.ts` **ranks by the share of a recipe that comes free**, not by
  how few things it adds, and **drops staples first**, derived rather than declared. Worked
  out once for the week; ties break on fewer new ingredients, then the title. An empty
  basket offers **nothing at all**. **Nothing is ever written on the household's behalf.**
- `/meals` keeps the week in the address (`?week=`), normalised to its Monday.

**[`docs/design/meals.md`](docs/design/meals.md) has all of the reasoning.**

### Tonight's dinner is today's row on the meal plan, not a pick kept apart from it

`tonightsDinner` in `src/lib/recipe-suggestion.ts` reads today's `MealPlan` row, so the
dashboard and `/meals` agree because they are reading the same one.

- **A day already decided is shown as it was decided**, and "Find new" is offered only where
  it would not be arguing with the household — a recipe, never leftovers or a night out.
- **A day with no row yet is where the auto-pick belongs**: one eligible recipe is written
  into `MealPlan` before this returns, so a second visit shows the same dinner.
- "Find new" replaces `recipeId` for today, prefers a recipe other than the one showing, and
  revalidates `/meals` alongside the dashboard.
- A category's `excludeFromSuggestion` keeps its recipes out of the pool **entirely** — a
  recipe filed under an excluded heading and an ordinary one is still excluded.

**[`docs/design/meals.md`](docs/design/meals.md) has the reasoning.**

### A new recipe starts by asking how, not with a field buried in the form

`NewRecipeDialog` is a small choice before it is a form: **start from scratch**, or **import
from a link**. Three steps, all inside the one `Modal`.

- **The step resets to "choose" on every *open*, never on close** — resetting on close shows
  the sheet flashing back while it is still animating away.
- **The button reads the clipboard before it decides which step to open on**, so it is never
  seen choosing; the read is raced against `CLIPBOARD_GRACE_MS`, because `readText()` can sit
  unresolved behind a permission decision nobody will make. Choosing "Import from a link" by
  hand always starts blank.
- **Importing reads the page's own structured data rather than scraping it**: `schema.org/
  Recipe` as JSON-LD first, then Microdata, each filling in what the other left blank. A page
  with nothing to cook from is **refused rather than guessed at from prose**, and marked
  `notARecipe` — **the client checks the flag, never the error string**, because
  `recipe-import.ts` pulls in `sharp` and nothing runtime from it may reach a client component.
- **The link is fetched from this app's own server, so it is checked the way that has to be:**
  `isBlockedHost` before anything is requested, and the response's own `url` again after
  redirects. Size and time are both bounded. The recipe's picture is resolved against the
  address actually landed on, checked the same way, downscaled server-side and stored through
  `storePhoto`; one that cannot be fetched is left out quietly.
- The title, ingredients, instructions, picture and total time come from the fetch; the video
  link and categories are the form's own fields either way.

**[`docs/design/recipes.md`](docs/design/recipes.md) has the reasoning.**

### Sheets, folds, movement, and how a form submits

- `Modal` lays its contents out as a column: `ModalBody` scrolls, `ModalFooter` does not.
  **Never put a form's buttons — or the reason a submission was refused — inside
  `ModalBody`.** On a phone a Save button below the fold is a form people abandon.
- `Collapsible` **always says how much is in there** and **starts shut on every visit**.
  Pass `headingClassName` where what folds is a section rather than part of a card. For the
  same reason **a list card counts open items, not all of them**.
- `PageTransition` picks the animation **from the two paths**, not from the link pressed.
  Movement that arrives with an element is a **keyframe animation, never a transition between
  two sets of classes** — a transition only runs from a state the browser has already painted.
  Which one a sheet plays is a media query in `globals.css`, not `sm:` classes. Everything is
  switched off under `prefers-reduced-motion` by the one rule at the end of `globals.css`.
- **Forms submit through `useFormAction`, not the `action` prop.** React 19 clears an
  uncontrolled form once its action resolves, which on a rejected submission throws away
  everything the person typed. Only a successful add to a list resets.

**[`docs/design/ui-patterns.md`](docs/design/ui-patterns.md) says why each one is the rule.**

### Tests gate everything

`.githooks/pre-push` runs lint, types and unit tests always, and the schema check plus the
integration and browser suites when the code they cover changed. CI runs the full suite
regardless, and `npm run build` runs the unit tests. **Pushing to `main` deploys, so a
failing suite must not reach the remote.**

- Integration and E2E use **separate databases** (`homehub_test`, `homehub_e2e`), created
  automatically, truncated between tests, and **refused outright if the name lacks the right
  suffix**.
- **Both suites run their files at the same time, and a worker owns a whole world.** The
  plain names are **templates**, migrated and never run against; every worker gets a
  `CREATE DATABASE … TEMPLATE` copy.
- **All of that plumbing is `scripts/test-db.mjs`, once, for both suites.** It is plain
  JavaScript and uses no `import.meta`.
- **A worker's database is keyed by something two workers cannot share at once**: the process
  id for vitest — hence `pool: "forks"`, because a pool of threads shares one pid — and
  `parallelIndex` for Playwright. Copies are swept afterwards, **except one whose process is
  still alive**.
- **The key goes before the suffix** (`homehub_w7_test`, never `homehub_test_w7`), because
  the suffix is the whole guard. `tests/unit/test-db-url.test.ts` holds every one of those
  rules without a database.
- Each browser worker gets its own app server. **Do not put `baseURL` in
  `playwright.config.ts`** — it wins over the per-worker value, and every worker then drives
  the first worker's server while seeding its own database, passing while it does it.
- **A password is hashed once per password, not once per user**, and `loginAs` puts the
  cookie straight into the browser; `auth.spec.ts` still drives the real form.
- **A flaky test is worse than no test: fix the race, do not add a timeout.** CI refuses an
  `it.only` in either suite.

**[`docs/design/testing.md`](docs/design/testing.md) has the reasoning, and the two races
that only showed once the files started running at the same time.**

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
