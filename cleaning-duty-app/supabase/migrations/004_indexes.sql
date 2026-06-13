create index if not exists idx_profiles_rotation_order
on public.profiles(rotation_order)
where is_active = true;

create index if not exists idx_rooms_sort_order
on public.rooms(sort_order)
where is_active = true;

create index if not exists idx_tasks_room_sort_order
on public.tasks(room_id, sort_order)
where is_active = true;

create index if not exists idx_duty_periods_status
on public.duty_periods(status);

create index if not exists idx_duty_periods_week_start
on public.duty_periods(week_start);

create index if not exists idx_duty_periods_assignee
on public.duty_periods(assignee_id);

create index if not exists idx_duty_periods_next_assignee
on public.duty_periods(next_assignee_id);

create index if not exists idx_task_checks_duty
on public.task_checks(duty_period_id);

create index if not exists idx_room_acceptances_duty
on public.room_acceptances(duty_period_id);

create index if not exists idx_notifications_pending
on public.notifications(status, scheduled_for);

create index if not exists idx_audit_log_created_at
on public.audit_log(created_at desc);
