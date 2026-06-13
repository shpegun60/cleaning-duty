create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.user_role not null default 'worker',
  rotation_order integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_rooms_updated_at on public.rooms;
create trigger trg_rooms_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create table if not exists public.duty_periods (
  id uuid primary key default gen_random_uuid(),
  assignee_id uuid not null references public.profiles(id),
  next_assignee_id uuid references public.profiles(id),
  week_start date not null,
  week_end date not null,
  status public.duty_status not null default 'scheduled',
  cleaned_at timestamptz,
  handover_started_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  rejected_at timestamptz,
  rejected_by uuid references public.profiles(id),
  reject_comment text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint duty_periods_valid_week check (week_end >= week_start)
);

create unique index if not exists uq_duty_periods_week_start_not_cancelled
on public.duty_periods(week_start)
where status <> 'cancelled';

drop trigger if exists trg_duty_periods_updated_at on public.duty_periods;
create trigger trg_duty_periods_updated_at
before update on public.duty_periods
for each row execute function public.set_updated_at();

create table if not exists public.task_checks (
  id uuid primary key default gen_random_uuid(),
  duty_period_id uuid not null references public.duty_periods(id) on delete cascade,
  task_id uuid not null references public.tasks(id),
  checked_by uuid not null references public.profiles(id),
  is_checked boolean not null default false,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_checks_unique_task unique (duty_period_id, task_id)
);

drop trigger if exists trg_task_checks_updated_at on public.task_checks;
create trigger trg_task_checks_updated_at
before update on public.task_checks
for each row execute function public.set_updated_at();

create table if not exists public.room_acceptances (
  id uuid primary key default gen_random_uuid(),
  duty_period_id uuid not null references public.duty_periods(id) on delete cascade,
  room_id uuid not null references public.rooms(id),
  accepted_by uuid not null references public.profiles(id),
  status public.room_acceptance_status not null default 'pending',
  comment text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_acceptances_unique_room unique (duty_period_id, room_id)
);

drop trigger if exists trg_room_acceptances_updated_at on public.room_acceptances;
create trigger trg_room_acceptances_updated_at
before update on public.room_acceptances
for each row execute function public.set_updated_at();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  duty_period_id uuid references public.duty_periods(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id),
  type public.notification_type not null,
  status public.notification_status not null default 'pending',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  last_attempt_at timestamptz,
  attempt_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_unique_type unique (duty_period_id, recipient_id, type)
);

drop trigger if exists trg_notifications_updated_at on public.notifications;
create trigger trg_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

create table if not exists public.cron_locks (
  lock_name text primary key,
  locked_until timestamptz not null,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_cron_locks_updated_at on public.cron_locks;
create trigger trg_cron_locks_updated_at
before update on public.cron_locks
for each row execute function public.set_updated_at();

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
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

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();
