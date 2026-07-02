-- 080: Link expense_claims to projects
alter table expense_claims add column if not exists project_id uuid references projects(id) on delete set null;
create index if not exists idx_expense_claims_project on expense_claims(project_id);
