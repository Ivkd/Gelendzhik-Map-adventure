-- Выполни этот SQL-скрипт в Supabase: SQL Editor -> New query -> вставь всё -> Run

-- Таблица меток
create table if not exists markers (
  id text primary key,
  lat double precision not null,
  lng double precision not null,
  title text not null,
  description text,
  created_at timestamptz default now()
);

-- Таблица фотографий (ссылки на файлы в Storage)
create table if not exists marker_photos (
  id text primary key,
  marker_id text references markers(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz default now()
);

-- Включаем Row Level Security
alter table markers enable row level security;
alter table marker_photos enable row level security;

-- Разрешаем всем читать и писать (для простого личного проекта на 2 человека)
create policy "Allow all read markers" on markers for select using (true);
create policy "Allow all insert markers" on markers for insert with check (true);
create policy "Allow all delete markers" on markers for delete using (true);

create policy "Allow all read photos" on marker_photos for select using (true);
create policy "Allow all insert photos" on marker_photos for insert with check (true);
create policy "Allow all delete photos" on marker_photos for delete using (true);

-- Включаем realtime синхронизацию (чтобы изменения появлялись у всех сразу)
alter publication supabase_realtime add table markers;
alter publication supabase_realtime add table marker_photos;
