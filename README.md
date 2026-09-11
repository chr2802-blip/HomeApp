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

```bash
npm run db:studio
```

```bash
npm run build
```
