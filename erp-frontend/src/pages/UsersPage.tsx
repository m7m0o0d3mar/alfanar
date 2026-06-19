import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { usersApi } from '../services/api';
import type { UserProfile, UserRole } from '../types';
import { Plus, Edit3, Trash2, UserCheck, UserX, Shield, Mail } from 'lucide-react';
import Pagination from '../components/Pagination';

const ROLES: UserRole[] = [
  'admin', 'developer', 'project_manager', 'main_contractor',
  'subcontractor', 'engineer', 'quality', 'hse', 'hr',
  'finance', 'sales', 'consultant', 'client',
];

export default function UsersPage() {
  const t = useT();
  const toast = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [form, setForm] = useState({
    email: '', password: '', full_name_en: '', full_name_ar: '', phone: '', role: 'developer' as UserRole,
  });

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (err) {
      console.error('Load users failed:', err);
    } finally { setLoading(false); }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      await usersApi.invite(form.email, form.password, {
        full_name_en: form.full_name_en,
        full_name_ar: form.full_name_ar,
        phone: form.phone,
        role: form.role,
      });
      setShowInvite(false);
      setForm({ email: '', password: '', full_name_en: '', full_name_ar: '', phone: '', role: 'developer' });
      toast.success('User invited successfully');
      loadUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite user');
    }
  }

  async function handleUpdate(user: UserProfile, field: string, value: unknown) {
    try {
      await usersApi.update(user.id, { [field]: value });
      toast.success('User updated');
      loadUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleDelete(user: UserProfile) {
    if (!confirm(`Delete user ${user.full_name_en}?`)) return;
    try {
      await usersApi.remove(user.id);
      toast.success('User deleted');
      loadUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('admin.users')}</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.users_desc')}</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowInvite(true)}>
          <Plus size={16} /> {t('admin.invite_user')}
        </button>
      </div>

      {showInvite && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">{t('admin.invite_user')}</h3>
          <form onSubmit={handleInvite} className="space-y-4 max-w-lg">
            <div>
              <label className="label">{t('auth.email')}</label>
              <input className="input" type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('auth.password')}</label>
              <input className="input" type="password" required value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('admin.name_en')}</label>
                <input className="input" required value={form.full_name_en}
                  onChange={(e) => setForm({ ...form, full_name_en: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.name_ar')}</label>
                <input className="input text-right" dir="rtl" value={form.full_name_ar}
                  onChange={(e) => setForm({ ...form, full_name_ar: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('admin.phone')}</label>
                <input className="input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.role')}</label>
                <select className="input" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary btn-sm">
                <Mail size={16} /> {t('admin.send_invite')}
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShowInvite(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('admin.name_en')}</th>
                <th>{t('admin.name_ar')}</th>
                <th>{t('auth.email')}</th>
                <th>{t('admin.role')}</th>
                <th>{t('admin.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.no_data')}</td></tr>
              ) : (
                users.slice((page - 1) * pageSize, page * pageSize).map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.full_name_en}</td>
                    <td>{u.full_name_ar || '-'}</td>
                    <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{u.email || '-'}</td>
                    <td>
                      <select className="text-xs border rounded px-1 py-0.5" style={{ borderColor: 'var(--color-border)' }}
                        value={u.role} onChange={(e) => handleUpdate(u, 'role', e.target.value)}>
                        {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                      </select>
                    </td>
                    <td>
                      <button onClick={() => handleUpdate(u, 'is_active', !u.is_active)}
                        className={`badge cursor-pointer ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? <UserCheck size={14} /> : <UserX size={14} />}
                        <span className="ms-1">{u.is_active ? t('admin.active') : t('admin.inactive')}</span>
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-sm btn-secondary" title={t('common.edit')}
                          onClick={() => setEditing(u)}>
                          <Edit3 size={14} />
                        </button>
                        <button className="btn-sm btn-secondary text-red-500" title={t('common.delete')}
                          onClick={() => handleDelete(u)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={users.length} onChange={setPage} />
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="rounded-xl p-6 w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{t('admin.edit_user')}</h3>
            <div className="space-y-4">
              <div>
                <label className="label">{t('admin.name_en')}</label>
                <input className="input" value={editing.full_name_en}
                  onChange={(e) => setEditing({ ...editing, full_name_en: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.name_ar')}</label>
                <input className="input text-right" dir="rtl" value={editing.full_name_ar || ''}
                  onChange={(e) => setEditing({ ...editing, full_name_ar: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.phone')}</label>
                <input className="input" value={editing.phone || ''}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.role')}</label>
                <select className="input" value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value as UserRole })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button className="btn-primary btn-sm" onClick={async () => {
                  try {
                    await usersApi.update(editing.id, {
                      full_name_en: editing.full_name_en,
                      full_name_ar: editing.full_name_ar,
                      phone: editing.phone,
                      role: editing.role,
                    });
                    loadUsers();
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : 'Update failed');
                  }
                  setEditing(null);
                }}>
                  <Shield size={16} /> {t('common.save')}
                </button>
                <button className="btn-secondary btn-sm" onClick={() => setEditing(null)}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
