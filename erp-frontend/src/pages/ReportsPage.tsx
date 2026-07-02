import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { reportTemplatesApi, reportsApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import {
  FileText, BarChart3, ClipboardList, CheckSquare, AlertTriangle, Activity,
  Plus, Edit3, Trash2, Eye, X, ChevronUp, ChevronDown,
  Loader2, AlertCircle, Filter, Download, Printer,
  Check, Clock, BookTemplate, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  ReportTemplate, ReportTemplateSection, ReportApprovalStage,
  ReportTracking,
} from '../types';
import Pagination from '../components/Pagination';

const CATEGORIES = ['daily', 'weekly', 'monthly', 'progress', 'quality', 'safety', 'custom'] as const;
const ICONS: { key: string; icon: LucideIcon }[] = [
  { key: 'FileText', icon: FileText },
  { key: 'BarChart3', icon: BarChart3 },
  { key: 'ClipboardList', icon: ClipboardList },
  { key: 'CheckSquare', icon: CheckSquare },
  { key: 'AlertTriangle', icon: AlertTriangle },
  { key: 'Activity', icon: Activity },
];
const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(ICONS.map(i => [i.key, i.icon]));
const SECTION_TYPES = ['text', 'table', 'chart', 'image', 'signature', 'dynamic', 'checkbox', 'select'] as const;
const STATUS_OPTIONS = ['all', 'draft', 'pending', 'submitted', 'under_review', 'approved', 'rejected', 'archived'] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: '#6B7280',
  pending: '#F59E0B',
  submitted: '#3B82F6',
  under_review: '#F59E0B',
  approved: '#22C55E',
  rejected: '#EF4444',
  archived: '#9CA3AF',
};

const CATEGORY_COLORS: Record<string, string> = {
  daily: '#3B82F6',
  weekly: '#8B5CF6',
  monthly: '#EC4899',
  progress: '#22C55E',
  quality: '#F59E0B',
  safety: '#EF4444',
  custom: '#6B7280',
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6B7280';
  return (
    <span className="badge text-xs" style={{ backgroundColor: `${color}20`, color }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function formatDate(d: string) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 6%, transparent)' }}>
        <Icon size={28} style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{title}</p>
      {description && <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--color-text-muted)' }}>{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function renderSectionField(
  section: ReportTemplateSection,
  value: unknown,
  onChange: (val: unknown) => void,
  t: (key: string) => string,
) {
  const id = `section-${section.id || section.section_key}`;
  switch (section.section_type) {
    case 'text':
      return (
        <textarea
          id={id}
          className="textarea"
          rows={4}
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          placeholder={section.title_en}
        />
      );
    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={id}
            checked={value === true}
            onChange={e => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <label htmlFor={id} className="text-sm">{t('yes') || 'Yes'}</label>
        </div>
      );
    case 'select': {
      const opts: string[] = [];
      if (section.config && typeof section.config === 'object') {
        const cfg = section.config as Record<string, unknown>;
        if (Array.isArray(cfg.options)) opts.push(...cfg.options.map(String));
      }
      return (
        <select
          id={id}
          className="input"
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">{t('select') || 'Select...'}</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    case 'image':
      return (
        <div className="flex items-center gap-2">
          <input
            type="file"
            id={id}
            accept="image/*"
            className="text-sm"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = () => onChange(reader.result);
                reader.readAsDataURL(file);
              }
            }}
          />
          {typeof value === 'string' && value.startsWith('data:') && (
            <img src={value} alt="preview" className="w-16 h-16 object-cover rounded" />
          )}
        </div>
      );
    case 'signature':
      return (
        <div>
          <canvas
            id={`sig-${section.id || section.section_key}`}
            className="border rounded w-full h-24 cursor-crosshair"
            style={{ backgroundColor: 'var(--color-surface)' }}
            onMouseDown={e => {
              const canvas = e.currentTarget;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              const rect = canvas.getBoundingClientRect();
              const startX = e.clientX - rect.left;
              const startY = e.clientY - rect.top;
              const onMove = (ev: MouseEvent) => {
                const x = ev.clientX - rect.left;
                const y = ev.clientY - rect.top;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(x, y);
                ctx.stroke();
              };
              const onUp = () => {
                canvas.removeEventListener('mousemove', onMove);
                canvas.removeEventListener('mouseup', onUp);
                onChange(canvas.toDataURL());
              };
              canvas.addEventListener('mousemove', onMove);
              canvas.addEventListener('mouseup', onUp);
            }}
          />
          {typeof value === 'string' && value.startsWith('data:') && (
            <button className="btn-xs btn-secondary mt-1" onClick={() => onChange(null)}>{t('clear') || 'Clear'}</button>
          )}
        </div>
      );
    case 'table': {
      const rows: Record<string, string>[] = Array.isArray(value) ? value as Record<string, string>[] : [];
      const cols: string[] = [];
      if (section.config && typeof section.config === 'object') {
        const cfg = section.config as Record<string, unknown>;
        if (Array.isArray(cfg.columns)) cols.push(...cfg.columns.map(String));
      }
      return (
        <div className="space-y-1">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {cols.length ? cols.map((c, i) => <th key={i}>{c}</th>) : <th>{t('value') || 'Value'}</th>}
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {cols.length ? cols.map((c, ci) => (
                      <td key={ci}>
                        <input
                          className="input text-xs py-1"
                          value={row[c] || ''}
                          onChange={e => {
                            const next = [...rows];
                            next[ri] = { ...next[ri], [c]: e.target.value };
                            onChange(next);
                          }}
                        />
                      </td>
                    )) : (
                      <td>
                        <input
                          className="input text-xs py-1"
                          value={row.value || ''}
                          onChange={e => {
                            const next = [...rows];
                            next[ri] = { ...next[ri], value: e.target.value };
                            onChange(next);
                          }}
                        />
                      </td>
                    )}
                    <td>
                      <button className="btn-xs btn-secondary" onClick={() => onChange(rows.filter((_, i) => i !== ri))}>
                        <X size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-xs btn-secondary" onClick={() => {
            const next = [...rows, cols.length ? Object.fromEntries(cols.map(c => [c, ''])) : { value: '' }];
            onChange(next);
          }}>
            <Plus size={12} /> {t('add_row') || 'Add Row'}
          </button>
        </div>
      );
    }
    case 'chart':
    case 'dynamic':
      return (
        <textarea
          id={id}
          className="textarea font-mono text-xs"
          rows={4}
          value={typeof value === 'string' ? value : value ? JSON.stringify(value, null, 2) : ''}
          onChange={e => {
            try { onChange(JSON.parse(e.target.value)); }
            catch { onChange(e.target.value); }
          }}
          placeholder="{}"
        />
      );
    default:
      return (
        <textarea
          id={id}
          className="textarea"
          rows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
        />
      );
  }
}

interface StageApproval {
  id: string;
  report_id: string;
  stage_id: string;
  approver_id?: string;
  status: string;
  comments?: string;
  signed_at?: string;
  report?: { id: string; title_en: string; report_date: string; status: string; template_id: string };
  stage?: { stage_name_en: string; stage_order: number };
}

export default function ReportsPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('reports');

  const tabs = [
    { key: 'templates', label: t('report_templates') || 'Templates', icon: BookTemplate },
    { key: 'reports', label: t('reports') || 'Reports', icon: FileText },
    { key: 'tracking', label: t('tracking') || 'Tracking', icon: Activity },
    { key: 'approvals', label: t('approvals') || 'Approvals', icon: Users },
  ];

  return (
    <div className="page-enter space-y-6">
      <div className="welcome-gradient p-6 md:p-8">
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
            <FileText size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">{t('reports_management') || 'Reports Management'}</h1>
            <p className="text-sm text-white/80">{t('reports_description') || 'Create, manage, and approve reports'}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`tab flex items-center gap-1.5 ${activeTab === tab.key ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'templates' && <TemplatesTab t={t} toast={toast} />}
      {activeTab === 'reports' && <ReportsTab t={t} toast={toast} user={user} />}
      {activeTab === 'tracking' && <TrackingTab t={t} />}
      {activeTab === 'approvals' && <ApprovalsTab t={t} toast={toast} user={user} />}
    </div>
  );
}

function TemplatesTab({ t, toast }: { t: (k: string) => string; toast: ReturnType<typeof useToast> }) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReportTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ReportTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ReportTemplate>>({ code: '', name_en: '', name_ar: '', description: '', category: 'daily', icon: 'FileText', is_active: true });

  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editingSection, setEditingSection] = useState<ReportTemplateSection | null>(null);
  const [sectionForm, setSectionForm] = useState<Partial<ReportTemplateSection>>({ section_key: '', title_en: '', title_ar: '', section_type: 'text', content_template: '', config: {}, is_required: false });
  const [savingSection, setSavingSection] = useState(false);

  const [showStageForm, setShowStageForm] = useState(false);
  const [editingStage, setEditingStage] = useState<ReportApprovalStage | null>(null);
  const [stageForm, setStageForm] = useState<Partial<ReportApprovalStage>>({ stage_name_en: '', stage_name_ar: '', approver_role: '', approver_user_id: '', required_signatures: 1, timeout_hours: 0 });
  const [savingStage, setSavingStage] = useState(false);

  useEffect(() => { loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await reportTemplatesApi.list(true);
      setTemplates(data);
    } catch (err) {
      toast.error(t('load_failed') || 'Failed to load templates');
      console.error(err);
    } finally { setLoading(false); }
  }

  function resetForm() {
    setForm({ code: '', name_en: '', name_ar: '', description: '', category: 'daily', icon: 'FileText', is_active: true });
    setEditing(null);
  }

  function openEdit(tmpl: ReportTemplate) {
    setForm({ code: tmpl.code, name_en: tmpl.name_en, name_ar: tmpl.name_ar || '', description: tmpl.description || '', category: tmpl.category, icon: tmpl.icon, is_active: tmpl.is_active });
    setEditing(tmpl);
    setShowForm(true);
  }

  async function saveTemplate() {
    if (!form.name_en) { toast.error(t('name_required') || 'Name is required'); return; }
    setSaving(true);
    try {
      await reportTemplatesApi.upsert(editing ? { ...form, id: editing.id, version: (editing.version || 1) + 1 } : { ...form, version: 1 });
      toast.success(editing ? (t('updated') || 'Updated') : (t('created') || 'Created'));
      setShowForm(false);
      resetForm();
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  async function deleteTemplate(id: string) {
    if (!confirm(t('confirm_delete') || 'Delete this template?')) return;
    try {
      await reportTemplatesApi.remove(id);
      toast.success(t('deleted') || 'Deleted');
      if (selected?.id === id) setSelected(null);
      await loadTemplates();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Delete failed'); }
  }

  function resetSectionForm() {
    setSectionForm({ section_key: '', title_en: '', title_ar: '', section_type: 'text', content_template: '', config: {}, is_required: false });
    setEditingSection(null);
  }

  function openEditSection(sec: ReportTemplateSection) {
    setSectionForm({ section_key: sec.section_key, title_en: sec.title_en, title_ar: sec.title_ar || '', section_type: sec.section_type, content_template: sec.content_template || '', config: sec.config || {}, is_required: sec.is_required });
    setEditingSection(sec);
    setShowSectionForm(true);
  }

  async function saveSection() {
    if (!sectionForm.section_key || !sectionForm.title_en) { toast.error(t('fill_required') || 'Key and title required'); return; }
    if (!selected?.id) return;
    setSavingSection(true);
    try {
      const payload: any = {
        template_id: selected.id,
        section_key: sectionForm.section_key,
        title_en: sectionForm.title_en,
        title_ar: sectionForm.title_ar || null,
        section_type: sectionForm.section_type,
        content_template: sectionForm.content_template || null,
        config: sectionForm.config || {},
        is_required: sectionForm.is_required || false,
        sort_order: editingSection ? editingSection.sort_order : ((selected.sections || []).length + 1),
      };
      if (editingSection) payload.id = editingSection.id;
      await reportTemplatesApi.upsertSection(payload);
      toast.success(editingSection ? (t('updated') || 'Updated') : (t('created') || 'Created'));
      setShowSectionForm(false);
      resetSectionForm();
      await loadTemplates();
      const updated = await reportTemplatesApi.get(selected.id);
      setSelected(updated);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSavingSection(false); }
  }

  async function deleteSection(id: string) {
    if (!confirm(t('confirm_delete') || 'Delete this section?')) return;
    try {
      await reportTemplatesApi.removeSection(id);
      toast.success(t('deleted') || 'Deleted');
      if (selected) {
        const updated = await reportTemplatesApi.get(selected.id);
        setSelected(updated);
      }
      await loadTemplates();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Delete failed'); }
  }

  async function moveSection(index: number, direction: -1 | 1) {
    if (!selected?.sections) return;
    const sections = [...selected.sections];
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
    for (let i = 0; i < sections.length; i++) {
      await reportTemplatesApi.upsertSection({ id: sections[i].id, sort_order: i + 1 });
    }
    const updated = await reportTemplatesApi.get(selected.id);
    setSelected(updated);
  }

  function resetStageForm() {
    setStageForm({ stage_name_en: '', stage_name_ar: '', approver_role: '', approver_user_id: '', required_signatures: 1, timeout_hours: 0 });
    setEditingStage(null);
  }

  function openEditStage(stg: ReportApprovalStage) {
    setStageForm({ stage_name_en: stg.stage_name_en, stage_name_ar: stg.stage_name_ar || '', approver_role: stg.approver_role || '', approver_user_id: stg.approver_user_id || '', required_signatures: stg.required_signatures, timeout_hours: stg.timeout_hours || 0 });
    setEditingStage(stg);
    setShowStageForm(true);
  }

  async function saveStage() {
    if (!stageForm.stage_name_en) { toast.error(t('fill_required') || 'Stage name required'); return; }
    if (!selected?.id) return;
    setSavingStage(true);
    try {
      const payload: any = {
        template_id: selected.id,
        stage_name_en: stageForm.stage_name_en,
        stage_name_ar: stageForm.stage_name_ar || null,
        approver_role: stageForm.approver_role || null,
        approver_user_id: stageForm.approver_user_id || null,
        required_signatures: stageForm.required_signatures || 1,
        timeout_hours: stageForm.timeout_hours || 0,
        stage_order: editingStage ? editingStage.stage_order : ((selected.approval_stages || []).length + 1),
      };
      if (editingStage) payload.id = editingStage.id;
      await reportTemplatesApi.upsertStage(payload);
      toast.success(editingStage ? (t('updated') || 'Updated') : (t('created') || 'Created'));
      setShowStageForm(false);
      resetStageForm();
      const updated = await reportTemplatesApi.get(selected.id);
      setSelected(updated);
      await loadTemplates();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSavingStage(false); }
  }

  async function deleteStage(id: string) {
    if (!confirm(t('confirm_delete') || 'Delete this stage?')) return;
    try {
      await reportTemplatesApi.removeStage(id);
      toast.success(t('deleted') || 'Deleted');
      if (selected) {
        const updated = await reportTemplatesApi.get(selected.id);
        setSelected(updated);
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Delete failed'); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('templates') || 'Templates'}</h2>
        <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus size={14} /> {t('new_template') || 'New Template'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-2">
          {templates.length === 0 ? (
            <EmptyState icon={BookTemplate} title={t('no_templates') || 'No templates'} description={t('create_first_template') || 'Create your first report template'} />
          ) : templates.map(tmpl => {
            const TmplIcon = ICON_MAP[tmpl.icon] || FileText;
            const catColor = CATEGORY_COLORS[tmpl.category] || '#6B7280';
            return (
              <div
                key={tmpl.id}
                className={`card p-3 cursor-pointer transition-colors ${selected?.id === tmpl.id ? 'ring-2' : ''}`}
                style={{ borderColor: selected?.id === tmpl.id ? 'var(--color-primary)' : undefined }}
                onClick={() => setSelected(tmpl)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${catColor}15`, color: catColor }}>
                    <TmplIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{tmpl.name_en}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{tmpl.name_ar}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="badge text-xs" style={{ backgroundColor: `${catColor}20`, color: catColor }}>{tmpl.category}</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>v{tmpl.version}</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{tmpl.sections?.length || 0} {t('sections') || 'sections'}</span>
                      {!tmpl.is_active && <span className="badge text-xs" style={{ backgroundColor: '#EF444420', color: '#EF4444' }}>{t('inactive') || 'Inactive'}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-xs btn-secondary" onClick={e => { e.stopPropagation(); openEdit(tmpl); }}>
                      <Edit3 size={12} />
                    </button>
                    <button className="btn-xs btn-secondary" onClick={e => { e.stopPropagation(); deleteTemplate(tmpl.id); }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="glass-card p-8">
              <EmptyState icon={Eye} title={t('select_template') || 'Select a Template'} description={t('select_template_hint') || 'Click a template from the list to view and manage its sections and approval stages'} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold">{selected.name_en}</h3>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{selected.name_ar}</p>
                  </div>
                  <StatusBadge status={selected.category} />
                </div>
                {selected.description && <p className="text-sm mb-2">{selected.description}</p>}
                <div className="text-xs space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                  <span>{t('code') || 'Code'}: {selected.code}</span>
                  <span className="ml-3">{t('version') || 'Version'}: {selected.version}</span>
                  {selected.is_active ? (
                    <span className="badge badge-success text-xs ml-2">{t('active') || 'Active'}</span>
                  ) : (
                    <span className="badge badge-danger text-xs ml-2">{t('inactive') || 'Inactive'}</span>
                  )}
                </div>
              </div>

              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5"><ClipboardList size={14} /> {t('sections') || 'Sections'}</h4>
                  <button className="btn-xs btn-primary flex items-center gap-1" onClick={() => { resetSectionForm(); setShowSectionForm(true); }}>
                    <Plus size={12} /> {t('add_section') || 'Add Section'}
                  </button>
                </div>
                {(!selected.sections || selected.sections.length === 0) ? (
                  <EmptyState icon={ClipboardList} title={t('no_sections') || 'No sections'} />
                ) : (
                  <div className="space-y-1.5">
                    {selected.sections.map((sec, idx) => (
                      <div key={sec.id || idx} className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'var(--color-surface)' }}>
                        <div className="flex flex-col gap-0.5">
                          <button className="btn-xs btn-secondary p-0.5" onClick={() => moveSection(idx, -1)} disabled={idx === 0}>
                            <ChevronUp size={12} />
                          </button>
                          <button className="btn-xs btn-secondary p-0.5" onClick={() => moveSection(idx, 1)} disabled={idx === (selected.sections || []).length - 1}>
                            <ChevronDown size={12} />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{sec.title_en}</span>
                            <span className="badge text-xs">{sec.section_type}</span>
                            {sec.is_required && <span className="text-xs text-red-500">*</span>}
                          </div>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{sec.section_key}</p>
                        </div>
                        <div className="flex gap-1">
                          <button className="btn-xs btn-secondary" onClick={() => openEditSection(sec)}><Edit3 size={12} /></button>
                          <button className="btn-xs btn-secondary" onClick={() => deleteSection(sec.id)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5"><CheckSquare size={14} /> {t('approval_stages') || 'Approval Stages'}</h4>
                  <button className="btn-xs btn-primary flex items-center gap-1" onClick={() => { resetStageForm(); setShowStageForm(true); }}>
                    <Plus size={12} /> {t('add_stage') || 'Add Stage'}
                  </button>
                </div>
                {(!selected.approval_stages || selected.approval_stages.length === 0) ? (
                  <EmptyState icon={CheckSquare} title={t('no_stages') || 'No stages'} />
                ) : (
                  <div className="space-y-1.5">
                    {selected.approval_stages.map((stg, idx) => (
                      <div key={stg.id || idx} className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'var(--color-surface)' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{stg.stage_name_en}</p>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {stg.approver_role && `${t('role') || 'Role'}: ${stg.approver_role} | `}
                            {t('signatures') || 'Signatures'}: {stg.required_signatures}
                            {stg.timeout_hours ? ` | ${t('timeout') || 'Timeout'}: ${stg.timeout_hours}h` : ''}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button className="btn-xs btn-secondary" onClick={() => openEditStage(stg)}><Edit3 size={12} /></button>
                          <button className="btn-xs btn-secondary" onClick={() => deleteStage(stg.id)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{editing ? (t('edit_template') || 'Edit Template') : (t('new_template') || 'New Template')}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} style={{ color: 'var(--color-text-muted)' }} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">{t('code') || 'Code'}</label>
                <input className="input" value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="AUTO-GENERATED" />
              </div>
              <div>
                <label className="label">{t('name_en') || 'Name (EN)'}</label>
                <input className="input" value={form.name_en || ''} onChange={e => setForm({ ...form, name_en: e.target.value })} required />
              </div>
              <div>
                <label className="label">{t('name_ar') || 'Name (AR)'}</label>
                <input className="input" value={form.name_ar || ''} onChange={e => setForm({ ...form, name_ar: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('description') || 'Description'}</label>
                <textarea className="textarea" rows={2} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('category') || 'Category'}</label>
                  <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as any })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('icon') || 'Icon'}</label>
                  <select className="input" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}>
                    {ICONS.map(ic => <option key={ic.key} value={ic.key}>{ic.key}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tmpl-active" checked={form.is_active ?? true} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                <label htmlFor="tmpl-active" className="text-sm">{t('active') || 'Active'}</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>{t('cancel') || 'Cancel'}</button>
                <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={saveTemplate} disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editing ? (t('update') || 'Update') : (t('create') || 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSectionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSectionForm(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{editingSection ? (t('edit_section') || 'Edit Section') : (t('add_section') || 'Add Section')}</h3>
              <button onClick={() => setShowSectionForm(false)}><X size={18} style={{ color: 'var(--color-text-muted)' }} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('section_key') || 'Section Key'}</label>
                  <input className="input" value={sectionForm.section_key || ''} onChange={e => setSectionForm({ ...sectionForm, section_key: e.target.value })} placeholder="e.g. progress_summary" />
                </div>
                <div>
                  <label className="label">{t('section_type') || 'Type'}</label>
                  <select className="input" value={sectionForm.section_type} onChange={e => setSectionForm({ ...sectionForm, section_type: e.target.value as any })}>
                    {SECTION_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">{t('title_en') || 'Title (EN)'}</label>
                <input className="input" value={sectionForm.title_en || ''} onChange={e => setSectionForm({ ...sectionForm, title_en: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('title_ar') || 'Title (AR)'}</label>
                <input className="input" value={sectionForm.title_ar || ''} onChange={e => setSectionForm({ ...sectionForm, title_ar: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('content_template') || 'Content Template (JSON/HTML)'}</label>
                <textarea className="textarea font-mono text-xs" rows={4} value={sectionForm.content_template || ''} onChange={e => setSectionForm({ ...sectionForm, content_template: e.target.value })} placeholder="{ &quot;key&quot;: &quot;value&quot; }" />
              </div>
              <div>
                <label className="label">{t('config') || 'Config (JSON)'}</label>
                <textarea className="textarea font-mono text-xs" rows={3} value={JSON.stringify(sectionForm.config || {}, null, 2)} onChange={e => {
                  try { setSectionForm({ ...sectionForm, config: JSON.parse(e.target.value) }); }
                  catch { /* invalid JSON */ }
                }} placeholder='{ &quot;options&quot;: [&quot;A&quot;, &quot;B&quot;] }' />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="sec-required" checked={sectionForm.is_required || false} onChange={e => setSectionForm({ ...sectionForm, is_required: e.target.checked })} />
                <label htmlFor="sec-required" className="text-sm">{t('is_required') || 'Required'}</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-secondary btn-sm" onClick={() => setShowSectionForm(false)}>{t('cancel') || 'Cancel'}</button>
                <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={saveSection} disabled={savingSection}>
                  {savingSection && <Loader2 size={14} className="animate-spin" />}
                  {editingSection ? (t('update') || 'Update') : (t('add') || 'Add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStageForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowStageForm(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{editingStage ? (t('edit_stage') || 'Edit Stage') : (t('add_stage') || 'Add Stage')}</h3>
              <button onClick={() => setShowStageForm(false)}><X size={18} style={{ color: 'var(--color-text-muted)' }} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('stage_name_en') || 'Stage Name (EN)'}</label>
                  <input className="input" value={stageForm.stage_name_en || ''} onChange={e => setStageForm({ ...stageForm, stage_name_en: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('stage_name_ar') || 'Stage Name (AR)'}</label>
                  <input className="input" value={stageForm.stage_name_ar || ''} onChange={e => setStageForm({ ...stageForm, stage_name_ar: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('approver_role') || 'Approver Role'}</label>
                  <input className="input" value={stageForm.approver_role || ''} onChange={e => setStageForm({ ...stageForm, approver_role: e.target.value })} placeholder="e.g. project_manager" />
                </div>
                <div>
                  <label className="label">{t('approver_user') || 'Approver User ID'}</label>
                  <input className="input" value={stageForm.approver_user_id || ''} onChange={e => setStageForm({ ...stageForm, approver_user_id: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('required_signatures') || 'Required Signatures'}</label>
                  <input type="number" className="input" min={1} value={stageForm.required_signatures || 1} onChange={e => setStageForm({ ...stageForm, required_signatures: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className="label">{t('timeout_hours') || 'Timeout (hours)'}</label>
                  <input type="number" className="input" min={0} value={stageForm.timeout_hours || 0} onChange={e => setStageForm({ ...stageForm, timeout_hours: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-secondary btn-sm" onClick={() => setShowStageForm(false)}>{t('cancel') || 'Cancel'}</button>
                <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={saveStage} disabled={savingStage}>
                  {savingStage && <Loader2 size={14} className="animate-spin" />}
                  {editingStage ? (t('update') || 'Update') : (t('add') || 'Add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsTab({ t, toast, user }: { t: (k: string) => string; toast: ReturnType<typeof useToast>; user: any }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [filters, setFilters] = useState({
    project_id: '', report_date_from: '', report_date_to: '', department_id: '',
    unit_id: '', block_id: '', activity_id: '', status: '', template_id: '',
    created_by: '', assigned_to: '', search: '',
  });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [detailReport, setDetailReport] = useState<any>(null);
  const [tracking, setTracking] = useState<ReportTracking[]>([]);

  const [repForm, setRepForm] = useState({
    template_id: '', title_en: '', title_ar: '', project_id: '', department_id: '',
    unit_id: '', block_id: '', activity_id: '', report_date: new Date().toISOString().slice(0, 10),
    due_date: '', assigned_to: '', progress_pct: 0, status: 'draft' as string,
    report_data: {} as Record<string, unknown>,
  });
  const [formSections, setFormSections] = useState<ReportTemplateSection[]>([]);
  const [sectionData, setSectionData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    loadInitial();
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInitial() {
    try {
      const [projRes, tmplRes, usersRes] = await Promise.all([
        supabase.from('projects').select('id, name_en, project_code').order('name_en'),
        reportTemplatesApi.list(false),
        supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
      ]);
      setProjects(projRes.data || []);
      setTemplates(tmplRes);
      setUsers(usersRes.data || []);
    } catch (err) { console.error(err); }
    try {
      const deptRes = await supabase.from('departments').select('id, name_en').order('name_en');
      setDepartments(deptRes.data || []);
    } catch { setDepartments([]); }
  }

  async function loadReports() {
    setLoading(true);
    try {
      const f: any = {};
      if (filters.project_id) f.project_id = filters.project_id;
      if (filters.status) f.status = filters.status;
      if (filters.template_id) f.template_id = filters.template_id;
      if (filters.report_date_from) f.report_date_from = filters.report_date_from;
      if (filters.report_date_to) f.report_date_to = filters.report_date_to;
      if (filters.department_id) f.department_id = filters.department_id;
      if (filters.unit_id) f.unit_id = filters.unit_id;
      if (filters.block_id) f.block_id = filters.block_id;
      if (filters.activity_id) f.activity_id = filters.activity_id;
      if (filters.created_by) f.created_by = filters.created_by;
      if (filters.assigned_to) f.assigned_to = filters.assigned_to;
      let data = await reportsApi.list(f);
      if (filters.search) {
        const s = filters.search.toLowerCase();
        data = data.filter((r: any) => r.title_en?.toLowerCase().includes(s) || r.title_ar?.toLowerCase().includes(s));
      }
      setReports(data);
    } catch (err) { toast.error(t('load_failed') || 'Failed to load reports'); console.error(err); }
    finally { setLoading(false); }
  }

  function resetRepForm() {
    setRepForm({
      template_id: '', title_en: '', title_ar: '', project_id: '', department_id: '',
      unit_id: '', block_id: '', activity_id: '', report_date: new Date().toISOString().slice(0, 10),
      due_date: '', assigned_to: '', progress_pct: 0, status: 'draft',
      report_data: {},
    });
    setSectionData({});
    setFormSections([]);
    setEditingReport(null);
  }

  function openEditRep(r: any) {
    setRepForm({
      template_id: r.template_id, title_en: r.title_en || '', title_ar: r.title_ar || '',
      project_id: r.project_id || '', department_id: r.department_id || '',
      unit_id: r.unit_id || '', block_id: r.block_id || '', activity_id: r.activity_id || '',
      report_date: r.report_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      due_date: r.due_date?.slice(0, 10) || '',
      assigned_to: r.assigned_to || '', progress_pct: r.progress_pct || 0,
      status: r.status || 'draft', report_data: (r.report_data || {}) as Record<string, unknown>,
    });
    setEditingReport(r);
    loadTemplateSections(r.template_id);
    setShowForm(true);
  }

  async function loadTemplateSections(templateId: string) {
    try {
      const tmpl = await reportTemplatesApi.get(templateId);
      setFormSections(tmpl.sections || []);
      const existingData = editingReport?.report_data || {};
      const merged: Record<string, unknown> = {};
      (tmpl.sections || []).forEach(sec => {
        merged[sec.section_key] = (existingData as Record<string, unknown>)[sec.section_key] || '';
      });
      setSectionData(merged);
    } catch { setFormSections([]); }
  }

  async function handleTemplateChange(templateId: string) {
    setRepForm({ ...repForm, template_id: templateId });
    if (templateId) {
      try {
        const tmpl = await reportTemplatesApi.get(templateId);
        setFormSections(tmpl.sections || []);
        const merged: Record<string, unknown> = {};
        (tmpl.sections || []).forEach(sec => { merged[sec.section_key] = ''; });
        setSectionData(merged);
      } catch { setFormSections([]); }
    } else {
      setFormSections([]);
      setSectionData({});
    }
  }

  async function saveReport(submitAfter = false) {
    if (!repForm.template_id) { toast.error(t('template_required') || 'Template required'); return; }
    if (!repForm.title_en) { toast.error(t('title_required') || 'Title required'); return; }
    setSaving(true);
    try {
      const payload: any = {
        ...repForm,
        report_data: sectionData,
        created_by: editingReport ? undefined : user?.id,
        updated_at: new Date().toISOString(),
      };
      delete payload.status;
      if (submitAfter) payload.status = 'submitted';
      else payload.status = editingReport ? editingReport.status : 'draft';

      if (editingReport) {
        await reportsApi.update(editingReport.id, payload);
        if (submitAfter) await reportsApi.submit(editingReport.id);
        toast.success(t('updated') || 'Updated');
      } else {
        if (submitAfter) {
          const created = await reportsApi.create({ ...payload, status: 'draft' });
          await reportsApi.submit(created.id);
        } else {
          await reportsApi.create(payload);
        }
        toast.success(t('created') || 'Created');
      }
      setShowForm(false);
      resetRepForm();
      await loadReports();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('already exists')) {
        toast.error(t('duplicate_warning') || 'A completed report already exists for this combination. Archive it first or create a revision.');
      } else {
        toast.error(msg);
      }
    } finally { setSaving(false); }
  }

  async function deleteReport(id: string) {
    if (!confirm(t('confirm_delete') || 'Delete this report?')) return;
    try {
      await reportsApi.remove(id);
      toast.success(t('deleted') || 'Deleted');
      await loadReports();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Delete failed'); }
  }

  async function handleSubmit(id: string) {
    if (!confirm(t('confirm_submit') || 'Submit this report?')) return;
    try {
      await reportsApi.submit(id);
      toast.success(t('submitted') || 'Submitted');
      await loadReports();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Submit failed'); }
  }

  async function bulkAction(action: 'submit' | 'archive') {
    if (selectedRows.size === 0) { toast.info(t('select_rows') || 'Select rows first'); return; }
    if (!confirm(t('confirm_bulk') || `Apply ${action} to ${selectedRows.size} reports?`)) return;
    try {
      for (const id of selectedRows) {
        if (action === 'submit') await reportsApi.submit(id);
        else await reportsApi.update(id, { status: 'archived', updated_at: new Date().toISOString() });
      }
      toast.success(`${action} applied to ${selectedRows.size} reports`);
      setSelectedRows(new Set());
      await loadReports();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Bulk action failed'); }
  }

  async function openDetail(r: any) {
    setDetailReport(r);
    try {
      const tr = await reportsApi.getTracking(r.id);
      setTracking(tr);
    } catch { setTracking([]); }
  }

  function toggleRow(id: string) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const paginated = reports.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('reports') || 'Reports'}</h2>
        <div className="flex items-center gap-2">
          {selectedRows.size > 0 && (
            <>
              <button className="btn-xs btn-secondary" onClick={() => bulkAction('submit')}>{t('bulk_submit') || 'Submit Selected'}</button>
              <button className="btn-xs btn-secondary" onClick={() => bulkAction('archive')}>{t('bulk_archive') || 'Archive Selected'}</button>
            </>
          )}
          <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={() => { resetRepForm(); setShowForm(true); }}>
            <Plus size={14} /> {t('new_report') || 'New Report'}
          </button>
        </div>
      </div>

      <div className="glass-card p-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('project') || 'Project'}</label>
            <select className="input text-xs py-1.5 min-w-[140px]" value={filters.project_id} onChange={e => setFilters({ ...filters, project_id: e.target.value })}>
              <option value="">{t('all') || 'All'}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name_en}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('from') || 'From'}</label>
            <input type="date" className="input text-xs py-1.5 w-[130px]" value={filters.report_date_from} onChange={e => setFilters({ ...filters, report_date_from: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('to') || 'To'}</label>
            <input type="date" className="input text-xs py-1.5 w-[130px]" value={filters.report_date_to} onChange={e => setFilters({ ...filters, report_date_to: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('dept') || 'Dept'}</label>
            <input className="input text-xs py-1.5 w-[100px]" value={filters.department_id} onChange={e => setFilters({ ...filters, department_id: e.target.value })} placeholder={t('department') || 'Department'} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('unit') || 'Unit'}</label>
            <input className="input text-xs py-1.5 w-[100px]" value={filters.unit_id} onChange={e => setFilters({ ...filters, unit_id: e.target.value })} placeholder={t('unit') || 'Unit'} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('block') || 'Block'}</label>
            <input className="input text-xs py-1.5 w-[100px]" value={filters.block_id} onChange={e => setFilters({ ...filters, block_id: e.target.value })} placeholder={t('block') || 'Block'} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('activity') || 'Activity'}</label>
            <input className="input text-xs py-1.5 w-[100px]" value={filters.activity_id} onChange={e => setFilters({ ...filters, activity_id: e.target.value })} placeholder={t('activity') || 'Activity'} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('status') || 'Status'}</label>
            <select className="input text-xs py-1.5 w-[110px]" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s === 'all' ? '' : s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('template') || 'Template'}</label>
            <select className="input text-xs py-1.5 min-w-[120px]" value={filters.template_id} onChange={e => setFilters({ ...filters, template_id: e.target.value })}>
              <option value="">{t('all') || 'All'}</option>
              {templates.map(tm => <option key={tm.id} value={tm.id}>{tm.name_en}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('created_by') || 'Created By'}</label>
            <select className="input text-xs py-1.5 w-[120px]" value={filters.created_by} onChange={e => setFilters({ ...filters, created_by: e.target.value })}>
              <option value="">{t('all') || 'All'}</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('assigned_to') || 'Assigned To'}</label>
            <select className="input text-xs py-1.5 w-[120px]" value={filters.assigned_to} onChange={e => setFilters({ ...filters, assigned_to: e.target.value })}>
              <option value="">{t('all') || 'All'}</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('search') || 'Search'}</label>
            <input className="input text-xs py-1.5 w-[140px]" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder={t('search_title') || 'Search by title'} />
          </div>
          <button className="btn-xs btn-secondary mt-4" onClick={loadReports}><Filter size={12} /> {t('filter') || 'Filter'}</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="w-8">
                <input type="checkbox" onChange={e => {
                  if (e.target.checked) setSelectedRows(new Set(paginated.map((r: any) => r.id)));
                  else setSelectedRows(new Set());
                }} />
              </th>
              <th>{t('title') || 'Title'}</th>
              <th>{t('template') || 'Template'}</th>
              <th>{t('project') || 'Project'}</th>
              <th>{t('date') || 'Date'}</th>
              <th>{t('status') || 'Status'}</th>
              <th>{t('progress') || 'Progress'}</th>
              <th>{t('dept_unit') || 'Dept/Unit'}</th>
              <th>{t('created_by') || 'Created By'}</th>
              <th className="w-36">{t('actions') || 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-12"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>{t('no_reports') || 'No reports found'}</td></tr>
            ) : paginated.map((r: any) => {
              const TmplIcon = ICON_MAP[r.template?.icon] || FileText;
              return (
                <tr key={r.id} className="clickable" onClick={() => openDetail(r)}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedRows.has(r.id)} onChange={() => toggleRow(r.id)} />
                  </td>
                  <td className="font-medium text-sm">{r.title_en}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <TmplIcon size={14} style={{ color: 'var(--color-text-muted)' }} />
                      <span className="text-xs">{r.template?.name_en || '-'}</span>
                    </div>
                  </td>
                  <td className="text-xs">{r.project?.name_en || '-'}</td>
                  <td className="text-xs">{formatDate(r.report_date)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 10%, transparent)' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${r.progress_pct || 0}%`, backgroundColor: STATUS_COLORS[r.status] || '#3B82F6' }} />
                      </div>
                      <span className="text-xs">{r.progress_pct || 0}%</span>
                    </div>
                  </td>
                  <td className="text-xs">{r.department?.name_en || r.unit?.name_en || '-'}</td>
                  <td className="text-xs">{r.created_by?.slice(0, 8) || '-'}</td>
                  <td>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button className="btn-xs btn-secondary" onClick={() => openDetail(r)}><Eye size={12} /></button>
                      {r.status === 'draft' && (
                        <>
                          <button className="btn-xs btn-secondary" onClick={() => openEditRep(r)}><Edit3 size={12} /></button>
                          <button className="btn-xs btn-secondary" onClick={() => handleSubmit(r.id)}><Check size={12} /></button>
                          <button className="btn-xs btn-secondary" onClick={() => deleteReport(r.id)}><Trash2 size={12} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {reports.length > pageSize && (
        <Pagination page={page} pageSize={pageSize} total={reports.length} onChange={setPage} />
      )}

      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <button className="btn-xs btn-secondary flex items-center gap-1" onClick={() => {
          const rows = paginated.map((r: any) => ({
            Title: r.title_en,
            Template: r.template?.name_en || '',
            Project: r.project?.name_en || '',
            Date: r.report_date || '',
            Status: r.status || '',
            Progress: (r.progress_pct || 0) + '%',
          }));
          const header = Object.keys(rows[0] || {}).join(',');
          const csv = [header, ...rows.map((r: Record<string, any>) => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `reports_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
          URL.revokeObjectURL(a.href);
          toast.success('CSV exported');
        }}><Download size={12} /> {t('export_csv') || 'Export CSV'}</button>
        <button className="btn-xs btn-secondary flex items-center gap-1" onClick={() => window.print()}><Printer size={12} /> {t('print') || 'Print'}</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{editingReport ? (t('edit_report') || 'Edit Report') : (t('new_report') || 'New Report')}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} style={{ color: 'var(--color-text-muted)' }} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">{t('template') || 'Template'} *</label>
                <select className="input" value={repForm.template_id} onChange={e => handleTemplateChange(e.target.value)} disabled={!!editingReport}>
                  <option value="">{t('select_template') || 'Select template...'}</option>
                  {templates.map(tm => <option key={tm.id} value={tm.id}>{tm.name_en}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('title_en') || 'Title (EN)'} *</label>
                  <input className="input" value={repForm.title_en} onChange={e => setRepForm({ ...repForm, title_en: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('title_ar') || 'Title (AR)'}</label>
                  <input className="input" value={repForm.title_ar} onChange={e => setRepForm({ ...repForm, title_ar: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">{t('project') || 'Project'}</label>
                  <select className="input" value={repForm.project_id} onChange={e => setRepForm({ ...repForm, project_id: e.target.value })}>
                    <option value="">{t('select') || 'Select...'}</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name_en}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('department') || 'Department'}</label>
                  <select className="input" value={repForm.department_id} onChange={e => setRepForm({ ...repForm, department_id: e.target.value })}>
                    <option value="">{t('select') || 'Select...'}</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name_en}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('unit') || 'Unit'}</label>
                  <input className="input" value={repForm.unit_id} onChange={e => setRepForm({ ...repForm, unit_id: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">{t('block') || 'Block'}</label>
                  <input className="input" value={repForm.block_id} onChange={e => setRepForm({ ...repForm, block_id: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('activity') || 'Activity'}</label>
                  <input className="input" value={repForm.activity_id} onChange={e => setRepForm({ ...repForm, activity_id: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('assigned_to') || 'Assigned To'}</label>
                  <select className="input" value={repForm.assigned_to} onChange={e => setRepForm({ ...repForm, assigned_to: e.target.value })}>
                    <option value="">{t('select') || 'Select...'}</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('report_date') || 'Report Date'}</label>
                  <input type="date" className="input" value={repForm.report_date} onChange={e => setRepForm({ ...repForm, report_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('due_date') || 'Due Date'}</label>
                  <input type="date" className="input" value={repForm.due_date} onChange={e => setRepForm({ ...repForm, due_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">{t('progress') || 'Progress (%)'}</label>
                <input type="range" min={0} max={100} className="w-full" value={repForm.progress_pct} onChange={e => setRepForm({ ...repForm, progress_pct: parseInt(e.target.value) })} />
                <span className="text-xs">{repForm.progress_pct}%</span>
              </div>

              {formSections.length > 0 && (
                <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--color-border)' }}>
                  <h4 className="text-sm font-semibold mb-3">{t('report_sections') || 'Report Sections'}</h4>
                  <div className="space-y-4">
                    {formSections.map(sec => (
                      <div key={sec.id || sec.section_key}>
                        <label className="label flex items-center gap-1">
                          {sec.title_en}
                          {sec.is_required && <span className="text-red-500">*</span>}
                          <span className="badge text-xs">{sec.section_type}</span>
                        </label>
                        {renderSectionField(sec, sectionData[sec.section_key], (val) => {
                          setSectionData(prev => ({ ...prev, [sec.section_key]: val }));
                        }, t)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>{t('cancel') || 'Cancel'}</button>
                <button className="btn-secondary btn-sm flex items-center gap-1.5" onClick={() => saveReport(false)} disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {t('save_draft') || 'Save Draft'}
                </button>
                <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={() => saveReport(true)} disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {t('submit') || 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetailReport(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{detailReport.title_en}</h3>
              <button onClick={() => setDetailReport(null)}><X size={18} style={{ color: 'var(--color-text-muted)' }} /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="font-medium">{t('template') || 'Template'}:</span> {detailReport.template?.name_en || '-'}</div>
                <div><span className="font-medium">{t('status') || 'Status'}:</span> <StatusBadge status={detailReport.status} /></div>
                <div><span className="font-medium">{t('project') || 'Project'}:</span> {detailReport.project?.name_en || '-'}</div>
                <div><span className="font-medium">{t('date') || 'Date'}:</span> {formatDate(detailReport.report_date)}</div>
                <div><span className="font-medium">{t('due_date') || 'Due Date'}:</span> {formatDate(detailReport.due_date)}</div>
                <div><span className="font-medium">{t('progress') || 'Progress'}:</span> {detailReport.progress_pct || 0}%</div>
                <div><span className="font-medium">{t('department') || 'Department'}:</span> {detailReport.department_id || '-'}</div>
                <div><span className="font-medium">{t('unit') || 'Unit'}:</span> {detailReport.unit_id || '-'}</div>
                <div><span className="font-medium">{t('block') || 'Block'}:</span> {detailReport.block_id || '-'}</div>
                <div><span className="font-medium">{t('activity') || 'Activity'}:</span> {detailReport.activity_id || '-'}</div>
                <div><span className="font-medium">{t('assigned_to') || 'Assigned To'}:</span> {detailReport.assigned_to?.slice(0, 8) || '-'}</div>
                <div><span className="font-medium">{t('locked') || 'Locked'}:</span> {detailReport.is_locked ? 'Yes' : 'No'}</div>
              </div>
              {detailReport.previous_version_id && (
                <p className="text-xs" style={{ color: 'var(--color-primary)' }}>
                  {t('previous_version') || 'Previous version'}: {detailReport.previous_version_id?.slice(0, 8)}
                </p>
              )}

              <div className="border-t pt-2" style={{ borderColor: 'var(--color-border)' }}>
                <h4 className="text-sm font-semibold mb-2">{t('report_data') || 'Report Data'}</h4>
                <pre className="text-xs p-3 rounded overflow-x-auto max-h-48" style={{ backgroundColor: 'var(--color-surface)' }}>
                  {JSON.stringify(detailReport.report_data || {}, null, 2)}
                </pre>
              </div>

              {tracking.length > 0 && (
                <div className="border-t pt-2" style={{ borderColor: 'var(--color-border)' }}>
                  <h4 className="text-sm font-semibold mb-2">{t('timeline') || 'Timeline'}</h4>
                  <div className="space-y-1.5">
                    {tracking.map(ev => (
                      <div key={ev.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                        <span className="font-medium">{ev.event_type.replace(/_/g, ' ')}</span>
                        <span>{formatDate(ev.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {detailReport.status === 'draft' && (
                  <>
                    <button className="btn-primary btn-sm" onClick={() => { setDetailReport(null); openEditRep(detailReport); }}>
                      <Edit3 size={14} /> {t('edit') || 'Edit'}
                    </button>
                    <button className="btn-secondary btn-sm" onClick={async () => { await handleSubmit(detailReport.id); setDetailReport(null); }}>
                      <Check size={14} /> {t('submit') || 'Submit'}
                    </button>
                    <button className="btn-secondary btn-sm" onClick={async () => { await deleteReport(detailReport.id); setDetailReport(null); }}>
                      <Trash2 size={14} /> {t('delete') || 'Delete'}
                    </button>
                  </>
                )}
                {detailReport.status === 'under_review' && (
                  <p className="text-sm" style={{ color: 'var(--color-warning)' }}>{t('under_review_msg') || 'This report is currently under review.'}</p>
                )}
                {detailReport.status === 'approved' && (
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-green-500" />
                    <span className="text-sm" style={{ color: 'var(--color-success)' }}>{t('approved_locked') || 'Approved and locked.'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackingTab({ t }: { t: (k: string) => string }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [detailReport, setDetailReport] = useState<any>(null);
  const [tracking, setTracking] = useState<ReportTracking[]>([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [projRes] = await Promise.all([
        supabase.from('projects').select('id, name_en').order('name_en'),
      ]);
      setProjects(projRes.data || []);
      await loadReports();
    } catch { console.error(); }
    finally { setLoading(false); }
  }

  async function loadReports() {
    try {
      const f: any = {};
      if (filterProject) f.project_id = filterProject;
      if (filterStatus) f.status = filterStatus;
      const data = await reportsApi.list(f);
      setReports(data);
    } catch (err) { console.error(err); }
  }

  const stats = {
    total: reports.length,
    submitted: reports.filter(r => r.status === 'submitted').length,
    under_review: reports.filter(r => r.status === 'under_review').length,
    approved: reports.filter(r => r.status === 'approved').length,
    rejected: reports.filter(r => r.status === 'rejected').length,
    overdue: reports.filter(r => {
      if (!r.due_date) return false;
      if (r.status === 'approved' || r.status === 'archived') return false;
      return new Date(r.due_date) < new Date();
    }).length,
  };

  const overdueReports = reports.filter(r => {
    if (!r.due_date) return false;
    if (r.status === 'approved' || r.status === 'archived') return false;
    return new Date(r.due_date) < new Date();
  });

  const categoryBreakdown: Record<string, number> = {};
  reports.forEach(r => {
    const tmpl = r.template?.name_en || 'Unknown';
    categoryBreakdown[tmpl] = (categoryBreakdown[tmpl] || 0) + 1;
  });
  const categoryEntries = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);
  const catMax = Math.max(...categoryEntries.map(e => e[1]), 1);
  const CAT_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'];

  async function openDetail(r: any) {
    setDetailReport(r);
    try { setTracking(await reportsApi.getTracking(r.id)); }
    catch { setTracking([]); }
  }

  const rowStyle = (status: string): React.CSSProperties => {
    const colors: Record<string, string> = {
      approved: '#22C55E15',
      rejected: '#EF444415',
      under_review: '#F59E0B15',
      submitted: '#3B82F615',
      draft: '#6B728010',
    };
    return { backgroundColor: colors[status] || 'transparent' };
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="stat-glass text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('total_reports') || 'Total Reports'}</p>
        </div>
        <div className="stat-glass text-center">
          <p className="text-2xl font-bold" style={{ color: '#3B82F6' }}>{stats.submitted}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('submitted') || 'Submitted'}</p>
        </div>
        <div className="stat-glass text-center">
          <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{stats.under_review}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('under_review') || 'Under Review'}</p>
        </div>
        <div className="stat-glass text-center">
          <p className="text-2xl font-bold" style={{ color: '#22C55E' }}>{stats.approved}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('approved') || 'Approved'}</p>
        </div>
        <div className="stat-glass text-center">
          <p className="text-2xl font-bold" style={{ color: '#EF4444' }}>{stats.rejected}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('rejected') || 'Rejected'}</p>
        </div>
        <div className="stat-glass text-center">
          <p className="text-2xl font-bold" style={{ color: '#EF4444' }}>{stats.overdue}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('overdue') || 'Overdue'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-card p-3">
            <div className="flex flex-wrap gap-2 items-center">
              <select className="input text-xs py-1.5 w-[130px]" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); }}>
                <option value="">{t('all_statuses') || 'All Statuses'}</option>
                {STATUS_OPTIONS.filter(s => s !== 'all').map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
              <select className="input text-xs py-1.5 w-[160px]" value={filterProject} onChange={e => { setFilterProject(e.target.value); }}>
                <option value="">{t('all_projects') || 'All Projects'}</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name_en}</option>)}
              </select>
              <button className="btn-xs btn-secondary" onClick={loadReports}><Filter size={12} /> {t('filter') || 'Filter'}</button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('title') || 'Title'}</th>
                  <th>{t('project') || 'Project'}</th>
                  <th>{t('date') || 'Date'}</th>
                  <th>{t('due_date') || 'Due Date'}</th>
                  <th>{t('status') || 'Status'}</th>
                  <th>{t('progress') || 'Progress'}</th>
                  <th>{t('actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>
                ) : reports.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>{t('no_reports') || 'No reports'}</td></tr>
                ) : reports.map(r => (
                  <tr key={r.id} className="clickable" style={rowStyle(r.status)} onClick={() => openDetail(r)}>
                    <td className="text-sm font-medium">{r.title_en}</td>
                    <td className="text-xs">{r.project?.name_en || '-'}</td>
                    <td className="text-xs">{formatDate(r.report_date)}</td>
                    <td className="text-xs">{formatDate(r.due_date)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 10%, transparent)' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${r.progress_pct || 0}%`, backgroundColor: STATUS_COLORS[r.status] || '#3B82F6' }} />
                        </div>
                        <span className="text-xs">{r.progress_pct || 0}%</span>
                      </div>
                    </td>
                    <td><button className="btn-xs btn-secondary" onClick={() => openDetail(r)}><Eye size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card p-4">
            <h4 className="text-sm font-semibold mb-3">{t('category_summary') || 'Category Summary'}</h4>
            {categoryEntries.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('no_data') || 'No data'}</p>
            ) : (
              <div className="space-y-2">
                {categoryEntries.map(([name, count], i) => (
                  <div key={name} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate">{name}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>{count}</span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 8%, transparent)' }}>
                      <div className="h-2 rounded-full" style={{ width: `${(count / catMax) * 100}%`, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {overdueReports.length > 0 && (
            <div className="glass-card p-4" style={{ borderColor: '#EF4444' }}>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: '#EF4444' }}>
                <AlertCircle size={14} /> {t('overdue_alerts') || 'Overdue Alerts'}
              </h4>
              <div className="space-y-2">
                {overdueReports.slice(0, 5).map(r => {
                  const overdueDays = r.due_date ? Math.floor((Date.now() - new Date(r.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                  return (
                    <div key={r.id} className="p-2 rounded text-xs cursor-pointer" style={{ backgroundColor: '#EF444410' }} onClick={() => openDetail(r)}>
                      <p className="font-medium truncate">{r.title_en}</p>
                      <p style={{ color: 'var(--color-text-muted)' }}>{r.project?.name_en} - {formatDate(r.due_date)}</p>
                      <p style={{ color: '#EF4444' }}>{overdueDays}d {t('overdue') || 'overdue'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {detailReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetailReport(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{detailReport.title_en}</h3>
              <button onClick={() => setDetailReport(null)}><X size={18} style={{ color: 'var(--color-text-muted)' }} /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="font-medium">{t('project') || 'Project'}:</span> {detailReport.project?.name_en || '-'}</div>
                <div><span className="font-medium">{t('status') || 'Status'}:</span> <StatusBadge status={detailReport.status} /></div>
                <div><span className="font-medium">{t('date') || 'Date'}:</span> {formatDate(detailReport.report_date)}</div>
                <div><span className="font-medium">{t('due_date') || 'Due Date'}:</span> {formatDate(detailReport.due_date)}</div>
                <div><span className="font-medium">{t('progress') || 'Progress'}:</span> {detailReport.progress_pct || 0}%</div>
              </div>
              {tracking.length > 0 && (
                <div className="border-t pt-2" style={{ borderColor: 'var(--color-border)' }}>
                  <h4 className="text-sm font-semibold mb-2">{t('timeline') || 'Timeline'}</h4>
                  <div className="space-y-1.5">
                    {tracking.map(ev => (
                      <div key={ev.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[ev.event_type === 'approved' ? 'approved' : ev.event_type === 'rejected' || ev.event_type === 'stage_rejected' ? 'rejected' : 'submitted'] || '#6B7280' }} />
                        <span className="font-medium capitalize">{ev.event_type.replace(/_/g, ' ')}</span>
                        <span>{formatDate(ev.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalsTab({ t, toast, user }: { t: (k: string) => string; toast: ReturnType<typeof useToast>; user: any }) {
  const [pending, setPending] = useState<StageApproval[]>([]);
  const [history, setHistory] = useState<StageApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [detailReport, setDetailReport] = useState<any>(null);
  const [tracking, setTracking] = useState<ReportTracking[]>([]);

  useEffect(() => {
    if (user?.id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadData() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [pendingRes, histRes] = await Promise.all([
        reportsApi.getPendingApprovals(user.id),
        supabase.from('report_approvals').select('*, report:report_id(id, title_en, report_date, status), stage:stage_id(stage_name_en, stage_order)').eq('approver_id', user.id).neq('status', 'pending').order('signed_at', { ascending: false }).limit(50),
      ]);
      setPending(pendingRes);
      setHistory((histRes.data || []) as any[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleApprove(approval: StageApproval) {
    if (!user?.id) return;
    setActionLoading(approval.id);
    try {
      await reportsApi.approve(approval.report_id, approval.stage_id, user.id, commentMap[approval.id] || '');
      toast.success(t('approved') || 'Approved');
      setCommentMap(prev => { const n = { ...prev }; delete n[approval.id]; return n; });
      await loadData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Approve failed'); }
    finally { setActionLoading(null); }
  }

  async function handleReject(approval: StageApproval) {
    if (!user?.id) return;
    const reason = commentMap[approval.id];
    if (!reason) { toast.error(t('comment_required') || 'Please provide a reason for rejection'); return; }
    setActionLoading(approval.id);
    try {
      await reportsApi.reject(approval.report_id, approval.stage_id, user.id, reason);
      toast.success(t('rejected') || 'Rejected');
      setCommentMap(prev => { const n = { ...prev }; delete n[approval.id]; return n; });
      await loadData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Reject failed'); }
    finally { setActionLoading(null); }
  }

  async function openDetail(r: any) {
    setDetailReport(r);
    try { setTracking(await reportsApi.getTracking(r.id)); }
    catch { setTracking([]); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Clock size={16} /> {t('pending_approvals') || 'Pending Approvals'}
          {pending.length > 0 && <span className="badge badge-warning text-xs">{pending.length}</span>}
        </h3>
        {pending.length === 0 ? (
          <div className="glass-card p-6">
            <EmptyState icon={CheckSquare} title={t('no_pending') || 'No pending approvals'} description={t('no_pending_hint') || 'All caught up!'} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pending.map(pa => (
              <div key={pa.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{pa.report?.title_en || t('untitled') || 'Untitled'}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {pa.stage?.stage_name_en || '-'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {formatDate(pa.report?.report_date || '')}
                    </p>
                  </div>
                  <StatusBadge status={pa.report?.status || 'pending'} />
                </div>
                <div>
                  <textarea
                    className="textarea text-xs"
                    rows={2}
                    placeholder={t('add_comment') || 'Add comment...'}
                    value={commentMap[pa.id] || ''}
                    onChange={e => setCommentMap(prev => ({ ...prev, [pa.id]: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary btn-sm flex-1 flex items-center justify-center gap-1"
                    onClick={() => handleApprove(pa)}
                    disabled={actionLoading === pa.id}
                  >
                    {actionLoading === pa.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {t('approve') || 'Approve'}
                  </button>
                  <button
                    className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-1"
                    style={{ color: '#EF4444', borderColor: '#EF4444' }}
                    onClick={() => handleReject(pa)}
                    disabled={actionLoading === pa.id}
                  >
                    {actionLoading === pa.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    {t('reject') || 'Reject'}
                  </button>
                  <button className="btn-xs btn-secondary" onClick={() => openDetail(pa.report)}><Eye size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Activity size={16} /> {t('approval_history') || 'Approval History'}
        </h3>
        {history.length === 0 ? (
          <div className="glass-card p-6">
            <EmptyState icon={Activity} title={t('no_history') || 'No history'} />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('report') || 'Report'}</th>
                  <th>{t('stage') || 'Stage'}</th>
                  <th>{t('decision') || 'Decision'}</th>
                  <th>{t('comments') || 'Comments'}</th>
                  <th>{t('date') || 'Date'}</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td className="text-sm">{h.report?.title_en || '-'}</td>
                    <td className="text-xs">{h.stage?.stage_name_en || '-'}</td>
                    <td>
                      {h.status === 'approved' ? (
                        <span className="badge badge-success text-xs">{t('approved') || 'Approved'}</span>
                      ) : (
                        <span className="badge badge-danger text-xs">{t('rejected') || 'Rejected'}</span>
                      )}
                    </td>
                    <td className="text-xs max-w-[200px] truncate">{h.comments || '-'}</td>
                    <td className="text-xs">{formatDate(h.signed_at || '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetailReport(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{detailReport?.title_en || t('report_detail') || 'Report Detail'}</h3>
              <button onClick={() => setDetailReport(null)}><X size={18} style={{ color: 'var(--color-text-muted)' }} /></button>
            </div>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">{t('status') || 'Status'}:</span> <StatusBadge status={detailReport?.status || 'draft'} /></div>
              <div><span className="font-medium">{t('date') || 'Date'}:</span> {formatDate(detailReport?.report_date || '')}</div>
              {tracking.length > 0 && (
                <div className="border-t pt-2" style={{ borderColor: 'var(--color-border)' }}>
                  <h4 className="text-sm font-semibold mb-2">{t('timeline') || 'Timeline'}</h4>
                  <div className="space-y-1">
                    {tracking.slice(0, 10).map(ev => (
                      <div key={ev.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                        <span>{ev.event_type.replace(/_/g, ' ')}</span>
                        <span>{formatDate(ev.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
