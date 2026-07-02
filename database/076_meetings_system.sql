-- 076: Meetings System — video calls, scheduling, recordings, calendar

create table if not exists meeting_rooms (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_ar text,
  description text,
  meet_link text,
  provider text not null check (provider in ('jitsi','zoom','teams','other')) default 'jitsi',
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer,
  is_recurring boolean default false,
  recurring_pattern jsonb,
  status text not null check (status in ('scheduled','ongoing','completed','cancelled')) default 'scheduled',
  created_by uuid references user_profiles(id) on delete set null,
  project_id uuid references projects(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meeting_rooms(id) on delete cascade not null,
  user_id uuid references user_profiles(id) on delete cascade not null,
  status text not null check (status in ('pending','accepted','declined','maybe')) default 'pending',
  responded_at timestamptz,
  joined_at timestamptz,
  left_at timestamptz,
  unique (meeting_id, user_id)
);

create table if not exists meeting_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meeting_rooms(id) on delete cascade not null,
  title text not null,
  duration_minutes integer,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists meeting_recordings (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meeting_rooms(id) on delete cascade not null,
  file_url text not null,
  duration_seconds integer,
  file_size integer,
  created_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table meeting_rooms enable row level security;
alter table meeting_participants enable row level security;
alter table meeting_agenda_items enable row level security;
alter table meeting_recordings enable row level security;

create policy "Users can read meetings they participate in"
  on meeting_rooms for select using (
    created_by = auth.uid() or
    exists (select 1 from meeting_participants mp where mp.meeting_id = meeting_rooms.id and mp.user_id = auth.uid())
  );
create policy "Users can create meetings"
  on meeting_rooms for insert with check (auth.uid() is not null);
create policy "Creators can update meetings"
  on meeting_rooms for update using (created_by = auth.uid());

create policy "Users can read participants"
  on meeting_participants for select using (
    exists (select 1 from meeting_rooms mr where mr.id = meeting_participants.meeting_id and (mr.created_by = auth.uid() or
      exists (select 1 from meeting_participants mp2 where mp2.meeting_id = meeting_participants.meeting_id and mp2.user_id = auth.uid())))
  );
create policy "Users can manage own participation"
  on meeting_participants for insert with check (user_id = auth.uid());
create policy "Users can update own participation"
  on meeting_participants for update using (user_id = auth.uid());

create policy "Agenda readable by participants"
  on meeting_agenda_items for select using (
    exists (select 1 from meeting_rooms mr where mr.id = meeting_agenda_items.meeting_id and
      (mr.created_by = auth.uid() or exists (select 1 from meeting_participants mp where mp.meeting_id = meeting_agenda_items.meeting_id and mp.user_id = auth.uid())))
  );
create policy "Creators can manage agenda"
  on meeting_agenda_items for all using (
    exists (select 1 from meeting_rooms mr where mr.id = meeting_agenda_items.meeting_id and mr.created_by = auth.uid())
  );

create policy "Recordings readable by participants"
  on meeting_recordings for select using (
    exists (select 1 from meeting_rooms mr join meeting_participants mp on mp.meeting_id = mr.id
      where mr.id = meeting_recordings.meeting_id and mp.user_id = auth.uid())
  );

insert into page_registry (code, path, icon, name_en, name_ar, parent_code, section_key, section_label_en, section_label_ar, sort_order, is_enabled)
values
  ('meetings', '/meetings', 'Video', 'Meetings', 'الاجتماعات', null, 'communication', 'Communication', 'التواصل', 56, true),
  ('meetings_recordings', '/meetings/recordings', 'VideoOff', 'Recordings', 'التسجيلات', 'meetings', 'communication', 'Communication', 'التواصل', 2, true)
on conflict (code) do nothing;
