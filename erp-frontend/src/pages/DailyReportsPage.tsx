import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Edit3, Trash2, FileText, Calendar, Cloud, Thermometer, Users, Settings, Eye, X, Layout, Save } from 'lucide-react';
import Pagination from '../components/Pagination';
import { exportCSV } from '../utils/csv';
import ConfirmDialog from '../components/ConfirmDialog';

interface DailyReport {
  id: string; project_id: string; report_date: string; title: string;
  weather: string; temperature: string; labor_count: number; equipment_count: number;
  summary: string; created_by: string; created_at: string;
  template_id?: string; extra_data: Record<string, unknown>;
  project?: { project_code: string; name_en: string };
  template?: { id: string; name_en: string; name_ar?: string };
}

interface ReportTemplate {
  id: string; name_en: string; name_ar?: string; category: string;
  sections?: ReportTemplateSection[];
}

interface ReportTemplateSection {
  id: string; template_id: string; section_key: string; title_en: string; title_ar?: string;
  section_type: string; sort_order: number; is_required: boolean;
  config: { options?: string[]; columns?: { key: string; label: string; type: string }[]; placeholder?: string };
}

const pageSize = 25;

export default function DailyReportsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [projects, setProjects] = useState<{ id: string; project_code: string; name_en: string }[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterTemplate, setFilterTemplate] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ project_id: '', report_date: new Date().toISOString().slice(0, 10), title: '', weather: '', temperature: '', labor_count: 0, equipment_count: 0, summary: '', template_id: '' });
  const [sectionData, setSectionData] = useState<Record<string, unknown>>({});
  const [preview, setPreview] = useState<DailyReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DailyReport | null>(null);
  const [selectedTemplateSections, setSelectedTemplateSections] = useState<ReportTemplateSection[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [repRes, projRes, tmplRes] = await Promise.all([
        supabase.from('daily_reports').select('*, project:projects(project_code, name_en), template:report_templates!template_id(id, name_en, name_ar)').order('report_date', { ascending: false }),
        supabase.from('projects').select('id, project_code, name_en').eq('is_active', true).order('project_code'),
        supabase.from('report_templates').select('id, name_en, name_ar, category').in('category', ['daily', 'general', 'site']).order('name_en'),
      ]);
      setReports((repRes.data || []) as DailyReport[]);
      setProjects((projRes.data || []) as { id: string; project_code: string; name_en: string }[]);
      setTemplates((tmplRes.data || []) as ReportTemplate[]);
    } catch { toast.error('Failed to load daily reports'); }
    finally { setLoading(false); }
  }

  async function loadTemplateSections(templateId: string) {
    if (!templateId) { setSelectedTemplateSections([]); return; }
    try {
      const { data } = await supabase.from('report_template_sections').select('*')
        .eq('template_id', templateId).order('sort_order');
      setSelectedTemplateSections(data as ReportTemplateSection[] || []);
    } catch { setSelectedTemplateSections([]); }
  }

  function resetForm() {
    setForm({ project_id: '', report_date: new Date().toISOString().slice(0, 10), title: '', weather: '', temperature: '', labor_count: 0, equipment_count: 0, summary: '', template_id: '' });
    setSectionData({}); setSelectedTemplateSections([]); setEditingId(null); setFormError('');
  }

  function openEdit(r: DailyReport) {
    setForm({
      project_id: r.project_id, report_date: r.report_date.slice(0, 10), title: r.title || '',
      weather: r.weather || '', temperature: r.temperature || '', labor_count: r.labor_count || 0,
      equipment_count: r.equipment_count || 0, summary: r.summary || '', template_id: r.template_id || '',
    });
    setSectionData((r.extra_data || {}) as Record<string, unknown>);
    setEditingId(r.id); setShowForm(true);
    if (r.template_id) loadTemplateSections(r.template_id);
  }

  async function save() {
    setFormError('');
    if (!form.project_id) { setFormError('Project is required'); return; }
    if (!form.report_date) { setFormError('Date is required'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        project_id: form.project_id, report_date: form.report_date, title: form.title || null,
        weather: form.weather || null, temperature: form.temperature || null,
        labor_count: form.labor_count || 0, equipment_count: form.equipment_count || 0,
        summary: form.summary || null, template_id: form.template_id || null,
        extra_data: Object.keys(sectionData).length > 0 ? sectionData : null,
      };
      if (editingId) {
        const { error } = await supabase.from('daily_reports').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Report updated');
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('daily_reports').insert({ ...payload, created_by: user?.id });
        if (error) {
          if (error.message.includes('unique') || error.message.includes('duplicate')) {
            setFormError('A report for this project on this date already exists.');
            return;
          }
          throw error;
        }
        toast.success('Daily report created');
      }
      setShowForm(false); resetForm(); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    try {
      const { error } = await supabase.from('daily_reports').delete().eq('id', id);
      if (error) throw error;
      toast.success('Report deleted');
      setDeleteTarget(null); load();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Delete failed'); }
  }

  const filtered = reports.filter(r =>
    (!filterProject || r.project_id === filterProject) &&
    (!filterTemplate || r.template_id === filterTemplate) &&
    (!search || r.title?.toLowerCase().includes(search.toLowerCase()) || r.summary?.toLowerCase().includes(search.toLowerCase()) || r.project?.project_code?.toLowerCase().includes(search.toLowerCase()))
  );

  function renderSectionField(sec: ReportTemplateSection, value: unknown, onChange: (val: unknown) => void) {
    const cfg = sec.config || {};
    switch (sec.section_type) {
      case 'text':
        return <textarea className="input" rows={3} value={(value as string) || ''} onChange={e => onChange(e.target.value)} placeholder={cfg.placeholder || ''} />;
      case 'select':
        return (
          <select className="input" value={(value as string) || ''} onChange={e => onChange(e.target.value)}>
            <option value="">-- Select --</option>
            {(cfg.options || []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case 'checkbox':
        return (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
            <span className="text-sm">{sec.title_en}</span>
          </label>
        );
      case 'table':
        return (
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead><tr>{(cfg.columns || []).map(col => <th key={col.key}>{col.label}</th>)}</tr></thead>
              <tbody>
                {((value as Record<string, string>[]) || []).map((row, ri) => (
                  <tr key={ri}>{(cfg.columns || []).map(col => (
                    <td key={col.key}>
                      <input className="input" type={col.type === 'number' ? 'number' : 'text'}
                        value={(row as Record<string, string>)[col.key] || ''}
                        onChange={e => {
                          const newRows = [...((value as Record<string, string>[]) || [])];
                          if (!newRows[ri]) newRows[ri] = {};
                          newRows[ri] = { ...newRows[ri], [col.key]: e.target.value };
                          onChange(newRows);
                        }} />
                    </td>
                  ))}</tr>
                ))}
                <tr><td colSpan={(cfg.columns || []).length}>
                  <button className="btn-xs btn-secondary mt-1"
                    onClick={() => {
                      const newRow: Record<string, string> = {};
                      (cfg.columns || []).forEach(c => { newRow[c.key] = ''; });
                      onChange([...((value as Record<string, string>[]) || []), newRow]);
                    }}>+ Add Row</button>
                </td></tr>
              </tbody>
            </table>
          </div>
        );
      case 'image':
        return <input type="file" className="input" accept="image/*" onChange={e => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = () => onChange(reader.result);
            reader.readAsDataURL(file);
          }
        }} />;
      default:
        return <textarea className="input" rows={2} value={(value as string) || ''} onChange={e => onChange(e.target.value)} />;
    }
  }

  const getWeatherIcon = (w: string) => {
    if (!w) return <Cloud size={14} />;
    const lw = w.toLowerCase();
    if (lw.includes('sun') || lw.includes('clear')) return '☀️';
    if (lw.includes('cloud') || lw.includes('overcast')) return '☁️';
    if (lw.includes('rain') || lw.includes('drizzle')) return '🌧️';
    if (lw.includes('storm') || lw.includes('thunder')) return '⛈️';
    if (lw.includes('wind') || lw.includes('dust') || lw.includes('sand')) return '💨';
    if (lw.includes('fog') || lw.includes('mist')) return '🌫️';
    return <Cloud size={14} />;
  };

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Daily Reports</h1>
        <div className="flex gap-2">
          {hasPermission('projects', 'create') && (
            <button className="btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus size={18} /> New Report
            </button>
          )}
        </div>
      </div>

      {formError && (
        <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>{formError}</div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-10 rounded-lg" placeholder="Search reports..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input max-w-[200px]" value={filterProject} onChange={(e) => { setFilterProject(e.target.value); setPage(1); }}>
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_code}</option>)}
        </select>
        <select className="input max-w-[200px]" value={filterTemplate} onChange={(e) => { setFilterTemplate(e.target.value); setPage(1); }}>
          <option value="">All templates</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name_en}</option>)}
        </select>
        <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as any, `daily_reports_${new Date().toISOString().slice(0, 10)}.csv`); }}>
          <Eye size={14} /> Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse p-4">
              <div className="h-4 rounded w-1/3 mb-3" style={{ backgroundColor: 'var(--color-border)' }} />
              <div className="h-3 rounded w-2/3 mb-2" style={{ backgroundColor: 'var(--color-border)' }} />
              <div className="h-3 rounded w-1/2" style={{ backgroundColor: 'var(--color-border)' }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full card text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
            <FileText size={48} className="mx-auto mb-3 opacity-30" />
            <p>No daily reports found.</p>
          </div>
        ) : (
          filtered.slice((page - 1) * pageSize, page * pageSize).map(r => (
            <div key={r.id} className="card p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setPreview(r)}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-mono" style={{ color: 'var(--color-primary)' }}>{r.project?.project_code || r.project_id?.slice(0, 8)}</p>
                  <p className="font-semibold text-sm mt-0.5">{r.title || 'Untitled'}</p>
                </div>
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}><Calendar size={12} />{new Date(r.report_date + 'T00:00:00').toLocaleDateString()}</span>
              </div>
              {r.summary && <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--color-text-secondary)' }}>{r.summary}</p>}
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {r.weather && <span className="flex items-center gap-1">{getWeatherIcon(r.weather)} {r.weather}</span>}
                {r.temperature && <span className="flex items-center gap-1"><Thermometer size={12} />{r.temperature}°C</span>}
                <span className="flex items-center gap-1"><Users size={12} />{r.labor_count || 0}</span>
                <span className="flex items-center gap-1"><Settings size={12} />{r.equipment_count || 0}</span>
              </div>
              {r.template && <div className="mt-2"><span className="badge badge-info text-xs">{r.template.name_en}</span></div>}
              <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Edit3 size={13} /></button>
                <button className="btn-sm btn-secondary" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}><Trash2 size={13} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{editingId ? 'Edit Daily Report' : 'New Daily Report'}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Project *</label>
                  <select className="input" value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})}>
                    <option value="">-- Select Project --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                  </select>
                </div>
                <div><label className="label">Date *</label><input type="date" className="input" value={form.report_date} onChange={e => setForm({...form, report_date: e.target.value})} /></div>
              </div>
              <div><label className="label">Title</label><input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Foundation work day 3" /></div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Template</label>
                  <select className="input" value={form.template_id} onChange={e => {
                    setForm({...form, template_id: e.target.value});
                    setSectionData({});
                    if (e.target.value) loadTemplateSections(e.target.value);
                  }}>
                    <option value="">No template (basic fields only)</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name_en}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="label">Weather</label>
                    <select className="input" value={form.weather} onChange={e => setForm({...form, weather: e.target.value})}>
                      <option value="">--</option>
                      <option value="Sunny">Sunny</option>
                      <option value="Cloudy">Cloudy</option>
                      <option value="Rainy">Rainy</option>
                      <option value="Windy">Windy</option>
                      <option value="Dusty">Dusty</option>
                      <option value="Foggy">Foggy</option>
                      <option value="Storm">Storm</option>
                      <option value="Clear">Clear</option>
                    </select>
                  </div>
                  <div><label className="label">Temp (°C)</label><input type="number" className="input" value={form.temperature} onChange={e => setForm({...form, temperature: e.target.value})} /></div>
                  <div><label className="label">Labor</label><input type="number" className="input" value={form.labor_count} onChange={e => setForm({...form, labor_count: parseInt(e.target.value) || 0})} /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Equipment</label><input type="number" className="input" value={form.equipment_count} onChange={e => setForm({...form, equipment_count: parseInt(e.target.value) || 0})} /></div>
              </div>

              {selectedTemplateSections.length > 0 && (
                <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Layout size={14} /> Template Sections
                  </h4>
                  <div className="space-y-3">
                    {selectedTemplateSections.map(sec => (
                      <div key={sec.id || sec.section_key}>
                        <label className="label">
                          {sec.title_en}
                          {sec.is_required && <span className="text-red-500">*</span>}
                          <span className="badge text-xs">{sec.section_type}</span>
                        </label>
                        {renderSectionField(sec, sectionData[sec.section_key], (val) => {
                          setSectionData(prev => ({ ...prev, [sec.section_key]: val }));
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div><label className="label">Summary</label><textarea className="input" rows={4} value={form.summary} onChange={e => setForm({...form, summary: e.target.value})} placeholder="Work performed, issues encountered, materials used..." /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary" onClick={save} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn-secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setPreview(null)}>
          <div className="rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{preview.title || 'Daily Report'}</h3>
                {preview.template && <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Template: {preview.template.name_en}</p>}
              </div>
              <button onClick={() => setPreview(null)}><X size={20} className="opacity-40 hover:opacity-100" /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' }}>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Project</p>
                <p className="font-medium text-sm">{preview.project?.project_code || '-'}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' }}>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Date</p>
                <p className="font-medium text-sm">{new Date(preview.report_date + 'T00:00:00').toLocaleDateString()}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' }}>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Weather</p>
                <p className="font-medium text-sm">{preview.weather || '-'} {preview.temperature ? `/ ${preview.temperature}°C` : ''}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' }}>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Labor / Equipment</p>
                <p className="font-medium text-sm">{preview.labor_count || 0} / {preview.equipment_count || 0}</p>
              </div>
            </div>
            {preview.extra_data && Object.keys(preview.extra_data).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2">Template Data</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(preview.extra_data).map(([key, val]) => (
                    <div key={key} className="p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, transparent)' }}>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{key}</p>
                      <p className="text-sm">{typeof val === 'string' ? val : JSON.stringify(val)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div><p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Summary</p><p className="text-sm whitespace-pre-wrap">{preview.summary || 'No summary provided.'}</p></div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Report"
          message={`Delete daily report "${deleteTarget.title || 'Untitled'}"?`}
          confirmLabel="Delete"
          onConfirm={() => remove(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
