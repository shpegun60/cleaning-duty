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
