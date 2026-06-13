insert into public.rooms (name, description, sort_order)
values
  ('Кухня', 'Поверхні, підлога, сміття', 10),
  ('Ванна', 'Сантехніка, дзеркало, підлога', 20),
  ('Коридор', 'Підлога і спільні поверхні', 30)
on conflict do nothing;
