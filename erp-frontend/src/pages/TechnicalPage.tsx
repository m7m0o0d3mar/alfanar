import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { exportCSV } from '../utils/csv';
import CsvImportModal from '../components/CsvImportModal';
import { type SyncConfig } from '../services/syncService';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Upload, Eye, Search, Trash2 } from 'lucide-react';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';

interface Ticket {
  id: string; ticket_no: string; title_en: string; category: string;
  priority: string; status: string; assigned_to: string; created_at: string;
  ticket_type: string;
}

interface UserProfile {
  id: string; full_name_en: string;
}

interface Project {
  id: string; name_en: string; project_code: string;
}

export default function TechnicalPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [deleting, setDeleting] = useState<{ table: string; id: string; label: string } | null>(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ project_id: '', ticket_no: '', title_en: '', ticket_type: 'rfi', priority: 'medium' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [tickRes, projRes, userRes] = await Promise.all([
        supabase.from('technical_tickets').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
        supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
      ]);
      setTickets((tickRes.data || []) as Ticket[]);
      setProjects((projRes.data || []) as Project[]);
      setUsers((userRes.data || []) as UserProfile[]);
    } catch (err) {
      console.error('Failed to load technical data:', err);
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(table: string, id: string) {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted successfully');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
    setDeleting(null);
  }

  const filtered = tickets.filter((t) => !search ||
    t.ticket_no?.toLowerCase().includes(search.toLowerCase()) ||
    t.title_en?.toLowerCase().includes(search.toLowerCase()));

  async function save() {
    setFormError('');
    if (!form.project_id) { setFormError('Project is required'); return; }
    if (!form.ticket_no.trim()) { setFormError('Ticket No is required'); return; }
    if (!form.title_en.trim()) { setFormError('Title is required'); return; }
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) { setFormError('You must be logged in to create a ticket.'); setSaving(false); return; }
      const { error } = await supabase.from('technical_tickets').insert({
        project_id: form.project_id, ticket_no: form.ticket_no,
        title_en: form.title_en, ticket_type: form.ticket_type,
        priority: form.priority, status: 'open',
        description: form.title_en,
        requested_by: user.id,
      });
      if (error) throw error;
      toast.success(`Ticket "${form.ticket_no}" created`);
      setShowForm(false); setForm({ project_id: '', ticket_no: '', title_en: '', ticket_type: 'rfi', priority: 'medium' }); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  const columns = [
    { key: 'ticket_no', label: 'Ticket No', required: true },
    { key: 'title_en', label: 'Title', required: true },
    { key: 'description', label: 'Description', required: true },
    { key: 'ticket_type', label: 'Type' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'project_id', label: 'Project ID' },
    { key: 'requested_by', label: 'Requested By' },
    { key: 'assigned_to', label: 'Assigned To' },
  ];

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
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('nav.technical')}</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{tickets.length} Tickets</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as unknown as Record<string, unknown>[], `technical_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> {t('admin.export_csv')}
          </button>
          <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={14} /> {t('admin.import_csv')}
          </button>
          <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Ticket
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
        <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Ticket No</th><th>Title</th><th>Type</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>{t('common.actions')}</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.no_results')}</td></tr>
              ) : (
                filtered.slice((page - 1) * pageSize, page * pageSize).map((t) => {
                  const user = users.find((u) => u.id === t.assigned_to);
                  return (
                  <tr key={t.id} className="clickable" onClick={() => navigate(`/technical/tickets/${t.id}`)}>
                    <td className="font-mono text-xs">{t.ticket_no}</td>
                    <td className="font-medium">{t.title_en}</td>
                    <td className="text-sm capitalize">{t.ticket_type}</td>
                    <td><span className={`badge capitalize ${t.priority === 'high' || t.priority === 'urgent' ? 'badge-danger' : t.priority === 'medium' ? 'badge-warning' : 'badge-success'}`}>{t.priority}</span></td>
                    <td><span className={`badge capitalize ${t.status === 'closed' ? 'badge-success' : t.status === 'open' ? 'badge-warning' : 'badge-info'}`}>{t.status.replace(/_/g, ' ')}</span></td>
                    <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{user?.full_name_en || '-'}</td>
                     <td><button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); navigate(`/technical/tickets/${t.id}`); }}><Eye size={14} /></button><button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); setDeleting({ table: 'technical_tickets', id: t.id, label: t.ticket_no }); }}><Trash2 size={14} /></button></td>
                   </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Ticket</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Project *</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">-- Select Project --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Ticket No *</label><input className="input" value={form.ticket_no} onChange={(e) => setForm({ ...form, ticket_no: e.target.value })} /></div>
              <div><label className="label">Title *</label><input className="input" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Type</label>
                  <select className="input" value={form.ticket_type} onChange={(e) => setForm({ ...form, ticket_type: e.target.value })}>
                    {['rfi','design_query','shop_drawing_review','method_statement_review','submittal_review','site_instruction','technical_query','other'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label className="label">Priority</label>
                  <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {['low','medium','high','urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImport && <CsvImportModal moduleName="Technical Tickets" config={importConfig} onClose={() => { setShowImport(false); load(); }} />}

      {deleting && (
        <ConfirmDialog
          title="Delete"
          message={`Are you sure you want to delete "${deleting.label}"?`}
          variant="danger"
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleting.table, deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
