grant usage on schema public to anon, authenticated, service_role;

grant select on table
  public.profiles,
  public.rooms,
  public.tasks,
  public.duty_periods,
  public.task_checks,
  public.room_acceptances,
  public.notifications,
  public.admin_visible_user_passwords,
  public.cron_locks,
  public.audit_log,
  public.app_settings,
  public.assignee_changes,
  public.shared_files
to authenticated, service_role;

grant insert, update, delete on table
  public.profiles,
  public.rooms,
  public.tasks,
  public.duty_periods,
  public.task_checks,
  public.room_acceptances,
  public.notifications,
  public.admin_visible_user_passwords,
  public.cron_locks,
  public.audit_log,
  public.app_settings,
  public.assignee_changes,
  public.shared_files
to service_role;

grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.try_acquire_cron_lock(text, text, integer) to service_role;
grant execute on function public.release_cron_lock(text, text) to service_role;
