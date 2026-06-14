# Cleaning Duty App

MVP web app for weekly cleaning duty, task checklists, room handover, reject/recheck flow, audit log, and email reminders.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase Auth/PostgreSQL/RLS
- Resend email
- Vercel Cron
- Local SQLite mode via Node.js 22 `node:sqlite`

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

By default the app starts in Local SQLite mode. Use:

```text
login: admin
password: admin
```

The system setup admin is always available at:

```text
http://127.0.0.1:3000/setup
```

From `/setup` you can:

- keep `Local SQLite` mode with a local database in `data/cleaning-duty.sqlite`
- switch to `Supabase` mode
- enter Supabase URL, publishable key, secret key, Resend key, cron secret, sender email
- change app timezone and reminder schedule settings
- change the setup admin username/password

Generic setup on a machine that already has Node.js:

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

The app can run without Supabase in Local SQLite mode. Supabase and Resend values are only required after switching backend mode to `supabase`. Local SQLite mode requires Node.js 22 or newer.

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

For Local SQLite mode, the database is created automatically in `data/cleaning-duty.sqlite`.

For Supabase mode, run all SQL files in `supabase/migrations` in filename order. The migrations create the database schema and the private Supabase Storage bucket used for shared files.

After migrations, create the first Supabase Auth user manually, then insert a matching `public.profiles` row with `role = 'admin'`.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

## Deployment

For the full current app with Local SQLite mode, uploaded files, and cron reminders, use the Docker/VPS deployment path in [DEPLOYMENT.md](DEPLOYMENT.md).

Manual cron test:

```bash
curl "https://your-app.vercel.app/api/cron/scheduler" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
