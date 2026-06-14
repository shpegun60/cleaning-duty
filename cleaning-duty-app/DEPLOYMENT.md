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

Do not deploy the current full Local SQLite setup to serverless hosting if you need persistent data. Serverless filesystems are not a safe place for:

- `data/cleaning-duty.sqlite`
- `data/runtime-config.json`
- uploaded shared files

Vercel is suitable only after moving persistent state to external services, for example Supabase/Postgres and object storage for uploaded files.
