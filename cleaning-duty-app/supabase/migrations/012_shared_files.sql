create table if not exists public.shared_files (
  id uuid primary key default gen_random_uuid(),
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  storage_path text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.shared_files enable row level security;

drop policy if exists "shared_files_authenticated_select" on public.shared_files;
create policy "shared_files_authenticated_select"
on public.shared_files
for select
to authenticated
using (true);
