# HomeHub

Lists, recurring tasks and recipes for your home. Multi-tenant: every home is isolated, and
users belong to exactly one home.

Next.js 15 (App Router) · Prisma · PostgreSQL · Tailwind · Web Push

## Features

**Lists** — Create any number of lists (shopping, to-do, packing). Add, tick off, remove and
clear items. Rename or delete a whole list.

**Recurring tasks** — Give a task an interval in days. Marking it done reschedules it that many
days out. Overdue and due-today tasks are highlighted on the dashboard, and a daily job sends a
push notification for anything due.

**Recipes** — Title, description, ingredients and instructions (one per line). Paste an
Instagram, YouTube, TikTok, Vimeo or Facebook link and the video is embedded on the recipe page.
Links from any other host are shown as a plain "open in new tab" link rather than embedded.

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

Two kinds of test run from the same command:

- **Unit** (`tests/unit`) — pure logic with no database: the video-embed allowlist, due-date
  wording, invite codes and the role rules.
- **Integration** (`tests/integration`) — the real server actions and the reminder endpoint,
  driven against a real Postgres database, with only Next.js's per-request APIs stubbed. These
  cover logging in, throttling, accepting an invite, lists, recurring tasks, recipes,
  administration, and that one home can never reach another home's data.

Run one group on its own with `npm run test:unit` or `npm run test:integration`, watch them with
`npm run test:watch`, and run the whole gate — lint, types, tests — with `npm run verify`.

### The test database

Integration tests need Postgres running:

```bash
docker start homehub-pg
```

They use a **separate** database from development. The name is taken from `DATABASE_URL` with
`_test` on the end (so `homehub` → `homehub_test`), created and migrated automatically on the
first run. Set `TEST_DATABASE_URL` to point somewhere else.

Every test starts from an empty database, so the suite truncates tables as it goes. Two guards
make it impossible for that to hit real data: the name must end in `_test`, and it is checked
again immediately before the first delete. Your development data is never touched.

## Blocking a bad deploy

Pushing to `main` is what triggers a Vercel deploy, so the tests gate the push:

1. **Before the push.** `npm install` points git at `.githooks`, where a `pre-push` hook runs
   `npm run verify`. If lint, the types or any test fails, nothing is pushed and nothing deploys.
   In a genuine emergency, `git push --no-verify` skips it.
2. **In CI.** `.github/workflows/test.yml` runs the same checks on GitHub against a throwaway
   Postgres, on every push and pull request.
3. **During the build.** `npm run build` runs the unit tests before `next build`, so a broken
   build fails on Vercel even if the first two were bypassed. (Integration tests are left out
   here: the build has no test database, and it must never touch the production one.)

To make Vercel wait for CI rather than deploying alongside it, turn on
**Vercel → Project Settings → Git → "Only deploy when checks pass"**. Protecting `main` on
GitHub so it only takes pull requests that pass the Tests check does the same job.

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

`vercel.json` registers a daily cron at 07:00 UTC that calls `/api/cron/reminders`. Vercel sends
its own `Authorization: Bearer $CRON_SECRET` header, so setting `CRON_SECRET` is all that is needed.
Hobby-plan projects are limited to one cron run per day, which this schedule fits.

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
