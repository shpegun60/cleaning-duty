alter type public.duty_status add value if not exists 'grace';
alter type public.duty_status add value if not exists 'overdue';

alter table public.app_settings
  add column if not exists grace_period_days integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_settings_valid_grace_period_days'
      and conrelid = 'public.app_settings'::regclass
  ) then
    alter table public.app_settings
      add constraint app_settings_valid_grace_period_days
      check (grace_period_days between 0 and 14);
  end if;
end;
$$;
