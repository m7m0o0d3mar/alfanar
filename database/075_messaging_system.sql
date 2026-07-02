-- 075: Internal Messaging System — conversations, messages, file sharing, real-time chat

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct','group','channel')) default 'direct',
  name_en text,
  name_ar text,
  topic text,
  created_by uuid references user_profiles(id) on delete set null,
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  user_id uuid references user_profiles(id) on delete cascade not null,
  role text not null check (role in ('member','admin','owner')) default 'member',
  last_read_at timestamptz,
  is_muted boolean default false,
  joined_at timestamptz default now(),
  unique (conversation_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references user_profiles(id) on delete set null,
  content text,
  message_type text not null check (message_type in ('text','image','file','system')) default 'text',
  file_url text,
  file_name text,
  file_size integer,
  mime_type text,
  reply_to_id uuid references messages(id) on delete set null,
  is_edited boolean default false,
  is_pinned boolean default false,
  created_at timestamptz default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete cascade not null,
  user_id uuid references user_profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique (message_id, user_id, emoji)
);

alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;
alter table message_reactions enable row level security;

create policy "Participants can read conversations"
  on conversations for select using (
    exists (select 1 from conversation_participants cp where cp.conversation_id = conversations.id and cp.user_id = auth.uid())
  );
create policy "Users can create conversations"
  on conversations for insert with check (auth.uid() is not null);
create policy "Participants can update conversation"
  on conversations for update using (
    exists (select 1 from conversation_participants cp where cp.conversation_id = conversations.id and cp.user_id = auth.uid() and cp.role in ('admin','owner'))
  );

create policy "Users can read own participations"
  on conversation_participants for select using (user_id = auth.uid());
create policy "Users can join conversations"
  on conversation_participants for insert with check (user_id = auth.uid());
create policy "Users can leave conversations"
  on conversation_participants for delete using (user_id = auth.uid());

create policy "Participants can read messages"
  on messages for select using (
    exists (select 1 from conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid())
  );
create policy "Users can send messages"
  on messages for insert with check (
    sender_id = auth.uid() and
    exists (select 1 from conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid())
  );
create policy "Users can update own messages"
  on messages for update using (sender_id = auth.uid());
create policy "Users can soft-delete own messages"
  on messages for delete using (sender_id = auth.uid());

create policy "Users can manage own reactions"
  on message_reactions for all using (user_id = auth.uid());
create policy "Participants can read reactions"
  on message_reactions for select using (
    exists (select 1 from messages m join conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_reactions.message_id and cp.user_id = auth.uid())
  );

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table message_reactions;

insert into page_registry (code, path, icon, name_en, name_ar, parent_code, section_key, section_label_en, section_label_ar, sort_order, is_enabled)
values
  ('chat', '/chat', 'MessageCircle', 'Chat', 'الدردشة', null, 'communication', 'Communication', 'التواصل', 55, true),
  ('chat_channels', '/chat/channels', 'Hash', 'Channels', 'القنوات', 'chat', 'communication', 'Communication', 'التواصل', 1, true)
on conflict (code) do nothing;
