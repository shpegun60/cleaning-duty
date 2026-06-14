# Deployment

## Recommended path: VPS + Docker

Use this path for the current full app: Local SQLite mode, local setup admin, uploaded files, and cron reminders. The important part is the persistent Docker volume mounted to `/app/data`.

### 1. Prepare server

Install Docker with the Compose plugin on a Linux VPS.

Open inbound traffic for:

- `80` and `443` if you use a domain and reverse proxy.
- `3000` only if you want to test the app directly before adding HTTPS.

### 2. Clone and configure

```bash
git clone https://github.com/shpegun60/cleaning-duty.git
cd cleaning-duty/cleaning-duty-app
cp .env.deploy.example .env
```

Edit `.env`:

```env
APP_URL=https://your-domain.com
CRON_SECRET=your-long-random-secret
RESEND_API_KEY=your-resend-key-if-email-is-needed
EMAIL_FROM=Cleaning Duty <noreply@your-domain.com>
```

Keep `APP_BACKEND=local` if you want the app to use SQLite.

### 3. Start

```bash
docker compose up -d --build
```

Open:

```text
http://SERVER_IP:3000/login
```

or, after reverse proxy setup:

```text
https://your-domain.com/login
```

Initial local setup login:

```text
admin / admin
```

Immediately open `/setup` and change the setup password.

### 4. Update

```bash
git pull
docker compose up -d --build
```

### 5. Backup

All important local data is in the Docker volume `cleaning-duty-data`: SQLite database, runtime config, and uploaded files.

Example backup:

```bash
mkdir -p backups
docker run --rm \
  -v cleaning-duty-app_cleaning-duty-data:/data \
  -v "$PWD/backups:/backup" \
  alpine:3.20 \
  tar czf /backup/cleaning-duty-data-$(date +%F).tgz -C /data .
```

### 6. Reverse proxy / HTTPS

Put Caddy, Nginx, Traefik, Cloudflare Tunnel, or another reverse proxy in front of port `3000`.

The app must know its public URL:

```env
APP_URL=https://your-domain.com
```

Restart after changing `.env`:

```bash
docker compose up -d
```

## Vercel / serverless note

Do not deploy the Local SQLite setup to serverless hosting if you need persistent data. Serverless filesystems are not a safe place for:

- `data/cleaning-duty.sqlite`
- `data/runtime-config.json`
- uploaded shared files

Vercel is suitable with `APP_BACKEND=supabase`. In that mode:

- Supabase Postgres stores the app data.
- Supabase Auth stores users.
- Supabase Storage stores uploaded shared files in the private `shared-files` bucket.

Required Vercel environment variables:

```env
APP_BACKEND=supabase
APP_URL=https://your-app.vercel.app
APP_TIMEZONE=Europe/Warsaw
SETUP_USERNAME=admin
SETUP_PASSWORD=change-this-before-production
LOCAL_AUTH_TOKEN=your-long-random-local-session-secret
CRON_SECRET=your-long-random-secret
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-or-service-role-key
RESEND_API_KEY=your-resend-key-if-email-is-needed
EMAIL_FROM=Cleaning Duty <noreply@your-domain.com>
```

Where to get these values:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase Dashboard -> Project Settings -> API -> Project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase Dashboard -> Project Settings -> API -> publishable/anon key.
- `SUPABASE_SECRET_KEY`: Supabase Dashboard -> Project Settings -> API -> secret/service role key. Keep it server-side only.
- `RESEND_API_KEY`: Resend Dashboard -> API Keys -> Create API key. Sending access is enough.
- `EMAIL_FROM`: a sender address on a domain verified in Resend, for example `Cleaning Duty <noreply@your-domain.com>`.
- `APP_URL`: the public Production URL from Vercel, for example `https://your-app.vercel.app` or your custom domain.
- `SETUP_USERNAME` / `SETUP_PASSWORD`: the protected setup login for `/setup`. Change the default before production.
- `LOCAL_AUTH_TOKEN`: a stable random secret used to sign the local setup/admin session cookie. If omitted, the app derives it from other server secrets.
- `CRON_SECRET`: any long random value that you create yourself and save in Vercel env vars.

Before the first Vercel deploy, run every SQL file in `supabase/migrations` in filename order against your Supabase project. Migration `013_shared_files_storage_bucket.sql` creates the Storage bucket for uploaded files, and `014_api_grants.sql` grants the Supabase API roles access to the app tables and RPC functions.

Vercel Cron can call:

```text
/api/cron/scheduler
```

The route requires:

```http
Authorization: Bearer YOUR_CRON_SECRET
```
