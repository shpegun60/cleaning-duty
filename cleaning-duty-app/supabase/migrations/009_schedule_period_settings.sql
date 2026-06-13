alter table public.app_settings
  add column if not exists rotation_period_unit text not null default 'week',
  add column if not exists rotation_period_count integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_settings_valid_rotation_period_unit'
      and conrelid = 'public.app_settings'::regclass
  ) then
    alter table public.app_settings
      add constraint app_settings_valid_rotation_period_unit
      check (rotation_period_unit in ('day', 'week', 'month'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_settings_valid_rotation_period_count'
      and conrelid = 'public.app_settings'::regclass
  ) then
    alter table public.app_settings
      add constraint app_settings_valid_rotation_period_count
      check (rotation_period_count between 1 and 12);
  end if;
end;
$$;
