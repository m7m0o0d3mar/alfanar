-- 078: Email Client — email accounts, messages, folders, attachments

create table if not exists email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete cascade not null,
  email_address text not null,
  display_name text,
  imap_host text not null,
  imap_port integer not null default 993,
  imap_user text not null,
  imap_pass text not null,
  smtp_host text not null,
  smtp_port integer not null default 465,
  smtp_user text not null,
  smtp_pass text not null,
  use_tls boolean default true,
  is_primary boolean default false,
  is_verified boolean default false,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, email_address)
);

create table if not exists email_messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references email_accounts(id) on delete cascade not null,
  folder text not null check (folder in ('inbox','sent','drafts','trash','spam','archive')) default 'inbox',
  from_address text not null,
  from_name text,
  to_addresses text[] not null default '{}',
  cc_addresses text[] default '{}',
  bcc_addresses text[] default '{}',
  subject text,
  body_html text,
  body_text text,
  attachments jsonb default '[]'::jsonb,
  is_read boolean default false,
  is_starred boolean default false,
  is_flagged boolean default false,
  message_id text,
  in_reply_to text,
  message_references text[] default '{}',
  received_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists email_folders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references email_accounts(id) on delete cascade not null,
  name text not null,
  path text not null,
  parent_id uuid references email_folders(id) on delete cascade,
  sort_order integer default 0,
  unique (account_id, path)
);

create table if not exists email_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete cascade not null,
  email_address text not null,
  display_name text,
  contact_id uuid references crm_contacts(id) on delete set null,
  frequency integer default 0,
  last_contacted_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, email_address)
);

create index if not exists idx_email_messages_account_folder on email_messages(account_id, folder);
create index if not exists idx_email_messages_from on email_messages(from_address);

alter table email_accounts enable row level security;
alter table email_messages enable row level security;
alter table email_folders enable row level security;
alter table email_contacts enable row level security;

create policy "Users can manage own email accounts"
  on email_accounts for all using (user_id = auth.uid());

create policy "Users can read own email messages"
  on email_messages for select using (
    exists (select 1 from email_accounts ea where ea.id = email_messages.account_id and ea.user_id = auth.uid())
  );
create policy "Users can insert own email messages"
  on email_messages for insert with check (
    exists (select 1 from email_accounts ea where ea.id = email_messages.account_id and ea.user_id = auth.uid())
  );
create policy "Users can update own email messages"
  on email_messages for update using (
    exists (select 1 from email_accounts ea where ea.id = email_messages.account_id and ea.user_id = auth.uid())
  );
create policy "Users can delete own email messages"
  on email_messages for delete using (
    exists (select 1 from email_accounts ea where ea.id = email_messages.account_id and ea.user_id = auth.uid())
  );

create policy "Users can manage own email folders"
  on email_folders for all using (
    exists (select 1 from email_accounts ea where ea.id = email_folders.account_id and ea.user_id = auth.uid())
  );

create policy "Users can manage own email contacts"
  on email_contacts for all using (user_id = auth.uid());

insert into page_registry (code, path, icon, name_en, name_ar, parent_code, section_key, section_label_en, section_label_ar, sort_order, is_enabled)
values
  ('email', '/email', 'Mail', 'Email', 'البريد الإلكتروني', null, 'communication', 'Communication', 'التواصل', 57, true),
  ('email_compose', '/email/compose', 'Edit', 'Compose', 'كتابة', 'email', 'communication', 'Communication', 'التواصل', 2, true)
on conflict (code) do nothing;
