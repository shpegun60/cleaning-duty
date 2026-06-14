insert into storage.buckets (id, name, public)
values ('shared-files', 'shared-files', false)
on conflict (id) do update
set
  name = excluded.name,
  public = false;
