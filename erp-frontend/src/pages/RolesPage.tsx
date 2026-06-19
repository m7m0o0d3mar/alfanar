import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { rolesApi } from '../services/api';
import type { RolePermission } from '../types';
import { Shield, Save, Database, AlertCircle } from 'lucide-react';

const DEFAULT_ROLES = [
  { role: 'admin', label: 'Administrator' },
  { role: 'developer', label: 'Developer' },
  { role: 'project_manager', label: 'Project Manager' },
  { role: 'main_contractor', label: 'Main Contractor' },
  { role: 'subcontractor', label: 'Subcontractor' },
  { role: 'engineer', label: 'Site Engineer' },
  { role: 'quality', label: 'QC Inspector' },
  { role: 'hse', label: 'HSE Officer' },
  { role: 'hr', label: 'HR Manager' },
  { role: 'finance', label: 'Finance Officer' },
  { role: 'sales', label: 'Sales' },
  { role: 'consultant', label: 'Consultant' },
  { role: 'client', label: 'Client' },
];

const MODULE_KEYS = [
  'dashboard', 'projects', 'units', 'execution', 'quality', 'hse',
  'hr', 'procurement', 'finance', 'sales', 'technical', 'documents',
  'approvals', 'settings',
];

const ADMIN_FEATURES = [
  { key: 'manage_users', label: 'manage_users' },
  { key: 'manage_roles', label: 'manage_roles' },
  { key: 'manage_settings', label: 'manage_settings' },
  { key: 'sql_editor', label: 'sql_editor' },
];

export default function RolesPage() {
  const t = useT();
  const toast = useToast();
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedError, setSeedError] = useState('');
  const [editPerms, setEditPerms] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => { loadRoles(); }, []);

  async function loadRoles() {
    setLoading(true);
    try {
      const data = await rolesApi.list();
      setRoles(data);
      const map: Record<string, Record<string, unknown>> = {};
      data.forEach((r) => { map[r.role] = { ...r.permissions }; });
      setEditPerms(map);
    } catch (err) {
      console.error('Load roles failed:', err);
    } finally { setLoading(false); }
  }

  async function seedDefaultRoles() {
    setSeedError('');
    try {
      for (const r of DEFAULT_ROLES) {
        const isAll = r.role === 'admin' || r.role === 'developer';
        const permissions: Record<string, unknown> = isAll
          ? { all_modules: true, manage_users: r.role === 'admin', manage_roles: r.role === 'admin', manage_settings: r.role === 'admin', sql_editor: r.role === 'admin' }
          : { all_modules: [], manage_users: false, manage_roles: false, manage_settings: false, sql_editor: false };
        await rolesApi.update(r.role, permissions);
      }
      await loadRoles();
    } catch (err: unknown) {
      setSeedError(err instanceof Error ? err.message : 'Failed to seed roles');
    }
  }

  function toggleModule(role: string, moduleKey: string) {
    const perms = { ...editPerms[role] };
    const modules: string[] = perms.all_modules === true
      ? MODULE_KEYS
      : Array.isArray(perms.all_modules) ? [...perms.all_modules as string[]] : [];
    const idx = modules.indexOf(moduleKey);
    if (idx >= 0) modules.splice(idx, 1);
    else modules.push(moduleKey);
    perms.all_modules = modules.length === MODULE_KEYS.length ? true : modules;
    setEditPerms({ ...editPerms, [role]: perms });
  }

  function toggleFeature(role: string, key: string) {
    const perms = { ...editPerms[role] };
    perms[key] = !perms[key];
    setEditPerms({ ...editPerms, [role]: perms });
  }

  async function saveRole(role: string) {
    try {
      await rolesApi.update(role, editPerms[role]);
      loadRoles();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.roles')}</h1>
        <p className="text-gray-500 mt-1">{t('admin.roles_desc')}</p>
      </div>

      {seedError && (
        <div className="text-sm p-3 rounded-lg flex items-center gap-2" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>
          <AlertCircle size={16} /> {seedError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400">{t('common.loading')}</div>
      ) : roles.length === 0 ? (
        <div className="card text-center py-12">
          <Database size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">{t('admin.no_roles')}</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">{t('admin.no_roles_desc')}</p>
          <button className="btn-primary" onClick={seedDefaultRoles}>
            <Database size={16} /> {t('admin.seed_roles')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {roles.map((role) => {
            const perms = editPerms[role.role] || {};
            const modules: string[] = perms.all_modules === true
              ? MODULE_KEYS
              : Array.isArray(perms.all_modules) ? perms.all_modules as string[] : [];
            const isAll = perms.all_modules === true;

            return (
              <div key={role.role} className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold capitalize flex items-center gap-2">
                    <Shield size={18} className="text-primary" />
                    {role.role.replace(/_/g, ' ')}
                  </h3>
                  <button className="btn-primary btn-sm" onClick={() => saveRole(role.role)}>
                    <Save size={14} /> {t('common.save')}
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">{t('admin.module_access')}</p>
                  <div className="flex flex-wrap gap-2">
                    {MODULE_KEYS.map((mk) => (
                      <label key={mk} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox"
                          checked={isAll || modules.includes(mk)}
                          onChange={() => toggleModule(role.role, mk)} />
                        <span className="text-sm capitalize">{mk.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">{t('admin.admin_features')}</p>
                  <div className="flex flex-wrap gap-2">
                    {ADMIN_FEATURES.map((af) => (
                      <label key={af.key} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox"
                          checked={!!perms[af.key]}
                          onChange={() => toggleFeature(role.role, af.key)} />
                        <span className="text-sm capitalize">{af.label.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
