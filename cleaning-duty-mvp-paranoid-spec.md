# Cleaning Duty App — MVP v1 Paranoid Implementation Spec

Дата ревізії: 2026-06-13  
Ціль: web-система для контролю тижневого графіку прибирання, виконання робіт, приймання чергування й email-нагадувань.

---

## 0. Короткий висновок після параноїдальної перевірки

Базова архітектура правильна:

```text
Next.js + Vercel + Supabase + Resend
```

Але початкову інструкцію треба затягнути в таких місцях:

1. **Vercel Cron працює тільки в UTC.** Не можна писати логіку так, ніби cron запускається в `Europe/Warsaw`. Треба запускати endpoint у UTC і всередині коду рахувати локальний день/годину.
2. **Vercel Cron може викликати той самий job більше одного разу.** Треба мати і lock, і idempotency через таблицю `notifications`.
3. **Vercel Cron не гарантує retry після помилки.** Треба зберігати failed notifications і мати manual retry/admin retry.
4. **Supabase service/secret key не можна використовувати в браузері.** Усі критичні мутації мають іти через server route handlers або SQL RPC.
5. **Складні переходи станів мають бути атомарні.** Приймання, reject, regenerate schedule і зміна чергового не повинні бути набором випадкових frontend-запитів.
6. **RLS не заміняє backend authorization.** RLS захищає базу, але кожен server endpoint усе одно перевіряє користувача, роль і бізнес-умови.
7. **Google Sheets не є базою.** У MVP не використовувати його як storage. Максимум потім як export.
8. **Фотографії не входять у MVP.** Інакше storage, moderation, compression, retention і privacy одразу роздують проєкт.
9. **Потрібно мати admin-ручку для зміни графіку.** Але історію минулих чергувань не переписувати.
10. **Усі важливі дії мають писатися в audit log.** Інакше потім ніхто не знатиме, хто що змінив.

---

## 1. Призначення системи

Система має автоматизувати тижневе чергування з прибирання.

Адміністратор створює:

```text
людей
кімнати
роботи в кімнатах
порядок чергування
поточне або майбутнє чергування
```

Користувач, який чергує, отримує email у суботу зранку, заходить на сайт, бачить список робіт по кімнатах і відмічає виконані роботи.

Наступна людина в черзі отримує email у неділю зранку, заходить на сайт, перевіряє кімнати й приймає або не приймає чергування.

Якщо наступна людина не приймає чергування, вона залишає коментар. Чергування не переходить далі, доки проблема не буде виправлена або admin не втрутиться.

---

## 2. MVP scope

### 2.1. Реалізувати в MVP

```text
логін користувачів
ролі admin/worker
адмінку
створення/редагування людей
створення/редагування кімнат
створення/редагування робіт
порядок чергування
поточне чергування
майбутній графік
ручну зміну графіку admin-ом
суботнє email-нагадування поточному черговому
недільне email-нагадування наступній людині
сторінку виконання робіт
сторінку приймання кімнат
reject з коментарем
історію/audit log
захист від дубльованих email
деплой на Vercel
```

### 2.2. Не реалізовувати в MVP

```text
фото-докази
push notifications
native Android app
desktop app
QR-коди
штрафи
складну аналітику
Google Sheets як базу
offline mode
чат між користувачами
```

---

## 3. Обраний стек

### 3.1. Web app

```text
Next.js
React
TypeScript
Tailwind CSS
App Router
Route Handlers
```

### 3.2. Hosting

```text
Vercel
```

Vercel відповідає за:

```text
production deploy
preview deploys
environment variables
Vercel Cron
serverless route handlers
```

### 3.3. Database/Auth

```text
Supabase
PostgreSQL
Supabase Auth
Row Level Security
```

### 3.4. Email

```text
Resend
```

Resend відповідає за application emails:

```text
Saturday cleaning reminder
Sunday handover reminder
Handover rejected email
Recheck requested email
Admin changed assignee email
```

Supabase Auth може відправляти auth-related email:

```text
invite link
magic link
password recovery
```

---

## 4. Основний workflow

### 4.1. Тижневе прибирання

```text
Monday-Sunday duty period exists
Saturday morning -> assignee gets cleaning email
Assignee opens /duty/[dutyId]
Assignee checks tasks room by room
Assignee clicks Complete cleaning
Duty status becomes cleaning_done
```

### 4.2. Приймання чергування

```text
Sunday morning -> next_assignee gets handover email
Next assignee opens /handover/[dutyId]
Next assignee checks rooms, not individual tasks
If all rooms accepted -> old duty closes and new duty starts
If not accepted -> old duty becomes rejected and stays with previous assignee
```

### 4.3. Reject flow

```text
Next assignee rejects at least one room
Comment is required
Old assignee receives email
Duty status becomes rejected
No new active duty is created
Old assignee fixes issue
Old assignee clicks Ready for recheck
Next assignee can accept or reject again
```

---

## 5. Status model

### 5.1. duty_status

```text
scheduled
active
cleaning_done
handover_pending
accepted
rejected
ready_for_recheck
force_closed
cancelled
```

### 5.2. Status meanings

| Status | Meaning |
|---|---|
| `scheduled` | Future duty exists but is not active yet. |
| `active` | Current assignee is responsible for cleaning. |
| `cleaning_done` | Assignee marked all tasks as done and completed cleaning. |
| `handover_pending` | Next assignee must accept/reject rooms. |
| `accepted` | Handover accepted; old duty is closed. |
| `rejected` | Handover rejected; old assignee remains responsible. |
| `ready_for_recheck` | Old assignee says rejected issues were fixed. |
| `force_closed` | Admin manually closed duty. |
| `cancelled` | Duty was cancelled before becoming active. |

### 5.3. Allowed transitions

```text
scheduled -> active
active -> cleaning_done
active -> handover_pending
cleaning_done -> handover_pending
handover_pending -> accepted
handover_pending -> rejected
rejected -> ready_for_recheck
ready_for_recheck -> accepted
ready_for_recheck -> rejected
any non-final -> force_closed by admin
scheduled -> cancelled by admin
```

Final statuses:

```text
accepted
force_closed
cancelled
```

`rejected` is not final, because it can go to `ready_for_recheck`.

---

## 6. Timezone and reminders

Application timezone:

```text
Europe/Warsaw
```

Reminder policy:

```text
Saturday morning: remind current assignee
Sunday morning: remind next assignee
```

Target local window:

```text
08:00-10:00 Europe/Warsaw
```

Reason: Vercel Cron uses UTC. Poland changes between CET and CEST, so exact local 08:00 cannot be represented by one fixed UTC cron for the whole year.

Use two cron entries:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/scheduler",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/scheduler",
      "schedule": "0 7 * * *"
    }
  ]
}
```

The endpoint must check local date and hour in `Europe/Warsaw`. It must send reminders only if:

```text
local day is Saturday or Sunday
local hour is between 08 and 10
notification was not already sent
cron lock is acquired
```

---

## 7. Security rules

### 7.1. Never expose server secrets

Never expose these to the browser:

```text
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
CRON_SECRET
```

Only browser-safe env variables may start with:

```text
NEXT_PUBLIC_
```

### 7.2. Browser is not trusted

The browser must never directly perform critical updates like:

```text
accept handover
reject handover
complete duty
change current assignee
regenerate schedule
create user
send email
```

These operations must go through Next.js Route Handlers.

### 7.3. Every server mutation must verify authorization

Each route handler must verify:

```text
current user exists
current user is active
current user has required role
current user is allowed to touch this duty period
current duty status allows requested transition
```

### 7.4. RLS is required

RLS must be enabled on all application tables.

RLS is defense-in-depth. It is not an excuse to skip backend checks.

---

## 8. Environment variables

Create `.env.local.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_SECRET_KEY=
# Optional legacy fallback if the project still uses old keys:
# SUPABASE_SERVICE_ROLE_KEY=

RESEND_API_KEY=
EMAIL_FROM="Cleaning Duty <noreply@example.com>"

APP_URL=http://localhost:3000
APP_TIMEZONE=Europe/Warsaw
CRON_SECRET=
```

Production values must be configured in Vercel Project Settings -> Environment Variables.

---

## 9. Project structure

```text
cleaning-duty-app/
  app/
    layout.tsx
    page.tsx

    login/
      page.tsx

    auth/
      callback/
        route.ts

    dashboard/
      page.tsx

    duty/
      [dutyId]/
        page.tsx

    handover/
      [dutyId]/
        page.tsx

    admin/
      layout.tsx
      page.tsx

      users/
        page.tsx

      rooms/
        page.tsx

      tasks/
        page.tsx

      rotation/
        page.tsx

      schedule/
        page.tsx

    api/
      cron/
        scheduler/
          route.ts

      duty/
        task-check/
          route.ts
        complete/
          route.ts
        ready-for-recheck/
          route.ts

      handover/
        room-check/
          route.ts
        accept/
          route.ts
        reject/
          route.ts

      admin/
        users/
          invite/
            route.ts
          update-profile/
            route.ts
        rooms/
          route.ts
        tasks/
          route.ts
        change-assignee/
          route.ts
        reorder-rotation/
          route.ts
        regenerate-schedule/
          route.ts
        retry-notification/
          route.ts

  components/
    admin/
    duty/
    handover/
    layout/
    ui/

  lib/
    auth/
      guards.ts
      profile.ts

    email/
      resend.ts
      templates.ts
      send-email.ts

    scheduler/
      dates.ts
      locks.ts
      scheduler.ts
      reminders.ts

    supabase/
      browser.ts
      server.ts
      admin.ts
      proxy.ts

    domain/
      duty.ts
      handover.ts
      rotation.ts
      notifications.ts
      audit.ts

  supabase/
    migrations/
      001_extensions.sql
      002_enums.sql
      003_schema.sql
      004_indexes.sql
      005_rls.sql
      006_rpc.sql
      007_seed.sql

  proxy.ts
  vercel.json
  .env.local.example
  package.json
  README.md
```

---

## 10. Initial setup commands

```bash
npx create-next-app@latest cleaning-duty-app
cd cleaning-duty-app
npm install @supabase/supabase-js @supabase/ssr resend date-fns date-fns-tz zod
npm install -D prettier eslint
```

Recommended create-next-app answers:

```text
TypeScript: yes
ESLint: yes
Tailwind: yes
src directory: no
App Router: yes
Turbopack: yes
Import alias: @/*
```

---

## 11. Supabase clients

### 11.1. Browser client

```ts
// lib/supabase/browser.ts
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

### 11.2. Server client

```ts
// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    }
  );
}
```

### 11.3. Admin client

```ts
// lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey) {
    throw new Error("Missing Supabase server secret key");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
```

---

## 12. Supabase auth proxy

Use `@supabase/ssr` with proxy middleware to keep auth cookies fresh.

`proxy.ts`:

```ts
// proxy.ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

`lib/supabase/proxy.ts`:

```ts
// lib/supabase/proxy.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  await supabase.auth.getClaims();

  return response;
}
```

---

## 13. Database schema

### 13.1. Extensions

```sql
create extension if not exists pgcrypto;
```

### 13.2. Enums

```sql
create type public.user_role as enum (
  'admin',
  'worker'
);

create type public.duty_status as enum (
  'scheduled',
  'active',
  'cleaning_done',
  'handover_pending',
  'accepted',
  'rejected',
  'ready_for_recheck',
  'force_closed',
  'cancelled'
);

create type public.notification_type as enum (
  'saturday_cleaning_reminder',
  'sunday_handover_reminder',
  'handover_rejected',
  'handover_accepted',
  'recheck_requested',
  'admin_changed_assignee'
);

create type public.notification_status as enum (
  'pending',
  'sent',
  'failed',
  'skipped'
);

create type public.room_acceptance_status as enum (
  'pending',
  'accepted',
  'rejected'
);
```

### 13.3. updated_at trigger

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

### 13.4. profiles

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.user_role not null default 'worker',
  rotation_order integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
```

### 13.5. rooms

```sql
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_rooms_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();
```

### 13.6. tasks

```sql
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_room_id_fkey
    foreign key (room_id)
    references public.rooms(id)
    on delete cascade
);

create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();
```

### 13.7. duty_periods

```sql
create table public.duty_periods (
  id uuid primary key default gen_random_uuid(),

  assignee_id uuid not null,
  next_assignee_id uuid,

  week_start date not null,
  week_end date not null,

  status public.duty_status not null default 'scheduled',

  cleaned_at timestamptz,
  handover_started_at timestamptz,

  accepted_at timestamptz,
  accepted_by uuid,

  rejected_at timestamptz,
  rejected_by uuid,
  reject_comment text,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint duty_periods_assignee_id_fkey
    foreign key (assignee_id)
    references public.profiles(id),

  constraint duty_periods_next_assignee_id_fkey
    foreign key (next_assignee_id)
    references public.profiles(id),

  constraint duty_periods_accepted_by_fkey
    foreign key (accepted_by)
    references public.profiles(id),

  constraint duty_periods_rejected_by_fkey
    foreign key (rejected_by)
    references public.profiles(id),

  constraint duty_periods_created_by_fkey
    foreign key (created_by)
    references public.profiles(id),

  constraint duty_periods_valid_week
    check (week_end >= week_start)
);

create unique index uq_duty_periods_week_start_not_cancelled
on public.duty_periods(week_start)
where status <> 'cancelled';

create trigger trg_duty_periods_updated_at
before update on public.duty_periods
for each row execute function public.set_updated_at();
```

### 13.8. task_checks

```sql
create table public.task_checks (
  id uuid primary key default gen_random_uuid(),
  duty_period_id uuid not null,
  task_id uuid not null,
  checked_by uuid not null,
  is_checked boolean not null default false,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint task_checks_duty_period_id_fkey
    foreign key (duty_period_id)
    references public.duty_periods(id)
    on delete cascade,

  constraint task_checks_task_id_fkey
    foreign key (task_id)
    references public.tasks(id),

  constraint task_checks_checked_by_fkey
    foreign key (checked_by)
    references public.profiles(id),

  constraint task_checks_unique_task
    unique (duty_period_id, task_id)
);

create trigger trg_task_checks_updated_at
before update on public.task_checks
for each row execute function public.set_updated_at();
```

### 13.9. room_acceptances

```sql
create table public.room_acceptances (
  id uuid primary key default gen_random_uuid(),
  duty_period_id uuid not null,
  room_id uuid not null,
  accepted_by uuid not null,
  status public.room_acceptance_status not null default 'pending',
  comment text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint room_acceptances_duty_period_id_fkey
    foreign key (duty_period_id)
    references public.duty_periods(id)
    on delete cascade,

  constraint room_acceptances_room_id_fkey
    foreign key (room_id)
    references public.rooms(id),

  constraint room_acceptances_accepted_by_fkey
    foreign key (accepted_by)
    references public.profiles(id),

  constraint room_acceptances_unique_room
    unique (duty_period_id, room_id)
);

create trigger trg_room_acceptances_updated_at
before update on public.room_acceptances
for each row execute function public.set_updated_at();
```

### 13.10. notifications

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  duty_period_id uuid,
  recipient_id uuid not null,
  type public.notification_type not null,
  status public.notification_status not null default 'pending',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  last_attempt_at timestamptz,
  attempt_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notifications_duty_period_id_fkey
    foreign key (duty_period_id)
    references public.duty_periods(id)
    on delete cascade,

  constraint notifications_recipient_id_fkey
    foreign key (recipient_id)
    references public.profiles(id),

  constraint notifications_unique_type
    unique (duty_period_id, recipient_id, type)
);

create trigger trg_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();
```

### 13.11. cron_locks

```sql
create table public.cron_locks (
  lock_name text primary key,
  locked_until timestamptz not null,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_cron_locks_updated_at
before update on public.cron_locks
for each row execute function public.set_updated_at();
```

### 13.12. audit_log

```sql
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now(),

  constraint audit_log_actor_id_fkey
    foreign key (actor_id)
    references public.profiles(id)
);
```

### 13.13. app_settings

```sql
create table public.app_settings (
  id boolean primary key default true,
  timezone text not null default 'Europe/Warsaw',
  saturday_reminder_hour integer not null default 8,
  sunday_reminder_hour integer not null default 8,
  reminder_window_hours integer not null default 2,
  future_schedule_weeks integer not null default 12,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint app_settings_single_row check (id = true),
  constraint app_settings_valid_saturday_hour check (saturday_reminder_hour between 0 and 23),
  constraint app_settings_valid_sunday_hour check (sunday_reminder_hour between 0 and 23),
  constraint app_settings_valid_window check (reminder_window_hours between 1 and 6)
);

insert into public.app_settings (id)
values (true)
on conflict (id) do nothing;

create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();
```

---

## 14. Indexes

```sql
create index idx_profiles_rotation_order
on public.profiles(rotation_order)
where is_active = true;

create index idx_rooms_sort_order
on public.rooms(sort_order)
where is_active = true;

create index idx_tasks_room_sort_order
on public.tasks(room_id, sort_order)
where is_active = true;

create index idx_duty_periods_status
on public.duty_periods(status);

create index idx_duty_periods_week_start
on public.duty_periods(week_start);

create index idx_duty_periods_assignee
on public.duty_periods(assignee_id);

create index idx_duty_periods_next_assignee
on public.duty_periods(next_assignee_id);

create index idx_task_checks_duty
on public.task_checks(duty_period_id);

create index idx_room_acceptances_duty
on public.room_acceptances(duty_period_id);

create index idx_notifications_pending
on public.notifications(status, scheduled_for);

create index idx_audit_log_created_at
on public.audit_log(created_at desc);
```

---

## 15. RLS policies

### 15.1. Enable RLS

```sql
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.tasks enable row level security;
alter table public.duty_periods enable row level security;
alter table public.task_checks enable row level security;
alter table public.room_acceptances enable row level security;
alter table public.notifications enable row level security;
alter table public.cron_locks enable row level security;
alter table public.audit_log enable row level security;
alter table public.app_settings enable row level security;
```

### 15.2. is_admin helper

```sql
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;
```

### 15.3. profiles policies

```sql
create policy "profiles_admin_select"
on public.profiles
for select
to authenticated
using (public.is_admin());

create policy "profiles_own_select"
on public.profiles
for select
to authenticated
using (id = auth.uid());
```

No direct browser insert/update/delete policies for profiles in MVP. Admin changes go through route handlers.

### 15.4. rooms policies

```sql
create policy "rooms_authenticated_select_active"
on public.rooms
for select
to authenticated
using (is_active = true or public.is_admin());
```

No direct browser insert/update/delete policies for rooms in MVP.

### 15.5. tasks policies

```sql
create policy "tasks_authenticated_select_active"
on public.tasks
for select
to authenticated
using (is_active = true or public.is_admin());
```

No direct browser insert/update/delete policies for tasks in MVP.

### 15.6. duty_periods policies

```sql
create policy "duty_periods_admin_select"
on public.duty_periods
for select
to authenticated
using (public.is_admin());

create policy "duty_periods_related_user_select"
on public.duty_periods
for select
to authenticated
using (
  assignee_id = auth.uid()
  or next_assignee_id = auth.uid()
  or accepted_by = auth.uid()
  or rejected_by = auth.uid()
);
```

No direct browser insert/update/delete policies for duty_periods in MVP.

### 15.7. task_checks policies

```sql
create policy "task_checks_admin_select"
on public.task_checks
for select
to authenticated
using (public.is_admin());

create policy "task_checks_related_user_select"
on public.task_checks
for select
to authenticated
using (
  exists (
    select 1
    from public.duty_periods dp
    where dp.id = task_checks.duty_period_id
      and (
        dp.assignee_id = auth.uid()
        or dp.next_assignee_id = auth.uid()
      )
  )
);
```

Task check mutations go through route handlers.

### 15.8. room_acceptances policies

```sql
create policy "room_acceptances_admin_select"
on public.room_acceptances
for select
to authenticated
using (public.is_admin());

create policy "room_acceptances_related_user_select"
on public.room_acceptances
for select
to authenticated
using (
  exists (
    select 1
    from public.duty_periods dp
    where dp.id = room_acceptances.duty_period_id
      and (
        dp.assignee_id = auth.uid()
        or dp.next_assignee_id = auth.uid()
      )
  )
);
```

Room acceptance mutations go through route handlers.

### 15.9. notifications policies

```sql
create policy "notifications_admin_select"
on public.notifications
for select
to authenticated
using (public.is_admin());

create policy "notifications_recipient_select"
on public.notifications
for select
to authenticated
using (recipient_id = auth.uid());
```

Notification mutations go through route handlers or scheduler.

### 15.10. audit_log policies

```sql
create policy "audit_log_admin_select"
on public.audit_log
for select
to authenticated
using (public.is_admin());
```

No browser insert/update/delete policies for audit_log.

### 15.11. app_settings policies

```sql
create policy "app_settings_authenticated_select"
on public.app_settings
for select
to authenticated
using (true);
```

Settings mutations go through admin route handlers.

---

## 16. Critical RPC functions

Supabase JS does not give a convenient multi-query transaction API from frontend code. Critical state transitions should be SQL RPC functions or carefully isolated server-side functions with database-side guarantees.

For MVP, at minimum create RPC functions for:

```text
try_acquire_cron_lock
release_cron_lock
```

Recommended RPC functions for stronger consistency:

```text
accept_handover_atomic
reject_handover_atomic
regenerate_future_schedule_atomic
```

### 16.1. try_acquire_cron_lock

```sql
create or replace function public.try_acquire_cron_lock(
  p_lock_name text,
  p_owner text,
  p_ttl_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_acquired boolean;
begin
  insert into public.cron_locks (lock_name, owner, locked_until)
  values (p_lock_name, p_owner, now() + make_interval(secs => p_ttl_seconds))
  on conflict (lock_name) do update
    set owner = excluded.owner,
        locked_until = excluded.locked_until,
        updated_at = now()
    where public.cron_locks.locked_until < now()
  returning true into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;
```

### 16.2. release_cron_lock

```sql
create or replace function public.release_cron_lock(
  p_lock_name text,
  p_owner text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.cron_locks
  where lock_name = p_lock_name
    and owner = p_owner;
end;
$$;
```

---

## 17. Auth and user creation

### 17.1. Login method

Recommended MVP login:

```text
Supabase magic link / invite link
```

Reason:

```text
no temporary passwords
less password management
simpler user onboarding
```

### 17.2. Admin invite user flow

Admin opens:

```text
/admin/users
```

Admin enters:

```text
full_name
email
role
rotation_order
```

Server endpoint:

```text
POST /api/admin/users/invite
```

Endpoint actions:

```text
verify current user is admin
call supabase.auth.admin.inviteUserByEmail(email)
create or update profile row
write audit_log
```

Code skeleton:

```ts
// app/api/admin/users/invite/route.ts
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";

const InviteUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.enum(["admin", "worker"]),
  rotationOrder: z.number().int().nullable(),
});

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const body = InviteUserSchema.parse(await request.json());
  const supabase = createSupabaseAdminClient();

  const { data: inviteData, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(body.email);

  if (inviteError) {
    return Response.json({ error: inviteError.message }, { status: 400 });
  }

  const userId = inviteData.user?.id;

  if (!userId) {
    return Response.json({ error: "Invite did not return user id" }, { status: 500 });
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    email: body.email,
    full_name: body.fullName,
    role: body.role,
    rotation_order: body.rotationOrder,
    is_active: true,
  });

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 400 });
  }

  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "user_invited",
    entity_type: "profile",
    entity_id: userId,
    payload: body,
  });

  return Response.json({ ok: true, userId });
}
```

---

## 18. Authorization guards

`lib/auth/guards.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,is_active")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    throw new Error("Inactive or missing profile");
  }

  return profile;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "admin") {
    throw new Error("Forbidden");
  }

  return user;
}
```

Route handlers should convert thrown errors into HTTP responses.

---

## 19. Scheduler implementation

### 19.1. Date helpers

```ts
// lib/scheduler/dates.ts
import { getDay } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export function getAppTimezone() {
  return process.env.APP_TIMEZONE ?? "Europe/Warsaw";
}

export function getLocalSchedulerState(now = new Date()) {
  const timezone = getAppTimezone();
  const zoned = toZonedTime(now, timezone);

  return {
    timezone,
    dateKey: formatInTimeZone(now, timezone, "yyyy-MM-dd"),
    weekday: getDay(zoned),
    hour: Number(formatInTimeZone(now, timezone, "H")),
  };
}

export function isReminderWindow(hour: number, targetHour: number, windowHours: number) {
  return hour >= targetHour && hour < targetHour + windowHours;
}
```

### 19.2. Cron endpoint

```ts
// app/api/cron/scheduler/route.ts
import { NextRequest } from "next/server";
import { runScheduler } from "@/lib/scheduler/scheduler";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "Missing CRON_SECRET" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduler();
  return Response.json(result);
}
```

### 19.3. Scheduler main function

```ts
// lib/scheduler/scheduler.ts
import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLocalSchedulerState, isReminderWindow } from "@/lib/scheduler/dates";
import {
  sendSaturdayCleaningReminderIfNeeded,
  sendSundayHandoverReminderIfNeeded,
} from "@/lib/scheduler/reminders";

const SATURDAY = 6;
const SUNDAY = 0;

export async function runScheduler() {
  const supabase = createSupabaseAdminClient();
  const owner = randomUUID();

  const { data: lockAcquired, error: lockError } = await supabase.rpc(
    "try_acquire_cron_lock",
    {
      p_lock_name: "main_scheduler",
      p_owner: owner,
      p_ttl_seconds: 600,
    }
  );

  if (lockError) {
    throw lockError;
  }

  if (!lockAcquired) {
    return { skipped: true, reason: "scheduler_lock_not_acquired" };
  }

  try {
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("saturday_reminder_hour,sunday_reminder_hour,reminder_window_hours")
      .eq("id", true)
      .single();

    if (settingsError) {
      throw settingsError;
    }

    const local = getLocalSchedulerState();

    const result = {
      localDate: local.dateKey,
      localHour: local.hour,
      saturdayCleaningReminder: false,
      sundayHandoverReminder: false,
    };

    if (
      local.weekday === SATURDAY &&
      isReminderWindow(local.hour, settings.saturday_reminder_hour, settings.reminder_window_hours)
    ) {
      result.saturdayCleaningReminder = await sendSaturdayCleaningReminderIfNeeded(supabase);
    }

    if (
      local.weekday === SUNDAY &&
      isReminderWindow(local.hour, settings.sunday_reminder_hour, settings.reminder_window_hours)
    ) {
      result.sundayHandoverReminder = await sendSundayHandoverReminderIfNeeded(supabase);
    }

    return result;
  } finally {
    await supabase.rpc("release_cron_lock", {
      p_lock_name: "main_scheduler",
      p_owner: owner,
    });
  }
}
```

---

## 20. Notification idempotency

Before sending any email:

```text
create notification row first
if unique conflict -> do not send
if row created -> send email
if send succeeds -> mark sent
if send fails -> mark failed
```

This prevents duplicate sends when cron runs twice.

```ts
// lib/domain/notifications.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createNotificationIfMissing(params: {
  supabase: SupabaseClient;
  dutyPeriodId: string;
  recipientId: string;
  type: string;
  scheduledFor: Date;
}) {
  const { data, error } = await params.supabase
    .from("notifications")
    .insert({
      duty_period_id: params.dutyPeriodId,
      recipient_id: params.recipientId,
      type: params.type,
      status: "pending",
      scheduled_for: params.scheduledFor.toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { created: false, id: null };
    }

    throw error;
  }

  return { created: true, id: data.id as string };
}

export async function markNotificationSent(
  supabase: SupabaseClient,
  notificationId: string
) {
  const { error } = await supabase
    .from("notifications")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", notificationId);

  if (error) {
    throw error;
  }
}

export async function markNotificationFailed(
  supabase: SupabaseClient,
  notificationId: string,
  cause: unknown
) {
  const message = cause instanceof Error ? cause.message : "Unknown email error";

  const { error } = await supabase
    .from("notifications")
    .update({
      status: "failed",
      last_attempt_at: new Date().toISOString(),
      error_message: message,
    })
    .eq("id", notificationId);

  if (error) {
    throw error;
  }
}
```

---

## 21. Email implementation

### 21.1. Resend client

```ts
// lib/email/resend.ts
import { Resend } from "resend";

export function createResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  return new Resend(process.env.RESEND_API_KEY);
}
```

### 21.2. Send email helper

```ts
// lib/email/send-email.ts
import { createResendClient } from "@/lib/email/resend";

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const resend = createResendClient();

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    throw new Error(error.message);
  }
}
```

### 21.3. Templates

```ts
// lib/email/templates.ts
export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function cleaningReminderTemplate(params: {
  name: string;
  dutyUrl: string;
}) {
  return {
    subject: "Нагадування про прибирання",
    html: `
      <p>Привіт, ${escapeHtml(params.name)}.</p>
      <p>Сьогодні нагадування про твоє чергування.</p>
      <p><a href="${params.dutyUrl}">Відкрити список робіт</a></p>
    `,
  };
}

export function handoverReminderTemplate(params: {
  name: string;
  previousName: string;
  handoverUrl: string;
}) {
  return {
    subject: "Потрібно прийняти чергування",
    html: `
      <p>Привіт, ${escapeHtml(params.name)}.</p>
      <p>Сьогодні потрібно прийняти чергування від ${escapeHtml(params.previousName)}.</p>
      <p><a href="${params.handoverUrl}">Відкрити приймання</a></p>
    `,
  };
}

export function handoverRejectedTemplate(params: {
  name: string;
  comment: string;
  dutyUrl: string;
}) {
  return {
    subject: "Чергування не прийняте",
    html: `
      <p>Привіт, ${escapeHtml(params.name)}.</p>
      <p>Твоє чергування не було прийняте.</p>
      <p><strong>Коментар:</strong> ${escapeHtml(params.comment)}</p>
      <p><a href="${params.dutyUrl}">Відкрити список робіт</a></p>
    `,
  };
}
```

---

## 22. Saturday reminder logic

```text
Find current duty with status active or ready_for_recheck.
Recipient = assignee.
Create notification if missing.
If created -> send email.
Mark sent or failed.
```

Important:

```text
Do not send Saturday reminder for accepted/cancelled/force_closed duty.
Do not send duplicate reminder for the same duty/user/type.
```

---

## 23. Sunday handover logic

```text
Find current duty with status active, cleaning_done, handover_pending, rejected, ready_for_recheck.
Resolve next_assignee if missing.
Set status to handover_pending if not already rejected/ready_for_recheck.
Create notification if missing.
Send email to next_assignee.
```

Important:

```text
Even if the assignee did not click Complete cleaning, Sunday handover can still begin.
The handover page should show a warning if cleaning was not officially completed.
```

---

## 24. Rotation rules

Only active workers participate in rotation.

```text
profiles.is_active = true
profiles.rotation_order is not null
```

Next assignee calculation:

```text
sort active workers by rotation_order ascending
find current assignee index
next index = (current index + 1) % users.length
```

If current assignee is not found:

```text
use first active user by rotation_order
log warning in audit_log
```

Function skeleton:

```ts
export async function resolveNextAssignee(supabase: any, currentAssigneeId: string) {
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,rotation_order")
    .eq("is_active", true)
    .not("rotation_order", "is", null)
    .order("rotation_order", { ascending: true });

  if (error) {
    throw error;
  }

  if (!users || users.length < 2) {
    throw new Error("At least two active users are required for rotation");
  }

  const currentIndex = users.findIndex((user: any) => user.id === currentAssigneeId);

  if (currentIndex < 0) {
    return users[0];
  }

  return users[(currentIndex + 1) % users.length];
}
```

---

## 25. Worker duty page

Route:

```text
/duty/[dutyId]
```

User can open if:

```text
user is duty.assignee_id
or user is admin
```

Page shows:

```text
week_start/week_end
assignee name
status
rooms
active tasks grouped by room
task check state
complete button
```

Complete button enabled only if:

```text
all active tasks are checked
status is active, rejected, or ready_for_recheck
current user is assignee
```

---

## 26. Task check endpoint

Route:

```text
POST /api/duty/task-check
```

Body:

```json
{
  "dutyPeriodId": "uuid",
  "taskId": "uuid",
  "isChecked": true
}
```

Validation:

```text
user is authenticated
user is active
user is duty assignee
status is active/rejected/ready_for_recheck
active task exists
```

Action:

```text
upsert task_checks by duty_period_id + task_id
write checked_by, is_checked, checked_at
```

---

## 27. Complete duty endpoint

Route:

```text
POST /api/duty/complete
```

Body:

```json
{
  "dutyPeriodId": "uuid"
}
```

Validation:

```text
user is authenticated
user is duty assignee or admin
status is active/rejected/ready_for_recheck
all active tasks are checked
```

Action:

```text
update duty_periods.status = cleaning_done
set cleaned_at = now()
write audit_log
```

---

## 28. Ready for recheck endpoint

Route:

```text
POST /api/duty/ready-for-recheck
```

Body:

```json
{
  "dutyPeriodId": "uuid"
}
```

Validation:

```text
user is duty assignee
status is rejected
all active tasks are checked
```

Action:

```text
status = ready_for_recheck
send recheck_requested email to next_assignee
write audit_log
```

---

## 29. Handover page

Route:

```text
/handover/[dutyId]
```

User can open if:

```text
user is next_assignee_id
or user is admin
```

Page shows:

```text
previous assignee
week range
status
warning if cleaning_done is missing
active rooms
room acceptance checkboxes
reject comment textarea
accept button
reject button
```

Accept button enabled if:

```text
all rooms are accepted
current user is next_assignee
status is handover_pending or ready_for_recheck
```

Reject button enabled if:

```text
at least one room is not accepted
comment length >= 5
current user is next_assignee
status is handover_pending or ready_for_recheck
```

---

## 30. Handover room-check endpoint

Route:

```text
POST /api/handover/room-check
```

Body:

```json
{
  "dutyPeriodId": "uuid",
  "roomId": "uuid",
  "isAccepted": true
}
```

Validation:

```text
user is next_assignee
status is handover_pending or ready_for_recheck
room is active
```

Action:

```text
upsert room_acceptances
status = accepted if isAccepted true
status = pending if isAccepted false
```

---

## 31. Handover accept endpoint

Route:

```text
POST /api/handover/accept
```

Body:

```json
{
  "dutyPeriodId": "uuid"
}
```

Validation:

```text
user is next_assignee
status is handover_pending or ready_for_recheck
all active rooms are accepted
```

Action:

```text
old duty status = accepted
old duty accepted_at = now()
old duty accepted_by = user.id
create new active duty for next week
new duty assignee_id = old.next_assignee_id
new duty next_assignee_id = resolveNextAssignee(old.next_assignee_id)
write audit_log
```

Paranoid requirement:

```text
This operation must be protected against double click and duplicate requests.
The unique index on week_start helps, but atomic RPC is recommended.
```

---

## 32. Handover reject endpoint

Route:

```text
POST /api/handover/reject
```

Body:

```json
{
  "dutyPeriodId": "uuid",
  "rejectedRoomIds": ["uuid"],
  "comment": "Підлога брудна"
}
```

Validation:

```text
user is next_assignee
status is handover_pending or ready_for_recheck
comment length >= 5
at least one rejected room
```

Action:

```text
upsert rejected room_acceptances
old duty status = rejected
rejected_by = user.id
rejected_at = now()
reject_comment = comment
send email to assignee
send optional email to admin
write audit_log
```

No new duty is created.

---

## 33. Admin panel

### 33.1. Admin dashboard

Route:

```text
/admin
```

Show:

```text
current active duty
current assignee
next assignee
last reject
pending failed notifications
quick links
```

### 33.2. Users

Route:

```text
/admin/users
```

Admin can:

```text
invite user
edit full_name
edit role
edit rotation_order
activate/deactivate user
```

### 33.3. Rooms

Route:

```text
/admin/rooms
```

Admin can:

```text
create room
edit room
set sort_order
deactivate room
```

### 33.4. Tasks

Route:

```text
/admin/tasks
```

Admin can:

```text
create task under room
edit task
set sort_order
deactivate task
```

### 33.5. Rotation

Route:

```text
/admin/rotation
```

MVP UI:

```text
simple numeric rotation_order inputs
save button
```

Drag-and-drop can be added later.

### 33.6. Schedule

Route:

```text
/admin/schedule
```

Admin can:

```text
view current/future/past duty periods
change current assignee
regenerate future schedule
force close duty
cancel scheduled duty
retry failed notification
```

---

## 34. Admin change-assignee endpoint

Route:

```text
POST /api/admin/change-assignee
```

Body:

```json
{
  "dutyPeriodId": "uuid",
  "newAssigneeId": "uuid",
  "reason": "Людина не може цього тижня"
}
```

Validation:

```text
admin only
reason length >= 5
new assignee is active
status is not accepted/cancelled/force_closed
```

Action:

```text
update assignee_id
recalculate next_assignee_id
keep existing checks
send email to new assignee
write audit_log
```

Important UI warning:

```text
Changing assignee keeps existing task checks.
```

---

## 35. Admin reorder-rotation endpoint

Route:

```text
POST /api/admin/reorder-rotation
```

Body:

```json
{
  "items": [
    { "userId": "uuid", "rotationOrder": 1 },
    { "userId": "uuid", "rotationOrder": 2 }
  ]
}
```

Validation:

```text
admin only
all userIds exist
rotationOrder values are unique
```

Action:

```text
update profiles.rotation_order
write audit_log
```

Do not automatically rewrite current duty.

---

## 36. Admin regenerate future schedule endpoint

Route:

```text
POST /api/admin/regenerate-schedule
```

Body:

```json
{
  "startWeek": "2026-06-22",
  "weeks": 12
}
```

Validation:

```text
admin only
startWeek must be Monday
weeks between 1 and 52
at least 2 active users with rotation_order
```

Action:

```text
delete future scheduled duties where week_start >= startWeek
never delete active/accepted/rejected/force_closed duties
generate new scheduled duties using rotation order
write audit_log
```

---

## 37. UI pages and minimal copy

### 37.1. Dashboard worker copy

```text
Моє чергування
Тут показане твоє поточне чергування і приймання, якщо воно очікується.
```

### 37.2. Duty page copy

```text
Відміть виконані роботи по кожній кімнаті.
Завершити прибирання можна тільки після виконання всіх активних робіт.
```

### 37.3. Handover page copy

```text
Перевір кімнати і підтвердь, що все прибрано.
Якщо щось не так, залиш коментар. Чергування залишиться за попередньою людиною.
```

### 37.4. Reject validation copy

```text
Щоб не прийняти чергування, вибери проблемну кімнату і напиши коментар.
```

---

## 38. Validation strategy

Use `zod` for all route handler body validation.

General rules:

```text
never trust request body
never trust dutyId from URL without loading duty from database
never trust role from client
never trust email from client if user is already authenticated
```

Example:

```ts
import { z } from "zod";

export const CompleteDutySchema = z.object({
  dutyPeriodId: z.string().uuid(),
});
```

---

## 39. Error handling

Each route handler returns:

```text
200 OK for success
400 Bad Request for validation/business rule error
401 Unauthorized for missing login
403 Forbidden for wrong role/user
404 Not Found for missing entity
409 Conflict for invalid state transition or duplicate active duty
500 Internal Server Error for unexpected failure
```

Do not leak server secrets or raw stack traces.

---

## 40. Deployment checklist

### 40.1. Supabase

```text
create Supabase project
copy project URL
copy publishable key
copy secret key or legacy service_role key
run migrations
create first admin user
insert first admin profile
verify RLS is enabled
```

### 40.2. Resend

```text
create Resend account
add sending domain or subdomain
configure DNS records
verify domain
set EMAIL_FROM
send test email
```

Recommended sender:

```text
Cleaning Duty <noreply@cleaning.example.com>
```

### 40.3. Vercel

```text
push project to GitHub
import repository into Vercel
set environment variables
deploy
verify /login
verify /admin
verify /api/cron/scheduler with CRON_SECRET
verify cron appears in Vercel dashboard
```

Manual cron test:

```bash
curl "https://your-app.vercel.app/api/cron/scheduler" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 41. Testing checklist

### 41.1. Auth tests

```text
worker can login
admin can login
inactive user cannot use system
worker cannot open /admin
admin can open /admin
```

### 41.2. Admin tests

```text
admin can invite user
admin can create room
admin can create task
admin can reorder rotation
admin can change assignee
admin can regenerate future schedule
```

### 41.3. Duty tests

```text
assignee can open duty page
non-assignee cannot edit duty page
assignee can check task
task check survives page refresh
complete button disabled until all tasks checked
complete changes status to cleaning_done
```

### 41.4. Handover accept tests

```text
next assignee can open handover page
non-next-assignee cannot accept
all rooms must be accepted
accept closes old duty
accept creates new active duty
accept double-click does not create duplicate duty
```

### 41.5. Handover reject tests

```text
reject requires comment
reject requires at least one rejected room
reject status becomes rejected
new active duty is not created
old assignee receives email
```

### 41.6. Cron tests

```text
cron endpoint rejects missing CRON_SECRET
cron endpoint accepts correct Authorization bearer
Saturday reminder sends exactly one email
Sunday reminder sends exactly one email
second cron call does not duplicate email
failed email is stored as failed notification
admin can retry failed notification
```

### 41.7. Schedule tests

```text
future schedule generation creates expected weeks
regenerate does not delete accepted history
regenerate does not delete current active duty
inactive users are skipped
rotation order is respected
```

---

## 42. Implementation order

Implement in this order:

```text
1. Create Next.js project
2. Create Supabase project
3. Add env variables
4. Create database migrations
5. Enable RLS and policies
6. Add Supabase SSR clients and proxy
7. Implement login/auth callback
8. Implement requireUser/requireAdmin guards
9. Implement admin users/rooms/tasks basic CRUD
10. Implement rotation page
11. Implement schedule page
12. Implement duty checklist page
13. Implement task-check endpoint
14. Implement complete duty endpoint
15. Implement handover page
16. Implement room-check endpoint
17. Implement accept/reject endpoints
18. Implement Resend email service
19. Implement notification idempotency
20. Implement cron lock
21. Implement scheduler endpoint
22. Implement Saturday/Sunday reminder logic
23. Implement admin change-assignee
24. Implement regenerate future schedule
25. Add audit logging everywhere
26. Deploy to Vercel
27. Test production auth/email/cron
```

---

## 43. Known edge cases and required behavior

### 43.1. Assignee did not complete cleaning before Sunday

Behavior:

```text
Sunday handover still starts.
Handover page shows warning.
Next assignee can reject with comment.
```

### 43.2. Next assignee is inactive before Sunday

Behavior:

```text
scheduler resolves next active user from rotation
updates next_assignee_id
writes audit_log warning
```

### 43.3. Only one active user exists

Behavior:

```text
scheduler does not create handover
admin dashboard shows configuration error
email is not sent
```

### 43.4. Cron runs twice

Behavior:

```text
cron lock prevents concurrent execution
notification unique key prevents duplicate email
```

### 43.5. Email sending fails

Behavior:

```text
notification status becomes failed
error_message is stored
admin can retry
```

### 43.6. Admin changes current assignee after tasks were checked

Behavior:

```text
existing task checks remain
admin sees warning before confirming
change is written to audit_log
new assignee receives email
```

### 43.7. User rejects and then changes mind

MVP behavior:

```text
after reject, only previous assignee can mark ready_for_recheck
next assignee can accept after recheck
admin can force_close if needed
```

---

## 44. Source checkpoints used for this spec

These official docs were checked during the paranoid revision:

```text
Vercel Cron Jobs:
https://vercel.com/docs/cron-jobs

Vercel Cron Jobs management, CRON_SECRET, idempotency:
https://vercel.com/docs/cron-jobs/manage-cron-jobs

Next.js Route Handlers:
https://nextjs.org/docs/app/getting-started/route-handlers

Next.js Server Functions / mutation security:
https://nextjs.org/docs/app/getting-started/mutating-data

Next.js Environment Variables:
https://nextjs.org/docs/pages/guides/environment-variables

Supabase SSR client setup:
https://supabase.com/docs/guides/auth/server-side/creating-a-client

Supabase RLS:
https://supabase.com/docs/guides/database/postgres/row-level-security

Supabase API keys and secret-key warning:
https://supabase.com/docs/guides/getting-started/api-keys

Supabase invite user by email:
https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail

Resend Domains:
https://resend.com/docs/dashboard/domains/introduction

Resend Send Email API:
https://resend.com/docs/api-reference/emails/send-email
```

---

## 45. Final MVP definition

MVP is complete only when all of these are true:

```text
admin can invite users
admin can create rooms
admin can create tasks
admin can set rotation order
admin can change current assignee
admin can regenerate future schedule
worker can see current duty
worker can check tasks
worker can complete cleaning
next worker can accept rooms
next worker can reject with comment
Saturday reminder is sent once
Sunday reminder is sent once
duplicate cron does not duplicate email
failed email is visible to admin
all critical actions write audit_log
Vercel deployment works
Supabase RLS is enabled
server secrets are not exposed to browser
```

This is the clean first iteration.
