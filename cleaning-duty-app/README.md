# Cleaning Duty App

MVP web app for weekly cleaning duty, task checklists, room handover, reject/recheck flow, audit log, and email reminders.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase Auth/PostgreSQL/RLS
- Resend email
- Vercel Cron

## Local setup

This workspace includes a portable Node.js under `../.tools`, so on this machine you can start the app with:

```cmd
..\start-cleaning-duty.cmd
```

Or from this folder:

```cmd
start-dev.cmd
```

Then open:

```text
http://127.0.0.1:3000/login
```

Generic setup on a machine that already has Node.js:

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

The app expects real Supabase and Resend values in `.env.local` for authenticated flows. Without them, `/login` still renders, but auth/API routes cannot complete.

## Required environment

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
RESEND_API_KEY=
EMAIL_FROM="Cleaning Duty <noreply@example.com>"
APP_URL=http://localhost:3000
APP_TIMEZONE=Europe/Warsaw
CRON_SECRET=
```

## Database

Run the SQL files in `supabase/migrations` in order:

1. `001_extensions.sql`
2. `002_enums.sql`
3. `003_schema.sql`
4. `004_indexes.sql`
5. `005_rls.sql`
6. `006_rpc.sql`
7. `007_seed.sql`

After migrations, create the first Supabase Auth user manually, then insert a matching `public.profiles` row with `role = 'admin'`.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

Manual cron test:

```bash
curl "https://your-app.vercel.app/api/cron/scheduler" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
