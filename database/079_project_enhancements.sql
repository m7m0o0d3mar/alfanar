-- Project Management Enhancements
-- Adds: milestones, budget tracking, auto-progress trigger, project<>chat integration

-- 1. Project Milestones
create table if not exists project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  milestone_code text not null,
  name_en text not null,
  name_ar text,
  description text,
  target_date date,
  achieved_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','achieved','missed')),
  weight_percent decimal(5,2) default 0,
  created_at timestamptz default now(),
  unique(project_id, milestone_code)
);

alter table project_milestones enable row level security;

create policy "Users can view project milestones"
  on project_milestones for select
  using (exists (select 1 from user_projects up where up.project_id = project_milestones.project_id and up.user_id = auth.uid()));

create policy "Admins can manage project milestones"
  on project_milestones for all
  using (exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin'))
  with check (exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin'));

-- 2. Project Budget Items
create table if not exists project_budget_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  category text not null check (category in ('labor','materials','equipment','subcontractor','consultant','permits','admin','contingency','other')),
  name_en text not null,
  name_ar text,
  planned_amount decimal(20,2) not null default 0,
  actual_amount decimal(20,2) default 0,
  currency text default 'SAR',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table project_budget_items enable row level security;

create policy "Users can view project budget items"
  on project_budget_items for select
  using (exists (select 1 from user_projects up where up.project_id = project_budget_items.project_id and up.user_id = auth.uid()));

create policy "Admins can manage project budget items"
  on project_budget_items for all
  using (exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin'))
  with check (exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin'));

-- 3. Auto-calculate project progress from work_tasks
create or replace function auto_calc_project_progress()
returns trigger as $$
declare
  avg_progress decimal(5,2);
begin
  select coalesce(avg(progress), 0) into avg_progress
  from work_tasks
  where project_id = new.project_id and status != 'cancelled';
  update projects set progress_percent = round(avg_progress, 2)
  where id = new.project_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_calc_project_progress on work_tasks;
create trigger trg_auto_calc_project_progress
  after insert or update of progress, status
  on work_tasks
  for each row
  execute function auto_calc_project_progress();

-- 4. Insert page_registry entries for new pages
do $$
begin
  if not exists (select 1 from public.page_registry where code = 'project_milestones') then
    insert into public.page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order)
    values ('project_milestones', '/projects/milestones', 'Flag', 'Milestones', 'مراحل المشروع', 'projects', 'Projects', 'المشاريع', 14);
  end if;
  if not exists (select 1 from public.page_registry where code = 'project_budget') then
    insert into public.page_registry (code, path, icon, icon_path, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order)
    values ('project_budget', '/projects/budget', 'PieChart', null, 'Budget', 'الميزانية', 'projects', 'Projects', 'المشاريع', 15);
  end if;
end;
$$;

-- 5. Link conversations to projects
alter table conversations add column if not exists project_id uuid references projects(id) on delete set null;
create index if not exists idx_conversations_project on conversations(project_id);
