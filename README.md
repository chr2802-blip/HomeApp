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

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Create a Postgres database (Neon, Supabase or Vercel Postgres) and set `DATABASE_URL`.
3. Add every other variable from `.env.example` to the Vercel project settings.
4. Deploy, then run `npm run db:push` and `npm run db:seed` once against the production database
   (locally, with the production `DATABASE_URL` in your shell).

`vercel.json` registers a daily cron at 07:00 UTC that calls `/api/cron/reminders`. Vercel sends
its own `Authorization: Bearer $CRON_SECRET` header, so setting `CRON_SECRET` in the project is
all that is needed.

Push notifications require HTTPS, which Vercel provides. On iOS the site must be added to the
home screen before Safari will deliver notifications.

## Useful commands

```bash
npm run db:studio
```

```bash
npm run build
```
