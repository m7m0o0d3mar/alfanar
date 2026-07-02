import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import {
  Plus, Download, Upload, Eye, Search, Trash2, FileText, MessageSquare,
  Calendar, ArrowUpDown,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import CsvImportModal from '../components/CsvImportModal';
import { exportCSV } from '../utils/csv';
import type { SyncConfig } from '../services/syncService';

interface Ticket {
  id: string; ticket_no: string; title_en: string; title_ar?: string;
  description?: string; ticket_type: string; priority: string; status: string;
  assigned_to?: string; requested_by?: string; due_date?: string;
  project_id?: string; created_at: string; updated_at?: string;
  project?: { project_code: string; name_en: string };
  assigned_user?: { id: string; full_name_en: string; avatar_url?: string } | null;
  requester?: { id: string; full_name_en: string; avatar_url?: string } | null;
}

interface TicketComment {
  id: string; ticket_id: string; user_id: string; comment_text: string;
  attachment_url?: string; created_at: string;
  user?: { id: string; full_name_en: string; avatar_url?: string } | null;
}

interface UserProfile {
  id: string; full_name_en: string; avatar_url?: string;
}

interface Project {
  id: string; name_en: string; project_code: string;
}

type TabKey = 'dashboard' | 'tickets' | 'comments';

const STATUS_COLORS: Record<string, string> = {
  open: '#3B82F6', in_progress: '#F59E0B', under_review: '#8B5CF6',
  resolved: '#22C55E', closed: '#6B7280', cancelled: '#EF4444',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#22C55E', medium: '#F59E0B', high: '#EF4444', urgent: '#DC2626',
};

const TICKET_TYPES = ['rfi', 'design_query', 'shop_drawing_review', 'method_statement_review', 'submittal_review', 'site_instruction', 'technical_query', 'other'];

const STATUS_OPTIONS = ['open', 'in_progress', 'under_review', 'resolved', 'closed', 'cancelled'];

export default function TechnicalPage() {
  const [tab, setTab] = useState<TabKey>('dashboard');

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Technical Office</h1>
      </div>

      <div className="flex gap-1 border-b pb-0 flex-wrap" style={{ borderColor: 'var(--color-border)' }}>
        {([
          { key: 'dashboard' as const, label: 'Dashboard', icon: FileText },
          { key: 'tickets' as const, label: 'Tickets', icon: FileText },
          { key: 'comments' as const, label: 'Comments', icon: MessageSquare },
        ]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 -mb-px ${tab === key ? '' : 'opacity-60 hover:opacity-80'}`}
            style={{ backgroundColor: tab === key ? 'var(--color-surface)' : 'transparent', borderColor: 'var(--color-border)', color: tab === key ? 'var(--color-primary)' : 'var(--color-text)' }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'tickets' && <TicketsTab />}
      {tab === 'comments' && <CommentsTab />}
    </div>
  );
}

function DashboardTab() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await supabase.from('technical_tickets')
        .select('*, project:projects(project_code, name_en), assigned_user:user_profiles!assigned_to(id, full_name_en, avatar_url)')
        .order('created_at', { ascending: false });
      setTickets((res.data || []) as Ticket[]);
    } catch { toast.error('Failed to load tickets'); }
    finally { setLoading(false); }
  }

  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'under_review');
  const overdue = tickets.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'closed' && t.status !== 'cancelled');
  const avgResolution = (() => {
    const closed = tickets.filter(t => t.status === 'closed' && t.created_at && t.updated_at);
    if (!closed.length) return 'N/A';
    const totalMs = closed.reduce((sum, t) => sum + (new Date(t.updated_at!).getTime() - new Date(t.created_at).getTime()), 0);
    return `${Math.round(totalMs / closed.length / 86400000)}d`;
  })();

  const kpiCards = [
    { label: 'Total Tickets', value: tickets.length, color: '#3B82F6' },
    { label: 'Open', value: openTickets.length, color: '#F59E0B' },
    { label: 'Overdue', value: overdue.length, color: '#EF4444' },
    { label: 'Avg Resolution', value: avgResolution, color: '#22C55E' },
  ];

  const statusDist = STATUS_OPTIONS.map(s => ({ status: s, count: tickets.filter(t => t.status === s).length }));
  const typeDist = TICKET_TYPES.map(tp => ({ type: tp, count: tickets.filter(t => t.ticket_type === tp).length }));
  const priorityCounts = ['urgent', 'high', 'medium', 'low'].map(p => ({ priority: p, count: tickets.filter(t => t.priority === p).length }));
  const recent = tickets.slice(0, 5);
  const maxStatusCount = Math.max(...statusDist.map(s => s.count), 1);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map(c => (
          <div key={c.label} className="card p-4 flex items-center gap-3">
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Status Distribution</h3>
          <div className="space-y-2">
            {statusDist.map(s => (
              <div key={s.status}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="capitalize">{s.status.replace(/_/g, ' ')}</span>
                  <span>{s.count}</span>
                </div>
                <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${(s.count / maxStatusCount) * 100}%`, backgroundColor: STATUS_COLORS[s.status] || '#6B7280' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Type Distribution</h3>
          <div className="flex flex-wrap gap-1.5">
            {typeDist.filter(td => td.count > 0).map(td => (
              <span key={td.type} className="badge text-xs capitalize">{td.type.replace(/_/g, ' ')}: {td.count}</span>
            ))}
            {typeDist.every(td => td.count === 0) && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>No data</span>}
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Priority Breakdown</h3>
          <div className="space-y-2">
            {priorityCounts.map(p => (
              <div key={p.priority} className="flex justify-between items-center">
                <span className="text-sm capitalize">{p.priority}</span>
                <span className="font-semibold" style={{ color: PRIORITY_COLORS[p.priority] }}>{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Recent Tickets</h3>
          {recent.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No tickets yet</p>
          ) : (
            <div className="space-y-2">
              {recent.map(t => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.ticket_no}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{t.title_en}</div>
                  </div>
                  <span className="badge text-xs" style={{ backgroundColor: `${STATUS_COLORS[t.status]}18`, color: STATUS_COLORS[t.status] }}>{t.status.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Calendar size={14} style={{ color: '#EF4444' }} />
            Overdue Tickets ({overdue.length})
          </h3>
          {overdue.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No overdue tickets</p>
          ) : (
            <div className="space-y-2">
              {overdue.map(t => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.ticket_no}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{t.title_en} &middot; Due {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A'}</div>
                  </div>
                  <span className="badge badge-danger text-xs">{t.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TicketsTab() {
  const { hasPermission } = useAuth();
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [deleting, setDeleting] = useState<{ table: string; id: string; label: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ project_id: '', ticket_no: '', title_en: '', title_ar: '', description: '', ticket_type: 'rfi', priority: 'medium', status: 'open', assigned_to: '', due_date: '' });
  const [sortCol, setSortCol] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTickets(); }, []);

  async function loadTickets() {
    setLoading(true);
    try {
      const [tickRes, projRes, userRes] = await Promise.all([
        supabase.from('technical_tickets')
          .select('*, project:projects(project_code, name_en), assigned_user:user_profiles!assigned_to(id, full_name_en, avatar_url), requester:user_profiles!requested_by(id, full_name_en, avatar_url)')
          .order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
        supabase.from('user_profiles').select('id, full_name_en, avatar_url').order('full_name_en'),
      ]);
      setTickets((tickRes.data || []) as Ticket[]);
      setProjects((projRes.data || []) as Project[]);
      setUsers((userRes.data || []) as UserProfile[]);
    } catch { toast.error('Failed to load tickets'); }
    finally { setLoading(false); }
  }

  async function handleDelete(table: string, id: string) {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted');
      loadTickets();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Delete failed'); }
    setDeleting(null);
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const filtered = tickets.filter(t => {
    if (search && !t.ticket_no?.toLowerCase().includes(search.toLowerCase()) && !t.title_en?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterProject && t.project_id !== filterProject) return false;
    if (filterType && t.ticket_type !== filterType) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterAssigned && t.assigned_to !== filterAssigned) return false;
    return true;
  }).sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortCol === 'ticket_no') return a.ticket_no.localeCompare(b.ticket_no) * dir;
    if (sortCol === 'created_at') return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
    if (sortCol === 'priority') return (['low', 'medium', 'high', 'urgent'].indexOf(a.priority) - ['low', 'medium', 'high', 'urgent'].indexOf(b.priority)) * dir;
    if (sortCol === 'status') return a.status.localeCompare(b.status) * dir;
    return 0;
  });

  async function save() {
    setFormError('');
    if (!form.project_id) { setFormError('Project is required'); return; }
    if (!form.ticket_no.trim()) { setFormError('Ticket No is required'); return; }
    if (!form.title_en.trim()) { setFormError('Title is required'); return; }
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) { setFormError('Not logged in'); setSaving(false); return; }
      const { error } = await supabase.from('technical_tickets').insert({
        project_id: form.project_id, ticket_no: form.ticket_no,
        title_en: form.title_en, title_ar: form.title_ar || null,
        description: form.description || null, ticket_type: form.ticket_type,
        priority: form.priority, status: form.status || 'open',
        assigned_to: form.assigned_to || null, due_date: form.due_date || null,
        requested_by: user.id,
      });
      if (error) throw error;
      toast.success(`Ticket "${form.ticket_no}" created`);
      setShowForm(false);
      setForm({ project_id: '', ticket_no: '', title_en: '', title_ar: '', description: '', ticket_type: 'rfi', priority: 'medium', status: 'open', assigned_to: '', due_date: '' });
      loadTickets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  function SortHeader({ col, children }: { col: string; children: React.ReactNode }) {
    return (
      <th className="cursor-pointer select-none" onClick={() => toggleSort(col)}>
        <div className="flex items-center gap-1">{children}<ArrowUpDown size={12} /></div>
      </th>
    );
  }

  const importConfig: SyncConfig = {
    table: 'technical_tickets',
    columns: [
      { key: 'ticket_no', label: 'Ticket No', required: true },
      { key: 'title_en', label: 'Title', required: true },
      { key: 'description', label: 'Description' },
      { key: 'ticket_type', label: 'Type' },
      { key: 'priority', label: 'Priority' },
    ],
    fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }],
    defaults: { status: 'open' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select className="input max-w-[150px]" value={filterProject} onChange={(e) => { setFilterProject(e.target.value); setPage(1); }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_code}</option>)}
          </select>
          <select className="input max-w-[140px]" value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            {TICKET_TYPES.map(tp => <option key={tp} value={tp}>{tp.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="input max-w-[120px]" value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }}>
            <option value="">All Priority</option>
            {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input max-w-[130px]" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="input max-w-[150px]" value={filterAssigned} onChange={(e) => { setFilterAssigned(e.target.value); setPage(1); }}>
            <option value="">All Assignees</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
          </select>
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as unknown as Record<string, unknown>[], `technical_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> Export
          </button>
          <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={14} /> Import
          </button>
          {hasPermission('technical', 'create') && <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Ticket
          </button>}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <SortHeader col="ticket_no">Ticket No</SortHeader>
                <th>Title</th>
                <th>Project</th>
                <th>Type</th>
                <SortHeader col="priority">Priority</SortHeader>
                <SortHeader col="status">Status</SortHeader>
                <th>Assigned To</th>
                <th>Due Date</th>
                <SortHeader col="created_at">Created</SortHeader>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No tickets found</td></tr>
              ) : (
                filtered.slice((page - 1) * pageSize, page * pageSize).map(t => (
                  <tr key={t.id} className="clickable" onClick={() => navigate(`/technical/tickets/${t.id}`)}>
                    <td className="font-mono text-xs">{t.ticket_no}</td>
                    <td className="font-medium max-w-[200px] truncate">{t.title_en}</td>
                    <td className="text-xs">{t.project?.project_code || '-'}</td>
                    <td className="text-xs capitalize">{t.ticket_type.replace(/_/g, ' ')}</td>
                    <td><span className="badge text-xs capitalize" style={{ backgroundColor: `${PRIORITY_COLORS[t.priority] || '#6B7280'}18`, color: PRIORITY_COLORS[t.priority] || '#6B7280' }}>{t.priority}</span></td>
                    <td><span className="badge text-xs capitalize" style={{ backgroundColor: `${STATUS_COLORS[t.status] || '#6B7280'}18`, color: STATUS_COLORS[t.status] || '#6B7280' }}>{t.status.replace(/_/g, ' ')}</span></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Avatar url={t.assigned_user?.avatar_url} name={t.assigned_user?.full_name_en} size={22} />
                        <span className="text-xs">{t.assigned_user?.full_name_en || '-'}</span>
                      </div>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t.due_date ? new Date(t.due_date).toLocaleDateString() : '-'}</td>
                    <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); navigate(`/technical/tickets/${t.id}`); }}><Eye size={14} /></button>
                      {hasPermission('technical', 'delete') && (
                        <button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); setDeleting({ table: 'technical_tickets', id: t.id, label: t.ticket_no }); }}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Ticket</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Project *</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">-- Select Project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Ticket No *</label><input className="input" value={form.ticket_no} onChange={(e) => setForm({ ...form, ticket_no: e.target.value })} /></div>
                <div><label className="label">Type</label>
                  <select className="input" value={form.ticket_type} onChange={(e) => setForm({ ...form, ticket_type: e.target.value })}>
                    {TICKET_TYPES.map(tp => <option key={tp} value={tp}>{tp.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Title (EN) *</label><input className="input" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} /></div>
              <div><label className="label">Title (AR)</label><input className="input" value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Priority</label>
                  <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div><label className="label">Status</label>
                  <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Assigned To</label>
                  <select className="input" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                    <option value="">-- Unassigned --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
                  </select>
                </div>
                <div><label className="label">Due Date</label><input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              {hasPermission('technical', 'create') && <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>}
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImport && <CsvImportModal moduleName="Technical Tickets" config={importConfig} onClose={() => { setShowImport(false); loadTickets(); }} />}

      {deleting && (
        <ConfirmDialog
          title="Delete"
          message={`Delete "${deleting.label}"?`}
          variant="danger"
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleting.table, deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function CommentsTab() {
  const { user: authUser } = useAuth();
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.from('technical_tickets')
      .select('id, ticket_no, title_en')
      .order('created_at', { ascending: false })
      .then(res => setTickets((res.data || []) as Ticket[]));
  }, []);

  useEffect(() => {
    if (!selectedTicketId) { setComments([]); return; }
    setLoading(true);
    supabase.from('ticket_comments')
      .select('*, user:user_profiles(id, full_name_en, avatar_url)')
      .eq('ticket_id', selectedTicketId)
      .order('created_at', { ascending: true })
      .then(res => { setComments((res.data || []) as TicketComment[]); setLoading(false); });
  }, [selectedTicketId]);

  async function handleSubmit() {
    if (!selectedTicketId || !newComment.trim()) return;
    setSending(true);
    try {
      let attachmentUrl = '';
      if (attachment) {
        setUploading(true);
        const path = `technical/comments/${selectedTicketId}/${Date.now()}_${attachment.name}`;
        const { error: uploadErr } = await supabase.storage.from('documents').upload(path, attachment);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        attachmentUrl = urlData.publicUrl;
        setUploading(false);
      }
      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: selectedTicketId, user_id: authUser?.id,
        comment_text: newComment.trim(), attachment_url: attachmentUrl || null,
      });
      if (error) throw error;
      setNewComment('');
      setAttachment(null);
      const res = await supabase.from('ticket_comments')
        .select('*, user:user_profiles(id, full_name_en, avatar_url)')
        .eq('ticket_id', selectedTicketId)
        .order('created_at', { ascending: true });
      setComments((res.data || []) as TicketComment[]);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to post comment'); }
    finally { setSending(false); }
  }

  async function deleteComment(id: string) {
    try {
      await supabase.from('ticket_comments').delete().eq('id', id);
      setComments(prev => prev.filter(c => c.id !== id));
      toast.success('Comment deleted');
    } catch { toast.error('Delete failed'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <label className="label mb-0">Ticket:</label>
        <select className="input max-w-md" value={selectedTicketId} onChange={(e) => setSelectedTicketId(e.target.value)}>
          <option value="">-- Select a ticket --</option>
          {tickets.map(t => <option key={t.id} value={t.id}>{t.ticket_no} - {t.title_en}</option>)}
        </select>
      </div>

      {selectedTicketId && (
        <>
          <div className="card p-5 space-y-4 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No comments yet. Start the discussion below.</div>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary, #f8f9fa)' }}>
                  <Avatar url={c.user?.avatar_url} name={c.user?.full_name_en} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.user?.full_name_en || 'Unknown'}</span>
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      {c.user_id === authUser?.id && (
                        <button className="btn-sm btn-secondary" style={{ color: 'var(--color-danger)' }} onClick={() => deleteComment(c.id)}><Trash2 size={12} /></button>
                      )}
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{c.comment_text}</p>
                    {c.attachment_url && (
                      <a href={c.attachment_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs mt-2 rounded-md px-2 py-1"
                        style={{ backgroundColor: 'var(--color-primary)10', color: 'var(--color-primary)' }}>
                        <Download size={12} /> Attachment
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card p-5 space-y-3">
            <h4 className="font-semibold text-sm">Add Comment</h4>
            <textarea className="input" rows={3} placeholder="Write your comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
            <div className="flex items-center gap-3 flex-wrap">
              <label className="btn-sm btn-secondary cursor-pointer">
                <Upload size={14} /> {attachment ? attachment.name : 'Attach File'}
                <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
              </label>
              {attachment && <button className="btn-sm btn-secondary text-xs" style={{ color: 'var(--color-danger)' }} onClick={() => setAttachment(null)}>Remove</button>}
              <button className="btn-primary btn-sm ml-auto" onClick={handleSubmit} disabled={sending || !newComment.trim()}>
                {sending ? (uploading ? 'Uploading...' : 'Sending...') : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
