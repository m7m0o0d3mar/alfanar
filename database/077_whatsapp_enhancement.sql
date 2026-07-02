-- 077: WhatsApp Enhancement — personal account linking, CRM integration, templates

create table if not exists user_whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete cascade not null,
  phone_number text not null,
  phone_country_code text default '+966',
  display_name text,
  is_primary boolean default false,
  is_connected boolean default false,
  connection_data jsonb default '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, phone_number)
);

create table if not exists whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text check (category in ('marketing','utility','authentication','otp')) default 'utility',
  body_en text not null,
  body_ar text,
  variables text[] default '{}',
  status text default 'approved' check (status in ('approved','pending','rejected')),
  created_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists crm_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references user_whatsapp_accounts(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete cascade,
  deal_id uuid references crm_deals(id) on delete cascade,
  company_id uuid references crm_companies(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  from_number text not null,
  to_number text not null,
  message_body text,
  media_url text,
  template_id uuid references whatsapp_templates(id) on delete set null,
  status text not null default 'sent' check (status in ('pending','sent','delivered','read','failed')),
  created_at timestamptz default now()
);

alter table user_whatsapp_accounts enable row level security;
alter table whatsapp_templates enable row level security;
alter table crm_whatsapp_messages enable row level security;

create policy "Users can manage own WhatsApp accounts"
  on user_whatsapp_accounts for all using (user_id = auth.uid());

create policy "Anyone can read templates"
  on whatsapp_templates for select using (true);
create policy "Admins can manage templates"
  on whatsapp_templates for all using (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
  );

create policy "Users can read CRM WhatsApp messages"
  on crm_whatsapp_messages for select using (
    exists (select 1 from user_whatsapp_accounts uwa where uwa.id = crm_whatsapp_messages.account_id and uwa.user_id = auth.uid())
  );
create policy "Users can create CRM WhatsApp messages"
  on crm_whatsapp_messages for insert with check (
    exists (select 1 from user_whatsapp_accounts uwa where uwa.id = crm_whatsapp_messages.account_id and uwa.user_id = auth.uid())
  );

insert into page_registry (code, path, icon, name_en, name_ar, parent_code, section_key, section_label_en, section_label_ar, sort_order, is_enabled)
values
  ('whatsapp_accounts', '/whatsapp/accounts', 'Smartphone', 'WhatsApp Accounts', 'حسابات واتساب', 'whatsapp', 'communication', 'Communication', 'التواصل', 1, true),
  ('whatsapp_templates', '/whatsapp/templates', 'FileText', 'Templates', 'القوالب', 'whatsapp', 'communication', 'Communication', 'التواصل', 2, true)
on conflict (code) do nothing;
