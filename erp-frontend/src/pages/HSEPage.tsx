import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import type { LucideIcon } from 'lucide-react';
import {
  Shield, AlertTriangle, Eye, ClipboardCheck, HardHat, FileText,
  Plus, Search, Download, Upload, Trash2, Users,
  Activity,
} from 'lucide-react';
import CsvImportModal from '../components/CsvImportModal';
import type { SyncConfig } from '../services/syncService';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import { exportCSV } from '../utils/csv';

interface Incident extends Record<string, unknown> {
  id: string; project_id?: string; project_name?: string; incident_no: string;
  incident_date: string; incident_time?: string; incident_type: string;
  severity: string; location?: string; description: string;
  immediate_action?: string; root_cause?: string; corrective_action?: string;
  status: string; reported_by?: string; closed_date?: string; created_at: string;
}

interface Observation extends Record<string, unknown> {
  id: string; project_id?: string; project_name?: string; observation_no: string;
  observation_date: string; observation_type: string; location?: string;
  description: string; recommended_action?: string; status: string;
  observed_by?: string; closed_by?: string; closed_date?: string; created_at: string;
}

interface SafetyAudit extends Record<string, unknown> {
  id: string; project_id?: string; project_name?: string; audit_no: string;
  audit_date: string; auditor: string; scope?: string;
  score?: number; findings?: string; recommendations?: string; status: string; created_at: string;
}

interface ToolboxTalk extends Record<string, unknown> {
  id: string; project_id?: string; project_name?: string; talk_date: string;
  topic_en: string; topic_ar?: string; conductor?: string;
  duration_minutes?: number; attendees_count?: number; notes?: string; created_at: string;
}

interface PpeIssuance extends Record<string, unknown> {
  id: string; project_id?: string; project_name?: string; employee_id?: string;
  employee_name?: string; ppe_type: string; brand?: string;
  size?: string; quantity: number; issue_date: string;
  expiry_date?: string; issued_by?: string; notes?: string;
}

interface Project {
  id: string; name_en: string; name_ar?: string; project_code: string;
}

type TabKey = 'overview' | 'incidents' | 'observations' | 'audits' | 'toolbox' | 'ppe';

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { key: 'observations', label: 'Observations', icon: Eye },
  { key: 'audits', label: 'Audits', icon: ClipboardCheck },
  { key: 'toolbox', label: 'Toolbox Talks', icon: Users },
  { key: 'ppe', label: 'PPE', icon: HardHat },
];

const SEVERITY_COLORS: Record<string, string> = {
  low: 'badge-success', medium: 'badge-warning', high: 'badge-danger', critical: 'badge-danger',
};

const STATUS_COLORS: Record<string, string> = {
  reported: 'badge-warning', investigating: 'badge-info', action_taken: 'badge-neutral',
  closed: 'badge-success', planned: 'badge-info', completed: 'badge-success',
  open: 'badge-warning', cancelled: 'badge-danger',
};

const emptyIncident = { project_id: '', incident_no: '', incident_date: new Date().toISOString().slice(0, 10), incident_time: '', incident_type: 'near_miss', severity: 'low', location: '', description: '', immediate_action: '', corrective_action: '' };
const emptyObservation = { project_id: '', observation_no: '', observation_date: new Date().toISOString().slice(0, 10), observation_type: 'unsafe_act', location: '', description: '', recommended_action: '' };
const emptyAudit = { project_id: '', audit_no: '', audit_date: new Date().toISOString().slice(0, 10), auditor: '', scope: '', score: '', findings: '', recommendations: '', status: 'planned' };
const emptyToolbox = { project_id: '', talk_date: new Date().toISOString().slice(0, 10), topic_en: '', topic_ar: '', conductor: '', duration_minutes: '', attendees_count: '' };
const emptyPpe = { project_id: '', employee_name: '', ppe_type: '', brand: '', size: '', quantity: '1', issue_date: new Date().toISOString().slice(0, 10), expiry_date: '', notes: '' };

export default function HSEPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [deleting, setDeleting] = useState<{ table: string; id: string; label: string } | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [audits, setAudits] = useState<SafetyAudit[]>([]);
  const [toolboxTalks, setToolboxTalks] = useState<ToolboxTalk[]>([]);
  const [ppeRecords, setPpeRecords] = useState<PpeIssuance[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [filterProject, setFilterProject] = useState('');
  const [incidentForm, setIncidentForm] = useState(emptyIncident);
  const [observationForm, setObservationForm] = useState(emptyObservation);
  const [auditForm, setAuditForm] = useState(emptyAudit);
  const [toolboxForm, setToolboxForm] = useState(emptyToolbox);
  const [ppeForm, setPpeForm] = useState(emptyPpe);

  const [overviewStats, setOverviewStats] = useState({ totalIncidents: 0, openIncidents: 0, openObservations: 0, totalAudits: 0, toolboxThisMonth: 0, ppeActive: 0 });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); setSearch(''); setFilterProject(''); loadAll(); }, [activeTab]);

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('id, name_en, name_ar, project_code').eq('is_active', true).order('name_en');
    setProjects((data || []) as Project[]);
  }

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadProjects(), loadTabData()]);
    } catch (err) {
      console.error('HSE load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTabData() {
    switch (activeTab) {
      case 'overview': return loadOverview();
      case 'incidents': return loadIncidents();
      case 'observations': return loadObservations();
      case 'audits': return loadAudits();
      case 'toolbox': return loadToolboxTalks();
      case 'ppe': return loadPpeRecords();
    }
  }

  async function loadOverview() {
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
    const [incRes, obsRes, audRes, tbRes] = await Promise.all([
      supabase.from('safety_incidents').select('id, status'),
      supabase.from('safety_observations').select('id, status'),
      supabase.from('safety_audits').select('id'),
      supabase.from('toolbox_talks').select('id, talk_date'),
    ]);
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    setOverviewStats({
      totalIncidents: incRes.data?.length || 0,
      openIncidents: (incRes.data || []).filter((i) => i.status !== 'closed').length,
      openObservations: (obsRes.data || []).filter((o) => o.status !== 'closed').length || 0,
      totalAudits: audRes.data?.length || 0,
      toolboxThisMonth: (tbRes.data || []).filter((t) => t.talk_date >= firstDay).length,
      ppeActive: 0,
    });
    const recentInc = await supabase.from('safety_incidents').select('*').order('created_at', { ascending: false }).limit(5);
    if (recentInc.data) {
      const mapped = (recentInc.data as Incident[]).map((i) => ({ ...i, project_name: projectMap[i.project_id || '']?.name_en || '' }));
      setIncidents(mapped);
    }
    const recentObs = await supabase.from('safety_observations').select('*').order('created_at', { ascending: false }).limit(5);
    if (recentObs.data) {
      const mapped = (recentObs.data as Observation[]).map((o) => ({ ...o, project_name: projectMap[o.project_id || '']?.name_en || '' }));
      setObservations(mapped);
    }
  }

  async function loadIncidents() {
    const { data } = await supabase.from('safety_incidents').select('*').order('created_at', { ascending: false });
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
    setIncidents(((data || []) as Incident[]).map((i) => ({ ...i, project_name: projectMap[i.project_id || '']?.name_en || '' })));
  }

  async function loadObservations() {
    const { data } = await supabase.from('safety_observations').select('*').order('created_at', { ascending: false });
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
    setObservations(((data || []) as Observation[]).map((o) => ({ ...o, project_name: projectMap[o.project_id || '']?.name_en || '' })));
  }

  async function loadAudits() {
    const { data } = await supabase.from('safety_audits').select('*').order('created_at', { ascending: false });
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
    setAudits(((data || []) as SafetyAudit[]).map((a) => ({ ...a, project_name: projectMap[a.project_id || '']?.name_en || '' })));
  }

  async function loadToolboxTalks() {
    const { data } = await supabase.from('toolbox_talks').select('*').order('talk_date', { ascending: false });
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
    setToolboxTalks(((data || []) as ToolboxTalk[]).map((t) => ({ ...t, project_name: projectMap[t.project_id || '']?.name_en || '' })));
  }

  async function loadPpeRecords() {
    const { data } = await supabase.from('ppe_issuance').select('*').order('issue_date', { ascending: false });
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
    setPpeRecords(((data || []) as PpeIssuance[]).map((p) => ({ ...p, project_name: projectMap[p.project_id || '']?.name_en || '' })));
  }

  async function handleDelete(table: string, id: string) {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted successfully');
      loadTabData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
    setDeleting(null);
  }

  function getTabLabel(key: TabKey): string {
    const tab = TABS.find((t) => t.key === key);
    return tab ? tab.label : key;
  }

  function getFormTitle(): string {
    switch (activeTab) {
      case 'incidents': return 'New Incident';
      case 'observations': return 'New Observation';
      case 'audits': return 'New Audit';
      case 'toolbox': return 'New Toolbox Talk';
      case 'ppe': return 'New PPE Issuance';
      default: return 'New Record';
    }
  }

  async function saveRecord() {
    setFormError('');
    setSaving(true);
    try {
      let tbl = '';
      let payload: Record<string, unknown> = {};
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;

      switch (activeTab) {
        case 'incidents': {
          if (!incidentForm.project_id) { setFormError('Project is required'); setSaving(false); return; }
          if (!incidentForm.incident_no.trim()) { setFormError('Incident No is required'); setSaving(false); return; }
          tbl = 'safety_incidents';
          payload = { project_id: incidentForm.project_id, incident_no: incidentForm.incident_no, incident_date: incidentForm.incident_date, incident_time: incidentForm.incident_time || null, incident_type: incidentForm.incident_type, severity: incidentForm.severity, location: incidentForm.location || null, description: incidentForm.description, immediate_action: incidentForm.immediate_action || null, corrective_action: incidentForm.corrective_action || null, status: 'reported', reported_by: userId };
          break;
        }
        case 'observations': {
          if (!observationForm.project_id) { setFormError('Project is required'); setSaving(false); return; }
          if (!observationForm.observation_no.trim()) { setFormError('Observation No is required'); setSaving(false); return; }
          tbl = 'safety_observations';
          payload = { project_id: observationForm.project_id, observation_no: observationForm.observation_no, observation_date: observationForm.observation_date, observation_type: observationForm.observation_type, location: observationForm.location || null, description: observationForm.description, recommended_action: observationForm.recommended_action || null, status: 'open', observed_by: userId };
          break;
        }
        case 'audits': {
          if (!auditForm.project_id) { setFormError('Project is required'); setSaving(false); return; }
          if (!auditForm.audit_no.trim()) { setFormError('Audit No is required'); setSaving(false); return; }
          tbl = 'safety_audits';
          payload = { project_id: auditForm.project_id, audit_no: auditForm.audit_no, audit_date: auditForm.audit_date, auditor: auditForm.auditor, scope: auditForm.scope || null, score: auditForm.score ? parseFloat(auditForm.score) : null, findings: auditForm.findings || null, recommendations: auditForm.recommendations || null, status: auditForm.status };
          break;
        }
        case 'toolbox': {
          if (!toolboxForm.project_id) { setFormError('Project is required'); setSaving(false); return; }
          if (!toolboxForm.topic_en.trim()) { setFormError('Topic (English) is required'); setSaving(false); return; }
          tbl = 'toolbox_talks';
          payload = { project_id: toolboxForm.project_id, talk_date: toolboxForm.talk_date, topic_en: toolboxForm.topic_en, topic_ar: toolboxForm.topic_ar || null, conductor: toolboxForm.conductor || null, duration_minutes: toolboxForm.duration_minutes ? parseInt(toolboxForm.duration_minutes) : null, attendees_count: toolboxForm.attendees_count ? parseInt(toolboxForm.attendees_count) : 0 };
          break;
        }
        case 'ppe': {
          if (!ppeForm.project_id) { setFormError('Project is required'); setSaving(false); return; }
          if (!ppeForm.ppe_type.trim()) { setFormError('PPE Type is required'); setSaving(false); return; }
          tbl = 'ppe_issuance';
          payload = { project_id: ppeForm.project_id, employee_name: ppeForm.employee_name || null, ppe_type: ppeForm.ppe_type, brand: ppeForm.brand || null, size: ppeForm.size || null, quantity: parseInt(ppeForm.quantity) || 1, issue_date: ppeForm.issue_date, expiry_date: ppeForm.expiry_date || null, issued_by: userId, notes: ppeForm.notes || null };
          break;
        }
      }

      const { error } = await supabase.from(tbl).insert(payload);
      if (error) throw error;
      toast.success(`"${getTabLabel(activeTab)}" record created`);
      setShowForm(false);
      resetForms();
      loadTabData();
    } catch (err: unknown) {
      let msg = 'Save failed';
      if (err instanceof Error) {
        msg = err.message;
      } else if (err && typeof err === 'object') {
        msg = (err as Record<string, unknown>).message as string || msg;
      }
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function resetForms() {
    setIncidentForm(emptyIncident);
    setObservationForm(emptyObservation);
    setAuditForm(emptyAudit);
    setToolboxForm(emptyToolbox);
    setPpeForm(emptyPpe);
    setFormError('');
  }

  function openNewForm() {
    resetForms();
    setShowForm(true);
  }

  function formatDate(d: string | undefined): string {
    if (!d) return '-';
    return d.slice(0, 10);
  }

  function filteredRecords<T extends { project_id?: string }>(records: T[], searchFields: (keyof T)[]): T[] {
    let result = records;
    if (filterProject) result = result.filter((r) => r.project_id === filterProject);
    if (!search) return result;
    const q = search.toLowerCase();
    return result.filter((r) => searchFields.some((f) => String(r[f] || '').toLowerCase().includes(q)));
  }

  function renderStatCard(icon: LucideIcon, label: string, value: number | string, color: string) {
    const Icon = icon;
    return (
      <div className="stat-glass">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: `${color}18` }}>
            <Icon size={20} style={{ color }} />
          </div>
          <div>
            <div className="stat-card-value" style={{ color: 'var(--color-text)' }}>{value}</div>
            <div className="stat-card-label">{label}</div>
          </div>
        </div>
      </div>
    );
  }

  function renderSearchBar() {
    if (activeTab === 'overview') return null;
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-9" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input max-w-[200px]" value={filterProject} onChange={(e) => { setFilterProject(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
        </select>
      </div>
    );
  }

  function renderActionButtons() {
    const { hasPermission } = useAuth();
    if (activeTab === 'overview') return null;
    return (
      <div className="flex gap-2">
        <button className="btn-sm btn-secondary" onClick={() => { const recs = getCurrentRecords(); if (recs.length) exportCSV(recs as unknown as Record<string, unknown>[], `hse_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`); }}>
          <Download size={14} /> Export
        </button>
        <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}>
          <Upload size={14} /> Import
        </button>
        {hasPermission('hse', 'create') && (
          <button className="btn-primary btn-sm" onClick={openNewForm}>
            <Plus size={16} /> New
          </button>
        )}
      </div>
    );
  }

  function getCurrentRecords(): unknown[] {
    switch (activeTab) {
      case 'incidents': return incidents;
      case 'observations': return observations;
      case 'audits': return audits;
      case 'toolbox': return toolboxTalks;
      case 'ppe': return ppeRecords;
      default: return [];
    }
  }

  function getImportConfig(): SyncConfig | null {
    switch (activeTab) {
      case 'incidents': return { table: 'safety_incidents', columns: [{ key: 'incident_no', label: 'Incident No', required: true }, { key: 'description', label: 'Description', required: true }, { key: 'incident_date', label: 'Date' }, { key: 'incident_type', label: 'Type' }, { key: 'severity', label: 'Severity' }], fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }], defaults: { status: 'reported' } };
      case 'observations': return { table: 'safety_observations', columns: [{ key: 'observation_no', label: 'Observation No', required: true }, { key: 'description', label: 'Description', required: true }, { key: 'observation_date', label: 'Date' }, { key: 'observation_type', label: 'Type' }], fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }], defaults: { status: 'open' } };
      case 'audits': return { table: 'safety_audits', columns: [{ key: 'audit_no', label: 'Audit No', required: true }, { key: 'audit_date', label: 'Date' }, { key: 'auditor', label: 'Auditor' }, { key: 'status', label: 'Status' }], fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }], defaults: { status: 'planned' } };
      case 'toolbox': return { table: 'toolbox_talks', columns: [{ key: 'talk_date', label: 'Date', required: true }, { key: 'topic_en', label: 'Topic (EN)', required: true }], fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }] };
      case 'ppe': return { table: 'ppe_issuance', columns: [{ key: 'ppe_type', label: 'PPE Type', required: true }, { key: 'quantity', label: 'Qty' }, { key: 'issue_date', label: 'Issue Date' }], fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }] };
      default: return null;
    }
  }

  function renderForm() {
    const { hasPermission } = useAuth();
    const modal = (children: React.ReactNode) => (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
        <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold mb-4">{getFormTitle()}</h3>
          {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>{formError}</div>}
          <div className="space-y-4">{children}</div>
          <div className="flex gap-2 mt-4">
            {hasPermission('hse', 'create') && (
              <button className="btn-primary btn-sm" onClick={saveRecord} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            )}
            <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      </div>
    );

    const projectSelect = (value: string, onChange: (v: string) => void) => (
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- Select Project --</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
      </select>
    );

    if (activeTab === 'incidents') {
      return modal(
        <>
          <div><label className="label">Project *</label>{projectSelect(incidentForm.project_id, (v) => setIncidentForm({ ...incidentForm, project_id: v }))}</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Incident No *</label><input className="input" value={incidentForm.incident_no} onChange={(e) => setIncidentForm({ ...incidentForm, incident_no: e.target.value })} /></div>
            <div><label className="label">Incident Date</label><input type="date" className="input" value={incidentForm.incident_date} onChange={(e) => setIncidentForm({ ...incidentForm, incident_date: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Type</label>
              <select className="input" value={incidentForm.incident_type} onChange={(e) => setIncidentForm({ ...incidentForm, incident_type: e.target.value })}>
                {['near_miss', 'minor_injury', 'serious_injury', 'fatality', 'property_damage', 'fire', 'environmental', 'other'].map((opt) => <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Severity</label>
              <select className="input" value={incidentForm.severity} onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}>
                {['low', 'medium', 'high', 'critical'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Location</label><input className="input" value={incidentForm.location} onChange={(e) => setIncidentForm({ ...incidentForm, location: e.target.value })} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={incidentForm.description} onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })} /></div>
          <div><label className="label">Immediate Action</label><textarea className="input" rows={2} value={incidentForm.immediate_action} onChange={(e) => setIncidentForm({ ...incidentForm, immediate_action: e.target.value })} /></div>
          <div><label className="label">Corrective Action</label><textarea className="input" rows={2} value={incidentForm.corrective_action} onChange={(e) => setIncidentForm({ ...incidentForm, corrective_action: e.target.value })} /></div>
        </>
      );
    }

    if (activeTab === 'observations') {
      return modal(
        <>
          <div><label className="label">Project *</label>{projectSelect(observationForm.project_id, (v) => setObservationForm({ ...observationForm, project_id: v }))}</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Observation No *</label><input className="input" value={observationForm.observation_no} onChange={(e) => setObservationForm({ ...observationForm, observation_no: e.target.value })} /></div>
            <div><label className="label">Date</label><input type="date" className="input" value={observationForm.observation_date} onChange={(e) => setObservationForm({ ...observationForm, observation_date: e.target.value })} /></div>
          </div>
          <div><label className="label">Type</label>
            <select className="input" value={observationForm.observation_type} onChange={(e) => setObservationForm({ ...observationForm, observation_type: e.target.value })}>
              {['safe_act', 'unsafe_act', 'unsafe_condition', 'positive'].map((opt) => <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div><label className="label">Location</label><input className="input" value={observationForm.location} onChange={(e) => setObservationForm({ ...observationForm, location: e.target.value })} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={observationForm.description} onChange={(e) => setObservationForm({ ...observationForm, description: e.target.value })} /></div>
          <div><label className="label">Recommended Action</label><textarea className="input" rows={2} value={observationForm.recommended_action} onChange={(e) => setObservationForm({ ...observationForm, recommended_action: e.target.value })} /></div>
        </>
      );
    }

    if (activeTab === 'audits') {
      return modal(
        <>
          <div><label className="label">Project *</label>{projectSelect(auditForm.project_id, (v) => setAuditForm({ ...auditForm, project_id: v }))}</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Audit No *</label><input className="input" value={auditForm.audit_no} onChange={(e) => setAuditForm({ ...auditForm, audit_no: e.target.value })} /></div>
            <div><label className="label">Audit Date</label><input type="date" className="input" value={auditForm.audit_date} onChange={(e) => setAuditForm({ ...auditForm, audit_date: e.target.value })} /></div>
          </div>
          <div><label className="label">Auditor *</label><input className="input" value={auditForm.auditor} onChange={(e) => setAuditForm({ ...auditForm, auditor: e.target.value })} /></div>
          <div><label className="label">Scope</label><textarea className="input" rows={2} value={auditForm.scope} onChange={(e) => setAuditForm({ ...auditForm, scope: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Score</label><input type="number" step="0.01" className="input" value={auditForm.score} onChange={(e) => setAuditForm({ ...auditForm, score: e.target.value })} /></div>
            <div><label className="label">Status</label>
              <select className="input" value={auditForm.status} onChange={(e) => setAuditForm({ ...auditForm, status: e.target.value })}>
                {['planned', 'in_progress', 'completed', 'overdue'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Findings</label><textarea className="input" rows={2} value={auditForm.findings} onChange={(e) => setAuditForm({ ...auditForm, findings: e.target.value })} /></div>
          <div><label className="label">Recommendations</label><textarea className="input" rows={2} value={auditForm.recommendations} onChange={(e) => setAuditForm({ ...auditForm, recommendations: e.target.value })} /></div>
        </>
      );
    }

    if (activeTab === 'toolbox') {
      return modal(
        <>
          <div><label className="label">Project *</label>{projectSelect(toolboxForm.project_id, (v) => setToolboxForm({ ...toolboxForm, project_id: v }))}</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Talk Date</label><input type="date" className="input" value={toolboxForm.talk_date} onChange={(e) => setToolboxForm({ ...toolboxForm, talk_date: e.target.value })} /></div>
            <div><label className="label">Conductor</label><input className="input" value={toolboxForm.conductor} onChange={(e) => setToolboxForm({ ...toolboxForm, conductor: e.target.value })} /></div>
          </div>
          <div><label className="label">Topic (English) *</label><input className="input" value={toolboxForm.topic_en} onChange={(e) => setToolboxForm({ ...toolboxForm, topic_en: e.target.value })} /></div>
          <div><label className="label">Topic (Arabic)</label><input className="input" value={toolboxForm.topic_ar} onChange={(e) => setToolboxForm({ ...toolboxForm, topic_ar: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Duration (min)</label><input type="number" className="input" value={toolboxForm.duration_minutes} onChange={(e) => setToolboxForm({ ...toolboxForm, duration_minutes: e.target.value })} /></div>
            <div><label className="label">Attendees</label><input type="number" className="input" value={toolboxForm.attendees_count} onChange={(e) => setToolboxForm({ ...toolboxForm, attendees_count: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={''} onChange={() => {}} placeholder="Optional notes" /></div>
        </>
      );
    }

    if (activeTab === 'ppe') {
      return modal(
        <>
          <div><label className="label">Project *</label>{projectSelect(ppeForm.project_id, (v) => setPpeForm({ ...ppeForm, project_id: v }))}</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">PPE Type *</label>
              <select className="input" value={ppeForm.ppe_type} onChange={(e) => setPpeForm({ ...ppeForm, ppe_type: e.target.value })}>
                <option value="">-- Select --</option>
                {['hard_hat', 'safety_vest', 'safety_glasses', 'gloves', 'safety_boots', 'earplugs', 'mask', 'full_body_harness', 'fall_arrestor', 'welding_mask', 'face_shield', 'respirator', 'other'].map((opt) => <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Quantity</label><input type="number" className="input" value={ppeForm.quantity} onChange={(e) => setPpeForm({ ...ppeForm, quantity: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Brand</label><input className="input" value={ppeForm.brand} onChange={(e) => setPpeForm({ ...ppeForm, brand: e.target.value })} /></div>
            <div><label className="label">Size</label><input className="input" value={ppeForm.size} onChange={(e) => setPpeForm({ ...ppeForm, size: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Issue Date</label><input type="date" className="input" value={ppeForm.issue_date} onChange={(e) => setPpeForm({ ...ppeForm, issue_date: e.target.value })} /></div>
            <div><label className="label">Expiry Date</label><input type="date" className="input" value={ppeForm.expiry_date} onChange={(e) => setPpeForm({ ...ppeForm, expiry_date: e.target.value })} /></div>
          </div>
          <div><label className="label">Employee</label><input className="input" value={ppeForm.employee_name} onChange={(e) => setPpeForm({ ...ppeForm, employee_name: e.target.value })} placeholder="Employee name" /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={ppeForm.notes} onChange={(e) => setPpeForm({ ...ppeForm, notes: e.target.value })} /></div>
        </>
      );
    }

    return null;
  }

  function renderOverview() {
    const statColor = (key: string): string => {
      const colors: Record<string, string> = { totalIncidents: '#3b82f6', openIncidents: '#ef4444', openObservations: '#f59e0b', totalAudits: '#8b5cf6', toolboxThisMonth: '#22c55e', ppeActive: '#14b8a6' };
      return colors[key] || '#3b82f6';
    };
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {renderStatCard(AlertTriangle, 'Total Incidents', overviewStats.totalIncidents, statColor('totalIncidents'))}
          {renderStatCard(AlertTriangle, 'Open Incidents', overviewStats.openIncidents, statColor('openIncidents'))}
          {renderStatCard(Eye, 'Open Observations', overviewStats.openObservations, statColor('openObservations'))}
          {renderStatCard(ClipboardCheck, 'Total Audits', overviewStats.totalAudits, statColor('totalAudits'))}
          {renderStatCard(Users, 'Toolbox This Month', overviewStats.toolboxThisMonth, statColor('toolboxThisMonth'))}
          {renderStatCard(HardHat, 'PPE Issued', overviewStats.ppeActive, statColor('ppeActive'))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
              <h3 className="font-semibold">Quick Actions</h3>
            </div>
            <div className="space-y-2">
              <button className="w-full text-start p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-3" onClick={() => { setActiveTab('incidents'); openNewForm(); }}>
                <div className="rounded-lg p-2" style={{ backgroundColor: '#ef444418' }}><AlertTriangle size={16} style={{ color: '#ef4444' }} /></div>
                <div><div className="text-sm font-medium">Report Incident</div><div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Log a new safety incident</div></div>
              </button>
              <button className="w-full text-start p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-3" onClick={() => { setActiveTab('observations'); openNewForm(); }}>
                <div className="rounded-lg p-2" style={{ backgroundColor: '#f59e0b18' }}><Eye size={16} style={{ color: '#f59e0b' }} /></div>
                <div><div className="text-sm font-medium">Record Observation</div><div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Capture a safety observation</div></div>
              </button>
              <button className="w-full text-start p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-3" onClick={() => { setActiveTab('audits'); openNewForm(); }}>
                <div className="rounded-lg p-2" style={{ backgroundColor: '#8b5cf618' }}><ClipboardCheck size={16} style={{ color: '#8b5cf6' }} /></div>
                <div><div className="text-sm font-medium">Schedule Audit</div><div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Plan a safety inspection</div></div>
              </button>
              <button className="w-full text-start p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-3" onClick={() => { setActiveTab('toolbox'); openNewForm(); }}>
                <div className="rounded-lg p-2" style={{ backgroundColor: '#22c55e18' }}><Users size={16} style={{ color: '#22c55e' }} /></div>
                <div><div className="text-sm font-medium">Conduct Toolbox Talk</div><div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Document a safety meeting</div></div>
              </button>
              <button className="w-full text-start p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-3" onClick={() => { setActiveTab('ppe'); openNewForm(); }}>
                <div className="rounded-lg p-2" style={{ backgroundColor: '#14b8a618' }}><HardHat size={16} style={{ color: '#14b8a6' }} /></div>
                <div><div className="text-sm font-medium">Issue PPE</div><div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Record PPE issuance</div></div>
              </button>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                <h3 className="font-semibold">Recent Incidents</h3>
              </div>
              <button className="text-xs btn-sm btn-secondary" onClick={() => setActiveTab('incidents')}>View All</button>
            </div>
            {incidents.length === 0 ? (
              <div className="text-sm py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>No recent incidents</div>
            ) : (
              <div className="space-y-2">
                {incidents.map((inc) => (
                  <div key={inc.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{inc.incident_no}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{inc.project_name || '—'} · {inc.incident_type?.replace(/_/g, ' ')}</div>
                    </div>
                    <span className={`badge text-xs capitalize ${SEVERITY_COLORS[inc.severity] || 'badge-neutral'}`}>{inc.severity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Eye size={18} style={{ color: '#f59e0b' }} />
                <h3 className="font-semibold">Recent Observations</h3>
              </div>
              <button className="text-xs btn-sm btn-secondary" onClick={() => setActiveTab('observations')}>View All</button>
            </div>
            {observations.length === 0 ? (
              <div className="text-sm py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>No recent observations</div>
            ) : (
              <div className="space-y-2">
                {observations.map((obs) => (
                  <div key={obs.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{obs.observation_no}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{obs.project_name || '—'} · {obs.observation_type?.replace(/_/g, ' ')}</div>
                    </div>
                    <span className={`badge text-xs capitalize ${STATUS_COLORS[obs.status] || 'badge-neutral'}`}>{obs.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderTable<T extends Record<string, unknown>>(
    records: T[],
    columns: { key: string; label: string; render?: (val: unknown, row: T) => React.ReactNode }[],
    idKey: string,
    deleteTable: string,
    labelKey: string,
  ) {
    const { hasPermission } = useAuth();
    const filtered = filteredRecords(records, columns.map((c) => c.key as keyof T));
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    return (
      <>
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}<th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={columns.length + 1} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={columns.length + 1}><EmptyState title="No records found" description="Try adjusting your search or create a new record." {...(hasPermission('hse', 'view') ? { actionLabel: 'New', onAction: openNewForm } : {})} /></td></tr>
                ) : (
                  paged.map((row) => (
                    <tr key={String(row[idKey])}>
                      {columns.map((col) => (
                        <td key={col.key}>
                          {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}
                        </td>
                      ))}
                      <td>
                        <button className="btn-sm btn-secondary" onClick={() => toast.info('Detail view coming soon')}><Eye size={14} /></button>
                        {hasPermission('hse', 'delete') && (
                          <button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={() => setDeleting({ table: deleteTable, id: String(row[idKey]), label: String(row[labelKey] || '') })}><Trash2 size={14} /></button>
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
      </>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case 'overview':
        return renderOverview();

      case 'incidents':
        return renderTable(
          incidents,
          [
            { key: 'incident_no', label: 'Incident No', render: (v) => <span className="font-mono text-xs">{String(v)}</span> },
            { key: 'description', label: 'Description', render: (v) => <span className="font-medium">{String(v).slice(0, 60)}{String(v).length > 60 ? '…' : ''}</span> },
            { key: 'project_name', label: 'Project', render: (v) => <span className="text-xs">{String(v || '-')}</span> },
            { key: 'incident_date', label: 'Date', render: (v) => <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(String(v))}</span> },
            { key: 'incident_type', label: 'Type', render: (v) => <span className="text-sm capitalize">{(String(v)).replace(/_/g, ' ')}</span> },
            { key: 'severity', label: 'Severity', render: (v) => <span className={`badge capitalize ${SEVERITY_COLORS[String(v)] || 'badge-neutral'}`}>{String(v)}</span> },
            { key: 'status', label: 'Status', render: (v) => <span className={`badge capitalize ${STATUS_COLORS[String(v)] || 'badge-neutral'}`}>{String(v).replace(/_/g, ' ')}</span> },
          ],
          'id', 'safety_incidents', 'incident_no',
        );

      case 'observations':
        return renderTable(
          observations,
          [
            { key: 'observation_no', label: 'Obs. No', render: (v) => <span className="font-mono text-xs">{String(v)}</span> },
            { key: 'description', label: 'Description', render: (v) => <span className="font-medium">{String(v).slice(0, 60)}{String(v).length > 60 ? '…' : ''}</span> },
            { key: 'project_name', label: 'Project', render: (v) => <span className="text-xs">{String(v || '-')}</span> },
            { key: 'observation_date', label: 'Date', render: (v) => <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(String(v))}</span> },
            { key: 'observation_type', label: 'Type', render: (v) => <span className="text-sm capitalize">{(String(v)).replace(/_/g, ' ')}</span> },
            { key: 'status', label: 'Status', render: (v) => <span className={`badge capitalize ${STATUS_COLORS[String(v)] || 'badge-neutral'}`}>{String(v).replace(/_/g, ' ')}</span> },
          ],
          'id', 'safety_observations', 'observation_no',
        );

      case 'audits':
        return renderTable(
          audits,
          [
            { key: 'audit_no', label: 'Audit No', render: (v) => <span className="font-mono text-xs">{String(v)}</span> },
            { key: 'project_name', label: 'Project', render: (v) => <span className="text-xs">{String(v || '-')}</span> },
            { key: 'audit_date', label: 'Date', render: (v) => <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(String(v))}</span> },
            { key: 'auditor', label: 'Auditor', render: (v) => <span className="font-medium">{String(v)}</span> },
            { key: 'scope', label: 'Scope', render: (v) => <span className="text-sm">{String(v || '-').slice(0, 50)}</span> },
            { key: 'score', label: 'Score', render: (v) => v ? <span className={`font-semibold ${Number(v) >= 80 ? 'badge-success' : Number(v) >= 60 ? 'badge-warning' : 'badge-danger'}`}>{String(v)}%</span> : <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>—</span> },
            { key: 'status', label: 'Status', render: (v) => <span className={`badge capitalize ${STATUS_COLORS[String(v)] || 'badge-neutral'}`}>{String(v).replace(/_/g, ' ')}</span> },
          ],
          'id', 'safety_audits', 'audit_no',
        );

      case 'toolbox':
        return renderTable(
          toolboxTalks,
          [
            { key: 'project_name', label: 'Project', render: (v) => <span className="text-xs">{String(v || '-')}</span> },
            { key: 'talk_date', label: 'Date', render: (v) => <span className="text-sm font-medium">{formatDate(String(v))}</span> },
            { key: 'topic_en', label: 'Topic', render: (v) => <span className="font-medium">{String(v)}</span> },
            { key: 'conductor', label: 'Conductor', render: (v) => <span>{String(v || '-')}</span> },
            { key: 'duration_minutes', label: 'Duration', render: (v) => <span className="text-sm">{v ? `${v} min` : '-'}</span> },
            { key: 'attendees_count', label: 'Attendees', render: (v) => <span className="badge badge-neutral">{String(v || '0')}</span> },
          ],
          'id', 'toolbox_talks', 'topic_en',
        );

      case 'ppe':
        return renderTable(
          ppeRecords,
          [
            { key: 'project_name', label: 'Project', render: (v) => <span className="text-xs">{String(v || '-')}</span> },
            { key: 'ppe_type', label: 'PPE Type', render: (v) => <span className="font-medium capitalize">{String(v).replace(/_/g, ' ')}</span> },
            { key: 'employee_name', label: 'Employee', render: (v) => <span>{String(v || '-')}</span> },
            { key: 'quantity', label: 'Qty', render: (v) => <span className="text-sm">{String(v)}</span> },
            { key: 'issue_date', label: 'Issue Date', render: (v) => <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(String(v))}</span> },
            { key: 'expiry_date', label: 'Expiry', render: (v) => {
              const d = String(v || '');
              if (!d) return <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>—</span>;
              const expired = new Date(d) < new Date();
              return <span className={`text-sm ${expired ? 'badge-danger' : 'badge-success'}`}>{formatDate(d)}{expired ? ' (expired)' : ''}</span>;
            }},
          ],
          'id', 'ppe_issuance', 'ppe_type',
        );

      default:
        return null;
    }
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2" style={{ backgroundColor: '#22c55e18' }}>
            <Shield size={22} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>HSE</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Health, Safety & Environment Management</p>
          </div>
        </div>
        {renderActionButtons()}
      </div>

      <div className="flex flex-wrap items-center gap-1 tabs">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`tab flex items-center gap-1.5 ${activeTab === key ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {renderSearchBar()}

      {activeTab !== 'overview' && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <FileText size={13} />
          {getCurrentRecords().length} record{getCurrentRecords().length !== 1 ? 's' : ''}
        </div>
      )}

      {renderTabContent()}

      {showForm && renderForm()}

      {showImport && getImportConfig() && (
        <CsvImportModal
          moduleName={`HSE ${getTabLabel(activeTab)}`}
          config={getImportConfig()!}
          onClose={() => { setShowImport(false); loadTabData(); }}
        />
      )}

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
