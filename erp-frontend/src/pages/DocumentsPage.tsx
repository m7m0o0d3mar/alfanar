import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { exportCSV } from '../utils/csv';
import CsvImportModal from '../components/CsvImportModal';
import { type SyncConfig } from '../services/syncService';
import { Plus, Download, Upload, Eye, Search, ExternalLink, Database, Trash2 } from 'lucide-react';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';

interface Document {
  id: string; doc_code: string; title_en: string; category: string;
  revision: string; description: string; status: string; uploaded_by: string; created_at: string;
  doc_type: string; file_url: string | null;
}

interface Project {
  id: string; name_en: string; project_code: string;
}

export default function DocumentsPage() {
  const t = useT();
  const toast = useToast();
  const [docs, setDocs] = useState<Document[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ project_id: '', doc_code: '', title_en: '', doc_type: 'drawing', category: '', revision: '', description: '' });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [deleting, setDeleting] = useState<{ table: string; id: string; label: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function seedSampleDocuments() {
    const projRes = await supabase.from('projects').select('id, project_code').eq('is_active', true);
    const projects = projRes.data || [];
    if (projects.length === 0) { toast.error('No projects found to seed documents'); return; }
    setSaving(true);
    let count = 0;
    for (const p of projects) {
      const samples = [
        { doc_code: `${p.project_code}-DRW-001`, title_en: 'Architectural Floor Plan', doc_type: 'drawing', category: 'Architectural', revision: 'A', description: 'Ground floor architectural plan with dimensions and room layout' },
        { doc_code: `${p.project_code}-DRW-002`, title_en: 'Structural Foundation Plan', doc_type: 'drawing', category: 'Structural', revision: 'A', description: 'Foundation layout with reinforcement details' },
        { doc_code: `${p.project_code}-SPC-001`, title_en: 'Material Specifications - Concrete', doc_type: 'specification', category: 'Materials', revision: 'B', description: 'Specifications for all concrete works' },
        { doc_code: `${p.project_code}-RPT-001`, title_en: 'Monthly Progress Report', doc_type: 'report', category: 'Progress', revision: 'A', description: 'Monthly progress report' },
        { doc_code: `${p.project_code}-CON-001`, title_en: 'Site Instruction - Column Adjustment', doc_type: 'correspondence', category: 'Site Instructions', revision: 'A', description: 'Site instruction regarding column alignment' },
      ];
      for (const s of samples) {
        try {
          const { error } = await supabase.from('documents').insert({ ...s, project_id: p.id, status: 'current' });
          if (!error) count++;
        } catch {}
      }
    }
    toast.success(`Seeded ${count} sample document(s)`);
    setSaving(false);
    load();
  }

  async function load() {
    setLoading(true);
    try {
      const [docRes, projRes] = await Promise.all([
        supabase.from('documents').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
      ]);
      const docsData = (docRes.data || []) as Document[];
      const projData = (projRes.data || []) as Project[];
      setDocs(docsData);
      setProjects(projData);
      if (docsData.length === 0 && projData.length > 0 && !seeded) {
        setSeeded(true);
        seedSampleDocuments();
      }
    } catch (err) {
      console.error('Failed to load documents data:', err);
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

  const filtered = docs.filter((d) => !search ||
    d.doc_code?.toLowerCase().includes(search.toLowerCase()) ||
    d.title_en?.toLowerCase().includes(search.toLowerCase()));

  async function uploadFile(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop();
    const filePath = `documents/${form.project_id}/${form.doc_code}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true });
    if (uploadError) { console.error('File upload error:', uploadError); return null; }
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
    return urlData?.publicUrl || null;
  }

  async function save() {
    setFormError('');
    if (!form.project_id) { setFormError('Project is required'); return; }
    if (!form.doc_code.trim()) { setFormError('Document Code is required'); return; }
    if (!form.title_en.trim()) { setFormError('Title is required'); return; }
    setSaving(true);
    try {
      let fileUrl: string | null = null;
      if (file) {
        setUploading(true);
        fileUrl = await uploadFile(file);
        setUploading(false);
        if (!fileUrl) { setFormError('File upload failed'); return; }
      }
      const { error } = await supabase.from('documents').insert({
        project_id: form.project_id, doc_code: form.doc_code,
        title_en: form.title_en, doc_type: form.doc_type,
        category: form.category || null, revision: form.revision || null,
        description: form.description || null, status: 'current',
        file_url: fileUrl,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast.success(`Document "${form.doc_code}" uploaded`);
      setShowForm(false); setForm({ project_id: '', doc_code: '', title_en: '', doc_type: 'drawing', category: '', revision: '', description: '' }); setFile(null); load();
    } catch (err: unknown) {
      console.error('Document save failed:', err);
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); setUploading(false); }
  }

  const columns = [
    { key: 'doc_code', label: 'Document Code', required: true },
    { key: 'title_en', label: 'Title', required: true },
    { key: 'doc_type', label: 'Type' },
    { key: 'revision', label: 'Revision' },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status' },
    { key: 'uploaded_by', label: 'Uploaded By' },
  ];

  const importConfig: SyncConfig = {
    table: 'documents',
    columns: [
      { key: 'doc_code', label: 'Document Code', required: true },
      { key: 'title_en', label: 'Title', required: true },
      { key: 'doc_type', label: 'Type' },
      { key: 'revision', label: 'Revision' },
      { key: 'description', label: 'Description' },
    ],
    fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }],
    defaults: { status: 'draft', doc_type: 'general' },
  };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('nav.documents')}</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{docs.length} Documents</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as unknown as Record<string, unknown>[], `documents_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> {t('admin.export_csv')}
          </button>
          <button className="btn-sm btn-secondary" onClick={seedSampleDocuments} disabled={saving}>
            <Database size={14} /> Seed Sample
          </button>
          <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={14} /> {t('admin.import_csv')}
          </button>
          <button className="btn-primary btn-sm" onClick={() => { setFormError(''); setShowForm(true); }}>
            <Plus size={16} /> Upload Document
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
              <tr><th>Document Code</th><th>Title</th><th>Type</th><th>Revision</th><th>Description</th><th>Status</th><th>Uploaded By</th><th>{t('common.actions')}</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.no_results')}</td></tr>
              ) : (
                filtered.slice((page - 1) * pageSize, page * pageSize).map((d) => (
                  <tr key={d.id}>
                    <td className="font-mono text-xs">{d.doc_code}</td>
                    <td className="font-medium">{d.title_en}</td>
                    <td className="text-sm capitalize" style={{ color: 'var(--color-text-secondary)' }}>{d.doc_type}</td>
                    <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>v{d.revision || 'A'}</td>
                    <td className="text-sm max-w-[200px] truncate" style={{ color: 'var(--color-text-secondary)' }}>{d.description || '-'}</td>
                    <td><span className={`badge capitalize ${d.status === 'current' ? 'badge-success' : d.status === 'draft' ? 'badge' : 'badge-warning'}`}>{d.status}</span></td>
                    <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{d.uploaded_by || '-'}</td>
                     <td>
                       <div className="flex gap-1">
                         {d.file_url ? (
                           <>
                             <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="btn-sm btn-secondary"><ExternalLink size={14} /></a>
                             <a href={d.file_url} download className="btn-sm btn-secondary"><Download size={14} /></a>
                           </>
                         ) : null}
                         <button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); setDeleting({ table: 'documents', id: d.id, label: d.doc_code }); }}><Trash2 size={14} /></button>
                       </div>
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
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Upload Document</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Project *</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">-- Select Project --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Document Code *</label><input className="input" value={form.doc_code} onChange={(e) => setForm({ ...form, doc_code: e.target.value })} /></div>
              <div><label className="label">Title *</label><input className="input" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} /></div>
              <div><label className="label">File *</label>
                <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Type</label>
                  <select className="input" value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })}>
                    {['drawing','contract','specification','report','method_statement','submittal','permit','correspondence','invoice','photo','other'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label className="label">Category</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              </div>
              <div><label className="label">Revision Number</label><input type="text" className="input" placeholder="e.g. A, 1.0, 01" value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} /></div>
              <div><label className="label">Description</label><textarea className="input" placeholder="Document description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving || uploading}>{uploading ? 'Uploading file...' : saving ? 'Saving...' : 'Upload'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImport && <CsvImportModal moduleName="Documents" config={importConfig} onClose={() => { setShowImport(false); load(); }} />}

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
