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

interface NcrRecord {
  id: string; wir_no: string; title_en: string; request_date: string;
  status: string; ncr_reason: string; location: string; project_id: string;
}

interface Project {
  id: string; name_en: string; project_code: string;
}

export default function QualityPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [ncrs, setNcrs] = useState<NcrRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [deleting, setDeleting] = useState<{ table: string; id: string; label: string } | null>(null);
  const [form, setForm] = useState({ project_id: '', wir_no: '', title_en: '', ncr_reason: '', status: 'open', description: '', division: '', activity: '', zone: '', block: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [ncrRes, projRes] = await Promise.all([
        supabase.from('work_requests').select('id, wir_no, title_en, request_date, status, ncr_reason, location, project_id').eq('is_ncr', true).order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
      ]);
      setNcrs((ncrRes.data || []) as NcrRecord[]);
      setProjects((projRes.data || []) as Project[]);
    } catch (err) {
      console.error('Failed to load quality data:', err);
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

  const filtered = ncrs.filter((n) => !search || n.wir_no.toLowerCase().includes(search.toLowerCase()) || n.title_en.toLowerCase().includes(search.toLowerCase()));

  async function save() {
    setFormError('');
    if (!form.project_id) { setFormError('Project is required'); return; }
    if (!form.wir_no.trim()) { setFormError('NCR No is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('work_requests').insert({
        project_id: form.project_id, wir_no: form.wir_no, title_en: form.title_en,
        is_ncr: true, status: form.status,
        ncr_reason: form.ncr_reason || null,
        description: form.description || form.title_en,
        division: form.division || null, activity: form.activity || null,
        zone: form.zone || null, block: form.block || null,
        request_date: new Date().toISOString().slice(0, 10),
        requested_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast.success(`NCR "${form.wir_no}" created`);
      setShowForm(false); setForm({ project_id: '', wir_no: '', title_en: '', ncr_reason: '', status: 'open', description: '', division: '', activity: '', zone: '', block: '' }); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  const columns = [
    { key: 'wir_no', label: 'NCR No', required: true },
    { key: 'title_en', label: 'Title', required: true },
    { key: 'status', label: 'Status' },
    { key: 'ncr_reason', label: 'Reason' },
  ];

  const importConfig: SyncConfig = {
    table: 'work_requests',
    columns: [
      { key: 'wir_no', label: 'NCR No', required: true },
      { key: 'title_en', label: 'Title', required: true },
      { key: 'status', label: 'Status' },
      { key: 'ncr_reason', label: 'Reason' },
    ],
    fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }],
    defaults: { is_ncr: true, status: 'open' },
  };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('nav.quality')}</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{ncrs.length} NCRs</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as unknown as Record<string, unknown>[], `ncrs_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> {t('admin.export_csv')}
          </button>
          <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={14} /> {t('admin.import_csv')}
          </button>
          <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New NCR
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
              <tr><th>NCR No</th><th>Title</th><th>Date</th><th>Status</th><th>Reason</th><th>{t('common.actions')}</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.no_results')}</td></tr>
              ) : (
                filtered.slice((page - 1) * pageSize, page * pageSize).map((n) => {
                  const statusColor: Record<string,string> = { open: 'badge-danger', in_progress: 'badge-warning', resolved: 'badge-success', closed: 'badge' };
                  return (
                    <tr key={n.id} className="clickable" onClick={() => navigate(`/execution/wir/${n.id}`)}>
                      <td className="font-mono text-xs">{n.wir_no}</td>
                      <td className="font-medium">{n.title_en}</td>
                      <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{n.request_date}</td>
                      <td><span className={`badge capitalize ${statusColor[n.status] || 'badge'}`}>{n.status}</span></td>
                      <td className="min-w-[200px] whitespace-normal break-all text-sm" style={{ color: 'var(--color-text-secondary)' }}>{n.ncr_reason || '-'}</td>
                       <td><button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); navigate(`/execution/wir/${n.id}`); }}><Eye size={14} /></button><button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); setDeleting({ table: 'work_requests', id: n.id, label: n.wir_no }); }}><Trash2 size={14} /></button></td>
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
            <h3 className="text-lg font-semibold mb-4">Create NCR</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Project *</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">-- Select Project --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">NCR No *</label><input className="input" value={form.wir_no} onChange={(e) => setForm({ ...form, wir_no: e.target.value })} /></div>
              <div><label className="label">Title</label><input className="input" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} /></div>
              <div><label className="label">Status</label>
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div><label className="label">Reason</label><input className="input" value={form.ncr_reason} onChange={(e) => setForm({ ...form, ncr_reason: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImport && <CsvImportModal moduleName="NCRs" config={importConfig} onClose={() => { setShowImport(false); load(); }} />}

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
