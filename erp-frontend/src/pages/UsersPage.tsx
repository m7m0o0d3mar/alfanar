import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import {
  usersApi, rolesApi, specializationsApi, jobRolesApi, regionsApi,
  departmentsApi,
  userInvitationsApi, userSessionsApi, userActivityLogApi,
} from '../services/api';
import type {
  UserProfile, UserRole, Role, Specialization, JobRole, Region,
  UserInvitation, UserSession, UserActivityLog,
} from '../types';
import {
  Users, Mail, Activity, LogIn, Plus, Edit3, Trash2, UserCheck, UserX, Shield,
  Search, Download, RefreshCw, X, Loader2,
  Ban, Send, Smartphone, Globe, Monitor, Clock, Inbox,
} from 'lucide-react';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';

const pageSize = 25;

type TabKey = 'users' | 'invitations' | 'activity' | 'sessions';

interface InviteFormState {
  email: string;
  full_name_en: string;
  full_name_ar: string;
  phone: string;
  role: string;
  specialization_id: string;
  job_role_id: string;
  region_id: string;
}

const defaultInviteForm: InviteFormState = {
  email: '',
  full_name_en: '',
  full_name_ar: '',
  phone: '',
  role: 'developer',
  specialization_id: '',
  job_role_id: '',
  region_id: '',
};

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const t = useT();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('users');
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState<{ id: string; code: string; name_en: string; name_ar?: string }[]>([]);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState(false);
  const [passwordResetTarget, setPasswordResetTarget] = useState<UserProfile | null>(null);
  const [editingForm, setEditingForm] = useState<Partial<UserProfile>>({});

  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormState>(defaultInviteForm);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [cancelInviteTarget, setCancelInviteTarget] = useState<UserInvitation | null>(null);

  const [activityUserId, setActivityUserId] = useState('');
  const [activityLog, setActivityLog] = useState<UserActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [sessionUserId, setSessionUserId] = useState('');
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState<UserSession | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { loadInitialData(); }, []);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [userData, roleData, specData, jrData, regData, deptData] = await Promise.all([
        usersApi.list(),
        rolesApi.list(),
        specializationsApi.list(true),
        jobRolesApi.list(true),
        regionsApi.list(true),
        departmentsApi.list(true),
      ]);
      setUsers(userData);
      setRoles(roleData);
      setSpecializations(specData);
      setJobRoles(jrData);
      setRegions(regData);
      setDepartments(deptData);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users');
    }
  }

  async function loadInvitations() {
    setInvitationsLoading(true);
    try {
      const data = await userInvitationsApi.list();
      setInvitations(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setInvitationsLoading(false);
    }
  }

  async function loadActivity(userId: string) {
    if (!userId) { setActivityLog([]); return; }
    setActivityLoading(true);
    try {
      const data = await userActivityLogApi.list(userId);
      setActivityLog(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setActivityLoading(false);
    }
  }

  async function loadSessions(userId: string) {
    if (!userId) { setSessions([]); return; }
    setSessionsLoading(true);
    try {
      const data = await userSessionsApi.list(userId);
      setSessions(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setSessionsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'invitations') loadInvitations();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'activity' && activityUserId) loadActivity(activityUserId);
  }, [activeTab, activityUserId]);

  useEffect(() => {
    if (activeTab === 'sessions' && sessionUserId) loadSessions(sessionUserId);
  }, [activeTab, sessionUserId]);

  async function handleInlineUpdate(user: UserProfile, field: string, value: unknown) {
    try {
      await usersApi.update(user.id, { [field]: value });
      toast.success('User updated');
      loadUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleBulkStatus(active: boolean) {
    try {
      await Promise.all(Array.from(selectedIds).map(id => usersApi.update(id, { is_active: active })));
      toast.success(`${selectedIds.size} users updated`);
      setSelectedIds(new Set());
      loadUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bulk update failed');
    }
  }

  async function handleBulkDelete() {
    try {
      await Promise.all(Array.from(selectedIds).map(id => usersApi.remove(id)));
      toast.success(`${selectedIds.size} users deleted`);
      setSelectedIds(new Set());
      setBulkDeleteTarget(false);
      loadUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bulk delete failed');
    }
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    try {
      await usersApi.update(editingUser.id, editingForm);
      toast.success('User updated');
      setEditingUser(null);
      loadUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handlePasswordReset() {
    if (!passwordResetTarget?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(passwordResetTarget.email, {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (error) throw error;
      toast.success('Password reset email sent');
      setPasswordResetTarget(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send password reset');
    }
  }

  async function handleCreateInvitation(e: React.FormEvent) {
    e.preventDefault();
    setInviteBusy(true);
    try {
      await userInvitationsApi.create({
        email: inviteForm.email,
        full_name_en: inviteForm.full_name_en || undefined,
        full_name_ar: inviteForm.full_name_ar || undefined,
        phone: inviteForm.phone || undefined,
        role: inviteForm.role,
        specialization_id: inviteForm.specialization_id || undefined,
        job_role_id: inviteForm.job_role_id || undefined,
        region_id: inviteForm.region_id || undefined,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      toast.success('Invitation created');
      setInviteForm(defaultInviteForm);
      loadInvitations();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleResendInvitation(inv: UserInvitation) {
    try {
      await userInvitationsApi.resend(inv.id);
      toast.success('Invitation resent');
      loadInvitations();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend invitation');
    }
  }

  async function handleCancelInvitation() {
    if (!cancelInviteTarget) return;
    try {
      await userInvitationsApi.cancel(cancelInviteTarget.id);
      toast.success('Invitation cancelled');
      setCancelInviteTarget(null);
      loadInvitations();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel invitation');
    }
  }

  async function handleTerminateSession() {
    if (!terminateTarget) return;
    try {
      await userSessionsApi.terminate(terminateTarget.id);
      toast.success('Session terminated');
      setTerminateTarget(null);
      loadSessions(sessionUserId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to terminate session');
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map(u => u.id)));
    }
  }

  function exportCSV() {
    const headers = ['Name EN', 'Name AR', 'Email', 'Phone', 'Role', 'Status', 'Last Login'];
    const rows = filteredUsers.map(u => [
      u.full_name_en, u.full_name_ar || '', u.email || '', u.phone || '',
      u.role, u.is_active ? 'Active' : 'Inactive', u.last_login || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending': return 'badge-warning';
      case 'accepted': return 'badge-success';
      case 'expired': return 'badge-danger';
      case 'cancelled': return 'badge-info';
      default: return 'badge';
    }
  }

  function getDeviceIcon(ua?: string) {
    if (!ua) return <Monitor size={14} />;
    const l = ua.toLowerCase();
    if (l.includes('iphone') || l.includes('android') && l.includes('mobile')) return <Smartphone size={14} />;
    if (l.includes('android') || l.includes('ipad')) return <Monitor size={14} />;
    return <Globe size={14} />;
  }

  function formatDateTime(iso?: string) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString();
  }

  const filteredUsers = useMemo(() => {
    let list = users;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(u =>
        u.full_name_en?.toLowerCase().includes(q) ||
        u.full_name_ar?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }
    if (roleFilter) list = list.filter(u => u.role === roleFilter);
    if (statusFilter === 'active') list = list.filter(u => u.is_active);
    if (statusFilter === 'inactive') list = list.filter(u => !u.is_active);
    if (departmentFilter) list = list.filter(u => u.department_id === departmentFilter);
    return list;
  }, [users, debouncedSearch, roleFilter, statusFilter, departmentFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.is_active).length,
    inactive: users.filter(u => !u.is_active).length,
  }), [users]);

  const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
    { key: 'users', label: 'All Users', icon: Users },
    { key: 'invitations', label: 'Invitations', icon: Mail },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'sessions', label: 'Sessions', icon: LogIn },
  ];

  function renderUsersTab() {
    const paginated = filteredUsers.slice((page - 1) * pageSize, page * pageSize);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-glass">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Total Users</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="stat-glass">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Active</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-success)' }}>{stats.active}</p>
          </div>
          <div className="stat-glass">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Inactive</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-danger)' }}>{stats.inactive}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
              <input
                className="input pl-9 w-64"
                placeholder="Search name or email..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
              {search && <X size={14} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: 'var(--color-text-secondary)' }} onClick={() => setSearch('')} />}
            </div>
            <select className="input w-36" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
              <option value="">All Roles</option>
              {roles.map(r => <option key={r.code} value={r.code}>{r.name_en}</option>)}
            </select>
            <select className="input w-32" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select className="input w-36" value={departmentFilter} onChange={e => { setDepartmentFilter(e.target.value); setPage(1); }}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name_en}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={exportCSV}>
              <Download size={14} /> Export CSV
            </button>
            {hasPermission('manage_users', 'create') && (
              <button className="btn-primary btn-sm" onClick={() => setActiveTab('invitations')}>
                <Plus size={16} /> Invite User
              </button>
            )}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-primary)' }}>
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <button className="btn-sm btn-secondary" onClick={() => handleBulkStatus(true)}>
              <UserCheck size={14} /> Activate
            </button>
            <button className="btn-sm btn-secondary" onClick={() => handleBulkStatus(false)}>
              <UserX size={14} /> Deactivate
            </button>
            {hasPermission('manage_users', 'delete') && (
              <button className="btn-sm btn-secondary" style={{ color: 'var(--color-danger)' }} onClick={() => setBulkDeleteTarget(true)}>
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button className="btn-sm btn-secondary ml-auto" onClick={() => setSelectedIds(new Set())}>
              <X size={14} /> Clear
            </button>
          </div>
        )}

        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input type="checkbox" className="cursor-pointer"
                      checked={filteredUsers.length > 0 && selectedIds.size === filteredUsers.length}
                      onChange={toggleSelectAll} />
                  </th>
                  <th>#</th>
                  <th>Name (EN)</th>
                  <th>Name (AR)</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Specialization</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="text-center py-8"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
                    <Inbox size={40} className="mx-auto mb-2 opacity-40" />
                    No users found
                  </td></tr>
                ) : (
                  paginated.map((u, idx) => (
                    <tr key={u.id} className="cursor-pointer" onClick={() => setEditingUser(u)}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="cursor-pointer"
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleSelect(u.id)} />
                      </td>
                      <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{(page - 1) * pageSize + idx + 1}</td>
                      <td className="font-medium">{u.full_name_en}</td>
                      <td>{u.full_name_ar || '-'}</td>
                      <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{u.email || '-'}</td>
                      <td className="text-sm">{u.phone || '-'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <select className="text-xs border rounded px-1 py-0.5" style={{ borderColor: 'var(--color-border)' }}
                          value={u.role} onChange={e => handleInlineUpdate(u, 'role', e.target.value)}>
                          {roles.map(r => <option key={r.code} value={r.code}>{r.name_en}</option>)}
                        </select>
                      </td>
                      <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {specializations.find(s => s.id === u.specialization_id)?.name_en || '-'}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleInlineUpdate(u, 'is_active', !u.is_active)}
                          className={`badge cursor-pointer ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {u.is_active ? <UserCheck size={14} /> : <UserX size={14} />}
                          <span className="ms-1">{u.is_active ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>
                      <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {u.last_login ? formatDateTime(u.last_login) : '-'}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button className="btn-xs btn-secondary" title="Edit"
                            onClick={() => { setEditingUser(u); setEditingForm({ ...u }); }}>
                            <Edit3 size={12} />
                          </button>
                          <button className="btn-xs btn-secondary" title="View Activity"
                            onClick={() => { setActivityUserId(u.id); setActiveTab('activity'); }}>
                            <Activity size={12} />
                          </button>
                          {hasPermission('manage_users', 'delete') && (
                            <button className="btn-xs btn-secondary" title="Delete"
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => setDeleteTarget(u)}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filteredUsers.length} onChange={setPage} />
        </div>
      </div>
    );
  }

  function renderInvitationsTab() {
    return (
      <div className="space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Create Invitation</h3>
          <form onSubmit={handleCreateInvitation} className="space-y-4 max-w-2xl">
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" required value={inviteForm.email}
                onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Name (EN)</label>
                <input className="input" value={inviteForm.full_name_en}
                  onChange={e => setInviteForm({ ...inviteForm, full_name_en: e.target.value })} />
              </div>
              <div>
                <label className="label">Name (AR)</label>
                <input className="input text-right" dir="rtl" value={inviteForm.full_name_ar}
                  onChange={e => setInviteForm({ ...inviteForm, full_name_ar: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone</label>
                <input className="input" value={inviteForm.phone}
                  onChange={e => setInviteForm({ ...inviteForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={inviteForm.role}
                  onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}>
                  {roles.map(r => <option key={r.code} value={r.code}>{r.name_en}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Specialization</label>
                <select className="input" value={inviteForm.specialization_id}
                  onChange={e => setInviteForm({ ...inviteForm, specialization_id: e.target.value })}>
                  <option value="">None</option>
                  {specializations.map(s => <option key={s.id} value={s.id}>{s.name_en}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Job Role</label>
                <select className="input" value={inviteForm.job_role_id}
                  onChange={e => setInviteForm({ ...inviteForm, job_role_id: e.target.value })}>
                  <option value="">None</option>
                  {jobRoles.map(j => <option key={j.id} value={j.id}>{j.name_en}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Region</label>
                <select className="input" value={inviteForm.region_id}
                  onChange={e => setInviteForm({ ...inviteForm, region_id: e.target.value })}>
                  <option value="">None</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name_en}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary btn-sm" disabled={inviteBusy}>
                {inviteBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Generate Invitation
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Invitations</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Invited By</th>
                  <th>Invited At</th>
                  <th>Expires At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitationsLoading ? (
                  <tr><td colSpan={8} className="text-center py-8"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>
                ) : invitations.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
                    <Inbox size={40} className="mx-auto mb-2 opacity-40" />
                    No invitations yet
                  </td></tr>
                ) : (
                  invitations.map(inv => (
                    <tr key={inv.id}>
                      <td className="text-sm">{inv.email}</td>
                      <td>{inv.full_name_en || inv.full_name_ar || '-'}</td>
                      <td className="text-xs">{inv.role || '-'}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(inv.status)}`}>{inv.status}</span>
                      </td>
                      <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{inv.invited_by || '-'}</td>
                      <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatDateTime(inv.created_at)}</td>
                      <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatDateTime(inv.expires_at)}</td>
                      <td>
                        <div className="flex gap-1">
                          {inv.status === 'pending' && (
                            <>
                              <button className="btn-xs btn-secondary" title="Resend"
                                onClick={() => handleResendInvitation(inv)}>
                                <RefreshCw size={12} />
                              </button>
                              <button className="btn-xs btn-secondary" title="Cancel"
                                style={{ color: 'var(--color-danger)' }}
                                onClick={() => setCancelInviteTarget(inv)}>
                                <X size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderActivityTab() {
    let filteredLog = activityLog;
    if (dateFrom) filteredLog = filteredLog.filter(l => l.created_at >= dateFrom);
    if (dateTo) filteredLog = filteredLog.filter(l => l.created_at <= dateTo + 'T23:59:59');

    const actionCounts: Record<string, number> = {};
    filteredLog.forEach(l => { actionCounts[l.action_type] = (actionCounts[l.action_type] || 0) + 1; });

    let mostCommonAction = '-';
    let max = 0;
    for (const [k, v] of Object.entries(actionCounts)) {
      if (v > max) { max = v; mostCommonAction = k; }
    }

    const lastActive = filteredLog.length === 0 ? '-' : formatDateTime(filteredLog[0].created_at);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-64">
            <label className="label">Select User</label>
            <select className="input" value={activityUserId}
              onChange={e => { setActivityUserId(e.target.value); loadActivity(e.target.value); }}>
              <option value="">Choose a user...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name_en} {u.email ? `(${u.email})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <button className="btn-secondary btn-sm" onClick={() => loadActivity(activityUserId)}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {activityUserId && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="stat-glass">
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Total Actions</p>
                <p className="text-2xl font-bold mt-1">{filteredLog.length}</p>
              </div>
              <div className="stat-glass">
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Most Common Action</p>
                <p className="text-lg font-bold mt-1">{mostCommonAction}</p>
              </div>
              <div className="stat-glass">
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Last Active</p>
                <p className="text-lg font-bold mt-1">{lastActive}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).map(([action, count]) => (
                <span key={action} className="badge badge-info gap-1">
                  {action}
                  <span className="font-bold">{count}</span>
                </span>
              ))}
            </div>

            <div className="card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date/Time</th>
                      <th>Action Type</th>
                      <th>Entity Type</th>
                      <th>Entity ID</th>
                      <th>IP Address</th>
                      <th>Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLoading ? (
                      <tr><td colSpan={6} className="text-center py-8"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>
                    ) : filteredLog.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
                        <Inbox size={40} className="mx-auto mb-2 opacity-40" />
                        No activity found
                      </td></tr>
                    ) : (
                      filteredLog.map(l => (
                        <tr key={l.id}>
                          <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatDateTime(l.created_at)}</td>
                          <td><span className="badge badge-info">{l.action_type}</span></td>
                          <td className="text-xs">{l.entity_type || '-'}</td>
                          <td className="text-xs font-mono">{l.entity_id ? l.entity_id.substring(0, 8) + '...' : '-'}</td>
                          <td className="text-xs">{l.ip_address || '-'}</td>
                          <td className="text-xs max-w-xs truncate">
                            {l.metadata && Object.keys(l.metadata).length > 0 ? (
                              <span className="cursor-pointer" title={JSON.stringify(l.metadata, null, 2)}
                                onClick={() => alert(JSON.stringify(l.metadata, null, 2))}>
                                View JSON
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!activityUserId && (
          <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>
            <Activity size={48} className="mx-auto mb-4 opacity-30" />
            <p>Select a user to view activity log</p>
          </div>
        )}
      </div>
    );
  }

  function renderSessionsTab() {
    const activeSessions = sessions.filter(s => s.is_active);
    const pastSessions = sessions.filter(s => !s.is_active);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-64">
            <label className="label">Select User</label>
            <select className="input" value={sessionUserId}
              onChange={e => { setSessionUserId(e.target.value); loadSessions(e.target.value); }}>
              <option value="">Choose a user...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name_en} {u.email ? `(${u.email})` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {sessionUserId && (
          <>
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                Active Sessions
                <span className="badge badge-success">{activeSessions.length}</span>
              </h3>
              {activeSessions.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
                  <Monitor size={36} className="mx-auto mb-2 opacity-30" />
                  <p>No active sessions</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeSessions.map(s => (
                    <div key={s.id} className="card">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-primary)', opacity: 0.1 }}>
                            {getDeviceIcon(s.user_agent)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{s.device_info || s.user_agent?.substring(0, 50) || 'Unknown Device'}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                              <Globe size={10} className="inline me-1" />{s.ip_address || 'Unknown IP'}
                            </p>
                            {s.location && <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{s.location}</p>}
                          </div>
                        </div>
                        <button className="btn-xs btn-secondary" style={{ color: 'var(--color-danger)' }}
                          onClick={() => setTerminateTarget(s)}>
                          <Ban size={12} /> Terminate
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        <span className="flex items-center gap-1"><Clock size={10} /> Last active: {formatDateTime(s.last_active_at)}</span>
                        <span>Started: {formatDateTime(s.started_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-3">Session History</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Started At</th>
                      <th>Ended At</th>
                      <th>IP Address</th>
                      <th>Device</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionsLoading ? (
                      <tr><td colSpan={6} className="text-center py-8"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>
                    ) : pastSessions.length === 0 && activeSessions.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
                        <Inbox size={40} className="mx-auto mb-2 opacity-40" />
                        No sessions found
                      </td></tr>
                    ) : (
                      pastSessions.map(s => (
                        <tr key={s.id}>
                          <td><span className={`badge ${s.is_active ? 'badge-success' : 'badge-danger'}`}>{s.is_active ? 'Active' : 'Ended'}</span></td>
                          <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatDateTime(s.started_at)}</td>
                          <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatDateTime(s.ended_at)}</td>
                          <td className="text-xs font-mono">{s.ip_address || '-'}</td>
                          <td className="text-xs">{s.device_info || s.user_agent?.substring(0, 40) || '-'}</td>
                          <td className="text-xs">{s.location || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!sessionUserId && (
          <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>
            <LogIn size={48} className="mx-auto mb-4 opacity-30" />
            <p>Select a user to view sessions</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('admin.users')}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.users_desc')}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b pb-px" style={{ borderColor: 'var(--color-border)' }}>
        {tabs.map(tab => (
          <button key={tab.key}
            className={`tab ${activeTab === tab.key ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}>
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'users' && renderUsersTab()}
      {activeTab === 'invitations' && renderInvitationsTab()}
      {activeTab === 'activity' && renderActivityTab()}
      {activeTab === 'sessions' && renderSessionsTab()}

      {editingUser && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditingUser(null)}>
          <div className="rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit User</h3>
              <button className="btn-xs btn-secondary" onClick={() => setEditingUser(null)}><X size={12} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Name (EN) *</label>
                  <input className="input" value={editingForm.full_name_en || ''}
                    onChange={e => setEditingForm({ ...editingForm, full_name_en: e.target.value })} />
                </div>
                <div>
                  <label className="label">Name (AR)</label>
                  <input className="input text-right" dir="rtl" value={editingForm.full_name_ar || ''}
                    onChange={e => setEditingForm({ ...editingForm, full_name_ar: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" readOnly value={editingUser.email || ''} style={{ opacity: 0.7 }} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={editingForm.phone || ''}
                  onChange={e => setEditingForm({ ...editingForm, phone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={editingForm.role || ''}
                    onChange={e => setEditingForm({ ...editingForm, role: e.target.value as UserRole })}>
                    {roles.map(r => <option key={r.code} value={r.code}>{r.name_en}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Specialization</label>
                  <select className="input" value={editingForm.specialization_id || ''}
                    onChange={e => setEditingForm({ ...editingForm, specialization_id: e.target.value || undefined })}>
                    <option value="">None</option>
                    {specializations.map(s => <option key={s.id} value={s.id}>{s.name_en}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Job Role</label>
                  <select className="input" value={editingForm.job_role_id || ''}
                    onChange={e => setEditingForm({ ...editingForm, job_role_id: e.target.value || undefined })}>
                    <option value="">None</option>
                    {jobRoles.map(j => <option key={j.id} value={j.id}>{j.name_en}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Region</label>
                  <select className="input" value={editingForm.region_id || ''}
                    onChange={e => setEditingForm({ ...editingForm, region_id: e.target.value || undefined })}>
                    <option value="">None</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name_en}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Department</label>
                  <select className="input" value={editingForm.department_id || ''}
                    onChange={e => setEditingForm({ ...editingForm, department_id: e.target.value || undefined })}>
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name_en}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Block ID</label>
                  <input className="input" value={editingForm.block_id || ''}
                    onChange={e => setEditingForm({ ...editingForm, block_id: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Employee Code</label>
                  <input className="input" value={editingForm.employee_code || ''}
                    onChange={e => setEditingForm({ ...editingForm, employee_code: e.target.value })} />
                </div>
                <div>
                  <label className="label">Hire Date</label>
                  <input type="date" className="input" value={editingForm.hire_date?.substring(0, 10) || ''}
                    onChange={e => setEditingForm({ ...editingForm, hire_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Employment Status</label>
                  <input className="input" value={editingForm.employment_status || ''}
                    onChange={e => setEditingForm({ ...editingForm, employment_status: e.target.value })} />
                </div>
                <div>
                  <label className="label">Nationality</label>
                  <input className="input" value={editingForm.nationality || ''}
                    onChange={e => setEditingForm({ ...editingForm, nationality: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">ID Number</label>
                  <input className="input" value={editingForm.id_number || ''}
                    onChange={e => setEditingForm({ ...editingForm, id_number: e.target.value })} />
                </div>
                <div>
                  <label className="label">Default Language</label>
                  <select className="input" value={editingForm.default_language || 'en'}
                    onChange={e => setEditingForm({ ...editingForm, default_language: e.target.value as 'ar' | 'en' })}>
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Emergency Contact Name</label>
                  <input className="input" value={editingForm.emergency_contact_name || ''}
                    onChange={e => setEditingForm({ ...editingForm, emergency_contact_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Emergency Contact Phone</label>
                  <input className="input" value={editingForm.emergency_contact_phone || ''}
                    onChange={e => setEditingForm({ ...editingForm, emergency_contact_phone: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="label mb-0">Active</label>
                <input type="checkbox" className="cursor-pointer"
                  checked={editingForm.is_active !== false}
                  onChange={e => setEditingForm({ ...editingForm, is_active: e.target.checked })} />
              </div>
              <div className="flex gap-2 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button className="btn-primary btn-sm" onClick={handleSaveEdit}>
                  <Shield size={16} /> Save
                </button>
                <button className="btn-secondary btn-sm" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                {editingUser.email && (
                  <button className="btn-secondary btn-sm ml-auto" style={{ color: 'var(--color-warning)' }}
                    onClick={() => { setPasswordResetTarget(editingUser); setEditingUser(null); }}>
                    <Send size={14} /> Send Password Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete User"
          message={`Are you sure you want to delete ${deleteTarget.full_name_en}? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={async () => {
            await usersApi.remove(deleteTarget.id);
            toast.success('User deleted');
            loadUsers();
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {bulkDeleteTarget && (
        <ConfirmDialog
          title="Delete Users"
          message={`Are you sure you want to delete ${selectedIds.size} users? This action cannot be undone.`}
          confirmLabel="Delete All"
          variant="danger"
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleteTarget(false)}
        />
      )}

      {passwordResetTarget && (
        <ConfirmDialog
          title="Send Password Reset"
          message={`Are you sure? This will send a password reset email to ${passwordResetTarget.email}.`}
          confirmLabel="Send Reset"
          variant="warning"
          onConfirm={handlePasswordReset}
          onCancel={() => setPasswordResetTarget(null)}
        />
      )}

      {cancelInviteTarget && (
        <ConfirmDialog
          title="Cancel Invitation"
          message={`Cancel invitation for ${cancelInviteTarget.email}?`}
          confirmLabel="Cancel Invitation"
          variant="warning"
          onConfirm={handleCancelInvitation}
          onCancel={() => setCancelInviteTarget(null)}
        />
      )}

      {terminateTarget && (
        <ConfirmDialog
          title="Terminate Session"
          message="Are you sure you want to terminate this session? The user will be logged out."
          confirmLabel="Terminate"
          variant="danger"
          onConfirm={handleTerminateSession}
          onCancel={() => setTerminateTarget(null)}
        />
      )}
    </div>
  );
}
