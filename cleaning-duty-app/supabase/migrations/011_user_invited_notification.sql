alter type public.notification_type add value if not exists 'user_invited';

create table if not exists public.admin_visible_user_passwords (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  password_plaintext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_admin_visible_user_passwords_updated_at
on public.admin_visible_user_passwords;
create trigger trg_admin_visible_user_passwords_updated_at
before update on public.admin_visible_user_passwords
for each row execute function public.set_updated_at();

alter table public.admin_visible_user_passwords enable row level security;

drop policy if exists "admin_visible_user_passwords_admin_select"
on public.admin_visible_user_passwords;
create policy "admin_visible_user_passwords_admin_select"
on public.admin_visible_user_passwords
for select
to authenticated
using (public.is_admin());
