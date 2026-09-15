# HomeHub

Lists, tasks and recipes for your home. Multi-tenant: every home is isolated, and
users belong to exactly one home.

Next.js 15 (App Router) · Prisma · PostgreSQL · Tailwind · Web Push

## Features

**Lists** — Create any number of lists (shopping, to-do, packing). Add, tick off, remove and
clear items. Rename or delete a whole list. Drag items into the order you shop in, and
when you type something that was ticked off earlier it is offered back rather than
duplicated — so next week's list is mostly rebuilt from last week's.

**Tasks** — A task happens once or over and over, and the repeat picker is where you say which.
A one-off is finished when you mark it done: it moves to a "Done" list at the bottom of the page,
where it can be brought back if the wrong card was pressed. A recurring task is given an interval
in days, and marking it done reschedules it that many days out. Either can be handed to one member
of the home, and either can be edited into the other kind later. Overdue and due-today tasks are
highlighted on the dashboard, and a daily job sends a push notification for anything due — a
one-off that has been done is out of all of that for good.

**Recipes** — Title, description, ingredients and instructions (one per line). Paste an
Instagram, YouTube, TikTok, Vimeo or Facebook link and the video is embedded on the recipe page.
Links from any other host are shown as a plain "open in new tab" link rather than embedded.

**Pictures** — The home has one of its own, shown beside its name and across the top of the
dashboard, and so can each list, task and recipe. Taking a photo on a phone and
adding it works: it is shrunk in the browser before any of it is uploaded. See below.

## Pictures

A picture can be added to the home itself and to anything a home creates. What you pick is
never what is stored:

1. The browser decodes it, applies the rotation the camera recorded, and redraws it twice —
   1600 pixels on the longest edge for the page that shows it whole, 600 for the cards that
   show a row of them. Both are written out as JPEG.
2. Only those two go over the network, so a twelve megapixel photo costs a few hundred
   kilobytes rather than several megabytes, and the upload finishes on a phone connection.
3. The server reads the dimensions and format out of the bytes that arrive — not out of the
   `Content-Type` the request claims — and refuses anything past the limits in
   [`src/lib/photo-file.ts`](src/lib/photo-file.ts). The browser doing the work first is a
   convenience; this is the part that holds when the browser is not the caller.

The bytes live in Postgres, in a `Photo` row belonging to a home. A household's collection is
measured in megabytes, and keeping it in the database means no second service to hold
credentials for and nothing to keep in step when a row is deleted. Pictures are served from
`/api/photos/<id>` behind the session, so there are no public URLs; an id belonging to another
home answers 404, exactly as an id that never existed does.

Uploading happens when the picture is chosen rather than when the form is saved, so it appears
straight away and the form itself carries only an id. Abandon the form and that picture belongs
to nothing — the next upload from the same home clears any such stray older than an hour.

## Keeping homes apart

The worst bug this app could have is one household seeing another's data, and the way
that happens is a forgotten `where: { homeId }` in a query someone wrote in a hurry.

So pages do not write that clause. They read through a client bound to one home:

```ts
const lists = await homeDb(user.homeId).list.findMany({ orderBy: { createdAt: "desc" } });
```

[`src/lib/home-db.ts`](src/lib/home-db.ts) carries the home into every query against a
home-scoped model — lists, tasks, recipes, invites and members — and stamps it onto
anything created. A query that forgets the home returns nothing instead of somebody
else's rows, and a record cannot be filed under the wrong home. Models that belong to
nobody in particular, such as push subscriptions, pass through untouched.

A lint rule keeps pages and components on that path. Reaching for `prisma.list` in a
page is an error with a message saying why; `prisma` directly is for the places where
crossing homes is the point, such as the nightly reminder job and the super admin's
system view.

This sits alongside the permission checks in [`src/lib/access.ts`](src/lib/access.ts)
rather than replacing them: those decide whether someone may act, this removes the
chance to ask the wrong question.

## Knowing whether it is working

**Admin → System** (super admin only) answers "is this installation healthy?": whether the
database is reachable and how fast it responds, when reminders last went out, the last few runs
with their counts, content totals, and the slowest database calls of the last day.

**Admin → Reminders** (every home admin) answers the same question for one household: how many
people have notifications switched on, when a reminder last went out, and what is overdue.
Nothing there reveals another home.

The point of both is the failure that hides: if the reminder schedule stops firing, no reminders
looks exactly like nothing being due. Every run writes a row, so a gap becomes visible.

### `/api/health`

```bash
curl https://<your-app>/api/health
```

Answers `{"status":"ok"}` and HTTP 200, or 503 when the database is unreachable — enough for an
uptime monitor, and nothing an outsider can learn from. `status` is `degraded` when reminders
have not run in `REMINDER_STALE_AFTER_HOURS` (26) or the last run failed; that stays HTTP 200,
because the app is still serving.

Send the cron secret for the detail behind the verdict:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/health
```

### Slow queries and errors

Database calls over `SLOW_QUERY_MS` (400 by default) are recorded and shown on the System page.
Only slow ones are kept — logging every query would make the metrics table the busiest in the
database — and the daily reminder run prunes anything older than seven days.

Failed requests are **not** stored. `src/instrumentation.ts` writes each one to the platform log
as a single JSON line with the path, route and stack, so log search can filter on the fields.
Errors arrive in bursts and are unbounded in size; a table of them would need its own paging and
pruning to be worth reading.

## Dates and times

The app runs on one household clock, set by `TIME_ZONE` in [`src/lib/time.ts`](src/lib/time.ts)
(currently `Europe/Copenhagen`). Tasks come due at 09:00 on that clock, and "Due today" means
today's calendar date there.

This is deliberately not the server's own timezone, which is UTC on Vercel and something else on
a developer's laptop. Anything that decides or displays a date goes through `src/lib/time.ts`
rather than using `new Date(...)` arithmetic directly. If the household moves, change that one
constant.

## Roles

| Role | Can do |
| --- | --- |
| Super admin | Everything; creates homes, switches between any home to administer it |
| Admin | Manages their own home: settings, members, roles, invitations |
| User | Creates and edits lists, tasks and recipes in their own home |

Every home member shares that home's lists, tasks and recipes. No one can reach another home's
data — requests for another home's records return 404.

## Invitations

There is no mail server. An admin creates an invitation for a specific email address and the app
generates a one-time code. The admin passes that code on however they like (text, chat, in
person). The invitee goes to `/accept-invite` and must supply **both** the exact invited email
**and** the code to create their account. Codes are stored hashed, expire after 14 days, and are
displayed only once — create a new invitation if one is lost.

## Local setup

1. Install dependencies and create the environment file:

```bash
npm install
```

Copy `.env.example` to `.env` and fill it in:

- `DATABASE_URL` — any Postgres instance.
- `AUTH_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — generate with `npx web-push generate-vapid-keys`.
- `CRON_SECRET` — any random string; the reminder endpoint requires it.
- `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` — used once, to seed the first account.

2. Create the tables and the first super admin:

```bash
npm run db:push
```

```bash
npm run db:seed
```

3. Start it:

```bash
npm run dev
```

Log in at `/login` with the super admin credentials, create a home under **Admin → All homes**,
switch into it, and invite the rest of the household.

## Tests

```bash
npm test
```

Two kinds of test run from that command:

- **Unit** (`tests/unit`) — pure logic with no database: the video-embed allowlist, due-date
  wording, invite codes and the role rules.
- **Integration** (`tests/integration`) — the real server actions and the reminder endpoint,
  driven against a real Postgres database, with only Next.js's per-request APIs stubbed. These
  cover logging in, throttling, accepting an invite, lists, tasks, recipes,
  administration, and that one home can never reach another home's data.

Run one group on its own with `npm run test:unit` or `npm run test:integration`, and watch them
with `npm run test:watch`.

Browser tests are separate, because they need the app built and served:

```bash
npm run e2e
```

- **End to end** (`e2e`) — Playwright drives a real Chromium against a production build of the
  app: signing in and out, issuing an invite and redeeming the code, building a list and ticking
  items off, completing a task of either kind, embedding a recipe video, every administration screen,
  and one home being unable to open another home's pages. `npm run e2e:ui` opens the interactive
  runner; after a failure `npm run e2e:report` shows the trace, screenshot and DOM snapshot.

`npm run verify` runs the whole gate: lint, types, the vitest suites, then the browser tests.

### Test databases

The tests need Postgres running:

```bash
docker start homehub-pg
```

They use **separate** databases from development, named after `DATABASE_URL` with a suffix —
`homehub_test` for vitest and `homehub_e2e` for Playwright — each created and migrated
automatically on first run. Override with `TEST_DATABASE_URL` or `E2E_DATABASE_URL`.

Both suites truncate tables between tests, so each starts from a known state. Two guards make it
impossible for that to reach real data: the database name must carry the right suffix, and it is
checked again immediately before the first delete. Your development data is never touched.

### Working in more than one checkout at once

A second worktree needs its own databases **and its own browser-test port**. The databases are
the obvious half; the port is the half that wastes an afternoon.

```bash
# in the second checkout's .env
TEST_DATABASE_URL=postgresql://…/homehub_myfeature_test
E2E_DATABASE_URL=postgresql://…/homehub_myfeature_e2e
E2E_PORT=3180
```

Playwright serves the built app on `E2E_PORT` (3100 by default) and reuses a server it finds
already listening there. Two checkouts on the same port therefore share one server built from
one of them, and whichever suite finishes first tears it down under the other. It does not look
like a collision: it looks like `ERR_CONNECTION_REFUSED`, tests failing in a different place
each run, and a summary reporting a handful of passes out of a hundred. Every one of those is
worth chasing, and none of them is real.

Migrations are the other thing to watch. Both checkouts migrate the same shared databases unless
they are pointed apart, so a branch carrying a migration the other does not have will break the
other's suite — usually as a null-constraint violation in a model neither branch was touching.

## Blocking a bad deploy

Pushing to `main` is what triggers a Vercel deploy, so the tests gate the push:

1. **Before the push.** `npm install` points git at `.githooks`, where a `pre-push` hook
   checks the change. Lint, types and the unit tests always run — seconds, and they need
   nothing running. The integration and browser suites run only when something they could
   exercise has changed, so editing a README costs about ten seconds rather than three
   minutes and a full build; anything unrecognised runs everything. If a check fails,
   nothing is pushed and nothing deploys. In a genuine emergency, `git push --no-verify`
   skips it.
2. **In CI.** `.github/workflows/test.yml` runs the same checks on GitHub against a throwaway
   Postgres, on every push and pull request. A failing browser test uploads its Playwright
   report as a build artifact.
3. **During the build.** `npm run build` runs the unit tests before `next build`, so a broken
   build fails on Vercel even if the first two were bypassed. (Integration tests are left out
   here: the build has no test database, and it must never touch the production one.)

### Only `main` deploys

`vercel.json` disables automatic deployments for every branch except `main`:

```json
"git": { "deploymentEnabled": { "**": false, "main": true } }
```

Preview deployments are deliberately off. They shared the production database — the
build runs `prisma migrate deploy`, so a branch adding a migration applied it to
production before anyone reviewed it, and the preview app itself read and wrote real
data. Rather than give previews their own database, there are no previews.

What replaces them: the browser tests, which drive a production build of the app
against a throwaway database on every push, locally and in CI. That is a better check
than clicking through a preview, and it cannot touch anything real.

If you ever want a one-off preview, `npx vercel` still deploys from your machine on
demand. This setting only turns off the automatic ones.

### Making Vercel wait for CI

By default Vercel builds and releases as soon as `main` moves, without waiting for the workflow
above. Two independent ways to close that gap — either is enough, and they combine well:

**Vercel Deployment Checks** hold a finished production build back from your production domain
until the checks pass. First make sure automatic aliasing is on under
**Project Settings → Environments → Production**. Then open
**Project Settings → Build and Deployment → Deployment Checks**, choose **Add Checks**, pick
**GitHub** as the provider, and select the **Lint, types and tests** check (GitHub identifies
checks by job name, so renaming that job in `test.yml` means re-selecting it here). The build
still runs; it just is not released to users until the tests go green. `Force Promote` on the
deployment page overrides this when you need it.

**A GitHub ruleset** on `main` requiring the same check keeps failing code off the branch in the
first place, so no production build is ever created from it. Set it under
**Repository Settings → Rules → Rulesets**, requiring a pull request and the status check.

## Deploying to Vercel with Supabase

### 1. Create the database

In Supabase create a project, then open **Project Settings → Database → Connection string**. Two
different strings are needed:

- **Transaction pooler** (port `6543`) → `DATABASE_URL`. Append `?pgbouncer=true&connection_limit=1`,
  which Prisma requires when talking to a transaction pooler.
- **Direct connection** (port `5432`) → `DIRECT_URL`. Migrations need a real session and cannot run
  through the pooler.

### 2. Generate secrets

```bash
node -e "console.log('AUTH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

```bash
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(24).toString('hex'))"
```

```bash
npx web-push generate-vapid-keys
```

### 3. Import into Vercel

Import the GitHub repo, then add every variable from `.env.example` under **Settings → Environment
Variables**. The build runs `prisma migrate deploy`, so the schema is created on the first deploy —
there is no separate migration step.

### 4. Create the first super admin

Once deployed, run the seed once from your machine against the production database:

```bash
DATABASE_URL="<direct-url>" DIRECT_URL="<direct-url>" SUPER_ADMIN_EMAIL="you@example.com" SUPER_ADMIN_PASSWORD="<a strong password>" npm run db:seed
```

Log in, create a home under **Admin → All homes**, switch into it, and invite the household.

### Notes

`vercel.json` registers a daily cron at 06:00 UTC that calls `/api/cron/reminders`. Vercel sends
its own `Authorization: Bearer $CRON_SECRET` header, so setting `CRON_SECRET` is all that is needed.
Hobby-plan projects are limited to one cron run per day, which this schedule fits.

The job notifies about everything due by the end of that day rather than by the minute it runs,
so the exact hour is not load-bearing — it only has to land in the morning.

Push notifications require HTTPS, which Vercel provides. On iOS the site must be added to the home
screen before Safari will deliver notifications.

## Useful commands

Browse the database:

```bash
npm run db:studio
```

Run every check exactly as the pre-push hook does:

```bash
npm run verify
```

Build as Vercel will:

```bash
npm run build
```
