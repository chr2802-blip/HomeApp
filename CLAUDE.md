# HomeHub

Lists, tasks and recipes for a household. Multi-tenant: everything belongs to a
**home**, and people belong to a home. Next.js App Router, Prisma, Postgres, on Vercel.

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

### Home-scoped data goes through `homeDb`

```ts
const lists = await homeDb(user.homeId).list.findMany({ orderBy: { createdAt: "desc" } });
```

`src/lib/home-db.ts` carries the home into every query against a home-scoped model
(List, Task, Recipe, Invite, User) and stamps it onto anything created. A query
that forgets the home returns nothing rather than another household's rows.

**Never hand-write `where: { homeId }` in a page or component.** A lint rule rejects
`prisma.list` and friends there. Use `prisma` directly only where crossing homes is the
point — the reminder job, the super admin's system view — and say so in a comment.

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

- **Hydration has no DOM signal.** A widget's markup looks identical before and after
  React attaches listeners. Browser tests of interactive widgets must wait on something
  the widget itself emits — the drag tests wait on dnd-kit's announcements, and a context
  menu's trigger grows `data-ready` once it can actually open.
- **Prisma accepts a non-unique field in `where`** on `findUnique`, `update` and `delete`,
  returning null or `P2025` on mismatch. That is what makes `homeDb` work everywhere.
- **A required relation between two cascade-deleted models wants `NoAction`, not
  `Restrict`.** `Recipe.categoryId` is required, and deleting a home cascades to both its
  recipes and its categories in one statement. Postgres checks `Restrict` the instant the
  referenced row goes, so that ordering can fail; `NoAction` is checked once the statement
  is finished, by which point both sides are gone. Both still refuse to delete a category
  that holds recipes, which is the point of having the constraint.
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
