create table if not exists public.assignee_changes (
  id uuid primary key default gen_random_uuid(),
  duty_period_id uuid not null references public.duty_periods(id) on delete cascade,
  previous_assignee_id uuid not null references public.profiles(id),
  new_assignee_id uuid not null references public.profiles(id),
  previous_next_assignee_id uuid references public.profiles(id),
  new_next_assignee_id uuid references public.profiles(id),
  reason text not null,
  created_by uuid not null references public.profiles(id),
  reverted_at timestamptz,
  reverted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_assignee_changes_duty_active
on public.assignee_changes(duty_period_id, reverted_at, created_at);

alter table public.assignee_changes enable row level security;

drop policy if exists "assignee_changes_admin_select" on public.assignee_changes;
create policy "assignee_changes_admin_select"
on public.assignee_changes
for select
to authenticated
using (public.is_admin());
