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
npm run setup        # make a cold checkout able to run the suites — the first thing to run
npm run dev          # local dev server
npm run verify       # lint + types + schema check + all tests — what the pre-push hook runs
npm test             # vitest (unit + integration)
npm run e2e          # Playwright (builds the app first)
npm run db:studio    # browse the database
```

**`npm run setup` first, in any checkout you did not set up yourself.** It probes and then
fixes, in order: `node_modules`, the generated Prisma client, Postgres, and Playwright's
browser — and it ends by launching a browser and closing it again, so "ready" means the
suites can actually start rather than that four files are in place. It is safe to run
twice, it never touches an existing `.env`, and `node scripts/dev-setup.mjs check` is the
same probes with nothing fixed, which is what the SessionStart hook runs. Every session
note from 2026-09-20 on named standing this up by hand as its largest cost; the paragraph
below is what the script now does, kept because the day it is wrong you have to know what
it was aiming at.

Integration and browser tests need the local Postgres: `docker start homehub-pg`.

**In a bare container with no Docker daemon** (a fresh Claude Code on the web sandbox),
there is usually a stopped `pg_lsclusters`-managed cluster already on disk instead:
`service postgresql start`, then point `DATABASE_URL`/`DIRECT_URL` at it (`ALTER USER
postgres WITH PASSWORD ...` first, since a bare cluster has none). It can stop again
mid-session with no warning; if every integration test starts failing to connect, check
`pg_lsclusters` before anything else — or just run `npm run setup` again, which starts a
cluster it finds stopped and says so. Such a container's `/opt/pw-browsers` also ships
whatever Chromium revision was baked into its image, which drifts behind the revision
`@playwright/test` wants as the lockfile moves — Playwright then refuses to launch at all.
Symlinking only the top-level `chromium-<old>` directory to `chromium-<wanted>` is not
enough: the internal layout can change between revisions (`chrome-linux/headless_shell`
became `chrome-headless-shell-linux64/chrome-headless-shell` between 1194 and 1243).
Mirror the whole tree with per-file symlinks under the revision directory name Playwright
actually asks for, for both `chromium-<rev>` and `chromium_headless_shell-<rev>`. **Which
revision Playwright wants is asked of Playwright** (`playwright install --dry-run` names
the directory it will look in and the archive it would have unpacked there) rather than
written down, because it moves with every lockfile bump.

## Conventions that are not optional

**Most of the rules below are one rule.** A flag beside `intervalDays`, a counter beside a
snooze, a second reader beside the importer, a cooking copy of the steps beside the
reading copy — each is refused for the same reason, and the section refusing it states the
conclusion rather than the test. The test, when you are about to add something that
overlaps what is already stored, is: **what question does this answer, and is anything else
already answering it?** Two things answering one question will disagree eventually, and the
one that disagrees quietly is the one every reader is then wrong about. Two things
answering *different* questions are fine however similar they look — `prepareCookSteps`
sits beside `normalizeRecipe` for exactly that reason, and the difference is spelled out
where it does.


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
to — it is how the Pantry, Settings and Profile are reached. The pantry is in it and is
not administration: it is above Settings and drawn for every member, because what the
household has in the cupboard is everyday business rather than a setting (see *The
household has a cupboard*). `HomeMenu` in
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

### A home is read in a language, and it dresses the words

`Home.language` is `HomeLanguage` — `EN` or `DA` — picked by that household's admins in the
same Home card on `/settings`, beside the colour. It decides three things: the words the app
speaks, the way a date is written, and **the language a recipe is read into on import** —
whichever language the source was written in, so the rule is "a home has a language" and
never "translate into Danish". `DEFAULT_LANGUAGE` is `EN`: every home that already exists
keeps the voice the app has always had.

**A phrase is its languages, written on one line.** `src/lib/copy/<area>.ts` — `app.ts`,
`pantry.ts`, `dates.ts`, `forms.ts`, `recipes.ts`, `settings.ts` and more as screens convert
— exports `Record<HomeLanguage, string>` constants (`Phrase`) or, for a sentence that counts
something, `Record<HomeLanguage, { one: string; other: string }>` (`Plural`). **Never an
English catalogue with a Danish file beside it**: written as one literal, the two halves
cannot be added in separate commits and cannot be reviewed apart, and a Danish half nobody
wrote is a compile error rather than a phrase that quietly stays English. Both languages
divide their plurals at one and nowhere else, so a `Plural` is two written-out forms and
nothing cleverer — Danish plurals are irregular per noun (dag/dage), which is why the
`count === 1 ? "" : "s"` idiom had to go everywhere it appeared.

**Phrases are values, not key strings** — `say(PANTRY.title)`, never `t("pantry.title")`. A
typo is a missing export, not a lookup that returns its own key at runtime, and the import
graph says which screens use which copy.

**`sayIn(language)` is curried the way `homeDb(homeId)` is curried**, in `src/lib/copy/say.ts`.
A page writes `const say = sayIn(user.homeLanguage)` beside its `const db = homeDb(user.homeId)`
and stops thinking about it. **A `src/lib` module never reaches for the catalogue — it takes
the language as an argument**, the same rule `homeDb(homeId)` and `weekWorkload(…, now)`
already follow: `pantryNote(covered, language)`, `dueLabel(dueAt, language, now)`. This is
what lets a lib module work identically whether it is called from a server page or, through
`useLanguage()` in `src/components/language-provider.tsx`, from a client component — there is
one API, `sayIn`, not a server `t()` and a client one.

**The same rule holds for a plain component with no `"use client"` of its own, and it is
easier to get wrong there than in `src/lib`.** A component like `AssigneeField` or
`AmountsField` carries no directive because it has no interactivity — but it is rendered
both as a child passed down from a server page (`/tasks`, `/lists`) *and* from inside an
already-client component (`list-directory.tsx`). `useContext` only resolves on the client
side of a boundary, and a component with no boundary of its own runs wherever its caller
does — so calling `useLanguage()` inside one crashes the instant a server page renders it
directly, while the exact same component rendered from a client parent works, which is
what makes it easy to ship and only fail in the one shape nobody happened to test. **Such
a component takes `language` as a prop, like `repeatLabel` and `dueLabel` do**, and its
caller supplies it — `user.homeLanguage` from a server page, `useLanguage()` from a client
one — rather than the component reaching for the context itself.

**Interpolation is `{name}` and a `String.replace`**, and the type makes a phrase with slots
impossible to say without filling them — an unfilled `{n}` reading as literal characters on a
phone is the one i18n bug that looks like bad data rather than a bug. **A conjunction is never
a phrase of its own**: `AND = { EN: "and", DA: "og" }` glued on with `+` is a word with no
sentence round it, so `PANTRY.lastTwo` ("{most} and {last}") is the shape and `namesInWords`
in `src/lib/pantry.ts` fills it — that is the hardest sentence in the app and the one every
other phrase's shape follows.

**Dates go through the same machine/person split as `src/lib/time.ts`** (below): `readInZone`
and `readDayInZone` take a `Phrase` pattern and a language, because a pattern can hold words —
`"d MMM 'at' HH:mm"` is English sitting inside what looks like a format. `formatInZone` and
`formatDayInZone` stay locale-free on purpose, because what they write is a database key
(`ClearedWeek.week`, a date input's value) that a locale would stop matching.

**The prompt owns the prose; `renderIngredient` owns the unit token.** `languageRules(language)`
in `src/lib/ingredient-line.ts` — handed to **both** model calls, the importer's and the
save's — tells the model to write the whole recipe (title, ingredients, steps, `reviewReason`)
in the household's language, translating where it is in the other one. **That includes a
recipe typed by hand**: every recipe is read before it is stored, so every one ends up in its home's
language, however it arrived. Which *word* a unit is spelled with is decided afterwards,
deterministically, by `SAME_MEASURE` (`tsp`↔`tsk`, `tbsp`↔`spsk`, and so on) — never by the
model, because a spelling has one right answer. Converting a cup, an ounce or a pound to
metric is a different question — how a metric kitchen measures *this* ingredient — and that
one is the reader's, told to it in `ingredientRules`. `formatAmount` writes the decimal the
household's own language does — a comma in Danish, a point in English.

**Switching changes only what happens next.** Stored recipes, pantry entries, list items and
tasks are left exactly as they are; nothing is migrated, and nothing is re-read through the
model. The picker says so underneath itself.

**The push notification reads a home's language with no session at all**: the reminder job
(`src/app/api/cron/reminders/route.ts`) fetches each due task's home alongside its members and
says the title in that home's language, because a person in two homes hears about each in
that home's own voice. `public/sw.js`'s offline page and push fallback do the same from a
small hand-written dictionary — plain JS outside the bundle, with no build step to import a
catalogue through — kept current by `OfflineSupport` posting the language to the worker on
every load, which also drops the worker's kept pages when it has changed: a page kept offline
was rendered in whatever language was current then, and serving it back after a switch would
answer in the language the household just left.

`tests/unit/language.test.ts` walks every file under `src/lib/copy/` — never a list of its
own — and holds four things no compiler checks: every phrase says something in every
language, the two languages ask for the same slots, a plural's two forms agree with each
other, and a phrase of more than one word is not identical between the languages, which is
the signature of English pasted into the Danish slot to make it compile. **The word count
strips `{slots}` first** — a slot holds a number or a name, never a word the household
wrote, so `"{min} min"` is one word ("min") and not two, the same reasoning that exempts a
single word like "OK". A phrase that still coincides with more than one real word in it
(`"Under {min} min"`, since "under" and "min" both happen to spell the same in Danish) is
not a bug in the test: reword the Danish until it says something a Dane would not mistake
for the English, the way `underMin` became "Op til {min} min" rather than "Under {min} min".
`tests/unit/untranslated.test.ts` is the other half: it walks `src/app` and
`src/components` for a sentence written outside the catalogue — a quoted string of two
words or more, or a JSX text node — and an exception is an entry in its `ALLOWED`, with
the reason beside it. **"Too long" is said by `readForm`**, from the zod issue's own
`maximum`, and never by a `.max()`: the ceilings live in helpers built at module scope,
where there is no household to ask.
**[`docs/design/language.md`](docs/design/language.md) has the reasoning.**

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

**An ingredient line is a contract, not free text.** `shoppingText`, `pantryKey`,
`writeRecipesToList` and `staplesOf` all take one apart, so anything writing one honours
the format `renderIngredient` writes — see *Every ingredient line is an amount, a unit and
the thing bought* below and [`docs/design/recipes.md`](docs/design/recipes.md). Action mode's breakdown sidesteps it
by storing positions and never a line of its own.

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

**`formatInZone` and `formatDayInZone` are machine-only, deliberately with no locale.**
What they write is read back — a date input's value, `ClearedWeek.week`, two calls compared
to decide a week's range — and a locale would stop the result matching the rows written
before a home switched language. **A person reads `readInZone` / `readDayInZone` instead**,
which take a language and a pattern written as a `Phrase` rather than a bare string, because
a pattern can hold words a locale alone would not translate (`"d MMM 'at' HH:mm"`).

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

### The household has a cupboard, and the shopping list is told about it

Almost every recipe opens with salt, pepper, oil and butter, and almost no household
needs to buy any of them. Before `PantryItem` existed, "add the lasagne" put those four
lines on the shop every time and the three that mattered were somewhere in among them —
so the note under each item saying which recipe asked for it was answering a question
nobody had, about salt.

**A pantry entry is a name and one bit**: `inStock`, which is the whole of what a
cupboard says. There is rice or there is not. Running out is therefore **switching rice
off** rather than deleting it, and the next recipe that wants rice puts rice back on the
list — which is the second half of what the feature is for, and why the boolean is not
just an absence. Deleting is the different sentence: this household has stopped treating
it as something it always has in.

**What matches is `key`, not `name`.** `pantryKey` in `src/lib/pantry.ts` is
`shoppingText` again, lower-cased — the same normalisation that decides two recipes'
lines land on one row of the shop. Matching on anything else would be a second opinion
about what two lines have in common, and the one that quietly disagreed would be this
one: an entry reading "Salt" on the page and silently failing against "2 tsk salt",
which looks like bad luck rather than a bug. The key is derived and never typed —
written in that one function, rewritten on **every** save, so a rename moves what the
entry answers for. `@@unique([homeId, key])` is on the key for the same reason the
matching is: the invariant worth holding is one entry per row of shopping, and "Salt"
and "salt" are not two basic goods. A name that normalises to nothing at all ("`,`") is
refused rather than stored — it would match no ingredient line ever written, and then
claim the next such entry was a duplicate of it.

**Only an exact key is answered for without asking; a key matched by a run of its own
words is asked about instead.** `matchedStockedKey` in `src/lib/pantry.ts` tries the key
as written first, then the longest contiguous run of its own words that the pantry has
an entry for, from any position — a qualifier sits in front of the ingredient it
describes ("tørret spidskommen" is *matched* by a pantry that has "spidskommen", "røget
paprika" by one that has "paprika") as often as it trails it ("hakkede tomater på dåse"
is matched by one that has "hakkede tomater" — "på dåse" names the tin, not the tomato).
But a qualifier the household never typed into the pantry is not assumed to mean the
same shelf, so `matchLine` keeps the two apart — `fullyExact` is true only where every
part of the line matched *as written* — and `stripStocked` silently drops a line off the
shop only on `fullyExact`. Anything matched only by dropping a qualifier is routed
through `ambiguousLines` exactly like a combined line the pantry only partly answers
for, and the household is asked. Only whole words move, and only as a contiguous run,
never a substring reaching inside one — Danish compounds carry no space of their own
("hvidløg", "rødløg") — a pantry entry for "løg" stays an exact match for "løg" and is
never mistaken for garlic, and never even reaches the question. A line naming more than
one thing ("Salt og
friskkværnet peber") is split on "og"/"and"/"&" first, and each half is checked the same
way — so a cupboard with salt and pepper, spelled however the recipe qualified the
pepper, still asks rather than silently deciding the pepper qualifies too.

**The cupboard is taken out in one place**, `writeRecipesToList` in
`src/app/actions/lists.ts`, so a recipe added from its own page and a whole week added
from the meal plan cannot come to disagree about it. It is read at the press rather than
when the page was drawn, because the pantry is a thing somebody may have just corrected
on the way to the shop, and the split is made **before** anything is read or written: a
press the pantry answers for in full leaves without opening a transaction, and the two
things the caller has to say — what went on, what was left out — are decided together.

**What was left out is said.** A line that quietly never arrives reads as one the app
forgot, and a household that cannot tell "we already have salt" from "the salt went
missing" stops trusting the button either way. `ActionResult` carries an optional `note`
for exactly this, and `pantryNote` names what was covered up to three of them and counts
the rest — "Salt, Peber and Olie" is something a cook can disagree with, and "3 skipped"
is something they can only take on trust. A recipe the pantry answers for **in full** is
a refusal rather than a cheerful "Added to Shopping", because nothing was added.

**It answers what a recipe assumed, never what a person asked for.** Typing "salt" into
the add box puts salt on the list, pantry or no pantry: that is somebody asking on
purpose, and second-guessing it would be an app arguing with its own add button.

**`/pantry` is reached from the home's name in the header, above Settings, and it is
everybody's.** The actions take the home from the session and go through `homeDb`, and
they make **no admin check at all** — unlike the recipe-category ones beside them.
Which household ran out of rice on a Tuesday is not a question about who runs the
household, and a pantry only an admin could correct would be out of date by Thursday.
The page is ordered by name and never by what has run out: both questions asked of it
("is the rice in", "we've run out of rice") begin by finding rice, and a list that
reordered itself under the household's thumb on every tick would answer neither.

**The state is a switch, not a tick, and the name is edited by pressing it.** A checkbox
says "this one is selected" — something picked out of a list on the way to doing
something with it, which is exactly what a shopping list's boxes mean and exactly what
this is not: a pantry entry is a standing fact about the cupboard, on until somebody
changes it. The switch is optimistic and is told the state to land in rather than "the
other one", so the second press of a double tap leaves the cupboard saying what the
thumb meant. The name beside it opens an editor in place, the same way a list item's
does — a name is the one thing on a row worth changing without a trip to a sheet, and a
rename costing a menu, a dialog and a Save is a rename nobody makes. A refused rename
(the household already keeps something under that name) needs no undoing: the optimistic
name falls back to the stored one when the transition ends, and the row says why
underneath itself. **Delete keeps the three dots to itself** — a destructive entry is
the whole reason that menu exists, and it stays at the far end of the row where a thumb
aiming at "we're out of rice" cannot reach it.

**Everything switched off goes onto a list in one press.** The pantry already knows what
is missing, so asking somebody to type those five lines into the shopping list is asking
them to say it twice: `addPantryToList` is the same `AddToListMenu` the recipe page and
the meal plan use, pointed at the run-out rows. **Nothing is switched back on** — what
has run out has run out until somebody has been to the shop, and a list is a plan rather
than a receipt; flipping the cupboard here would have the pantry telling the next recipe
that the rice is in because somebody wrote rice down. Each line goes through `addItem`,
so "already there" means what it means everywhere else: a ticked row comes back at one,
an open row is left alone (being out of rice is not a reason to buy two), and what was
left alone is named in the note. Row by row rather than in one transaction, unlike a
recipe's ingredients: every line is independent and the run is idempotent, so a press
that failed halfway is finished by pressing again — which beats one that undoes the rows
it managed. The button is drawn whenever the pantry holds anything at all rather than
only when something is out, because the switches are optimistic and a control that came
and went with the count would arrive a beat after the thumb that caused it.

**An in-stock entry also counts as a staple for the meal suggestions.** `staplesOf`
exists so a household need not keep a list of its own cupboard for the ranking to be
worth reading — but a home that keeps one anyway has said something better than any
inference from its recipes, and an ingredient nobody is buying either way cannot be what
two dinners have in common. `weekSuggestions` on `/meals` unions the two.

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

### A recipe is also read at the hob, and that reading needs one more thing

Action mode (`/recipes/[id]/cook`) is the same recipe one step to a screen, with the
ingredients that step uses beside it, turned like a cookbook's pages. **Leftwards turns
forward**, as lifting a right-hand page over does.

- **`Recipe.cookSteps` holds no text.** One entry per line of `instructions`, in order,
  each naming *indices* into `ingredientLines(ingredients)` plus the step's own minutes.
  The steps are the instructions and an ingredient is its stored line, so the breakdown
  cannot come to disagree with the recipe it describes. Derived and never typed, the way
  `PantryItem.key` is.
- **A write that changes `ingredients` or `instructions` also writes `cookSteps`** — to a
  fresh mapping, or to `DbNull` when the reader could not answer. Both writers are
  `createRecipe` and `updateRecipe`, and a save is read (`readForSaving`) except where the
  answer cannot differ — see *Every ingredient line is …* below;
  `tests/integration/recipes.test.ts` holds it. A reader that is
  down never fails a save: the recipe stores as written, the column clears.
  **Anything that changes how a save behaves has five call sites to check, not one**:
  `createRecipe` is handed in by `recipes/page.tsx` (to `NewRecipeDialog`) and
  `recipes/new/page.tsx`; `updateRecipe` by `recipes/[id]/edit/page.tsx`,
  `recipes/[id]/page.tsx` and `recipe-directory.tsx` (both through `ItemMenu`).
  `grep -rn "createRecipe\|updateRecipe" src --include=*.tsx` lists them.
- **The count is the guard, not the mechanism.** `cookSteps` in `src/lib/cook.ts` ignores
  a stored breakdown *whole* unless its length matches the instruction lines — there is no
  telling which of its entries still line up, and a plausible wrong ingredient at the hob
  is worse than none. An index past the end of the ingredients is dropped on its own.
- **An unprepared recipe still cooks**: plain steps, no ingredients, no timers, and the
  offer to prepare it on the first page. Matching ingredient words against a step to guess
  the mapping would be the pattern-matching `docs/design/recipes.md` records as the wrong
  tool for this question.
- **`prepareCookSteps` is the save's reader, and the gate every stored recipe passes.**
  `recipe-normalize.ts` asks "is there a recipe in this text" about text nobody here wrote,
  and its answer is only a draft for the form; this reads what is actually being stored. It
  rewrites the ingredient lines into the one format (below) **and** the steps, together,
  because what a line loses — "i tern", "stuetemperatur" — has to land in a step. Its
  `uses` are positions in its *own* ingredient answer, renumbered by `readAnswer` past any
  it dropped. Its schema carries the same two traps as the importer's: nothing narrows, and
  every `.describe()` comes before its `.nullish()`.
- **Because its answer replaces the ingredients and the instructions, it only ever answers
  for all of them.** Text past `MAX_INPUT_CHARS` (both blocks counted together) is not sent
  — never sliced to fit, which deleted everything after the cut on save — an answer that
  stopped at `max_tokens` is refused however well it parsed, and so is one that returned no
  steps or no ingredients where the recipe had some. `tests/unit/ai-readers.test.ts` holds
  all of it.
- **The surface is portalled to `document.body`**, because `PageTransition` puts a
  `transform` on an ancestor and a transformed ancestor contains a fixed child. It pads
  its own `env(safe-area-inset-*)`, holds a wake lock through `useWakeLock` (shared with
  `ScreenAwakeToggle`), and its timers live above the pages so a turn does not end them.
- The page turn is `page-turn-next` / `page-turn-back` in `globals.css` — keyframes, and
  no `translate-*`/`rotate-*`/`scale-*` utility on the element playing one.

### A new recipe starts by asking how, not with a field buried in the form

`NewRecipeDialog` is a small choice before it is a form: **start from scratch**, or **import
from a link**. Three steps, all inside the one `Modal`.

- **The step resets to "choose" on every *open*, never on close** — resetting on close shows
  the sheet flashing back while it is still animating away.
- **The button reads the clipboard before it decides which step to open on**, so it is never
  seen choosing; the read is raced against `CLIPBOARD_GRACE_MS`, because `readText()` can sit
  unresolved behind a permission decision nobody will make. Choosing "Import from a link" by
  hand always starts blank.
- The title, ingredients, instructions, picture and total time come back filled in; the
  categories are the form's own fields either way — **except for a reel**, where the pasted
  link *is* the video and fills `videoUrl`.

### An import is two stages, and only the second one decides what a recipe is

Extraction and reading are separate, and the split is the whole architecture.

**Stage one gathers text and judges nothing.** `recipe-extract.ts` reads a page's
`schema.org/Recipe` markup — JSON-LD first, Microdata filling in what it left blank — and
where a page publishes neither, takes its visible text with the furniture stripped out.
`reel-import.ts` does the same job for a reel, whose recipe is the paragraph under the video
and never markup: `isReelUrl` routes those links there before anything is fetched, and
`captionSources` is the one opinion about which links those are (`parseSocialEmbed` in
`embed.ts` knows the same hosts for a different job, building an iframe `src`, and the two
stay apart). All three routes — page, reel, pasted description — produce one `RawExtract`.

**Stage two is `recipe-normalize.ts`, and it is the only thing in this app that reads text as
a recipe.** One model call (`claude-sonnet-5`), one zod-constrained answer, deduplicating
lines, splitting each amount from its unit and its ingredient, and throwing away the hashtags
and the "follow for more". It is also allowed to refuse: `isRecipe: false` is the answer for
a shop page or somebody's lunch, and that refusal is what makes stage one's fall back to
visible text safe at all.

There used to be two readers — one picking fields out of markup, one taking a caption apart
by line length and heading words — and the recipe a cook got depended on which door they came
in by. Both were pattern-matchers being asked a question patterns cannot answer.

- **A reel's caption is looked for in three places, in the order they stopped working.**
  The embed page's `.Caption` element, then `og:description`, then the post as JSON inlined
  in the page (`captionFromEmbeddedJson`) — which is where it lives now that both Instagram
  addresses answer with an application shell carrying neither of the first two. That object
  is lifted out by **matching braces and `JSON.parse`, never by pattern**: a caption holds
  quotes, braces and escaped newlines, and a regex that reads one truncates the next. When a
  source still comes back empty, `reel_caption_source` logs `mentionsCode` and
  `hasInlineMediaJson`, which are the pair that says whether reading the page harder could
  ever have worked — a body that never mentions the post's code was never told which post it
  is for.
- **There is no fallback to a second reader.** The heuristics were deleted, not kept as a
  floor: a floor made of the thing that was getting it wrong is the same two answers to one
  question. **No `ANTHROPIC_API_KEY`, or an API that will not answer, is an honest refusal**
  with the paste box and the plain form beside it — never a quietly worse recipe.
- **`renderIngredient` writes the lines, for the importer and the save alike** — see the
  next section. **A unit is only ever written behind an amount**, and **a component is never
  a heading line of its own**: `writeRecipesToList` walks every line, and "Til dressingen:"
  would become an errand.
- **The schema asserts only what is worth losing the whole import over.** The SDK converts
  it for the API and drops what that format cannot carry — an enum becomes a plain string,
  `.positive()` becomes a line of description — but it still validates the answer against
  the *original* zod schema on the way back. **So a constraint that never reached the model
  is one the model can innocently break, and breaking it throws the recipe away.**
  `totalTimeMinutes: 0`, meaning "the text did not say", did exactly that in production. So
  nothing here narrows a value: `renderNormalized` coerces instead, where a wrong answer
  costs one field. **And every `.describe()` goes before its `.nullish()`** — the other way
  round the converter hoists the type into `$defs` and the description never reaches the
  model at all, which is silent and total. `tests/unit/recipe-normalize.test.ts` holds both.
- **The unit is checked on the way back, not on the wire.** So `UNITS` is what the model is
  *offered*, and
  `canonicalUnit` is what it is *held to*: a unit is kept only if it is in `UNIT_WORDS`
  (`src/lib/recipes.ts`), and dropped otherwise rather than failing the import.
  `shoppingText` strips only a unit word it knows; one it does not stays attached to the
  ingredient, so a model writing "2 tablespoons salt" breaks the pantry silently. Danish
  first, because that is what this household's recipes are in. **The recipe is read into
  the home's own language**, translated where the source was in the other one — see "A
  home is read in a language" above for the prompt/render split that does it, and for why
  a unit word is never the thing respelled by the model.
- **A page's own machine-readable `totalTime` beats the reader's.** `PT1H30M` is the site
  stating the answer; a number read out of prose is an inference.
- **The link is fetched from this app's own server, so it is checked the way that has to be:**
  `isBlockedHost` before anything is requested, and the response's own `url` again after
  redirects. Size and time are both bounded. The picture is resolved against the address
  actually landed on, checked the same way, downscaled server-side and stored through
  `storePhoto` — **only once the reading came back good**, and one that cannot be fetched is
  left out quietly.
- **The content is data, never instructions.** It comes from a page whoever pasted the link
  did not write; the system prompt says so, and a page addressing the reader is a page with no
  recipe on it.
- **Every paid model call is bounded twice.** Per person: `checkRateLimit("import", …)` for
  an import, and `"prepare"` for a save that re-reads the steps or the prepare button — a
  save over it still saves, and clears `cookSteps` as a reader that is down would. Per
  home: `overMonthlyLimit` is asked **inside** both readers rather than at each action, so
  no way into the model can forget it; past it, an import says so without offering the
  paste box, which goes to the same reader.
- **The paste box is the load-bearing half**, offered on any `notARecipe` failure and from a
  button under the link field. It goes to the very same reader, and nothing on Meta's side can
  block it.
- The browser suite drives the whole import against **`e2e/helpers/anthropic-stub.mjs`**, one
  per worker, pointed at by `ANTHROPIC_BASE_URL`. A test that called the real API would be
  billed, would differ between runs, and would fail whenever somebody else's service did.

**[`docs/design/recipes.md`](docs/design/recipes.md) has the reasoning.**

### Every ingredient line is an amount, a unit and the thing bought

**`100 g kartofler`, `2 æg`, `Salt` — and nothing else, for every recipe in the home**,
typed by hand, imported from a link or read off a reel. The shopping list uses only the
ingredient, so anything else on a line is either noise on the list or a second opinion
about which words to throw away.

- **One description, one writer, two callers.** `src/lib/ingredient-line.ts` holds the rules
  (`ingredientRules`), the shape the model answers in (`IngredientSchema` — name, amount,
  unit; **no field for preparation, a note or a component**, because a field is a place to put
  one) and the writer (`renderIngredient`). The importer and the save are both handed all
  three, word for word; `tests/unit/ai-readers.test.ts` asserts both prompts contain the
  same rules. Never write a third description of a line.
- **The save decides what is stored, and skips the reader only where the answer cannot
  differ.** A hand-typed recipe and any changed line go through `prepareCookSteps`. An
  import saved untouched stores the importer's own breakdown, carried in the form as a
  token signed with `AUTH_SECRET` (`reading-token.ts`, `READING_FIELD`) that vouches only
  for those exact lines in that home — the importer is handed `stepRules` too, so its
  breakdown is the save's answer. An edit leaving both blocks alone skips the reader when
  the recipe is already in the format: `IN_FORMAT` (`v: 2` on `cookSteps`, `src/lib/cook.ts`)
  is written only by a reading under the format. Recipes stored before this (`v: 1`, or no
  breakdown) are **not** migrated: any save of one reads it, and so does the "prepare"
  button in action mode.
- **What leaves a line goes into the steps, never nowhere** — the household's own decisions,
  each a bullet of `ingredientRules`: a cut (`i tern`) and a state (`stuetemperatur`) become
  or join a step; a size (`1 stort løg`) is `1 løg` and the step says "det store løg"; `efter
  smag` is the name alone and a step seasons; an optional or serving item is still a line
  (`Parmesan`) and a step says "Server med"; an alternative keeps its first option and the
  step names the other; `Salt og peber` is two lines.
- **Words that change what is bought stay in the name**: `hakkede tomater`, `græsk yoghurt
  10%`, `kyllingebryst uden skind`. No comma and no bracket ever does — `renderIngredient`
  removes them, because `shoppingText` cuts at a comma and the pantry matches nothing in
  brackets.
- **A range takes the higher number** and keeps no trace of the range. **A counted thing is
  its number alone** (`2 æg`, never `2 stk æg` — a `stk` that arrives is dropped).
  **Units are metric**: the reader converts cups, ounces and pounds, choosing weight or
  volume for the ingredient; where a source gives two measures, the metric one is kept.
- **Each ingredient appears once in the whole recipe.** Butter in the dough and in the
  filling is one line (`150 g smør`), with the steps saying how much goes where; different
  units are converted before adding, so the total never under-buys.

### Sheets, folds, movement, and how a form submits

- `Modal` lays its contents out as a column: `ModalBody` scrolls, `ModalFooter` does not.
  **Never put a form's buttons — or the reason a submission was refused — inside
  `ModalBody`.** On a phone a Save button below the fold is a form people abandon.
- **A sheet closes on the browser's back button and a phone's back gesture**, by pushing
  one history entry when it opens and closing on the `popstate` that leaves it. **It never
  calls `history.back()` itself to tidy that entry away on a Cancel or a save** — the App
  Router's client cache freezes the entry *below* the one a sheet pushed at the moment the
  sheet opened, and a save made inside the sheet happens after that: popping back to it
  restores the frozen snapshot and silently undoes the save. Costs one extra back press to
  leave a page after a sheet was opened and cancelled; the alternative cost correctness.
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
- **Never pipe a suite whose exit code is the thing being asked about.** `npm run e2e |
  tail -30` reports `tail`'s status, so a run in which all 249 tests failed came back `0`.
  Redirect to a file and read `$?`, or read `${PIPESTATUS[0]}`.

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
