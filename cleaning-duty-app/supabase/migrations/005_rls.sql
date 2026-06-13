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

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select"
on public.profiles
for select
to authenticated
using (public.is_admin());

drop policy if exists "profiles_own_select" on public.profiles;
create policy "profiles_own_select"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "rooms_authenticated_select_active" on public.rooms;
create policy "rooms_authenticated_select_active"
on public.rooms
for select
to authenticated
using (is_active = true or public.is_admin());

drop policy if exists "tasks_authenticated_select_active" on public.tasks;
create policy "tasks_authenticated_select_active"
on public.tasks
for select
to authenticated
using (is_active = true or public.is_admin());

drop policy if exists "duty_periods_admin_select" on public.duty_periods;
create policy "duty_periods_admin_select"
on public.duty_periods
for select
to authenticated
using (public.is_admin());

drop policy if exists "duty_periods_related_user_select" on public.duty_periods;
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

drop policy if exists "task_checks_admin_select" on public.task_checks;
create policy "task_checks_admin_select"
on public.task_checks
for select
to authenticated
using (public.is_admin());

drop policy if exists "task_checks_related_user_select" on public.task_checks;
create policy "task_checks_related_user_select"
on public.task_checks
for select
to authenticated
using (
  exists (
    select 1
    from public.duty_periods dp
    where dp.id = task_checks.duty_period_id
      and (dp.assignee_id = auth.uid() or dp.next_assignee_id = auth.uid())
  )
);

drop policy if exists "room_acceptances_admin_select" on public.room_acceptances;
create policy "room_acceptances_admin_select"
on public.room_acceptances
for select
to authenticated
using (public.is_admin());

drop policy if exists "room_acceptances_related_user_select" on public.room_acceptances;
create policy "room_acceptances_related_user_select"
on public.room_acceptances
for select
to authenticated
using (
  exists (
    select 1
    from public.duty_periods dp
    where dp.id = room_acceptances.duty_period_id
      and (dp.assignee_id = auth.uid() or dp.next_assignee_id = auth.uid())
  )
);

drop policy if exists "notifications_admin_select" on public.notifications;
create policy "notifications_admin_select"
on public.notifications
for select
to authenticated
using (public.is_admin());

drop policy if exists "notifications_recipient_select" on public.notifications;
create policy "notifications_recipient_select"
on public.notifications
for select
to authenticated
using (recipient_id = auth.uid());

drop policy if exists "audit_log_admin_select" on public.audit_log;
create policy "audit_log_admin_select"
on public.audit_log
for select
to authenticated
using (public.is_admin());

drop policy if exists "app_settings_authenticated_select" on public.app_settings;
create policy "app_settings_authenticated_select"
on public.app_settings
for select
to authenticated
using (true);
