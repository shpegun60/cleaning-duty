update public.profiles
set rotation_order = null
where role <> 'worker' or rotation_order < 1;

with ranked_workers as (
  select
    id,
    row_number() over (
      partition by rotation_order
      order by created_at asc, full_name asc, id asc
    ) as duplicate_rank
  from public.profiles
  where role = 'worker'
    and is_active = true
    and rotation_order is not null
)
update public.profiles as profiles
set rotation_order = null
from ranked_workers
where profiles.id = ranked_workers.id
  and ranked_workers.duplicate_rank > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_rotation_order_positive'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_rotation_order_positive
      check (rotation_order is null or rotation_order >= 1);
  end if;
end;
$$;

create unique index if not exists uq_profiles_active_worker_rotation_order
on public.profiles(rotation_order)
where role = 'worker'
  and is_active = true
  and rotation_order is not null;
