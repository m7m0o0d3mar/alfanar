import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { Search, Plus, Eye, Trash2, ClipboardCheck, AlertTriangle, ShieldCheck, Download, BookTemplate, GripVertical, FileText, Camera, User, Calendar, X, QrCode } from 'lucide-react';
import Pagination from '../components/Pagination';
import { exportCSV } from '../utils/csv';
import { generateInspectionReport } from '../utils/inspectionReport';
import QRCodeModal from '../components/QRCodeModal';

interface KpiData { inspections: number; openNcr: number; openCapa: number; avgScore: number; }
interface ChecklistTemplate { id: string; code: string; name_en: string; category: string; is_active: boolean; description: string; }
interface TemplateItem { id: string; template_id: string; sort_order: number; description_en: string; is_critical: boolean; weight: number; }
interface Inspection { id: string; inspection_no: string; title: string; inspection_date: string; status: string; score_percent: number; project_id: string; template_id: string; project?: { project_code: string; name_en: string }; }
interface NcrItem { id: string; ncr_no: string; title: string; severity: string; status: string; detected_date: string; project_id: string; project?: { project_code: string; name_en: string }; }
interface CapaItem { id: string; capa_no: string; title: string; action_type: string; status: string; deadline: string; assigned_to: string; project_id?: string; project?: { project_code: string; name_en: string }; }
interface Project { id: string; name_en: string; project_code: string; }

export default function QualityPage() {
  const t = useT();
  const [kpi, setKpi] = useState<KpiData>({ inspections: 0, openNcr: 0, openCapa: 0, avgScore: 0 });
  const [tab, setTab] = useState<'inspections' | 'ncr' | 'capa' | 'templates' | 'defects'>('inspections');
  const [loadingKpi, setLoadingKpi] = useState(true);

  const loadKpi = useCallback(async () => {
    try {
      const [insRes, ncrRes, capaRes] = await Promise.all([
        supabase.from('qc_inspections').select('score_percent'),
        supabase.from('qc_ncr').select('id', { count: 'exact', head: true }).neq('status', 'closed'),
        supabase.from('qc_capa').select('id', { count: 'exact', head: true }).neq('status', 'closed'),
      ]);
      const scores = (insRes.data || []).map((r: any) => r.score_percent).filter(Boolean);
      setKpi({
        inspections: insRes.data?.length || 0,
        openNcr: ncrRes.count ?? 0,
        openCapa: capaRes.count ?? 0,
        avgScore: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0,
      });
    } catch { console.error('Quality KPI load failed'); }
    finally { setLoadingKpi(false); }
  }, []);

  useEffect(() => { loadKpi(); }, [loadKpi]);

  const cards = [
    { label: 'Inspections', value: kpi.inspections, icon: ClipboardCheck, color: '#3B82F6' },
    { label: 'Open NCRs', value: kpi.openNcr, icon: AlertTriangle, color: '#EF4444' },
    { label: 'Open CAPAs', value: kpi.openCapa, icon: ShieldCheck, color: '#F59E0B' },
    { label: 'Avg Score', value: kpi.avgScore ? `${kpi.avgScore}%` : 'N/A', icon: BookTemplate, color: '#22C55E' },
  ];

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('nav.quality')}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4 flex items-center gap-3" style={{ opacity: loadingKpi ? 0.5 : 1 }}>
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${c.color}15` }}><c.icon size={20} style={{ color: c.color }} /></div>
            <div><p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{c.label}</p><p className="text-xl font-bold">{c.value}</p></div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b pb-0 flex-wrap" style={{ borderColor: 'var(--color-border)' }}>
        {([
          { key: 'inspections' as const, label: 'Inspections', icon: ClipboardCheck },
          { key: 'ncr' as const, label: 'NCR', icon: AlertTriangle },
          { key: 'capa' as const, label: 'CAPA', icon: ShieldCheck },
          { key: 'defects' as const, label: 'Defects', icon: Camera },
          { key: 'templates' as const, label: 'Templates', icon: BookTemplate },
        ]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 -mb-px ${tab === key ? '' : 'opacity-60 hover:opacity-80'}`}
            style={{ backgroundColor: tab === key ? 'var(--color-surface)' : 'transparent', borderColor: 'var(--color-border)', color: tab === key ? 'var(--color-primary)' : 'var(--color-text)' }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'inspections' && <InspectionsTab />}
      {tab === 'ncr' && <NcrTab />}
      {tab === 'capa' && <CapaTab />}
      {tab === 'defects' && <DefectsTab />}
      {tab === 'templates' && <TemplatesTab />}
    </div>
  );
}

function TemplatesTab() {
  const { hasPermission } = useAuth();
  const t = useT(); const toast = useToast();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1); const pageSize = 25;
  const [showForm, setShowForm] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [selTemplate, setSelTemplate] = useState<ChecklistTemplate | null>(null);
  const [saving, setSaving] = useState(false); const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ code: '', name_en: '', category: 'general', description: '' });
  const [itemForm, setItemForm] = useState({ description_en: '', is_critical: false, weight: 1 });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await supabase.from('qc_checklist_templates').select('*').order('name_en');
      setTemplates((res.data || []) as ChecklistTemplate[]);
    } catch { toast.error('Failed to load templates'); }
    finally { setLoading(false); }
  }

  async function loadItems(t: ChecklistTemplate) {
    const res = await supabase.from('qc_template_items').select('*').eq('template_id', t.id).order('sort_order');
    setItems((res.data || []) as TemplateItem[]);
    setSelTemplate(t); setShowItems(true);
  }

  async function save() {
    setFormError('');
    if (!form.code.trim() || !form.name_en.trim()) { setFormError('Code and Name are required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('qc_checklist_templates').insert(form);
      if (error) throw error;
      toast.success('Template created'); setShowForm(false);
      setForm({ code: '', name_en: '', category: 'general', description: '' }); load();
    } catch (err: unknown) { const msg = err instanceof Error ? err.message : 'Save failed'; setFormError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  async function addItem() {
    if (!selTemplate || !itemForm.description_en.trim()) return;
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) : 0;
    try {
      const { error } = await supabase.from('qc_template_items').insert({
        template_id: selTemplate.id, sort_order: maxOrder + 1,
        description_en: itemForm.description_en, is_critical: itemForm.is_critical, weight: itemForm.weight,
      });
      if (error) throw error;
      setItemForm({ description_en: '', is_critical: false, weight: 1 });
      loadItems(selTemplate);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to add item'); }
  }

  async function removeItem(id: string) {
    if (!selTemplate) return;
    try {
      await supabase.from('qc_template_items').delete().eq('id', id);
      loadItems(selTemplate);
    } catch { toast.error('Failed to remove item'); }
  }

  const filtered = templates.filter((t) => !search || t.name_en.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {hasPermission('quality', 'create') && <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}><Plus size={16} /> New Template</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <p style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</p> : filtered.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>No templates yet. Create your first inspection template.</p>
        ) : (
          filtered.slice((page - 1) * pageSize, page * pageSize).map((tmp) => (
            <div key={tmp.id} className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => loadItems(tmp)}>
              <div className="flex items-center justify-between">
                <span className="badge text-xs">{tmp.category}</span>
                <span className={`badge text-xs ${tmp.is_active ? 'badge-success' : 'badge'}`}>{tmp.is_active ? 'Active' : 'Inactive'}</span>
              </div>
              <h3 className="font-semibold mt-2">{tmp.name_en}</h3>
              <p className="text-xs mt-1 font-mono" style={{ color: 'var(--color-text-secondary)' }}>{tmp.code}</p>
              {tmp.description && <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{tmp.description}</p>}
            </div>
          ))
        )}
      </div>
      <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Checklist Template</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Code *</label><input className="input" value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} /></div>
              <div><label className="label">Name *</label><input className="input" value={form.name_en} onChange={(e) => setForm({...form, name_en: e.target.value})} /></div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
                  <option value="general">General</option>
                  <option value="safety">Safety</option>
                  <option value="quality">Quality</option>
                  <option value="supplier_audit">Supplier Audit</option>
                  <option value="material_inspection">Material Inspection</option>
                  <option value="equipment">Equipment</option>
                  <option value="cleaning">Cleaning</option>
                </select>
              </div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showItems && selTemplate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowItems(false); setSelTemplate(null); }}>
          <div className="rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{selTemplate.name_en} — Items</h3>
              <button className="btn-sm btn-secondary" onClick={() => { setShowItems(false); setSelTemplate(null); }}>Close</button>
            </div>
            <div className="space-y-2 mb-4">
              {items.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No items yet. Add your first checklist item below.</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                    <GripVertical size={16} style={{ color: 'var(--color-text-secondary)', cursor: 'grab' }} />
                    <div className="flex-1">
                      <p className="text-sm">{item.description_en}</p>
                      <div className="flex gap-2 mt-1">
                        {item.is_critical && <span className="badge badge-danger text-xs">Critical</span>}
                        <span className="badge text-xs">Weight: {item.weight}</span>
                      </div>
                    </div>
                    {hasPermission('quality', 'delete') && (
                      <button className="btn-sm btn-secondary" style={{ color: 'var(--color-danger)' }} onClick={() => removeItem(item.id)}><Trash2 size={14} /></button>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
              <h4 className="text-sm font-semibold mb-2">Add Item</h4>
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <input className="input" placeholder="Item description" value={itemForm.description_en} onChange={(e) => setItemForm({...itemForm, description_en: e.target.value})} />
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itemForm.is_critical} onChange={(e) => setItemForm({...itemForm, is_critical: e.target.checked})} /> Critical</label>
                    <label className="flex items-center gap-2 text-sm">Weight: <input type="number" className="input w-20" min={0} max={100} value={itemForm.weight} onChange={(e) => setItemForm({...itemForm, weight: Number(e.target.value)})} /></label>
                  </div>
                </div>
                <button className="btn-primary btn-sm mt-1" onClick={addItem}><Plus size={14} /> Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InspectionsTab() {
  const { hasPermission } = useAuth();
  const t = useT(); const toast = useToast();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const pageSize = 25;
  const [showForm, setShowForm] = useState(false); const [saving, setSaving] = useState(false); const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ template_id: '', project_id: '', title: '', inspection_date: new Date().toISOString().slice(0, 10), status: 'draft' });
  const [execute, setExecute] = useState<Inspection | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [resultNotes, setResultNotes] = useState<Record<string, string>>({});
  const [execSaving, setExecSaving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function downloadPdf(ins: Inspection) {
    try {
      const [itemRes, tmpRes, projRes] = await Promise.all([
        supabase.from('qc_inspection_items').select('*, qc_template_items!inner(description_en, is_critical)').eq('inspection_id', ins.id),
        ins.template_id ? supabase.from('qc_checklist_templates').select('name_en').eq('id', ins.template_id).single() : Promise.resolve({ data: null }),
        ins.project_id ? supabase.from('projects').select('name_en').eq('id', ins.project_id).single() : Promise.resolve({ data: null }),
      ]);
      const items = (itemRes.data || []).map((r: any) => ({
        description_en: r.qc_template_items?.description_en || '',
        is_critical: r.qc_template_items?.is_critical || false,
        result: r.result || '',
        notes: r.notes || '',
      }));
      generateInspectionReport({
        inspection_no: ins.inspection_no, title: ins.title,
        inspection_date: ins.inspection_date, status: ins.status,
        score_percent: ins.score_percent ?? 0,
        template_name: (tmpRes.data as any)?.name_en,
        project_name: (projRes.data as any)?.name_en,
        items,
      });
    } catch { toast.error('Failed to generate report'); }
  }

  async function load() {
    setLoading(true);
    try {
      const [insRes, tmpRes, projRes] = await Promise.all([
        supabase.from('qc_inspections').select('*, project:projects(project_code, name_en)').order('inspection_date', { ascending: false }),
        supabase.from('qc_checklist_templates').select('*').eq('is_active', true).order('name_en'),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
      ]);
      setInspections((insRes.data || []) as Inspection[]);
      setTemplates((tmpRes.data || []) as ChecklistTemplate[]);
      setProjects((projRes.data || []) as Project[]);
    } catch { toast.error('Failed to load inspections'); }
    finally { setLoading(false); }
  }

  async function executeInspection(ins: Inspection) {
    setExecute(ins); setResults({}); setResultNotes({});
    if (ins.template_id) {
      const res = await supabase.from('qc_template_items').select('*').eq('template_id', ins.template_id).order('sort_order');
      setTemplateItems((res.data || []) as TemplateItem[]);
      const existing = await supabase.from('qc_inspection_items').select('*').eq('inspection_id', ins.id);
      if (existing.data?.length) {
        const r: Record<string, string> = {}; const n: Record<string, string> = {};
        existing.data.forEach((item: any) => { if (item.template_item_id) { r[item.template_item_id] = item.result; n[item.template_item_id] = item.notes || ''; } });
        setResults(r); setResultNotes(n);
      }
    }
  }

  async function saveResults() {
    if (!execute) return;
    setExecSaving(true);
    try {
      for (const item of templateItems) {
        const result = results[item.id];
        if (!result) continue;
        await supabase.from('qc_inspection_items').upsert({
          inspection_id: execute.id, template_item_id: item.id,
          result, notes: resultNotes[item.id] || null,
        }, { onConflict: 'inspection_id,template_item_id', ignoreDuplicates: false });
      }
      const scored = templateItems.filter(i => results[i.id] && results[i.id] !== 'na').length;
      const passed = templateItems.filter(i => results[i.id] === 'pass').length;
      const score = scored > 0 ? Math.round((passed / scored) * 100) : 0;
      await supabase.from('qc_inspections').update({ status: 'completed', score_percent: score }).eq('id', execute.id);
      toast.success(`Inspection completed: ${score}%`);
      setExecute(null); load();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Save failed'); }
    finally { setExecSaving(false); }
  }

  async function save() {
    setFormError('');
    if (!form.title.trim()) { setFormError('Title is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('qc_inspections').insert({
        ...form, template_id: form.template_id || null,
        project_id: form.project_id || null, inspector_id: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast.success(`Inspection "${form.title}" created`);
      setShowForm(false); setForm({ template_id: '', project_id: '', title: '', inspection_date: new Date().toISOString().slice(0, 10), status: 'draft' }); load();
    } catch (err: unknown) { const msg = err instanceof Error ? err.message : 'Save failed'; setFormError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  const [filterProject, setFilterProject] = useState('');
  const [sp] = useSearchParams();
  useEffect(() => { const pid = sp.get('project_id'); if (pid) setFilterProject(pid); }, [sp]);
  const filtered = inspections.filter((i) =>
    (!search || i.title.toLowerCase().includes(search.toLowerCase()) || i.inspection_no.toLowerCase().includes(search.toLowerCase())) &&
    (!filterProject || i.project_id === filterProject)
  );
  const getStatusColor = (s: string) => { const m: Record<string, string> = { draft: 'badge', in_progress: 'badge-warning', completed: 'badge-success', closed: 'badge' }; return m[s] || 'badge'; };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input max-w-[200px]" value={filterProject} onChange={(e) => { setFilterProject(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as any, `inspections_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> Export
          </button>
          {hasPermission('quality', 'create') && <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}><Plus size={16} /> New Inspection</button>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead><tr><th>No</th><th>Title</th><th>Project</th><th>Date</th><th>Status</th><th>Score</th><th>{t('common.actions')}</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No inspections yet</td></tr>
            ) : (
              filtered.slice((page - 1) * pageSize, page * pageSize).map((i) => (
                <tr key={i.id}>
                  <td className="font-mono text-xs">{i.inspection_no}</td>
                  <td className="font-medium">{i.title}</td>
                  <td className="text-xs">{(i as any).project?.project_code || '-'}</td>
                  <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{i.inspection_date}</td>
                  <td><span className={`badge capitalize ${getStatusColor(i.status)}`}>{i.status}</span></td>
                  <td>{i.score_percent != null ? `${i.score_percent}%` : '-'}</td>
                  <td>
                    <button className="btn-sm btn-secondary" onClick={() => executeInspection(i)} title="Execute Inspection"><ClipboardCheck size={14} /></button>
                    <button className="btn-sm btn-secondary ml-1" onClick={() => downloadPdf(i)} title="Download PDF Report"><FileText size={14} /></button>
                    <button className="btn-sm btn-secondary ml-1" onClick={async () => { try { await supabase.from('qc_inspections').delete().eq('id', i.id); toast.success('Inspection deleted'); load(); } catch { toast.error('Delete failed'); } }} title="Delete"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Inspection</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Template</label>
                <select className="input" value={form.template_id} onChange={(e) => setForm({...form, template_id: e.target.value})}>
                  <option value="">-- No Template --</option>
                  {templates.map((tmp) => <option key={tmp.id} value={tmp.id}>{tmp.name_en} ({tmp.category})</option>)}
                </select>
              </div>
              <div><label className="label">Project</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({...form, project_id: e.target.value})}>
                  <option value="">-- No Project --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} /></div>
              <div><label className="label">Date</label><input type="date" className="input" value={form.inspection_date} onChange={(e) => setForm({...form, inspection_date: e.target.value})} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {execute && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setExecute(null)}>
          <div className="rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-lg font-semibold">{execute.title}</h3><p className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{execute.inspection_no} — {execute.inspection_date}</p></div>
              <button className="btn-sm btn-secondary" onClick={() => setExecute(null)}>Close</button>
            </div>
            {execute.template_id ? (
              <>
                {templateItems.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>This template has no items. Add items in the Templates tab first.</p>
                ) : (
                  <div className="space-y-3">
                    {templateItems.map((item, idx) => (
                      <div key={item.id} className="p-4 rounded-lg border" style={{ borderColor: results[item.id] === 'fail' ? '#EF4444' : results[item.id] === 'pass' ? '#22C55E' : results[item.id] === 'na' ? '#6B7280' : 'var(--color-border)' }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{idx + 1}. {item.description_en}</p>
                            {item.is_critical && <span className="badge badge-danger text-xs mt-1">Critical</span>}
                          </div>
                          <div className="flex gap-1">
                            {['pass', 'fail', 'na'].map((r) => (
                              <button key={r} onClick={() => setResults({...results, [item.id]: results[item.id] === r ? '' : r })}
                                className={`px-3 py-1 text-xs font-medium rounded-md border ${results[item.id] === r ? (r === 'pass' ? 'bg-green-500 text-white border-green-500' : r === 'fail' ? 'bg-red-500 text-white border-red-500' : 'bg-gray-500 text-white border-gray-500') : ''}`}
                                style={{ borderColor: 'var(--color-border)' }}>
                                {r.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input className="input text-sm mt-2" placeholder="Optional notes..." value={resultNotes[item.id] || ''} onChange={(e) => setResultNotes({...resultNotes, [item.id]: e.target.value})} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-6">
                  <button className="btn-primary btn-sm" onClick={saveResults} disabled={execSaving}>{execSaving ? 'Saving...' : 'Save Results'}</button>
                  <button className="btn-secondary btn-sm" onClick={() => setExecute(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No template linked. Edit inspection to assign a template.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NcrTab() {
  const { hasPermission } = useAuth();
  const t = useT(); const toast = useToast();
  const [ncrs, setNcrs] = useState<NcrItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const pageSize = 25;
  const [showForm, setShowForm] = useState(false); const [saving, setSaving] = useState(false); const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ project_id: '', title: '', description: '', severity: 'minor', status: 'open' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [ncrRes, projRes] = await Promise.all([
        supabase.from('qc_ncr').select('*, project:projects(project_code, name_en)').order('detected_date', { ascending: false }),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
      ]);
      setNcrs((ncrRes.data || []) as NcrItem[]); setProjects((projRes.data || []) as Project[]);
    } catch { toast.error('Failed to load NCRs'); }
    finally { setLoading(false); }
  }

  async function save() {
    setFormError(''); if (!form.title.trim()) { setFormError('Title is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('qc_ncr').insert({
        ...form, project_id: form.project_id || null,
        description: form.description || form.title, assigned_to: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast.success(`NCR created`); setShowForm(false);
      setForm({ project_id: '', title: '', description: '', severity: 'minor', status: 'open' }); load();
    } catch (err: unknown) { const msg = err instanceof Error ? err.message : 'Save failed'; setFormError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  const [filterProject, setFilterProject] = useState('');
  const [sp] = useSearchParams();
  useEffect(() => { const pid = sp.get('project_id'); if (pid) setFilterProject(pid); }, [sp]);
  const filtered = ncrs.filter((n) =>
    (!search || n.title.toLowerCase().includes(search.toLowerCase()) || n.ncr_no.toLowerCase().includes(search.toLowerCase())) &&
    (!filterProject || n.project_id === filterProject)
  );
  const getSeverityBadge = (s: string) => { const m: Record<string, string> = { minor: 'badge', major: 'badge-warning', critical: 'badge-danger' }; return m[s] || 'badge'; };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input max-w-[200px]" value={filterProject} onChange={(e) => { setFilterProject(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as any, `ncrs_${new Date().toISOString().slice(0, 10)}.csv`); }}><Download size={14} /> Export</button>
          {hasPermission('quality', 'create') && <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}><Plus size={16} /> New NCR</button>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead><tr><th>NCR No</th><th>Title</th><th>Project</th><th>Severity</th><th>Status</th><th>Date</th><th>{t('common.actions')}</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No NCRs found</td></tr>
            ) : (
              filtered.slice((page - 1) * pageSize, page * pageSize).map((n) => (
                <tr key={n.id}>
                  <td className="font-mono text-xs">{n.ncr_no}</td>
                  <td className="font-medium">{n.title}</td>
                  <td className="text-xs">{(n as any).project?.project_code || '-'}</td>
                  <td><span className={`badge capitalize ${getSeverityBadge(n.severity)}`}>{n.severity}</span></td>
                  <td><span className={`badge capitalize ${n.status === 'closed' ? 'badge-success' : n.status === 'open' ? 'badge-danger' : 'badge-warning'}`}>{n.status}</span></td>
                  <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{n.detected_date}</td>
                  <td><button className="btn-sm btn-secondary" onClick={() => toast.info(`NCR: ${n.title}`)} title="View"><Eye size={14} /></button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Create NCR</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Project</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({...form, project_id: e.target.value})}>
                  <option value="">-- Select Project --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
              <div><label className="label">Severity</label>
                <select className="input" value={form.severity} onChange={(e) => setForm({...form, severity: e.target.value})}>
                  <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CapaTab() {
  const { hasPermission } = useAuth();
  const t = useT(); const toast = useToast();
  const [items, setItems] = useState<CapaItem[]>([]);
  const [ncrs, setNcrs] = useState<NcrItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const pageSize = 25;
  const [filterProject, setFilterProject] = useState('');
  const [sp] = useSearchParams();
  useEffect(() => { const pid = sp.get('project_id'); if (pid) setFilterProject(pid); }, [sp]);
  const [showForm, setShowForm] = useState(false); const [saving, setSaving] = useState(false); const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ ncr_id: '', project_id: '', title: '', description: '', action_type: 'corrective', root_cause: '', proposed_action: '', status: 'open', deadline: '' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [capaRes, ncrRes, projRes] = await Promise.all([
        supabase.from('qc_capa').select('*, project:projects(project_code, name_en)').order('created_at', { ascending: false }),
        supabase.from('qc_ncr').select('id, ncr_no, title').neq('status', 'closed'),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
      ]);
      setItems((capaRes.data || []) as CapaItem[]);
      setNcrs((ncrRes.data || []) as NcrItem[]);
      setProjects((projRes.data || []) as Project[]);
    } catch { toast.error('Failed to load CAPAs'); }
    finally { setLoading(false); }
  }

  async function save() {
    setFormError(''); if (!form.title.trim()) { setFormError('Title is required'); return; }
    if (!form.deadline) { setFormError('Deadline is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('qc_capa').insert({
        ...form, ncr_id: form.ncr_id || null, deadline: form.deadline || null,
        project_id: form.project_id || null,
        assigned_to: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast.success(`CAPA created`); setShowForm(false);
      setForm({ ncr_id: '', project_id: '', title: '', description: '', action_type: 'corrective', root_cause: '', proposed_action: '', status: 'open', deadline: '' }); load();
    } catch (err: unknown) { const msg = err instanceof Error ? err.message : 'Save failed'; setFormError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  const filtered = items.filter((i) =>
    (!search || i.title.toLowerCase().includes(search.toLowerCase()) || i.capa_no.toLowerCase().includes(search.toLowerCase())) &&
    (!filterProject || i.project_id === filterProject)
  );
  const getStatusColor = (s: string) => { const m: Record<string, string> = { open: 'badge-danger', in_progress: 'badge-warning', implemented: 'badge-info', verified: 'badge', closed: 'badge-success' }; return m[s] || 'badge'; };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input max-w-[200px]" value={filterProject} onChange={(e) => { setFilterProject(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as any, `capas_${new Date().toISOString().slice(0, 10)}.csv`); }}><Download size={14} /> Export</button>
          {hasPermission('quality', 'create') && <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}><Plus size={16} /> New CAPA</button>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead><tr><th>CAPA No</th><th>Title</th><th>Project</th><th>Type</th><th>Status</th><th>Deadline</th><th>{t('common.actions')}</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No CAPAs found</td></tr>
            ) : (
              filtered.slice((page - 1) * pageSize, page * pageSize).map((item) => (
                <tr key={item.id}>
                  <td className="font-mono text-xs">{item.capa_no}</td>
                  <td className="font-medium">{item.title}</td>
                  <td className="text-xs">{(item as any).project?.project_code || '-'}</td>
                  <td><span className="badge capitalize">{item.action_type}</span></td>
                  <td><span className={`badge capitalize ${getStatusColor(item.status)}`}>{item.status}</span></td>
                  <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.deadline || '-'}</td>
                  <td><button className="btn-sm btn-secondary" onClick={() => toast.info(`CAPA: ${item.title}`)} title="View"><Eye size={14} /></button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Create CAPA</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Project</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({...form, project_id: e.target.value})}>
                  <option value="">-- Select Project --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Linked NCR</label>
                <select className="input" value={form.ncr_id} onChange={(e) => setForm({...form, ncr_id: e.target.value})}>
                  <option value="">-- No NCR --</option>
                  {ncrs.map((n) => <option key={n.id} value={n.id}>{n.ncr_no} - {n.title}</option>)}
                </select>
              </div>
              <div><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
              <div><label className="label">Type</label>
                <select className="input" value={form.action_type} onChange={(e) => setForm({...form, action_type: e.target.value})}>
                  <option value="corrective">Corrective</option><option value="preventive">Preventive</option>
                </select>
              </div>
              <div><label className="label">Root Cause</label><textarea className="input" rows={2} value={form.root_cause} onChange={(e) => setForm({...form, root_cause: e.target.value})} /></div>
              <div><label className="label">Proposed Action</label><textarea className="input" rows={2} value={form.proposed_action} onChange={(e) => setForm({...form, proposed_action: e.target.value})} /></div>
              <div><label className="label">Deadline *</label><input type="date" className="input" value={form.deadline} onChange={(e) => setForm({...form, deadline: e.target.value})} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DefectItem {
  id: string; defect_no: string; title: string; description?: string;
  category: string; severity: string; status: string;
  project_id?: string; unit_id?: string; assigned_to?: string;
  location_description?: string; due_date?: string;
  photos?: { url: string; name: string }[];
  project?: { project_code: string; name_en: string };
  created_at: string;
}

function DefectsTab() {
  const { hasPermission } = useAuth();
  const t = useT(); const toast = useToast();
  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name_en: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const pageSize = 25;
  const [filterProject, setFilterProject] = useState('');
  const [sp] = useSearchParams();
  useEffect(() => { const pid = sp.get('project_id'); if (pid) setFilterProject(pid); }, [sp]);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false); const [saving, setSaving] = useState(false); const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ project_id: '', unit_id: '', title: '', description: '', category: 'general', severity: 'minor', status: 'open', assigned_to: '', location_description: '', due_date: '', photos: [] as { url: string; name: string }[] });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [qrModal, setQrModal] = useState<{ show: boolean; value: string; title: string }>({ show: false, value: '', title: '' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [defRes, projRes, userRes] = await Promise.all([
        supabase.from('qc_defects').select('*, project:projects(project_code, name_en)').order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
        supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
      ]);
      setDefects((defRes.data || []) as DefectItem[]);
      setProjects((projRes.data || []) as Project[]);
      setUsers((userRes.data || []) as { id: string; full_name_en: string }[]);
    } catch { toast.error('Failed to load defects'); }
    finally { setLoading(false); }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `defects/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('uploads').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
      setForm(prev => ({ ...prev, photos: [...prev.photos, { url: urlData.publicUrl, name: file.name }] }));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  function removePhoto(idx: number) {
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }));
  }

  async function save() {
    setFormError(''); if (!form.title.trim()) { setFormError('Title is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('qc_defects').insert({
        project_id: form.project_id || null, unit_id: form.unit_id || null,
        title: form.title, description: form.description || null, category: form.category,
        severity: form.severity, status: form.status, assigned_to: form.assigned_to || null,
        location_description: form.location_description || null, due_date: form.due_date || null,
        photos: form.photos.length > 0 ? JSON.stringify(form.photos) : null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast.success(`Defect created`);
      setShowForm(false);
      setForm({ project_id: '', unit_id: '', title: '', description: '', category: 'general', severity: 'minor', status: 'open', assigned_to: '', location_description: '', due_date: '', photos: [] });
      load();
    } catch (err: unknown) { const msg = err instanceof Error ? err.message : 'Save failed'; setFormError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase.from('qc_defects').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setDefects(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } as DefectItem : d));
      toast.success(`Status updated to ${newStatus}`);
    } else { toast.error('Failed to update status'); }
  }

  const filtered = defects.filter((d) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.defect_no.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterProject && d.project_id !== filterProject) return false;
    if (filterSeverity && d.severity !== filterSeverity) return false;
    if (filterStatus && d.status !== filterStatus) return false;
    return true;
  });

  const getSeverityBadge = (s: string) => { const m: Record<string, string> = { minor: 'badge', major: 'badge-warning', critical: 'badge-danger' }; return m[s] || 'badge'; };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select className="input max-w-[160px]" value={filterProject} onChange={(e) => { setFilterProject(e.target.value); setPage(1); }}>
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code}</option>)}
          </select>
          <select className="input max-w-[130px]" value={filterSeverity} onChange={(e) => { setFilterSeverity(e.target.value); setPage(1); }}>
            <option value="">All Severity</option>
            <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
          </select>
          <select className="input max-w-[130px]" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="open">Open</option><option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option><option value="closed">Closed</option>
          </select>
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as any, `defects_${new Date().toISOString().slice(0, 10)}.csv`); }}><Download size={14} /> Export</button>
          {hasPermission('quality', 'create') && <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}><Plus size={16} /> New Defect</button>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead><tr><th>Defect No</th><th>Title</th><th>Project</th><th>Category</th><th>Severity</th><th>Status</th><th>Assigned To</th><th>Due Date</th><th>QR</th><th>{t('common.actions')}</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No defects found</td></tr>
            ) : (
              filtered.slice((page - 1) * pageSize, page * pageSize).map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs">{d.defect_no}</td>
                  <td className="font-medium max-w-[200px] truncate">{d.title}</td>
                  <td className="text-xs">{d.project?.project_code || '-'}</td>
                  <td><span className="badge capitalize text-[11px]">{d.category}</span></td>
                  <td><span className={`badge capitalize ${getSeverityBadge(d.severity)}`}>{d.severity}</span></td>
                  <td>
                    <select className="text-xs border-0 bg-transparent cursor-pointer font-medium" value={d.status}
                      onChange={(e) => updateStatus(d.id, e.target.value)}
                      style={{ color: d.status === 'closed' ? '#22c55e' : d.status === 'in_progress' ? '#eab308' : d.status === 'resolved' ? '#3b82f6' : '#ef4444' }}>
                      <option value="open">Open</option><option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option><option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="text-xs">{d.assigned_to ? (users.find(u => u.id === d.assigned_to)?.full_name_en || '-') : '-'}</td>
                  <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{d.due_date || '-'}</td>
                  <td>
                    <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setQrModal({ show: true, value: `${window.location.origin}/quality/defects/${d.id}`, title: d.defect_no }); }}><QrCode size={14} /></button>
                  </td>
                  <td><button className="btn-sm btn-secondary" onClick={() => toast.info(`Defect: ${d.defect_no}`)} title="View"><Eye size={14} /></button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Report Defect</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} /></div>
              <div><label className="label">Project</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({...form, project_id: e.target.value})}>
                  <option value="">-- Select --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Category</label>
                <select className="input" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
                  <option value="general">General</option><option value="architectural">Architectural</option>
                  <option value="structural">Structural</option><option value="mechanical">Mechanical</option>
                  <option value="electrical">Electrical</option><option value="plumbing">Plumbing</option>
                  <option value="finishing">Finishing</option><option value="safety">Safety</option>
                </select>
              </div>
              <div><label className="label">Severity</label>
                <select className="input" value={form.severity} onChange={(e) => setForm({...form, severity: e.target.value})}>
                  <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
                </select>
              </div>
              <div><label className="label">Assigned To</label>
                <select className="input" value={form.assigned_to} onChange={(e) => setForm({...form, assigned_to: e.target.value})}>
                  <option value="">-- Assign --</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
              <div><label className="label">Location</label><input className="input" value={form.location_description} onChange={(e) => setForm({...form, location_description: e.target.value})} /></div>
              <div><label className="label">Due Date</label><input type="date" className="input" value={form.due_date} onChange={(e) => setForm({...form, due_date: e.target.value})} /></div>
              <div className="col-span-2">
                <label className="label">Photos</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {form.photos.map((p, i) => (
                    <div key={i} className="relative group">
                      <img src={p.url} alt={p.name} className="w-20 h-20 rounded-lg object-cover border" style={{ borderColor: 'var(--color-border)' }} />
                      <button className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removePhoto(i)}><X size={10} /></button>
                    </div>
                  ))}
                  <button className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--color-border)' }} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: 'var(--color-primary)' }} /> : <Camera size={20} style={{ color: 'var(--color-text-muted)' }} />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
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
      <QRCodeModal
        show={qrModal.show}
        onClose={() => setQrModal({ show: false, value: '', title: '' })}
        value={qrModal.value}
        title={`Defect: ${qrModal.title}`}
        subtitle="Scan with your phone to view this defect"
      />
    </div>
  );
}

function generateDefectPhotoReport(defect: DefectItem, projectName?: string) {
  const photos = defect.photos || [];
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Defect Report - ${defect.defect_no}</title>
<style>
body{font-family:Arial,sans-serif;margin:20px;color:#333}
.header{border-bottom:2px solid #2563eb;padding-bottom:10px;margin-bottom:20px}
.header h1{color:#2563eb;margin:0;font-size:22px}
.header p{color:#666;margin:4px 0 0;font-size:13px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.field{margin-bottom:6px}
.field label{font-weight:600;font-size:11px;color:#666;text-transform:uppercase;display:block}
.field span{font-size:14px}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600}
.danger{background:#fee2e2;color:#dc2626}
.warning{background:#fef3c7;color:#d97706}
.info{background:#dbeafe;color:#2563eb}
.success{background:#d1fae5;color:#16a34a}
.photos{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px}
.photos img{width:100%;border-radius:8px;border:1px solid #e5e7eb}
.footer{margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:11px;color:#999}
</style></head><body>
<div class="header"><h1>Defect Report</h1><p>${defect.defect_no} - ${new Date().toLocaleDateString()}</p></div>
<div class="grid">
<div class="field"><label>Title</label><span>${defect.title}</span></div>
<div class="field"><label>Project</label><span>${projectName || (defect.project?.project_code) || '-'}</span></div>
<div class="field"><label>Category</label><span>${defect.category}</span></div>
<div class="field"><label>Severity</label><span class="badge ${defect.severity === 'critical' ? 'danger' : defect.severity === 'major' ? 'warning' : 'info'}">${defect.severity}</span></div>
<div class="field"><label>Status</label><span class="badge ${defect.status === 'closed' ? 'success' : defect.status === 'in_progress' ? 'warning' : 'danger'}">${defect.status}</span></div>
<div class="field"><label>Due Date</label><span>${defect.due_date || '-'}</span></div>
<div class="field" style="grid-column:1/-1"><label>Description</label><span>${defect.description || '-'}</span></div>
<div class="field" style="grid-column:1/-1"><label>Location</label><span>${defect.location_description || '-'}</span></div>
</div>
${photos.length ? `<div class="photos">${photos.map(p => `<img src="${p.url}" alt="${p.name}" />`).join('')}</div>` : ''}
<div class="footer"><p>Alfanar ERP</p></div>
</body></html>`;
  return html;
}
