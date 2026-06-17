import { supabase } from './supabase';
import type {
  Module, StatusDefinition, WorkflowDefinition, WorkflowStep,
  CustomField, KpiDefinition, Project, UserProfile, UserProject,
  SystemSettings, RolePermission, SQLResult,
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
    const { data } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
    return data as UserProfile | null;
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
    const { data } = await supabase.from('system_settings').select('*');
    const map: Record<string, unknown> = {};
    (data || []).forEach((r: { key: string; value: unknown }) => { map[r.key] = r.value; });
    return map as unknown as SystemSettings;
  },
  get: async (key: string) => {
    const { data } = await supabase.from('system_settings').select('value').eq('key', key).single();
    return data?.value;
  },
  set: async (key: string, value: unknown) => {
    const { error } = await supabase.from('system_settings').upsert({ key, value });
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
    const { data } = await supabase.from('modules').select('*').eq('code', code).single();
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
    const { data } = await supabase.from('projects').select('*').eq('id', id).single();
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

// ── Admin: Role Permissions ──
export const rolesApi = {
  list: async () => {
    const { data } = await supabase.from('role_permissions').select('*');
    return (data || []) as RolePermission[];
  },
  update: async (role: string, permissions: Record<string, unknown>) => {
    const { error } = await supabase
      .from('role_permissions')
      .upsert({ role, permissions });
    if (error) throw error;
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
