import { useState, useEffect, useCallback, useRef } from 'react';
import { modulesApi, statusesApi, workflowsApi, customFieldsApi, kpiApi } from '../services/api';
import { supabase } from '../services/supabase';
import type { Module, StatusDefinition, CustomField, Project } from '../types';
import { useAuth } from '../context/AuthContext';

const LOAD_TIMEOUT = 15000;

function useLoad<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setError('Request timed out. Check your connection.');
        setLoading(false);
      }
    }, LOAD_TIMEOUT);
    try {
      const result = await fetcher();
      clearTimeout(timeoutRef.current);
      if (mountedRef.current) setData(result);
    } catch (err: unknown) {
      clearTimeout(timeoutRef.current);
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      clearTimeout(timeoutRef.current);
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; clearTimeout(timeoutRef.current); };
  }, [load]);
  return { data, loading, error, reload: load };
}

export function useModules(enabledOnly = false) {
  const { data, loading, error, reload } = useLoad(
    () => modulesApi.list(enabledOnly), [enabledOnly]
  );
  return { data: data || [] as Module[], loading, error, reload };
}

export function useStatuses(moduleCode: string) {
  const { data, loading, error, reload } = useLoad(
    () => moduleCode ? statusesApi.list(moduleCode) : Promise.resolve([] as StatusDefinition[]),
    [moduleCode]
  );
  return { data: (data || []) as StatusDefinition[], loading, error, reload };
}

export function useCustomFields(moduleCode: string) {
  const { data, loading, error, reload } = useLoad(
    () => moduleCode ? customFieldsApi.list(moduleCode) : Promise.resolve([] as CustomField[]),
    [moduleCode]
  );
  return { data: (data || []) as CustomField[], loading, error, reload };
}

export function useTable(table: string, query?: Record<string, unknown>) {
  const { data, loading, error, reload } = useLoad(
    async () => {
      let q = supabase.from(table).select('*');
      if (query) {
        Object.entries(query).forEach(([k, v]) => { q = q.eq(k, v as string); });
      }
      const { data: d, error: e } = await q;
      if (e) throw new Error(e.message);
      return d || [];
    },
    [table, JSON.stringify(query)]
  );
  return { data: data || [], loading, error, reload };
}

export function useUserProjects() {
  const { user, effectiveRole } = useAuth();
  const { data, loading, error, reload } = useLoad(
    async () => {
      if (!user) return [];

      // Admin: return ALL projects (no user_projects filter needed)
      if (effectiveRole === 'admin') {
        const { data: allProjects, error: e } = await supabase
          .from('projects')
          .select('*');
        if (e) throw new Error(e.message);
        return (allProjects || []).map((p) => ({
          ...p,
          project_role: 'admin',
        })) as (Project & { project_role: string })[];
      }

      // Normal user: filter by user_projects
      const { data: raw, error: e } = await supabase
        .from('user_projects')
        .select('project_role, projects(*)')
        .eq('user_id', user.id);
      if (e) throw new Error(e.message);
      return (raw || []).map((r: Record<string, unknown>) => ({
        ...(r.projects as Project),
        project_role: r.project_role as string,
      })) as (Project & { project_role: string })[];
    },
    [user?.id, effectiveRole]
  );
  return { projects: data || [], loading, error, reload };
}
