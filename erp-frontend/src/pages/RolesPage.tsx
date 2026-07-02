import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { rolesApi, rolePermissionsApi, specializationsApi, jobRolesApi } from '../services/api';
import type { Role, RolePermission, Specialization, JobRole, PermissionScope, UserRole } from '../types';
import { Shield, Plus, Save, Edit3, Trash2, X, Check, Briefcase, UserCog, Search, Eye, EyeOff } from 'lucide-react';

type Tab = 'roles' | 'permissions' | 'specializations' | 'job_roles';

const TAB_KEYS: Record<Tab, string> = {
  roles: 'admin.roles_tab',
  permissions: 'admin.permissions_tab',
  specializations: 'admin.specializations_tab',
  job_roles: 'admin.job_roles_tab',
};

const MODULE_GROUPS: { group: string; modules: { key: string; label: string }[] }[] = [
  {
    group: 'Core', modules: [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'projects', label: 'Projects' },
      { key: 'units', label: 'Units' },
    ],
  },
  {
    group: 'Operations', modules: [
      { key: 'execution', label: 'Execution' },
      { key: 'quality', label: 'Quality' },
      { key: 'hse', label: 'HSE' },
      { key: 'technical', label: 'Technical Office' },
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'maps', label: 'Maps' },
    ],
  },
  {
    group: 'Business', modules: [
      { key: 'procurement', label: 'Procurement' },
      { key: 'finance', label: 'Finance' },
      { key: 'sales', label: 'Sales' },
      { key: 'crm', label: 'CRM' },
    ],
  },
  {
    group: 'HR & Admin', modules: [
      { key: 'hr', label: 'HR' },
      { key: 'attendance', label: 'Attendance' },
      { key: 'timelines', label: 'Timelines' },
      { key: 'resources', label: 'Resources' },
    ],
  },
  {
    group: 'System', modules: [
      { key: 'documents', label: 'Documents' },
      { key: 'approvals', label: 'Approvals' },
      { key: 'settings', label: 'Settings' },
    ],
  },
];

const ADMIN_FEATURES = [
  { key: 'manage_users', label: 'Manage Users' },
  { key: 'manage_roles', label: 'Manage Roles' },
  { key: 'manage_settings', label: 'Manage Settings' },
  { key: 'sql_editor', label: 'SQL Editor' },
];

const SCOPE_LABELS: Record<PermissionScope, string> = {
  global: 'Global (all projects)',
  project: 'Per Project',
  block: 'Per Block',
  unit: 'Per Unit',
};

export default function RolesPage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>('roles');

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('admin.roles')}</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.roles_desc')}</p>
      </div>

      <div className="tabs overflow-x-auto flex-nowrap">
        {(Object.keys(TAB_KEYS) as Tab[]).map((key) => {
          const iconMap: Record<string, typeof Shield> = { roles: Shield, permissions: Check, specializations: Briefcase, job_roles: UserCog };
          const Icon = iconMap[key];
          return (
            <button key={key} className={`tab whitespace-nowrap ${activeTab === key ? 'tab-active' : ''}`} onClick={() => setActiveTab(key)}>
              <Icon size={14} /> {t(TAB_KEYS[key])}
            </button>
          );
        })}
      </div>

      <div className="card">
        {activeTab === 'roles' && <RolesTab />}
        {activeTab === 'permissions' && <PermissionsMatrix />}
        {activeTab === 'specializations' && <SpecializationsTab />}
        {activeTab === 'job_roles' && <JobRolesTab />}
      </div>
    </div>
  );
}

function RolesTab() {
  const { hasPermission } = useAuth();
  const t = useT();
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Role> | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await rolesApi.list();
    setRoles(data);
    setLoading(false);
  }

  async function save() {
    if (!editing?.code || !editing?.name_en) {
      toast.error(t('admin.code_name_required'));
      return;
    }
    try {
      await rolesApi.upsert(editing);
      toast.success(t('admin.role_saved'));
      setEditing(null);
      setIsNew(false);
      load();
    } catch {
      toast.error(t('admin.save_failed'));
    }
  }

  async function remove(id: string) {
    try {
      await rolesApi.remove(id);
      toast.success(t('admin.role_deleted'));
      load();
    } catch {
      toast.error(t('admin.delete_failed'));
    }
  }

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{t('admin.system_roles')}</h2>
        {hasPermission('manage_roles', 'create') && <button className="btn-primary btn-sm" onClick={() => { setEditing({ code: '', name_en: '', name_ar: '', hierarchy_level: 0, is_system: false, is_active: true }); setIsNew(true); }}>
          <Plus size={14} /> {t('admin.new_role')}
        </button>}
      </div>

      {editing && (
        <div className="border rounded-lg p-4 space-y-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">{t('admin.code_asterisk')}</label>
              <input className="input text-sm" value={editing.code || ''}
                onChange={e => setEditing({ ...editing, code: e.target.value })}
                disabled={!isNew} placeholder="e.g. safety_officer" />
            </div>
            <div>
              <label className="label text-xs">{t('admin.name_en_asterisk')}</label>
              <input className="input text-sm" value={editing.name_en || ''}
                onChange={e => setEditing({ ...editing, name_en: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs">{t('admin.name_ar')}</label>
              <input className="input text-sm" value={editing.name_ar || ''}
                onChange={e => setEditing({ ...editing, name_ar: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs">{t('admin.hierarchy_level')}</label>
              <input type="number" className="input text-sm" value={editing.hierarchy_level || 0}
                onChange={e => setEditing({ ...editing, hierarchy_level: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="col-span-2">
              <label className="label text-xs">{t('admin.description')}</label>
              <input className="input text-sm" value={editing.description || ''}
                onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-sm btn-secondary" onClick={() => { setEditing(null); setIsNew(false); }}><X size={14} /> {t('common.cancel')}</button>
            <button className="btn-sm btn-primary" onClick={save}><Save size={14} /> {t('common.save')}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {roles.map(role => (
          <div key={role.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{role.name_en} <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>({role.code})</span></p>
                {role.name_ar && <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{role.name_ar}</p>}
              </div>
              {role.is_system && <span className="badge badge-neutral text-[10px]">{t('admin.system_badge')}</span>}
              {role.is_active && <span className="badge badge-success text-[10px]">{t('admin.active')}</span>}
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('admin.lvl')} {role.hierarchy_level}</span>
            </div>
            <div className="flex gap-1">
              <button className="btn-xs btn-ghost" onClick={() => { setEditing(role); setIsNew(false); }}><Edit3 size={12} /></button>
              {!role.is_system && hasPermission('manage_roles', 'delete') && (
                <button className="btn-xs btn-ghost text-red-500" onClick={() => remove(role.id)}><Trash2 size={12} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ACTIONS = ['view', 'create', 'edit', 'delete'] as const;

function getModulePerm(perms: Record<string, unknown>, mk: string): boolean[] {
  if (perms.all_modules === true) return [true, true, true, true];
  const val = perms[mk];
  if (val === true) return [true, true, true, true];
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const obj = val as Record<string, boolean>;
    return [obj.view ?? false, obj.create ?? false, obj.edit ?? false, obj.delete ?? false];
  }
  return [false, false, false, false];
}

function setModulePerm(perms: Record<string, unknown>, mk: string, actionIdx: number, value: boolean): Record<string, unknown> {
  if (perms.all_modules === true) return perms;
  const current = getModulePerm(perms, mk);
  current[actionIdx] = value;
  if (current.every(Boolean)) {
    return { ...perms, [mk]: true };
  }
  return { ...perms, [mk]: { view: current[0], create: current[1], edit: current[2], delete: current[3] } };
}

function toggleAllModules(perms: Record<string, unknown>): Record<string, unknown> {
  if (perms.all_modules === true) return { ...perms, all_modules: [] };
  return { ...perms, all_modules: true };
}

function PermissionsMatrix() {
  const t = useT();
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<RolePermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [editPerms, setEditPerms] = useState<Record<string, unknown>>({});
  const [scopeType, setScopeType] = useState<PermissionScope>('global');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    const [roleData, permData] = await Promise.all([rolesApi.list(), rolePermissionsApi.list()]);
    setRoles(roleData);
    setPerms(permData);
    if (roleData.length > 0) setSelectedRole(roleData[0].code);
    setLoading(false);
  }

  useEffect(() => {
    if (!selectedRole) return;
    const current = perms.find(p => p.role === selectedRole && p.scope_type === scopeType);
    setEditPerms(current ? { ...current.permissions } : {});
  }, [selectedRole, scopeType, perms]);

  const isAll = editPerms.all_modules === true;

  function toggleActionForGroup(groupModules: { key: string }[], actionIdx: number) {
    const allHave = groupModules.every(m => getModulePerm(editPerms, m.key)[actionIdx]);
    let next = { ...editPerms };
    groupModules.forEach(m => {
      next = setModulePerm(next, m.key, actionIdx, !allHave);
    });
    setEditPerms(next);
  }

  function toggleActionAll(actionIdx: number) {
    const allModules = MODULE_GROUPS.flatMap(g => g.modules);
    const allHave = allModules.every(m => getModulePerm(editPerms, m.key)[actionIdx]);
    let next = { ...editPerms };
    allModules.forEach(m => {
      next = setModulePerm(next, m.key, actionIdx, !allHave);
    });
    setEditPerms(next);
  }

  function toggleFeature(key: string) {
    setEditPerms({ ...editPerms, [key]: !editPerms[key] });
  }

  async function save() {
    if (!selectedRole) return;
    try {
      const existing = perms.find(p => p.role === selectedRole && p.scope_type === scopeType);
      await rolePermissionsApi.upsert({
        id: existing?.id,
        role: selectedRole as UserRole,
        permissions: editPerms,
        scope_type: scopeType,
        is_active: true,
      });
      toast.success(t('admin.perm_saved'));
      const data = await rolePermissionsApi.list();
      setPerms(data);
    } catch {
      toast.error(t('admin.save_failed'));
    }
  }

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>;

  const filteredGroups = search
    ? MODULE_GROUPS.map(g => ({
        ...g,
        modules: g.modules.filter(m => m.label.toLowerCase().includes(search.toLowerCase()) || m.key.includes(search.toLowerCase())),
      })).filter(g => g.modules.length > 0)
    : MODULE_GROUPS;

  const actionLabels = [t('admin.perm_view'), t('admin.perm_create'), t('admin.perm_edit'), t('admin.perm_delete')];

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <label className="label text-xs">{t('admin.role')}</label>
          <select className="input text-sm" value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
            {roles.map(r => <option key={r.code} value={r.code}>{r.name_en} ({r.code})</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">{t('admin.scope')}</label>
          <select className="input text-sm" value={scopeType} onChange={e => setScopeType(e.target.value as PermissionScope)}>
            {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: 'var(--color-text-muted)' }} />
          <input className="input pl-8 text-sm" placeholder={t('admin.filter_modules')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-primary btn-sm" onClick={save}><Save size={14} /> {t('common.save')}</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ color: 'var(--color-text)' }}>
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
              <th className="text-left py-2 pr-4 w-1/3 sticky left-0 z-10" style={{ backgroundColor: 'var(--color-card-bg)' }}>
                <button className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-80" onClick={() => setEditPerms(toggleAllModules(editPerms))}>
                  {isAll ? <EyeOff size={12} /> : <Eye size={12} />}
                  {t('admin.module_access')}
                </button>
              </th>
              {ACTIONS.map((a, i) => (
                <th key={a} className="text-center py-2 px-1 w-16">
                  <button className="text-[10px] uppercase tracking-wider font-semibold hover:opacity-80 mx-auto block" onClick={() => toggleActionAll(i)}>
                    {actionLabels[i]}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map(group => (
              <tr key={group.group} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <td className="py-1 pr-4 sticky left-0 z-10" style={{ backgroundColor: 'var(--color-card-bg)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                      {group.group}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>({group.modules.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {group.modules.map(m => {
                      const mp = getModulePerm(editPerms, m.key);
                      const anyOn = mp.some(Boolean);
                      return (
                        <span key={m.key}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: anyOn ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                            fontWeight: anyOn ? 500 : 400,
                          }}>
                          {m.label}
                        </span>
                      );
                    })}
                  </div>
                </td>
                {ACTIONS.map((_a, i) => {
                  const allInGroupOn = group.modules.every(m => getModulePerm(editPerms, m.key)[i]);
                  const anyInGroupOn = group.modules.some(m => getModulePerm(editPerms, m.key)[i]);
                  return (
                    <td key={`${group.group}-${i}`} className="text-center py-1 px-1 align-top">
                      <div className="flex flex-col items-center gap-0.5">
                        <button className="text-[9px] opacity-50 hover:opacity-100" onClick={() => toggleActionForGroup(group.modules, i)} title="Toggle all in group">
                          {allInGroupOn ? '-' : anyInGroupOn ? '~' : '+'}
                        </button>
                        {group.modules.map(m => {
                          const mp = getModulePerm(editPerms, m.key);
                          return (
                            <label key={`${m.key}-${i}`} className="block cursor-pointer p-0.5">
                              <input type="checkbox" className="w-3 h-3 rounded"
                                checked={mp[i]}
                                onChange={() => {
                                  setEditPerms(setModulePerm(editPerms, m.key, i, !mp[i]));
                                }} />
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {filteredGroups.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>{t('admin.no_results')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.admin_features')}</p>
        <div className="flex flex-wrap gap-2">
          {ADMIN_FEATURES.map(fk => (
            <label key={fk.key}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cursor-pointer text-xs border transition-colors ${
                editPerms[fk.key] ? 'border-transparent' : ''
              }`}
              style={{
                backgroundColor: editPerms[fk.key] ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
                borderColor: editPerms[fk.key] ? 'color-mix(in srgb, var(--color-accent) 30%, transparent)' : 'var(--color-border)',
              }}>
              <input type="checkbox" className="w-3 h-3 rounded" checked={!!editPerms[fk.key]} onChange={() => toggleFeature(fk.key)} />
              <span style={{ fontWeight: editPerms[fk.key] ? 500 : 400 }}>{fk.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span>{t('admin.role_info')}: {roles.find(r => r.code === selectedRole)?.name_en || selectedRole}</span>
          <span>{t('admin.scope')}: {SCOPE_LABELS[scopeType]}</span>
          {isAll && <span className="text-primary font-medium">{t('admin.all_modules')}</span>}
        </div>
      </div>
    </div>
  );
}

function SpecializationsTab() {
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Specialization> | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await specializationsApi.list();
    setItems(data);
    setLoading(false);
  }

  async function save() {
    if (!editing?.code || !editing?.name_en) return;
    try {
      await specializationsApi.upsert(editing);
      toast.success(t('admin.saved'));
      setEditing(null); setIsNew(false); load();
    } catch {
      toast.error(t('admin.save_failed'));
    }
  }

  async function remove(id: string) {
    try { await specializationsApi.remove(id); toast.success(t('admin.deleted')); load(); }
    catch { toast.error(t('admin.delete_failed')); }
  }

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{t('admin.specializations_tab')}</h3>
        <button className="btn-primary btn-sm" onClick={() => { setEditing({ code: '', name_en: '', name_ar: '', is_active: true }); setIsNew(true); }}>
          <Plus size={14} /> {t('admin.new_specialization')}
        </button>
      </div>
      {editing && (
        <div className="border rounded-lg p-4 space-y-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label text-xs">{t('admin.code_asterisk')}</label><input className="input text-sm" value={editing.code || ''} onChange={e => setEditing({ ...editing, code: e.target.value })} disabled={!isNew} /></div>
            <div><label className="label text-xs">{t('admin.name_en_asterisk')}</label><input className="input text-sm" value={editing.name_en || ''} onChange={e => setEditing({ ...editing, name_en: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.name_ar')}</label><input className="input text-sm" value={editing.name_ar || ''} onChange={e => setEditing({ ...editing, name_ar: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.description')}</label><input className="input text-sm" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-sm btn-secondary" onClick={() => { setEditing(null); setIsNew(false); }}><X size={14} /> {t('common.cancel')}</button>
            <button className="btn-sm btn-primary" onClick={save}><Save size={14} /> {t('common.save')}</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3">
              <Briefcase size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{item.name_en}</span>
              <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>({item.code})</span>
              {item.name_ar && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{item.name_ar}</span>}
              {!item.is_active && <span className="badge badge-neutral text-[10px]">{t('admin.inactive_badge')}</span>}
            </div>
            <div className="flex gap-1">
              <button className="btn-xs btn-ghost" onClick={() => { setEditing(item); setIsNew(false); }}><Edit3 size={12} /></button>
              {hasPermission('manage_roles', 'delete') && (
                <button className="btn-xs btn-ghost text-red-500" onClick={() => remove(item.id)}><Trash2 size={12} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobRolesTab() {
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<JobRole> | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await jobRolesApi.list();
    setItems(data);
    setLoading(false);
  }

  async function save() {
    if (!editing?.code || !editing?.name_en) return;
    try {
      await jobRolesApi.upsert(editing);
      toast.success(t('admin.saved'));
      setEditing(null); setIsNew(false); load();
    } catch {
      toast.error(t('admin.save_failed'));
    }
  }

  async function remove(id: string) {
    try { await jobRolesApi.remove(id); toast.success(t('admin.deleted')); load(); }
    catch { toast.error(t('admin.delete_failed')); }
  }

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{t('admin.job_roles_tab')}</h3>
        <button className="btn-primary btn-sm" onClick={() => { setEditing({ code: '', name_en: '', name_ar: '', hierarchy_level: 50, is_active: true }); setIsNew(true); }}>
          <Plus size={14} /> {t('admin.new_job_role')}
        </button>
      </div>
      {editing && (
        <div className="border rounded-lg p-4 space-y-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label text-xs">{t('admin.code_asterisk')}</label><input className="input text-sm" value={editing.code || ''} onChange={e => setEditing({ ...editing, code: e.target.value })} disabled={!isNew} /></div>
            <div><label className="label text-xs">{t('admin.name_en_asterisk')}</label><input className="input text-sm" value={editing.name_en || ''} onChange={e => setEditing({ ...editing, name_en: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.name_ar')}</label><input className="input text-sm" value={editing.name_ar || ''} onChange={e => setEditing({ ...editing, name_ar: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.hierarchy_level')}</label><input type="number" className="input text-sm" value={editing.hierarchy_level || 50} onChange={e => setEditing({ ...editing, hierarchy_level: parseInt(e.target.value) || 50 })} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-sm btn-secondary" onClick={() => { setEditing(null); setIsNew(false); }}><X size={14} /> {t('common.cancel')}</button>
            <button className="btn-sm btn-primary" onClick={save}><Save size={14} /> {t('common.save')}</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {items.sort((a, b) => b.hierarchy_level - a.hierarchy_level).map(item => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3">
              <UserCog size={16} className="text-primary shrink-0" />
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{item.name_en}</span>
              <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>({item.code})</span>
              {item.name_ar && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{item.name_ar}</span>}
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('admin.lvl')} {item.hierarchy_level}</span>
              {!item.is_active && <span className="badge badge-neutral text-[10px]">{t('admin.inactive_badge')}</span>}
            </div>
            <div className="flex gap-1">
              <button className="btn-xs btn-ghost" onClick={() => { setEditing(item); setIsNew(false); }}><Edit3 size={12} /></button>
              {hasPermission('manage_roles', 'delete') && (
                <button className="btn-xs btn-ghost text-red-500" onClick={() => remove(item.id)}><Trash2 size={12} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
