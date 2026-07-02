-- 074: Maps Enhancement — saved map views, map annotations, geofences
create table if not exists map_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete cascade not null,
  name_en text not null,
  name_ar text,
  center_lat double precision not null default 24.75,
  center_lng double precision not null default 46.75,
  zoom integer not null default 12,
  layers jsonb default '[]'::jsonb,
  filters jsonb default '{}'::jsonb,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists map_annotations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references user_profiles(id) on delete cascade not null,
  title text,
  description text,
  geometry jsonb not null,
  annotation_type text not null check (annotation_type in ('marker','polygon','polyline','circle','text')),
  color text default '#3b82f6',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists geofences (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name_en text not null,
  name_ar text,
  geometry jsonb not null,
  color text default '#ef4444',
  notify_on_enter boolean default false,
  notify_on_exit boolean default false,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table map_views enable row level security;
alter table map_annotations enable row level security;
alter table geofences enable row level security;

create policy "Users can manage own map views"
  on map_views for all using (user_id = auth.uid());
create policy "Anyone can read public map views"
  on map_views for select using (is_public or user_id = auth.uid());

create policy "Users can manage own annotations"
  on map_annotations for all using (user_id = auth.uid());
create policy "Users can read annotations on their projects"
  on map_annotations for select using (
    exists (select 1 from user_projects up where up.project_id = map_annotations.project_id and up.user_id = auth.uid())
  );

create policy "Users can read geofences on their projects"
  on geofences for select using (
    exists (select 1 from user_projects up where up.project_id = geofences.project_id and up.user_id = auth.uid())
  );
create policy "Admins can manage geofences"
  on geofences for all using (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
  );

insert into page_registry (code, path, icon, name_en, name_ar, parent_code, section_key, section_label_en, section_label_ar, sort_order, is_enabled)
values
  ('maps', '/maps', 'Map', 'Maps', 'الخرائط', null, 'maps', 'Maps', 'الخرائط', 60, true)
on conflict (code) do nothing;
