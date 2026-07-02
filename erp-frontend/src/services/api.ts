import { supabase } from './supabase';
import type {
  Module, StatusDefinition, WorkflowDefinition, WorkflowStep,
  CustomField, KpiDefinition, Project, UserProfile, UserProject,
  SystemSettings, RolePermission, SQLResult,
  Role, Specialization, JobRole, Region, Block, PageRegistryEntry,
  ProcurementCategory, PurchaseRequisition, PRLineItem,
  SourcingEvent, SourcingBid, ProcurementContract, SupplierEvaluation,
  ProcurementBudget, CatalogItem,
  ChartOfAccount, JournalEntry, ExpenseClaim,
  CurrencyRate, TaxRate,
  Department, EmployeeContract, ShiftDefinition,
  EmployeeShift, EmployeeAdvance, EmployeeDocument,
  AppNotification, NotificationPreferences,
  FileUpload, DocumentFolder,
  AuditLogEntry, EmailTemplate, FormDefinition,
  ApprovalRequest, ApprovalStep,
  AttendanceRequest, RandomVerification, OvertimeRule,
  EVMMetric, EVMBaseline, ProjectCostItem,
  CostReport, BudgetForecast, CallLog,
  ReportTemplate, ReportTemplateSection, Report, ReportApproval, ReportApprovalStage, ReportTracking,
  UserInvitation, UserSession, UserActivityLog,
} from '../types';

// ── Auth ──
export const authApi = {
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  signUp: async (email: string, password: string, profile: Partial<UserProfile>) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;
    if (authData.user) {
      const { error } = await supabase.from('user_profiles').insert({
        id: authData.user.id,
        email,
        ...profile,
      });
      if (error) throw error;
    }
    return authData;
  },
  resetPassword: (email: string) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' }),
  updatePassword: (password: string) => supabase.auth.updateUser({ password }),
  signOut: () => supabase.auth.signOut(),
  getSession: () => supabase.auth.getSession(),
  onAuthChange: (callback: (event: string, session: unknown) => void) =>
    supabase.auth.onAuthStateChange(callback),
  getProfile: async (userId: string) => {
    const { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
    if (error) {
      console.error('getProfile error:', error);
      return null;
    }
    return data as UserProfile | null;
  },
  updateProfile: async (userId: string, updates: Partial<Pick<UserProfile, 'full_name_en' | 'full_name_ar' | 'phone' | 'default_language' | 'avatar_url'>>) => {
    const { data, error } = await supabase.from('user_profiles').update(updates).eq('id', userId).select().single();
    if (error) throw error;
    return data as UserProfile;
  },
};

// ── User Projects ──
export const userProjectsApi = {
  list: async (userId: string) => {
    const { data } = await supabase
      .from('user_projects')
      .select('*, projects!inner(*)')
      .eq('user_id', userId);
    return (data || []) as (UserProject & { projects: Project })[];
  },
};

// ── System Settings ──
export const settingsApi = {
  getAll: async () => {
    const { data, error } = await supabase.from('system_settings').select('*');
    if (error) {
      console.error('settingsApi.getAll error:', error);
      return {} as unknown as SystemSettings;
    }
    const map: Record<string, unknown> = {};
    (data || []).forEach((r: { key: string; value: unknown }) => { map[r.key] = r.value; });
    return map as unknown as SystemSettings;
  },
  get: async (key: string) => {
    const { data, error } = await supabase.from('system_settings').select('value').eq('key', key).single();
    if (error) {
      console.error('settingsApi.get error:', error);
      return undefined;
    }
    return data?.value;
  },
  set: async (key: string, value: unknown) => {
    const { error } = await supabase.from('system_settings').upsert({ key, value });
    if (error) throw error;
  },
  setMany: async (entries: Record<string, unknown>) => {
    const rows = Object.entries(entries).map(([key, value]) => ({ key, value }));
    if (rows.length === 0) return;
    const { error } = await supabase.from('system_settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
  },
};

// ── Modules ──
export const modulesApi = {
  list: async (enabledOnly = false) => {
    let q = supabase.from('modules').select('*').order('order');
    if (enabledOnly) q = q.eq('is_enabled', true);
    const { data } = await q;
    return (data || []) as Module[];
  },
  get: async (code: string) => {
    const { data, error } = await supabase.from('modules').select('*').eq('code', code).single();
    if (error) {
      console.error('modulesApi.get error:', error);
      return null;
    }
    return data as Module | null;
  },
  upsert: async (module: Partial<Module>) => {
    if (module.id) {
      const { error } = await supabase.from('modules').update(module).eq('id', module.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('modules').insert(module);
      if (error) throw error;
    }
  },
  toggle: async (id: string, is_enabled: boolean) => {
    const { error } = await supabase.from('modules').update({ is_enabled }).eq('id', id);
    if (error) throw error;
  },
};

// ── Statuses ──
export const statusesApi = {
  list: async (moduleCode: string) => {
    const { data } = await supabase
      .from('status_definitions')
      .select('*')
      .eq('module_code', moduleCode)
      .order('order');
    return (data || []) as StatusDefinition[];
  },
  upsert: async (status: Partial<StatusDefinition>) => {
    if (status.id) {
      const { error } = await supabase.from('status_definitions').update(status).eq('id', status.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('status_definitions').insert(status);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('status_definitions').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Workflows ──
export const workflowsApi = {
  list: async (moduleCode: string) => {
    const { data } = await supabase
      .from('workflow_definitions')
      .select('*')
      .eq('module_code', moduleCode);
    return (data || []) as WorkflowDefinition[];
  },
  getSteps: async (workflowId: string) => {
    const { data } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('step_order');
    return (data || []) as WorkflowStep[];
  },
  upsert: async (wf: Partial<WorkflowDefinition>) => {
    if (wf.id) {
      const { error } = await supabase.from('workflow_definitions').update(wf).eq('id', wf.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('workflow_definitions').insert(wf);
      if (error) throw error;
    }
  },
  upsertStep: async (step: Partial<WorkflowStep>) => {
    if (step.id) {
      const { error } = await supabase.from('workflow_steps').update(step).eq('id', step.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('workflow_steps').insert(step);
      if (error) throw error;
    }
  },
  removeStep: async (id: string) => {
    const { error } = await supabase.from('workflow_steps').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Custom Fields ──
export const customFieldsApi = {
  list: async (moduleCode: string) => {
    const { data } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('module_code', moduleCode)
      .order('order');
    return (data || []) as CustomField[];
  },
  upsert: async (field: Partial<CustomField>) => {
    if (field.id) {
      const { error } = await supabase.from('custom_fields').update(field).eq('id', field.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('custom_fields').insert(field);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('custom_fields').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── KPI Definitions ──
export const kpiApi = {
  list: async (moduleCode?: string) => {
    let q = supabase.from('kpi_definitions').select('*');
    if (moduleCode) q = q.eq('module_code', moduleCode);
    const { data } = await q;
    return (data || []) as KpiDefinition[];
  },
  upsert: async (kpi: Partial<KpiDefinition>) => {
    if (kpi.id) {
      const { error } = await supabase.from('kpi_definitions').update(kpi).eq('id', kpi.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('kpi_definitions').insert(kpi);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('kpi_definitions').delete().eq('id', id);
    if (error) throw error;
  },
  getLogs: async (kpiId: string, period?: string) => {
    let q = supabase.from('kpi_logs').select('*').eq('kpi_id', kpiId).order('period', { ascending: false });
    if (period) q = q.eq('period', period);
    const { data } = await q;
    return data || [];
  },
};

// ── Projects ──
export const projectsApi = {
  list: async (userId?: string) => {
    let q = supabase.from('projects').select('*').order('name_en');
    if (userId) {
      const { data: up } = await supabase.from('user_projects').select('project_id').eq('user_id', userId);
      const ids = (up || []).map((r: { project_id: string }) => r.project_id);
      if (ids.length) q = q.in('id', ids);
      else return [];
    }
    const { data } = await q;
    return (data || []) as Project[];
  },
  get: async (id: string) => {
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
    if (error) {
      console.error('projectsApi.get error:', error);
      return null;
    }
    return data as Project | null;
  },
};

// ── Admin: Users ──
export const usersApi = {
  list: async () => {
    const { data } = await supabase.from('user_profiles').select('*').order('full_name_en');
    return (data || []) as UserProfile[];
  },
  update: async (id: string, updates: Partial<UserProfile>) => {
    const { error } = await supabase.from('user_profiles').update(updates).eq('id', id);
    if (error) throw error;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('user_profiles').delete().eq('id', id);
    if (error) throw error;
  },
  invite: async (email: string, password: string, profile: Partial<UserProfile>) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;
    if (authData.user) {
      const { error } = await supabase.from('user_profiles').insert({
        id: authData.user.id,
        email,
        ...profile,
      });
      if (error) throw error;
    }
    return authData;
  },
};

// ── Admin: Roles ──
export const rolesApi = {
  list: async () => {
    const { data } = await supabase.from('roles').select('*').order('hierarchy_level', { ascending: false });
    return (data || []) as Role[];
  },
  get: async (code: string) => {
    const { data } = await supabase.from('roles').select('*').eq('code', code).single();
    return data as Role | null;
  },
  upsert: async (role: Partial<Role>) => {
    if (role.id) {
      const { error } = await supabase.from('roles').update(role).eq('id', role.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('roles').insert(role);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Admin: Role Permissions ──
export const rolePermissionsApi = {
  list: async (roleCode?: string) => {
    let q = supabase.from('role_permissions').select('*');
    if (roleCode) q = q.eq('role', roleCode);
    const { data } = await q;
    return (data || []) as RolePermission[];
  },
  upsert: async (rp: Partial<RolePermission>) => {
    if (rp.id) {
      const { error } = await supabase.from('role_permissions').update(rp).eq('id', rp.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('role_permissions').insert(rp);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('role_permissions').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Admin: Specializations ──
export const specializationsApi = {
  list: async (activeOnly = false) => {
    let q = supabase.from('specializations').select('*').order('name_en');
    if (activeOnly) q = q.eq('is_active', true);
    const { data } = await q;
    return (data || []) as Specialization[];
  },
  upsert: async (spec: Partial<Specialization>) => {
    if (spec.id) {
      const { error } = await supabase.from('specializations').update(spec).eq('id', spec.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('specializations').insert(spec);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('specializations').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Admin: Job Roles ──
export const jobRolesApi = {
  list: async (activeOnly = false) => {
    let q = supabase.from('job_roles').select('*').order('hierarchy_level', { ascending: false });
    if (activeOnly) q = q.eq('is_active', true);
    const { data } = await q;
    return (data || []) as JobRole[];
  },
  upsert: async (jr: Partial<JobRole>) => {
    if (jr.id) {
      const { error } = await supabase.from('job_roles').update(jr).eq('id', jr.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('job_roles').insert(jr);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('job_roles').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Admin: Regions ──
export const regionsApi = {
  list: async (activeOnly = false) => {
    let q = supabase.from('regions').select('*').order('name_en');
    if (activeOnly) q = q.eq('is_active', true);
    const { data } = await q;
    return (data || []) as Region[];
  },
  upsert: async (region: Partial<Region>) => {
    if (region.id) {
      const { error } = await supabase.from('regions').update(region).eq('id', region.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('regions').insert(region);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('regions').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Admin: Blocks ──
export const blocksApi = {
  list: async (regionId?: string) => {
    let q = supabase.from('blocks').select('*').order('name_en');
    if (regionId) q = q.eq('region_id', regionId);
    const { data } = await q;
    return (data || []) as Block[];
  },
  upsert: async (block: Partial<Block>) => {
    if (block.id) {
      const { error } = await supabase.from('blocks').update(block).eq('id', block.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('blocks').insert(block);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('blocks').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Admin: Page Registry ──
export const pageRegistryApi = {
  list: async (enabledOnly = false) => {
    let q = supabase.from('page_registry').select('*').order('sort_order');
    if (enabledOnly) q = q.eq('is_enabled', true);
    const { data } = await q;
    return (data || []) as PageRegistryEntry[];
  },
  upsert: async (page: Partial<PageRegistryEntry>) => {
    if (page.id) {
      const { error } = await supabase.from('page_registry').update(page).eq('id', page.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('page_registry').insert(page);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('page_registry').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Admin: Audit Log ──
export const auditLogApi = {
  list: async (options?: { entity_type?: string; limit?: number; offset?: number }) => {
    let q = supabase
      .from('audit_logs')
      .select('*, user_profiles:user_id(full_name_en, full_name_ar)')
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 200);
    if (options?.offset) q = q.range(options.offset, options.offset + (options.limit ?? 200) - 1);
    if (options?.entity_type) q = q.eq('entity_type', options.entity_type);
    const { data } = await q;
    return (data || []) as AuditLogEntry[];
  },
  getEntityTypes: async () => {
    const { data } = await supabase.rpc('exec_sql', { query: "SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type" });
    return ((data || []) as { entity_type: string }[]).map(r => r.entity_type);
  },
};

// ── Generic Data API (for DynamicPages) ──
const sanitizeTable = (name: string) => name.replace(/[^a-z_]/g, '');
const sanitizeId = (id: string) => id.replace(/[^a-fA-F0-9-]/g, '');

export const genericDataApi = {
  list: async (tableName: string, limit = 200): Promise<Record<string, unknown>[]> => {
    const t = sanitizeTable(tableName);
    const { data } = await supabase.rpc('exec_sql', { query: `SELECT * FROM ${t} ORDER BY created_at DESC NULLS LAST LIMIT ${limit}` });
    return (data || []) as Record<string, unknown>[];
  },
  getSchema: async (tableName: string): Promise<{ column_name: string; data_type: string }[]> => {
    const t = sanitizeTable(tableName);
    const { data } = await supabase.rpc('exec_sql', {
      query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${t}' ORDER BY ordinal_position`,
    });
    return (data || []) as { column_name: string; data_type: string }[];
  },
  insert: async (tableName: string, record: Record<string, unknown>): Promise<void> => {
    const t = sanitizeTable(tableName);
    const json = JSON.stringify(record);
    await supabase.rpc('exec_sql', { query: `INSERT INTO ${t} SELECT * FROM jsonb_to_recordset('${json.replace(/'/g, "''")}'::jsonb) AS x` });
  },
  update: async (tableName: string, id: string, record: Record<string, unknown>): Promise<void> => {
    const t = sanitizeTable(tableName);
    const safeId = sanitizeId(id);
    const sets = Object.entries(record).filter(([k]) => k !== 'id').map(([k, v]) => {
      const val = typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v === null ? 'NULL' : String(v);
      return `${k} = ${val}`;
    }).join(', ');
    await supabase.rpc('exec_sql', { query: `UPDATE ${t} SET ${sets} WHERE id = '${safeId}'` });
  },
  remove: async (tableName: string, id: string): Promise<void> => {
    const t = sanitizeTable(tableName);
    await supabase.rpc('exec_sql', { query: `DELETE FROM ${t} WHERE id = '${sanitizeId(id)}'` });
  },
};

// ── Admin: SQL Editor ──
export const sqlApi = {
  execute: async (query: string): Promise<SQLResult> => {
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (error) return { columns: [], rows: [], error: error.message };
    const rows = (data || []) as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, error: undefined };
  },
};

// ── Procurement Categories ──
export const procurementCategoriesApi = {
  list: async (activeOnly = false) => {
    let q = supabase.from('procurement_categories').select('*').order('code');
    if (activeOnly) q = q.eq('is_active', true);
    const { data } = await q;
    return (data || []) as ProcurementCategory[];
  },
};

// ── Purchase Requisitions ──
export const purchaseRequisitionsApi = {
  list: async () => {
    const { data } = await supabase.from('purchase_requisitions').select('*').order('created_at', { ascending: false });
    return (data || []) as PurchaseRequisition[];
  },
  get: async (id: string) => {
    const { data } = await supabase.from('purchase_requisitions').select('*').eq('id', id).single();
    return data as PurchaseRequisition | null;
  },
  upsert: async (pr: Partial<PurchaseRequisition>) => {
    if (pr.id) {
      const { error } = await supabase.from('purchase_requisitions').update(pr).eq('id', pr.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('purchase_requisitions').insert(pr);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('purchase_requisitions').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── PR Line Items ──
export const prLineItemsApi = {
  list: async (prId: string) => {
    const { data } = await supabase.from('pr_line_items').select('*').eq('pr_id', prId).order('line_no');
    return (data || []) as PRLineItem[];
  },
  upsertBatch: async (items: Partial<PRLineItem>[]) => {
    for (const item of items) {
      if (item.id) {
        const { error } = await supabase.from('pr_line_items').update(item).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pr_line_items').insert(item);
        if (error) throw error;
      }
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('pr_line_items').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Sourcing Events ──
export const sourcingEventsApi = {
  list: async () => {
    const { data } = await supabase.from('sourcing_events').select('*').order('created_at', { ascending: false });
    return (data || []) as SourcingEvent[];
  },
  upsert: async (event: Partial<SourcingEvent>) => {
    if (event.id) {
      const { error } = await supabase.from('sourcing_events').update(event).eq('id', event.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('sourcing_events').insert(event);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('sourcing_events').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Sourcing Bids ──
export const sourcingBidsApi = {
  list: async (eventId: string) => {
    const { data } = await supabase.from('sourcing_bids').select('*, suppliers!inner(name_en)').eq('event_id', eventId);
    return (data || []).map((b: Record<string, unknown>) => ({ ...b, supplier_name: (b as { suppliers: { name_en: string } }).suppliers?.name_en })) as SourcingBid[];
  },
  upsert: async (bid: Partial<SourcingBid>) => {
    if (bid.id) {
      const { error } = await supabase.from('sourcing_bids').update(bid).eq('id', bid.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('sourcing_bids').insert(bid);
      if (error) throw error;
    }
  },
};

// ── Procurement Contracts ──
export const procurementContractsApi = {
  list: async () => {
    const { data } = await supabase.from('procurement_contracts').select('*, suppliers!inner(name_en)').order('created_at', { ascending: false });
    return (data || []).map((c: Record<string, unknown>) => ({ ...c, supplier_name: (c as { suppliers: { name_en: string } }).suppliers?.name_en })) as ProcurementContract[];
  },
  upsert: async (contract: Partial<ProcurementContract>) => {
    if (contract.id) {
      const { error } = await supabase.from('procurement_contracts').update(contract).eq('id', contract.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('procurement_contracts').insert(contract);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('procurement_contracts').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Supplier Evaluations ──
export const supplierEvaluationsApi = {
  list: async (supplierId?: string) => {
    let q = supabase.from('supplier_evaluations').select('*').order('evaluation_date', { ascending: false });
    if (supplierId) q = q.eq('supplier_id', supplierId);
    const { data } = await q;
    return (data || []) as SupplierEvaluation[];
  },
  upsert: async (eval_: Partial<SupplierEvaluation>) => {
    if (eval_.id) {
      const { error } = await supabase.from('supplier_evaluations').update(eval_).eq('id', eval_.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('supplier_evaluations').insert(eval_);
      if (error) throw error;
    }
  },
};

// ── Procurement Budgets ──
export const procurementBudgetsApi = {
  list: async (fiscalYear?: number) => {
    let q = supabase.from('procurement_budgets').select('*').order('fiscal_year', { ascending: false });
    if (fiscalYear) q = q.eq('fiscal_year', fiscalYear);
    const { data } = await q;
    return (data || []) as ProcurementBudget[];
  },
};

// ── Catalog Items ──
export const catalogItemsApi = {
  list: async (supplierId?: string) => {
    let q = supabase.from('catalog_items').select('*').order('item_code');
    if (supplierId) q = q.eq('supplier_id', supplierId);
    const { data } = await q;
    return (data || []) as CatalogItem[];
  },
};

// ── Chart of Accounts ──
export const chartOfAccountsApi = {
  list: async (type?: string) => {
    let q = supabase.from('chart_of_accounts').select('*').order('account_code');
    if (type) q = q.eq('type', type);
    const { data } = await q;
    return (data || []) as ChartOfAccount[];
  },
};

// ── Journal Entries ──
export const journalEntriesApi = {
  list: async () => {
    const { data } = await supabase.from('journal_entries').select('*').order('entry_date', { ascending: false });
    return (data || []) as JournalEntry[];
  },
  upsert: async (je: Partial<JournalEntry>) => {
    if (je.id) {
      const { error } = await supabase.from('journal_entries').update(je).eq('id', je.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('journal_entries').insert(je);
      if (error) throw error;
    }
  },
};

// ── Expense Claims ──
export const expenseClaimsApi = {
  list: async () => {
    const { data } = await supabase.from('expense_claims').select('*, project:projects(project_code, name_en)').order('created_at', { ascending: false });
    return (data || []) as ExpenseClaim[];
  },
  upsert: async (claim: Partial<ExpenseClaim>) => {
    if (claim.id) {
      const { error } = await supabase.from('expense_claims').update(claim).eq('id', claim.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('expense_claims').insert(claim);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('expense_claims').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Tax Rates ──
export const taxRatesApi = {
  list: async () => {
    const { data } = await supabase.from('tax_rates').select('*').order('tax_code');
    return (data || []) as TaxRate[];
  },
};

// ── Currency Rates ──
export const currencyRatesApi = {
  latest: async (fromCurrency: string, toCurrency: string = 'SAR') => {
    const { data } = await supabase.from('currency_rates').select('*').eq('from_currency', fromCurrency).eq('to_currency', toCurrency).order('rate_date', { ascending: false }).limit(1).maybeSingle();
    return data as CurrencyRate | null;
  },
};

// ── Departments ──
export const departmentsApi = {
  list: async (activeOnly = false) => {
    let q = supabase.from('departments').select('*').order('code');
    if (activeOnly) q = q.eq('is_active', true);
    const { data } = await q;
    return (data || []) as Department[];
  },
};

// ── Employee Contracts ──
export const employeeContractsApi = {
  list: async (employeeId?: string) => {
    let q = supabase.from('employee_contracts').select('*').order('created_at', { ascending: false });
    if (employeeId) q = q.eq('employee_id', employeeId);
    const { data } = await q;
    return (data || []) as EmployeeContract[];
  },
  upsert: async (contract: Partial<EmployeeContract>) => {
    if (contract.id) {
      const { error } = await supabase.from('employee_contracts').update(contract).eq('id', contract.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('employee_contracts').insert(contract);
      if (error) throw error;
    }
  },
};

// ── Shift Definitions ──
export const shiftDefinitionsApi = {
  list: async (activeOnly = false) => {
    let q = supabase.from('shift_definitions').select('*').order('code');
    if (activeOnly) q = q.eq('is_active', true);
    const { data } = await q;
    return (data || []) as ShiftDefinition[];
  },
  get: async (id: string) => {
    const { data } = await supabase.from('shift_definitions').select('*').eq('id', id).single();
    return data as ShiftDefinition | null;
  },
  upsert: async (shift: Partial<ShiftDefinition>) => {
    if (shift.id) {
      const { error } = await supabase.from('shift_definitions').update(shift).eq('id', shift.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('shift_definitions').insert(shift);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('shift_definitions').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Employee Shifts ──
export const employeeShiftsApi = {
  list: async (employeeId?: string) => {
    let q = supabase.from('employee_shifts').select('*, shift_definitions!inner(*)').order('effective_from', { ascending: false });
    if (employeeId) q = q.eq('employee_id', employeeId);
    const { data } = await q;
    return (data || []) as (EmployeeShift & { shift_definitions: ShiftDefinition })[];
  },
  upsert: async (es: Partial<EmployeeShift>) => {
    if (es.id) {
      const { error } = await supabase.from('employee_shifts').update(es).eq('id', es.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('employee_shifts').insert(es);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('employee_shifts').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Overtime Rules ──
export const overtimeRulesApi = {
  list: async (projectId?: string) => {
    let q = supabase.from('overtime_rules').select('*').order('created_at', { ascending: false });
    if (projectId) q = q.eq('project_id', projectId);
    const { data } = await q;
    return (data || []) as OvertimeRule[];
  },
  upsert: async (rule: Partial<OvertimeRule>) => {
    if (rule.id) {
      const { error } = await supabase.from('overtime_rules').update(rule).eq('id', rule.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('overtime_rules').insert(rule);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('overtime_rules').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Attendance Requests (Leave / Permission / Escalation) ──
export const attendanceRequestsApi = {
  list: async (employeeId?: string) => {
    let q = supabase.from('attendance_requests').select('*, employees(full_name_en, employee_code)').order('created_at', { ascending: false });
    if (employeeId) q = q.eq('employee_id', employeeId);
    const { data } = await q;
    return (data || []) as AttendanceRequest[];
  },
  get: async (id: string) => {
    const { data } = await supabase.from('attendance_requests').select('*').eq('id', id).single();
    return data as AttendanceRequest | null;
  },
  create: async (req: Partial<AttendanceRequest>) => {
    const { data, error } = await supabase.from('attendance_requests').insert(req).select('id').single();
    if (error) throw error;
    return data as { id: string };
  },
  update: async (id: string, updates: Partial<AttendanceRequest>) => {
    const { error } = await supabase.from('attendance_requests').update(updates).eq('id', id);
    if (error) throw error;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('attendance_requests').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Random Verifications ──
export const randomVerificationsApi = {
  list: async (employeeId?: string, pendingOnly = false) => {
    let q = supabase.from('random_verifications').select('*').order('requested_at', { ascending: false });
    if (employeeId) q = q.eq('employee_id', employeeId);
    if (pendingOnly) q = q.eq('status', 'pending');
    const { data } = await q;
    return (data || []) as RandomVerification[];
  },
  create: async (v: Partial<RandomVerification>) => {
    const { data, error } = await supabase.from('random_verifications').insert(v).select('id').single();
    if (error) throw error;
    return data as { id: string };
  },
  update: async (id: string, updates: Partial<RandomVerification>) => {
    const { error } = await supabase.from('random_verifications').update(updates).eq('id', id);
    if (error) throw error;
  },
};

// ── Employee Advances ──
export const employeeAdvancesApi = {
  list: async (employeeId?: string) => {
    let q = supabase.from('employee_advances').select('*').order('created_at', { ascending: false });
    if (employeeId) q = q.eq('employee_id', employeeId);
    const { data } = await q;
    return (data || []) as EmployeeAdvance[];
  },
  upsert: async (advance: Partial<EmployeeAdvance>) => {
    if (advance.id) {
      const { error } = await supabase.from('employee_advances').update(advance).eq('id', advance.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('employee_advances').insert(advance);
      if (error) throw error;
    }
  },
};

// ── Employee Documents ──
export const employeeDocumentsApi = {
  list: async (employeeId: string) => {
    const { data } = await supabase.from('employee_documents').select('*').eq('employee_id', employeeId);
    return (data || []) as EmployeeDocument[];
  },
  upsert: async (doc: Partial<EmployeeDocument>) => {
    if (doc.id) {
      const { error } = await supabase.from('employee_documents').update(doc).eq('id', doc.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('employee_documents').insert(doc);
      if (error) throw error;
    }
  },
};

// ── Notifications ──
export const notificationsApi = {
  list: async (unreadOnly = false) => {
    let q = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (unreadOnly) q = q.eq('is_read', false);
    const { data } = await q;
    return (data || []) as AppNotification[];
  },
  markRead: async (id: string) => {
    const { error } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
  markAllRead: async () => {
    const { error } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('is_read', false);
    if (error) throw error;
  },
  getUnreadCount: async () => {
    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false);
    return count || 0;
  },
};

// ── Notification Preferences ──
export const notificationPreferencesApi = {
  get: async (userId: string) => {
    const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', userId).single();
    return data as NotificationPreferences | null;
  },
  upsert: async (prefs: Partial<NotificationPreferences>) => {
    const { error } = await supabase.from('notification_preferences').upsert(prefs);
    if (error) throw error;
  },
};

// ── File Uploads ──
export const fileUploadsApi = {
  list: async (folder?: string) => {
    let q = supabase.from('file_uploads').select('*').order('created_at', { ascending: false });
    if (folder) q = q.eq('folder', folder);
    const { data } = await q;
    return (data || []) as FileUpload[];
  },
  upload: async (file: File, path: string, reference?: { type: string; id: string }) => {
    const bucket = 'documents';
    const filePath = `${path}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
    const { error: dbError } = await supabase.from('file_uploads').insert({
      bucket_name: bucket,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: filePath,
      public_url: publicUrl,
      reference_type: reference?.type,
      reference_id: reference?.id,
    });
    if (dbError) throw dbError;
    return publicUrl;
  },
  remove: async (id: string) => {
    const { data: file } = await supabase.from('file_uploads').select('storage_path').eq('id', id).single();
    if (file) await supabase.storage.from('documents').remove([file.storage_path]);
    const { error } = await supabase.from('file_uploads').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Document Folders ──
export const documentFoldersApi = {
  list: async () => {
    const { data } = await supabase.from('document_folders').select('*').order('sort_order');
    return (data || []) as DocumentFolder[];
  },
};

// ── Form Definitions ──
export const formDefinitionsApi = {
  list: async () => {
    const { data } = await supabase.from('form_definitions').select('*').order('code');
    return (data || []) as FormDefinition[];
  },
  get: async (id: string) => {
    const { data } = await supabase.from('form_definitions').select('*').eq('id', id).single();
    return data as FormDefinition | null;
  },
  getByCode: async (code: string) => {
    const { data } = await supabase.from('form_definitions').select('*').eq('code', code).single();
    return data as FormDefinition | null;
  },
  upsert: async (def: Partial<FormDefinition> & { code: string }) => {
    const { error } = await supabase.from('form_definitions').upsert(def, { onConflict: 'code' });
    if (error) throw error;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('form_definitions').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Email Templates ──
export const emailTemplatesApi = {
  list: async () => {
    const { data } = await supabase.from('email_templates').select('*').order('code');
    return (data || []) as EmailTemplate[];
  },
  get: async (id: string) => {
    const { data } = await supabase.from('email_templates').select('*').eq('id', id).single();
    return data as EmailTemplate | null;
  },
  upsert: async (template: Partial<EmailTemplate> & { code: string }) => {
    const { error } = await supabase.from('email_templates').upsert(template, { onConflict: 'code' });
    if (error) throw error;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('email_templates').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Saved Reports ──
export const savedReportsApi = {
  list: async () => {
    const { data } = await supabase.from('saved_reports').select('*').order('created_at', { ascending: false });
    return data || [];
  },
  create: async (report: { report_type: string; name_en: string; name_ar: string; config_json: object; created_by?: string }) => {
    const { data, error } = await supabase.from('saved_reports').insert(report).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id: string, report: Partial<{ report_type: string; name_en: string; name_ar: string; config_json: object }>) => {
    const { error } = await supabase.from('saved_reports').update(report).eq('id', id);
    if (error) throw error;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('saved_reports').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Flow Diagrams ──
export interface FlowDiagram {
  id?: string;
  name_en: string;
  name_ar?: string;
  description_en?: string;
  description_ar?: string;
  config: { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] };
  is_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const flowDiagramsApi = {
  list: async (enabledOnly = false) => {
    let q = supabase.from('flow_diagrams').select('*').order('updated_at', { ascending: false });
    if (enabledOnly) q = q.eq('is_enabled', true);
    const { data } = await q;
    return (data || []) as FlowDiagram[];
  },
  get: async (id: string) => {
    const { data } = await supabase.from('flow_diagrams').select('*').eq('id', id).single();
    return data as FlowDiagram | null;
  },
  upsert: async (diagram: Partial<FlowDiagram>) => {
    if (diagram.id) {
      const { error } = await supabase.from('flow_diagrams').update({ ...diagram, updated_at: new Date().toISOString() }).eq('id', diagram.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('flow_diagrams').insert(diagram);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('flow_diagrams').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Project Geometries (Site Plans) ──
export interface ProjectGeometry {
  id: string;
  project_id: string;
  parent_id?: string;
  geometry_type: 'site' | 'building' | 'floor' | 'unit' | 'zone' | 'amenity';
  label_en?: string;
  label_ar?: string;
  geometry: Record<string, unknown>;
  properties: Record<string, unknown>;
  level: number;
  sort_order: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export const projectGeometriesApi = {
  list: async (projectId: string) => {
    const { data } = await supabase.from('project_geometries').select('*').eq('project_id', projectId).order('level').order('sort_order');
    return (data || []) as ProjectGeometry[];
  },
  upsert: async (geom: Partial<ProjectGeometry>) => {
    if (geom.id) {
      const { error } = await supabase.from('project_geometries').update({ ...geom, updated_at: new Date().toISOString() }).eq('id', geom.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('project_geometries').insert(geom);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('project_geometries').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Translation Overrides ──
export interface TranslationOverride {
  id?: string;
  user_id: string;
  locale: 'en' | 'ar';
  key: string;
  value: string;
  updated_at?: string;
}

export const translationApi = {
  list: async (userId: string, locale: 'en' | 'ar') => {
    const { data } = await supabase
      .from('translation_overrides')
      .select('key, value')
      .eq('user_id', userId)
      .eq('locale', locale);
    const map: Record<string, string> = {};
    if (data) data.forEach(r => { map[r.key] = r.value; });
    return map;
  },
  upsert: async (userId: string, locale: 'en' | 'ar', key: string, value: string) => {
    const { error } = await supabase
      .from('translation_overrides')
      .upsert({ user_id: userId, locale, key, value }, { onConflict: 'user_id,locale,key' });
    if (error) throw error;
  },
  remove: async (userId: string, locale: 'en' | 'ar', key: string) => {
    const { error } = await supabase
      .from('translation_overrides')
      .delete()
      .eq('user_id', userId)
      .eq('locale', locale)
      .eq('key', key);
    if (error) throw error;
  },
  upsertMany: async (userId: string, locale: 'en' | 'ar', overrides: Record<string, string>) => {
    const rows = Object.entries(overrides).map(([key, value]) => ({ user_id: userId, locale, key, value }));
    if (rows.length === 0) return;
    const { error } = await supabase.from('translation_overrides').upsert(rows, { onConflict: 'user_id,locale,key' });
    if (error) throw error;
  },
};

// ── Conversations (Chat) ──
export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'channel';
  name_en?: string;
  name_ar?: string;
  topic?: string;
  created_by?: string;
  is_archived: boolean;
  project_id?: string;
  created_at: string;
  updated_at: string;
  project?: { id: string; project_code: string; name_en: string };
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'member' | 'admin' | 'owner';
  last_read_at?: string;
  is_muted: boolean;
  joined_at: string;
  user?: UserProfile;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id?: string;
  content?: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  reply_to_id?: string;
  is_edited: boolean;
  is_pinned: boolean;
  is_read: boolean;
  read_at?: string;
  delivered_at?: string;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
  sender?: UserProfile;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export const conversationsApi = {
  list: async () => {
    const { data } = await supabase.from('conversations').select('*, conversation_participants!inner(*), project:projects(id, project_code, name_en)').order('updated_at', { ascending: false });
    return (data || []) as Conversation[];
  },
  get: async (id: string) => {
    const { data } = await supabase.from('conversations').select('*, conversation_participants(*)').eq('id', id).single();
    return data as Conversation | null;
  },
  createDirect: async (userId: string) => {
    const { data: convo, error } = await supabase.rpc('create_direct_conversation', { other_user_id: userId });
    if (error) throw error;
    return convo as Conversation;
  },
  createGroup: async (name: string, userIds: string[]) => {
    const { data: convo, error } = await supabase.from('conversations').insert({ type: 'group', name_en: name }).select().single();
    if (error) throw error;
    const participants = userIds.map((uid) => ({ conversation_id: convo.id, user_id: uid, role: uid === userIds[0] ? 'owner' as const : 'member' as const }));
    const { error: pErr } = await supabase.from('conversation_participants').insert(participants);
    if (pErr) throw pErr;
    return convo as Conversation;
  },
  archive: async (id: string) => {
    const { error } = await supabase.from('conversations').update({ is_archived: true }).eq('id', id);
    if (error) throw error;
  },
};

export const messagesApi = {
  list: async (conversationId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:user_profiles!sender_id(id, full_name_en, full_name_ar, avatar_url)')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    return (data || []) as ChatMessage[];
  },
  send: async (conversationId: string, content: string, messageType: string = 'text', fileUrl?: string) => {
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId, content, message_type: messageType, file_url: fileUrl,
    });
    if (error) throw error;
  },
  sendFile: async (conversationId: string, file: File) => {
    const path = `chat/${conversationId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
    if (upErr) throw upErr;
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId, message_type: 'file', file_url: publicUrl, file_name: file.name, file_size: file.size, mime_type: file.type,
    });
    if (error) throw error;
  },
  addReaction: async (messageId: string, emoji: string) => {
    const { error } = await supabase.from('message_reactions').insert({ message_id: messageId, emoji });
    if (error) throw error;
  },
  removeReaction: async (messageId: string, emoji: string) => {
    const { error } = await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('emoji', emoji);
    if (error) throw error;
  },
};

// ── Meetings ──
export interface MeetingRoom {
  id: string;
  title_en: string;
  title_ar?: string;
  description?: string;
  meet_link?: string;
  provider: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  is_recurring: boolean;
  recurring_pattern?: Record<string, unknown>;
  status: string;
  created_by?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
  participants?: MeetingParticipant[];
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  status: string;
  responded_at?: string;
  user?: UserProfile;
}

export const meetingsApi = {
  list: async () => {
    const { data } = await supabase.from('meeting_rooms').select('*, meeting_participants(*), project:projects(id, project_code, name_en)').order('start_time', { ascending: false });
    return (data || []) as MeetingRoom[];
  },
  get: async (id: string) => {
    const { data } = await supabase.from('meeting_rooms').select('*, meeting_participants(*, user:user_profiles(id, full_name_en, full_name_ar, avatar_url))').eq('id', id).single();
    return data as MeetingRoom | null;
  },
  create: async (meeting: Partial<MeetingRoom>) => {
    const { data, error } = await supabase.from('meeting_rooms').insert(meeting).select().single();
    if (error) throw error;
    return data as MeetingRoom;
  },
  update: async (id: string, updates: Partial<MeetingRoom>) => {
    const { error } = await supabase.from('meeting_rooms').update(updates).eq('id', id);
    if (error) throw error;
  },
  respond: async (meetingId: string, status: string) => {
    const { error } = await supabase.from('meeting_participants').upsert({ meeting_id: meetingId, status, responded_at: new Date().toISOString() }, { onConflict: 'meeting_id,user_id' });
    if (error) throw error;
  },
};

// ── Email ──
export interface EmailAccount {
  id: string;
  user_id: string;
  email_address: string;
  display_name?: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_pass: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  use_tls: boolean;
  is_primary: boolean;
  is_verified: boolean;
  last_sync_at?: string;
  created_at: string;
}

export interface EmailMessage {
  id: string;
  account_id: string;
  folder: string;
  from_address: string;
  from_name?: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject?: string;
  body_html?: string;
  body_text?: string;
  attachments: Record<string, unknown>[];
  is_read: boolean;
  is_starred: boolean;
  is_flagged: boolean;
  received_at?: string;
  created_at: string;
}

const EMAIL_WORKER_URL = import.meta.env.VITE_EMAIL_WORKER_URL || '';

export const emailApi = {
  listAccounts: async () => {
    const { data } = await supabase.from('email_accounts').select('*');
    return (data || []) as EmailAccount[];
  },
  addAccount: async (account: Partial<EmailAccount>) => {
    const { error } = await supabase.from('email_accounts').insert(account);
    if (error) throw error;
  },
  removeAccount: async (id: string) => {
    const { error } = await supabase.from('email_accounts').delete().eq('id', id);
    if (error) throw error;
  },
  listMessages: async (accountId: string, folder = 'inbox') => {
    const { data } = await supabase.from('email_messages').select('*').eq('account_id', accountId).eq('folder', folder).order('received_at', { ascending: false });
    return (data || []) as EmailMessage[];
  },
  sendMessage: async (msg: Partial<EmailMessage>) => {
    const { data: inserted, error } = await supabase.from('email_messages').insert({ ...msg, status: 'pending' }).select('id').single<{ id: string }>();
    if (error) throw error;
    const m = msg as any;
    if (inserted && EMAIL_WORKER_URL && m.account_id && (m.to_addresses?.length || m.to_emails?.length)) {
      try {
        await fetch(`${EMAIL_WORKER_URL}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: inserted.id,
            accountId: m.account_id,
            to: m.to_addresses || m.to_emails || [],
            cc: m.cc_addresses || m.cc_emails || [],
            bcc: m.bcc_addresses || m.bcc_emails || [],
            subject: msg.subject,
            html: msg.body_html,
            text: msg.body_text,
          }),
        });
      } catch { /* worker may not be deployed */ }
    }
  },
  updateMessage: async (id: string, updates: Partial<EmailMessage>) => {
    const { error } = await supabase.from('email_messages').update(updates).eq('id', id);
    if (error) throw error;
  },
  moveMessage: async (id: string, folder: string) => {
    const { error } = await supabase.from('email_messages').update({ folder }).eq('id', id);
    if (error) throw error;
  },
};

// ── WhatsApp Accounts ──
export interface UserWhatsAppAccount {
  id: string;
  user_id: string;
  phone_number: string;
  phone_country_code: string;
  display_name?: string;
  is_primary: boolean;
  is_connected: boolean;
  connection_data: Record<string, unknown>;
  connected_at?: string;
  created_at: string;
}

// ── Approvals ──
export const approvalsApi = {
  list: async () => {
    const { data } = await supabase
      .from('approval_requests')
      .select('*')
      .order('created_at', { ascending: false });
    return (data || []) as ApprovalRequest[];
  },
  getById: async (id: string) => {
    const { data } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', id)
      .single();
    return data as ApprovalRequest | null;
  },
  create: async (req: Partial<ApprovalRequest>) => {
    const { data, error } = await supabase
      .from('approval_requests')
      .insert(req)
      .select('id')
      .single();
    if (error) throw error;
    return data as { id: string };
  },
  update: async (id: string, updates: Partial<ApprovalRequest>) => {
    const { error } = await supabase
      .from('approval_requests')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },
  listSteps: async (requestId: string) => {
    const { data } = await supabase
      .from('approval_steps')
      .select('*')
      .eq('approval_request_id', requestId)
      .order('step_order');
    return (data || []) as ApprovalStep[];
  },
  createStep: async (step: Partial<ApprovalStep>) => {
    const { error } = await supabase
      .from('approval_steps')
      .insert(step);
    if (error) throw error;
  },
  updateStep: async (id: string, updates: Partial<ApprovalStep>) => {
    const { error } = await supabase
      .from('approval_steps')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },
};

export const whatsappAccountsApi = {
  list: async () => {
    const { data } = await supabase.from('user_whatsapp_accounts').select('*');
    return (data || []) as UserWhatsAppAccount[];
  },
  upsert: async (account: Partial<UserWhatsAppAccount>) => {
    const { error } = await supabase.from('user_whatsapp_accounts').upsert(account);
    if (error) throw error;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('user_whatsapp_accounts').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── EVM Metrics ──
export const evmApi = {
  list: async (projectId: string) => {
    const { data } = await supabase.from('evm_metrics').select('*').eq('project_id', projectId).order('period', { ascending: true });
    return (data || []) as EVMMetric[];
  },
  upsert: async (metric: Partial<EVMMetric>) => {
    const { error } = await supabase.from('evm_metrics').upsert(metric, { onConflict: 'project_id,period' });
    if (error) throw error;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('evm_metrics').delete().eq('id', id);
    if (error) throw error;
  },
  calculate: async (projectId: string) => {
    const { data } = await supabase.rpc('calculate_evm', { p_project_id: projectId });
    return (data || []) as { period_date: string; planned_value: number; earned_value: number; actual_cost: number; cumulative_pv: number; cumulative_ev: number; cumulative_ac: number; spi: number; cpi: number }[];
  },
};

// ── EVM Baselines ──
export const evmBaselinesApi = {
  list: async (projectId: string) => {
    const { data } = await supabase.from('evm_baselines').select('*').eq('project_id', projectId).order('baseline_date', { ascending: false });
    return (data || []) as EVMBaseline[];
  },
  create: async (bl: Partial<EVMBaseline>) => {
    const { data, error } = await supabase.from('evm_baselines').insert(bl).select().single();
    if (error) throw error;
    return data as EVMBaseline;
  },
};

// ── Project Cost Items ──
export const projectCostItemsApi = {
  list: async (projectId: string) => {
    const { data } = await supabase.from('project_cost_items').select('*').eq('project_id', projectId).order('category');
    return (data || []) as ProjectCostItem[];
  },
  upsert: async (item: Partial<ProjectCostItem>) => {
    if (item.id) {
      const { error } = await supabase.from('project_cost_items').update(item).eq('id', item.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('project_cost_items').insert(item);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('project_cost_items').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Cost Reports ──
export const costReportsApi = {
  list: async (projectId: string) => {
    const { data } = await supabase.from('cost_reports').select('*').eq('project_id', projectId).order('report_date', { ascending: false });
    return (data || []) as CostReport[];
  },
  create: async (report: Partial<CostReport>) => {
    const { data, error } = await supabase.from('cost_reports').insert(report).select().single();
    if (error) throw error;
    return data as CostReport;
  },
};

// ── Budget Forecasts ──
export const budgetForecastsApi = {
  list: async (projectId: string) => {
    const { data } = await supabase.from('budget_forecasts').select('*').eq('project_id', projectId).order('forecast_date', { ascending: false });
    return (data || []) as BudgetForecast[];
  },
  create: async (f: Partial<BudgetForecast>) => {
    const { data, error } = await supabase.from('budget_forecasts').insert(f).select().single();
    if (error) throw error;
    return data as BudgetForecast;
  },
};

// ── Budget Items ──
export const budgetItemsApi = {
  list: async (projectId: string) => {
    const { data } = await supabase.from('project_budget_items').select('*').eq('project_id', projectId).order('category');
    return (data || []);
  },
  upsert: async (item: Record<string, unknown>) => {
    if (item.id) {
      const { error } = await supabase.from('project_budget_items').update(item).eq('id', item.id as string);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('project_budget_items').insert(item);
      if (error) throw error;
    }
  },
};

// ── Call Logs ──
export const callLogsApi = {
  list: async (userId?: string) => {
    let q = supabase.from('call_logs').select('*, caller:caller_id(id, full_name_en), callee:callee_id(id, full_name_en)').order('created_at', { ascending: false });
    if (userId) q = q.or(`caller_id.eq.${userId},callee_id.eq.${userId}`);
    const { data } = await q;
    return (data || []) as CallLog[];
  },
  create: async (log: Partial<CallLog>) => {
    const { data, error } = await supabase.from('call_logs').insert(log).select().single();
    if (error) throw error;
    return data as CallLog;
  },
  update: async (id: string, updates: Partial<CallLog>) => {
    const { error } = await supabase.from('call_logs').update(updates).eq('id', id);
    if (error) throw error;
  },
};

// ── Report Templates ──
export const reportTemplatesApi = {
  list: async (includeSections = false) => {
    const q = supabase.from('report_templates').select('*').order('name_en');
    const { data } = await q;
    const templates = (data || []) as ReportTemplate[];
    if (includeSections && templates.length) {
      const { data: sections } = await supabase.from('report_template_sections').select('*').in('template_id', templates.map(t => t.id)).order('sort_order');
      const { data: stages } = await supabase.from('report_approval_stages').select('*').in('template_id', templates.map(t => t.id)).order('stage_order');
      return templates.map(t => ({
        ...t,
        sections: (sections || []).filter(s => s.template_id === t.id) as ReportTemplateSection[],
        approval_stages: (stages || []).filter(s => s.template_id === t.id) as ReportApprovalStage[],
      })) as ReportTemplate[];
    }
    return templates;
  },
  get: async (id: string) => {
    const { data } = await supabase.from('report_templates').select('*').eq('id', id).single();
    if (!data) throw new Error('Template not found');
    const [sections, stages] = await Promise.all([
      supabase.from('report_template_sections').select('*').eq('template_id', id).order('sort_order'),
      supabase.from('report_approval_stages').select('*').eq('template_id', id).order('stage_order'),
    ]);
    return { ...data, sections: (sections.data || []), approval_stages: (stages.data || []) } as ReportTemplate;
  },
  upsert: async (template: Partial<ReportTemplate>) => {
    if (template.id) {
      const { error } = await supabase.from('report_templates').update(template).eq('id', template.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('report_templates').insert(template);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('report_templates').delete().eq('id', id);
    if (error) throw error;
  },
  upsertSection: async (section: Partial<ReportTemplateSection>) => {
    if (section.id) {
      const { error } = await supabase.from('report_template_sections').update(section).eq('id', section.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('report_template_sections').insert(section);
      if (error) throw error;
    }
  },
  removeSection: async (id: string) => {
    const { error } = await supabase.from('report_template_sections').delete().eq('id', id);
    if (error) throw error;
  },
  upsertStage: async (stage: Partial<ReportApprovalStage>) => {
    if (stage.id) {
      const { error } = await supabase.from('report_approval_stages').update(stage).eq('id', stage.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('report_approval_stages').insert(stage);
      if (error) throw error;
    }
  },
  removeStage: async (id: string) => {
    const { error } = await supabase.from('report_approval_stages').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Reports ──
export const reportsApi = {
  list: async (filters?: { project_id?: string; status?: string; template_id?: string; report_date_from?: string; report_date_to?: string; department_id?: string; unit_id?: string; block_id?: string; activity_id?: string; created_by?: string; assigned_to?: string }) => {
    let q = supabase.from('reports').select('*, template:template_id(name_en, name_ar, icon), project:project_id(name_en, project_code), department:department_id(name_en), unit:unit_id(name_en)').order('report_date', { ascending: false });
    if (filters?.project_id) q = q.eq('project_id', filters.project_id);
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.template_id) q = q.eq('template_id', filters.template_id);
    if (filters?.report_date_from) q = q.gte('report_date', filters.report_date_from);
    if (filters?.report_date_to) q = q.lte('report_date', filters.report_date_to);
    if (filters?.department_id) q = q.eq('department_id', filters.department_id);
    if (filters?.unit_id) q = q.eq('unit_id', filters.unit_id);
    if (filters?.block_id) q = q.eq('block_id', filters.block_id);
    if (filters?.activity_id) q = q.eq('activity_id', filters.activity_id);
    if (filters?.created_by) q = q.eq('created_by', filters.created_by);
    if (filters?.assigned_to) q = q.eq('assigned_to', filters.assigned_to);
    q = q.limit(200);
    const { data } = await q;
    return (data || []) as any[];
  },
  create: async (report: Partial<Report>) => {
    const { data, error } = await supabase.from('reports').insert(report).select().single();
    if (error) throw error;
    return data as Report;
  },
  update: async (id: string, updates: Partial<Report>) => {
    const { data, error } = await supabase.from('reports').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as Report;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from('reports').delete().eq('id', id);
    if (error) throw error;
  },
  submit: async (id: string) => {
    const { data, error } = await supabase.from('reports').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    await supabase.from('report_tracking').insert({ report_id: id, event_type: 'submitted', event_data: {}, created_by: data.created_by });
    return data as Report;
  },
  approve: async (id: string, stageId: string, approverId: string, comments?: string) => {
    await supabase.from('report_approvals').upsert({ report_id: id, stage_id: stageId, approver_id: approverId, status: 'approved', signed_at: new Date().toISOString(), comments });
    await supabase.from('report_tracking').insert({ report_id: id, event_type: 'stage_approved', event_data: { stage_id: stageId, approver_id: approverId }, created_by: approverId });
    const { data: stages } = await supabase.from('report_approval_stages').select('id').eq('template_id', (await supabase.from('reports').select('template_id').eq('id', id).single()).data?.template_id);
    const { data: approvals } = await supabase.from('report_approvals').select('stage_id').eq('report_id', id).eq('status', 'approved');
    if (stages && approvals && stages.length === approvals.length) {
      await supabase.from('reports').update({ status: 'approved', is_locked: true, updated_at: new Date().toISOString() }).eq('id', id);
      await supabase.from('report_tracking').insert({ report_id: id, event_type: 'approved', event_data: {}, created_by: approverId });
    } else {
      await supabase.from('reports').update({ status: 'under_review', updated_at: new Date().toISOString() }).eq('id', id);
    }
  },
  reject: async (id: string, stageId: string, approverId: string, comments: string) => {
    await supabase.from('report_approvals').upsert({ report_id: id, stage_id: stageId, approver_id: approverId, status: 'rejected', signed_at: new Date().toISOString(), comments });
    await supabase.from('report_tracking').insert({ report_id: id, event_type: 'stage_rejected', event_data: { stage_id: stageId, approver_id: approverId, comments }, created_by: approverId });
    await supabase.from('reports').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id);
  },
  getTracking: async (reportId: string) => {
    const { data } = await supabase.from('report_tracking').select('*').eq('report_id', reportId).order('created_at', { ascending: false });
    return (data || []) as ReportTracking[];
  },
  getPendingApprovals: async (userId: string) => {
    const { data } = await supabase.from('report_approvals').select('*, report:report_id(id, title_en, report_date, status, template_id), stage:stage_id(stage_name_en, stage_order)').eq('approver_id', userId).eq('status', 'pending').order('created_at', { ascending: false });
    return (data || []) as any[];
  },
};

// ── User Management Extensions ──
export const userInvitationsApi = {
  list: async () => {
    const { data } = await supabase.from('user_invitations').select('*').order('created_at', { ascending: false });
    return (data || []) as UserInvitation[];
  },
  create: async (inv: Partial<UserInvitation>) => {
    const { data, error } = await supabase.from('user_invitations').insert(inv).select().single();
    if (error) throw error;
    return data as UserInvitation;
  },
  cancel: async (id: string) => {
    const { error } = await supabase.from('user_invitations').update({ status: 'cancelled' }).eq('id', id);
    if (error) throw error;
  },
  resend: async (id: string) => {
    const { error } = await supabase.from('user_invitations').update({ expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), status: 'pending' }).eq('id', id);
    if (error) throw error;
  },
};

export const userSessionsApi = {
  list: async (userId: string) => {
    const { data } = await supabase.from('user_sessions').select('*').eq('user_id', userId).order('last_active_at', { ascending: false }).limit(50);
    return (data || []) as UserSession[];
  },
  terminate: async (sessionId: string) => {
    const { error } = await supabase.from('user_sessions').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', sessionId);
    if (error) throw error;
  },
};

export const userActivityLogApi = {
  list: async (userId: string) => {
    const { data } = await supabase.from('user_activity_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200);
    return (data || []) as UserActivityLog[];
  },
  log: async (userId: string, actionType: string, entityType?: string, entityId?: string, metadata?: Record<string, unknown>) => {
    const { error } = await supabase.from('user_activity_log').insert({ user_id: userId, action_type: actionType, entity_type: entityType, entity_id: entityId, metadata });
    if (error) throw error;
  },
};

export const inviteUser = async (email: string, password: string, profile: Partial<UserProfile>) => {
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) throw authError;
  if (authData.user) {
    const { error } = await supabase.from('user_profiles').insert({ id: authData.user.id, email, ...profile });
    if (error) throw error;
  }
  return authData;
};
