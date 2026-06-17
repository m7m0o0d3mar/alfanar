import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { exportCSV } from '../utils/csv';
import CsvImportModal from '../components/CsvImportModal';
import { type SyncConfig } from '../services/syncService';
import { Plus, Download, Upload, Eye, Search, Trash2 } from 'lucide-react';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';

interface Incident {
  id: string; incident_no: string; title: string; incident_date: string;
  incident_type: string; severity: string; location: string; status: string;
}

interface Project {
  id: string; name_en: string; project_code: string;
}

export default function HSEPage() {
  const t = useT();
  const toast = useToast();
  const [records, setRecords] = useState<Incident[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'incidents' | 'observations'>('incidents');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [deleting, setDeleting] = useState<{ table: string; id: string; label: string } | null>(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ project_id: '', incident_no: '', title: '', incident_type: 'near_miss', severity: 'low', description: '', location: '', incident_date: new Date().toISOString().slice(0, 10), injured_person: '', corrective_action: '' });

  useEffect(() => { setPage(1); load(); }, [tab]);

  async function load() {
    setLoading(true);
    try {
      const tbl = tab === 'incidents' ? 'safety_incidents' : 'safety_observations';
      const [dataRes, projRes] = await Promise.all([
        supabase.from(tbl).select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
      ]);
      setRecords((dataRes.data || []) as Incident[]);
      setProjects((projRes.data || []) as Project[]);
    } catch (err) {
      console.error('Failed to load HSE data:', err);
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

  function stripTypePrefix(text: string, incidentType?: string): string {
    if (!text || !incidentType) return text || '';
    const idx = text.indexOf(incidentType);
    if (idx === 0) {
      return text.slice(incidentType.length).replace(/^[\s\-–—:]+/, '') || text;
    }
    return text;
  }

  const filtered = records.filter((i) => {
    const no = (i as any)[tab === 'incidents' ? 'incident_no' : 'observation_no'] || i.incident_no || '';
    const title = stripTypePrefix((i as any)[tab === 'incidents' ? 'title' : 'description'] || i.title || '', (i as any).incident_type || (i as any).observation_type);
    if (!search) return true;
    return no.toLowerCase().includes(search.toLowerCase()) || title.toLowerCase().includes(search.toLowerCase());
  });

  async function save() {
    setFormError('');
    if (!form.project_id) { setFormError('Project is required'); return; }
    if (!form.incident_no.trim()) { setFormError('Reference No is required'); return; }
    setSaving(true);
    try {
      const tbl = tab === 'incidents' ? 'safety_incidents' : 'safety_observations';
      const payload: Record<string, unknown> = {
        project_id: form.project_id,
        incident_no: form.incident_no,
        title: form.title,
        incident_date: form.incident_date || new Date().toISOString().slice(0, 10),
        location: form.location || null,
        description: form.description || form.title,
        status: 'reported',
        reported_by: (await supabase.auth.getUser()).data.user?.id,
      };
      payload.incident_type = form.incident_type;
      payload.severity = form.severity;
      if (tab === 'incidents') {
        payload.injured_person = form.injured_person || null;
        payload.corrective_action = form.corrective_action || null;
      }
      const { error } = await supabase.from(tbl).insert(payload);
      if (error) throw error;
      toast.success(`${tab === 'incidents' ? 'Incident' : 'Observation'} "${form.incident_no}" created`);
      setShowForm(false); setForm({ project_id: '', incident_no: '', title: '', incident_type: 'near_miss', severity: 'low', description: '', location: '', incident_date: new Date().toISOString().slice(0, 10), injured_person: '', corrective_action: '' }); load();
    } catch (err: unknown) {
      console.error('HSE save failed:', err);
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  const columns = tab === 'incidents'
    ? [
        { key: 'incident_no', label: 'Incident No', required: true },
        { key: 'title', label: 'Title', required: true },
        { key: 'incident_date', label: 'Date' },
        { key: 'incident_type', label: 'Type' },
        { key: 'severity', label: 'Severity' },
      ]
    : [
        { key: 'observation_no', label: 'Observation No', required: true },
        { key: 'description', label: 'Description', required: true },
        { key: 'observation_date', label: 'Date' },
        { key: 'observation_type', label: 'Type' },
      ];

  const importConfig: SyncConfig = tab === 'incidents'
    ? {
        table: 'safety_incidents',
        columns: [
          { key: 'incident_no', label: 'Incident No', required: true },
          { key: 'title', label: 'Title', required: true },
          { key: 'incident_date', label: 'Date' },
          { key: 'incident_type', label: 'Type' },
          { key: 'severity', label: 'Severity' },
        ],
        fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }],
        defaults: { status: 'open' },
      }
    : {
        table: 'safety_observations',
        columns: [
          { key: 'observation_no', label: 'Observation No', required: true },
          { key: 'description', label: 'Description', required: true },
          { key: 'observation_date', label: 'Date' },
          { key: 'observation_type', label: 'Type' },
        ],
        fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }],
        defaults: { status: 'open' },
      };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('nav.hse')}</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as unknown as Record<string, unknown>[], `hse_${tab}_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> {t('admin.export_csv')}
          </button>
          <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={14} /> {t('admin.import_csv')}
          </button>
          <button className="btn-primary btn-sm" onClick={() => { setFormError(''); setShowForm(true); }}>
            <Plus size={16} /> {tab === 'incidents' ? 'New Incident' : 'New Observation'}
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'incidents' ? 'tab-active' : ''}`} onClick={() => setTab('incidents')}>Incidents</button>
        <button className={`tab ${tab === 'observations' ? 'tab-active' : ''}`} onClick={() => setTab('observations')}>Observations</button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
        <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
              <thead>
                <tr><th>{tab === 'incidents' ? 'Incident No' : 'Observation No'}</th><th>{tab === 'incidents' ? 'Title' : 'Description'}</th><th>Date</th><th>Type</th>{tab === 'incidents' && <th>Severity</th>}<th>{t('common.actions')}</th></tr>
              </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={tab === 'incidents' ? 6 : 5} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={tab === 'incidents' ? 6 : 5} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.no_results')}</td></tr>
              ) : (
                filtered.slice((page - 1) * pageSize, page * pageSize).map((i) => {
                  const no = tab === 'incidents' ? i.incident_no : (i as any).observation_no || i.incident_no;
                  const rawTitle = tab === 'incidents' ? i.title : (i as any).description || i.title;
                  const incidentType = tab === 'incidents' ? i.incident_type : (i as any).observation_type || i.incident_type;
                  const title = stripTypePrefix(rawTitle, incidentType);
                  const date = tab === 'incidents' ? i.incident_date : (i as any).observation_date || i.incident_date;
                  const type = incidentType;
                  return (
                  <tr key={i.id}>
                    <td className="font-mono text-xs">{no}</td>
                    <td className="font-medium">{title}</td>
                    <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{date}</td>
                    <td className="text-sm capitalize">{type?.replace(/_/g, ' ')}</td>
                    {tab === 'incidents' && <td><span className={`badge capitalize ${i.severity === 'critical' ? 'badge-danger' : i.severity === 'high' ? 'badge-warning' : i.severity === 'medium' ? 'badge-warning' : 'badge-success'}`}>{i.severity}</span></td>}
                     <td><button className="btn-sm btn-secondary" onClick={() => toast.info('Full page view coming soon')}><Eye size={14} /></button><button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); setDeleting({ table: tab === 'incidents' ? 'safety_incidents' : 'safety_observations', id: i.id, label: no }); }}><Trash2 size={14} /></button></td>
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
            <h3 className="text-lg font-semibold mb-4">{tab === 'incidents' ? 'New Incident' : 'New Observation'}</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Project *</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">-- Select Project --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">{tab === 'incidents' ? 'Incident No' : 'Observation No'} *</label><input className="input" value={form.incident_no} onChange={(e) => setForm({ ...form, incident_no: e.target.value })} /></div>
              <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Date</label><input type="date" className="input" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} /></div>
                <div><label className="label">Location</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              </div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Type</label>
                  <select className="input" value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value })}>
                    {(tab === 'observations'
                      ? ['unsafe_act','unsafe_condition','near_miss','environmental']
                      : ['near_miss','minor_injury','serious_injury','fatality','property_damage','fire','environmental','other']
                    ).map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label className="label">Severity</label>
                  <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                    {['low','medium','high','critical'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {tab === 'incidents' && (
                <>
                  <div><label className="label">Injured Person</label><input className="input" value={form.injured_person} onChange={(e) => setForm({ ...form, injured_person: e.target.value })} /></div>
                  <div><label className="label">Corrective Action</label><textarea className="input" rows={3} value={form.corrective_action} onChange={(e) => setForm({ ...form, corrective_action: e.target.value })} /></div>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImport && <CsvImportModal moduleName={`HSE ${tab}`} config={importConfig} onClose={() => { setShowImport(false); load(); }} />}

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
