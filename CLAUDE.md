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

### A home is dressed in a colour, and it dresses the frame only

`Home.theme` is one of a fixed set (`HomeTheme`), picked by that household's admins in
the Home card on `/settings`. Now that somebody is in several homes, the header saying
which one is open is the difference between adding milk to the right shopping list and
the wrong one.

What each colour *is* lives in **`globals.css` and nowhere else**, as a block of five
variables per theme keyed by `[data-theme="NAME"]`. `src/lib/theme.ts` holds only what
they are called. Anything showing a colour — a swatch in the picker, a dot beside a home
in the header's menu — carries that home's `data-theme` and reads `var(--accent)`, so it *is*
the colour rather than a copy that drifts. `tests/unit/theme.test.ts` reads the
stylesheet and fails if a theme has no block: an undefined variable leaves the element
wearing whatever the page already had, which looks like a theme that works.

The attribute goes on `<html>`, set by the **root layout** from the session. Not on a
wrapper inside the app: sheets and the three-dot panel are portalled into `<body>`, so
anything scoped to a div would leave every dialog in the previous home's colours.

The one exception to "only globals.css" is the phone's status bar: `generateViewport`
in the root layout hands the browser a `theme-color`, and a meta tag takes a literal and
not a variable. So `THEME_BAR` in `src/lib/theme.ts` repeats each theme's `--accent-soft`
as an opaque hex — and `tests/unit/theme.test.ts` parses both and fails if they ever stop
agreeing, because the drift shows only as the strip above the header no longer matching
the header. **Any new theme needs a `THEME_BAR` entry as well as a CSS block.** The
manifest's own `theme_color` cannot be one of these: it is read once when the app is
installed, so it stays the default, and the document's tag takes over the moment a page
renders.

**The colour dresses the frame, never the meanings inside it.** The header, the tab bar,
the active nav pill, the primary button and the focus ring — and nothing else. Green is
still "added", red "about to be deleted", amber "overdue", in every home; a household
dressed in one of those would be saying it on every screen, which is why none of the
themes is any of them and why `create` and `danger` keep their own colours.

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
`ListFavorite` and `RecipeCategoryLink`. None of the four carries a `homeId`, so scoping
would pass the query straight through — and `homeDb(id).user.findMany()`, which used to
mean "this home's people", would now hand back every account on the installation. A
household's roster is `homeDb(id).homeMember.findMany({ include: { user: … } })`, and a
list's items are an `include` on a list query that went through `homeDb`.

Being refused is the point, and the refusal is the whole protection: a model that reads
as though it belongs to a home but carries no `homeId` is passed through *unscoped* if
`homeDb` does not name it. `ListItem` was in exactly that position and
`homeDb(id).listItem.findMany()` returned every household's shopping. **Anything added
to the schema without a `homeId` belongs in one of the two lists in `home-db.ts` before
it is queried anywhere.**

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

### A sheet's actions stay on screen

`Modal` lays its contents out as a column: `ModalBody` scrolls, `ModalFooter` does not.
Every dialog puts its buttons — and the reason a submission was refused — in the footer,
so they are in view from the moment it opens. **Never put a form's buttons inside
`ModalBody`.** On a phone the sheet is the whole screen and the longer forms run well past
it; a Save button below the fold is a form people abandon believing it did not work.

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

A flaky test is worse than no test: it teaches everyone to press the button again. Fix the
race, do not add a timeout.

## Deployment

Only `main` deploys — `vercel.json` disables every other branch. **There are no preview
deployments**, deliberately: they ran migrations against, and served from, the production
database.

Production: **https://home-app-three-virid.vercel.app**. Other Vercel addresses for this
project are frozen snapshots of one build and will show stale commits forever. The
deployed commit is shown on **Admin → System**.

Migrations run inside the production build (`prisma migrate deploy`). A bad migration
therefore presents as a failed build, and there is no rollback path — worth changing if it
ever bites.

## Observability

**Admin → System** (super admin) shows database health, the reminder job's recent runs,
content totals and the slowest queries of the last day. Home admins see whether reminders
are reaching their own household.

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
- **`vercel.json` is schema-validated.** An unknown key can fail the deploy; keep
  explanations in the README.
- **On Windows, `npx.cmd` cannot be spawned without a shell.** Invoke a CLI's entry point
  with `node` instead (see `tests/setup/global.ts`).
- **`npm audit` reports build-time-only advisories** in Prisma's CLI and Next's PostCSS.
  `audit fix --force` downgrades Prisma and breaks the build. Leave them.

## Working style

Open a branch, keep `npm run verify` green, and open a PR rather than pushing to `main`.
Explain in the PR what changed and why, and flag anything you decided rather than knew.
