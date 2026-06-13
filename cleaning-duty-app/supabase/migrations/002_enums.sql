do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'worker');
  end if;

  if not exists (select 1 from pg_type where typname = 'duty_status') then
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
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'saturday_cleaning_reminder',
      'sunday_handover_reminder',
      'handover_rejected',
      'handover_accepted',
      'recheck_requested',
      'admin_changed_assignee'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_status') then
    create type public.notification_status as enum (
      'pending',
      'sent',
      'failed',
      'skipped'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'room_acceptance_status') then
    create type public.room_acceptance_status as enum (
      'pending',
      'accepted',
      'rejected'
    );
  end if;
end $$;
