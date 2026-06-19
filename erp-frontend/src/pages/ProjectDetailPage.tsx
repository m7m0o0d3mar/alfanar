import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Building2, Calendar, MapPin, DollarSign, Layers, ClipboardList, ShoppingCart, FileText, CheckSquare, Edit3, User, ExternalLink, Download, Phone, Mail, Users, Image as ImageIcon, Globe, History } from 'lucide-react';

interface Project {
  id: string; project_code: string; name_en: string; name_ar: string;
  project_type: string; status: string; start_date: string; end_date: string;
  location: string; budget_amount: number; progress_percent: number;
  client_name: string; description: string;
  consultant_name?: string; consultant_company?: string;
  consultant_phone?: string; consultant_email?: string;
  project_manager_id?: string; partners?: string; stakeholders?: string;
  logo_url?: string; latitude?: number; longitude?: number;
}

interface AuditEntry {
  id: string; changed_by: string; action: string;
  table_name: string; record_id: string;
  old_data: Record<string, unknown>; new_data: Record<string, unknown>;
  changed_at: string;
  user_profile?: { full_name_en: string } | null;
}

interface Unit { id: string; unit_code: string; unit_type: string; status: string; price: number; bedrooms: number; }

interface ProjectDocument {
  id: string; doc_code: string; title_en: string;
  doc_type: string; revision: string; status: string;
  uploaded_at: string; file_url: string | null;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Project>>({});
  const [tab, setTab] = useState<'overview' | 'units' | 'documents' | 'history'>('overview');
  const [units, setUnits] = useState<Unit[]>([]);
  const [projectDocs, setProjectDocs] = useState<ProjectDocument[]>([]);
  const [userProfiles, setUserProfiles] = useState<{ id: string; full_name_en: string }[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('units').select('*').eq('project_id', id).limit(10),
      supabase.from('documents').select('*').eq('project_id', id).order('uploaded_at', { ascending: false }).limit(5),
      supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
    ]).then(([projRes, unitsRes, docRes, profilesRes]) => {
      if (projRes.error) throw new Error(projRes.error.message);
      setProject(projRes.data as Project | null);
      setForm(projRes.data as Project || {});
      setUnits((unitsRes.data || []) as Unit[]);
      setProjectDocs((docRes.data || []) as ProjectDocument[]);
      setUserProfiles((profilesRes.data || []) as { id: string; full_name_en: string }[]);
      setLoading(false);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to load project';
      setError(msg);
      toast.error(msg);
      setLoading(false);
    });
  }, [id]);

  async function loadAuditLogs() {
    if (!id) return;
    setHistoryLoading(true);
    try {
      let { data, error: err } = await supabase.from('audit_logs')
        .select('*, user_profile:user_profiles!audit_logs_user_id_fkey(full_name_en)')
        .eq('entity_type', 'projects')
        .eq('entity_id', id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) {
        if (err.code === '42P01') {
          toast.error('No audit logs available yet. Run migration 018 to enable auditing.');
          return;
        }
        toast.error('Failed to load audit history');
        return;
      }
      setAuditLogs((data || []) as unknown as AuditEntry[]);
    } catch {
      toast.error('An unexpected error occurred while loading audit history');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function save() {
    if (!id) return;
    if (form.end_date && form.start_date && form.end_date <= form.start_date) {
      toast.error('تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('projects').update(form).eq('id', id);
      if (error) throw error;
      toast.success('Project updated');
      setEditing(false);
      const { data } = await supabase.from('projects').select('*').eq('id', id).single();
      setProject(data as Project | null);
    } catch (err: unknown) {
      console.error('Project update failed:', err);
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" /></div>;
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>;
  if (!project) return <div className="text-center py-20 text-gray-400">Project not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/projects')} className="btn-sm btn-secondary">
          <ArrowLeft size={16} /> {t('common.back')}
        </button>
        <button className="btn-sm btn-secondary" onClick={() => setEditing(!editing)}>
          <Edit3 size={14} /> {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name_en}</h1>
            <p className="text-sm text-gray-500 font-mono mt-1">{project.project_code}</p>
            {project.name_ar && <p className="text-sm text-gray-400 text-right" dir="rtl">{project.name_ar}</p>}
          </div>
          <span className={`badge text-xs ${
            project.status === 'active' ? 'badge-success' :
            project.status === 'planning' ? 'badge-info' :
            'badge-neutral'
          }`}>{project.status}</span>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
            <span>Progress</span>
            <span>{project.progress_percent}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${project.progress_percent}%` }} />
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'overview' ? 'tab-active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`tab ${tab === 'units' ? 'tab-active' : ''}`} onClick={() => setTab('units')}>Units</button>
        <button className={`tab ${tab === 'documents' ? 'tab-active' : ''}`} onClick={() => setTab('documents')}>Documents</button>
        <button className={`tab ${tab === 'history' ? 'tab-active' : ''}`} onClick={() => { setTab('history'); loadAuditLogs(); }}>Update History</button>
      </div>

      {editing && (
        <div className="card space-y-4">
          <h3 className="font-semibold">Edit Project</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Project Name (EN)</label><input className="input" value={form.name_en || ''} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Project Name (AR)</label><input className="input text-right" dir="rtl" value={form.name_ar || ''} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
            <div><label className="label">Project Code</label><input className="input" value={form.project_code || ''} onChange={(e) => setForm({ ...form, project_code: e.target.value })} /></div>
            <div><label className="label">Type</label>
              <select className="input" value={form.project_type || ''} onChange={(e) => setForm({ ...form, project_type: e.target.value })}>
                {['residential','commercial','mixed_use','infrastructure','industrial','other'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Status</label>
              <select className="input" value={form.status || ''} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['planning','active','on_hold','completed','cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Client Name</label><input className="input" value={form.client_name || ''} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
            <div><label className="label">Start Date</label><input type="date" className="input" value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label className="label">End Date</label><input type="date" className="input" value={form.end_date || ''} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            <div><label className="label">Location</label><input className="input" value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><label className="label">Budget</label><input type="number" className="input" value={form.budget_amount ?? ''} onChange={(e) => setForm({ ...form, budget_amount: e.target.value ? parseFloat(e.target.value) : undefined })} /></div>
            <div><label className="label">Progress (%)</label><input type="number" className="input" min={0} max={100} value={form.progress_percent ?? 0} onChange={(e) => setForm({ ...form, progress_percent: parseInt(e.target.value) || 0 })} /></div>
            <div className="col-span-2"><hr className="border-gray-200" /></div>
            <div className="col-span-2"><h4 className="font-medium text-gray-700 text-sm">Consultant Info</h4></div>
            <div><label className="label">Consultant Name</label><input className="input" value={form.consultant_name || ''} onChange={(e) => setForm({ ...form, consultant_name: e.target.value })} /></div>
            <div><label className="label">Consultant Company</label><input className="input" value={form.consultant_company || ''} onChange={(e) => setForm({ ...form, consultant_company: e.target.value })} /></div>
            <div><label className="label">Consultant Phone</label><input className="input" value={form.consultant_phone || ''} onChange={(e) => setForm({ ...form, consultant_phone: e.target.value })} /></div>
            <div><label className="label">Consultant Email</label><input type="email" className="input" value={form.consultant_email || ''} onChange={(e) => setForm({ ...form, consultant_email: e.target.value })} /></div>
            <div className="col-span-2"><hr className="border-gray-200" /></div>
            <div className="col-span-2"><h4 className="font-medium text-gray-700 text-sm">Team & Partners</h4></div>
            <div><label className="label">Project Manager</label>
              <select className="input" value={form.project_manager_id || ''} onChange={(e) => setForm({ ...form, project_manager_id: e.target.value || undefined })}>
                <option value="">-- Select --</option>
                {userProfiles.map((up) => <option key={up.id} value={up.id}>{up.full_name_en}</option>)}
              </select>
            </div>
            <div><label className="label">Logo URL</label><input className="input" value={form.logo_url || ''} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://example.com/logo.png" /></div>
            <div className="col-span-2"><label className="label">Partners (comma separated)</label><textarea className="input" rows={2} value={form.partners || ''} onChange={(e) => setForm({ ...form, partners: e.target.value })} placeholder="Partner 1, Partner 2, Partner 3" /></div>
            <div className="col-span-2"><label className="label">Stakeholders (comma separated)</label><textarea className="input" rows={2} value={form.stakeholders || ''} onChange={(e) => setForm({ ...form, stakeholders: e.target.value })} placeholder="Stakeholder A, Stakeholder B" /></div>
            <div className="col-span-2"><hr className="border-gray-200" /></div>
            <div className="col-span-2"><h4 className="font-medium text-gray-700 text-sm">Location Coordinates</h4></div>
            <div><label className="label">Latitude</label><input type="number" step="any" className="input" value={form.latitude ?? ''} onChange={(e) => setForm({ ...form, latitude: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="24.7136" /></div>
            <div><label className="label">Longitude</label><input type="number" step="any" className="input" value={form.longitude ?? ''} onChange={(e) => setForm({ ...form, longitude: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="46.6753" /></div>
          </div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Building2 size={16} /> Details</h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="capitalize">{project.project_type}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="capitalize">{project.status}</span></div>
                {project.client_name && <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><User size={14} /> Client</span><span>{project.client_name}</span></div>}
                {project.location && <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><MapPin size={14} /> Location</span><span>{project.location}</span></div>}
                {project.budget_amount > 0 && <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><DollarSign size={14} /> Budget</span><span>{project.budget_amount.toLocaleString()} SAR</span></div>}
              </div>
            </div>
            <div className="card space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Calendar size={16} /> Schedule</h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-gray-500">Start</span><span>{project.start_date || '-'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">End</span><span>{project.end_date || '-'}</span></div>
              </div>
            </div>
            {project.description && (
              <div className="card col-span-full space-y-3">
                <h3 className="font-semibold text-gray-900">Description</h3>
                <p className="text-sm text-gray-700">{project.description}</p>
              </div>
            )}
          </div>

          {/* Project Team */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users size={16} /> Project Team</h3>
            <div className="text-sm space-y-2">
              {project.project_manager_id ? (
                <div className="flex justify-between">
                  <span className="text-gray-500">Project Manager</span>
                  <span>{userProfiles.find((u) => u.id === project.project_manager_id)?.full_name_en || project.project_manager_id}</span>
                </div>
              ) : null}
              {project.consultant_name && <div className="flex justify-between"><span className="text-gray-500">Consultant</span><span>{project.consultant_name}</span></div>}
              {project.consultant_company && <div className="flex justify-between"><span className="text-gray-500">Consultant Company</span><span>{project.consultant_company}</span></div>}
              {project.consultant_phone && <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><Phone size={14} /> Consultant Phone</span><span dir="ltr">{project.consultant_phone}</span></div>}
              {project.consultant_email && <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><Mail size={14} /> Consultant Email</span><span>{project.consultant_email}</span></div>}
              {project.partners && <div className="flex justify-between"><span className="text-gray-500">Partners</span><span>{project.partners}</span></div>}
              {project.stakeholders && <div className="flex justify-between"><span className="text-gray-500">Stakeholders</span><span>{project.stakeholders}</span></div>}
              {!project.project_manager_id && !project.consultant_name && !project.partners && !project.stakeholders && (
                <p className="text-gray-400 italic">No team information available</p>
              )}
            </div>
          </div>

          {/* Location */}
          {project.latitude != null || project.longitude != null ? (
            <div className="card space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Globe size={16} /> Location</h3>
              <div className="text-sm space-y-2">
                {project.latitude != null && <div className="flex justify-between"><span className="text-gray-500">Latitude</span><span>{project.latitude}</span></div>}
                {project.longitude != null && <div className="flex justify-between"><span className="text-gray-500">Longitude</span><span>{project.longitude}</span></div>}
              </div>
            </div>
          ) : null}

          {/* Logo */}
          {project.logo_url && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><ImageIcon size={16} /> Logo</h3>
              <img src={project.logo_url} alt="Project logo" className="max-h-24 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t('nav.units'), icon: Layers, path: '/units' },
                { label: t('nav.execution'), icon: ClipboardList, path: '/execution' },
                { label: t('nav.procurement'), icon: ShoppingCart, path: '/procurement' },
                { label: t('nav.quality'), icon: FileText, path: '/quality' },
                { label: t('nav.hse'), icon: CheckSquare, path: '/hse' },
                { label: t('nav.finance'), icon: DollarSign, path: '/finance' },
                { label: t('nav.documents'), icon: FileText, path: '/documents' },
                { label: t('nav.approvals'), icon: CheckSquare, path: '/approvals' },
              ].map((link) => (
                <button key={link.path} onClick={() => navigate(link.path)} className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
                  <link.icon size={18} className="text-primary" />
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'units' && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Unit Code</th><th>Type</th><th>Bedrooms</th><th>Price</th><th>Status</th></tr>
              </thead>
              <tbody>
                {units.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">No units found</td></tr>
                ) : (
                  units.map((u) => (
                    <tr key={u.id} className="clickable" onClick={() => navigate(`/units/${u.id}`)}>
                      <td className="font-mono text-xs">{u.unit_code}</td>
                      <td className="capitalize">{u.unit_type}</td>
                      <td>{u.bedrooms}</td>
                      <td>{u.price ? `${u.price.toLocaleString()} SAR` : '-'}</td>
                      <td><span className={`badge capitalize ${u.status === 'available' ? 'badge-success' : 'badge-info'}`}>{u.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Document No</th><th>Title</th><th>Type</th><th>Version</th><th>Status</th><th>Upload Date</th><th></th></tr>
              </thead>
              <tbody>
                {projectDocs.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">No documents for this project</td></tr>
                ) : (
                  projectDocs.map((d) => (
                    <tr key={d.id}>
                      <td className="font-mono text-xs">{d.doc_code}</td>
                      <td className="font-medium">{d.title_en}</td>
                      <td className="text-sm text-gray-500 capitalize">{d.doc_type}</td>
                      <td className="text-sm text-gray-500">v{d.revision || 'A'}</td>
                      <td><span className={`badge capitalize ${d.status === 'current' ? 'badge-success' : d.status === 'draft' ? 'badge-neutral' : 'badge-warning'}`}>{d.status}</span></td>
                      <td className="text-sm text-gray-500">{d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : '-'}</td>
                      <td>
                        {d.file_url ? (
                          <div className="flex gap-1">
                            <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="btn-sm btn-secondary"><ExternalLink size={14} /></a>
                            <a href={d.file_url} download className="btn-sm btn-secondary"><Download size={14} /></a>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {projectDocs.length > 0 && (
            <div className="mt-3 text-center">
              <button onClick={() => navigate(`/documents?project=${id}`)} className="text-primary hover:underline text-sm font-medium">View All &rarr;</button>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><History size={16} /> Update History</h3>
          {historyLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-b-2 border-primary rounded-full" /></div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <History size={40} className="mx-auto mb-2 opacity-30" />
              <p>No update history found for this project.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs ${
                        log.action === 'create' ? 'badge-success' :
                        log.action === 'update' ? 'badge-info' :
                        log.action === 'delete' ? 'badge-danger' : 'badge-neutral'
                      }`}>{log.action}</span>
                      <span className="text-gray-500">
                        {log.user_profile?.full_name_en || log.changed_by || 'System'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{log.changed_at ? new Date(log.changed_at).toLocaleString() : '-'}</span>
                  </div>
                  {log.action === 'update' && log.new_data && (
                    <div className="mt-2 bg-gray-50 rounded p-2 text-xs font-mono max-h-32 overflow-y-auto">
                      {Object.entries(log.new_data).filter(([k]) => !['id','created_at','updated_at','is_active'].includes(k)).map(([key, val]) => {
                        const oldVal = log.old_data?.[key];
                        if (String(oldVal) === String(val)) return null;
                        return (
                          <div key={key} className="flex gap-2">
                            <span className="text-gray-500 shrink-0">{key}:</span>
                            <span className="text-red-600 line-through mr-1">{oldVal != null ? String(oldVal) : '(empty)'}</span>
                            <span className="text-green-600">{val != null ? String(val) : '(empty)'}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {log.action === 'create' && log.new_data && (
                    <div className="mt-2 bg-gray-50 rounded p-2 text-xs text-gray-600">
                      Created with {(Object.keys(log.new_data).length)} fields
                    </div>
                  )}
                  {log.action === 'delete' && log.old_data && (
                    <div className="mt-2 bg-gray-50 rounded p-2 text-xs text-gray-600">
                      Project deleted - {(Object.keys(log.old_data).length)} fields archived
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
