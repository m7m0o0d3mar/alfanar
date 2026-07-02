import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Building2, Calendar, MapPin, DollarSign, Layers, ClipboardList, ShoppingCart, FileText, CheckSquare, Edit3, User, ExternalLink, Download, Phone, Mail, Users, Image as ImageIcon, Globe, History, Home, Target, Map as MapIcon, Flag, PieChart, TrendingUp, CheckCircle, Clock, AlertTriangle, BarChart3, UserPlus, Briefcase, GitBranch, Activity, Trash2, MessageCircle, Video } from 'lucide-react';
import ProjectSitePlan from '../components/ProjectSitePlan';
import { useAuth } from '../context/AuthContext';

interface Project {
  id: string; project_code: string; name_en: string; name_ar: string;
  project_type: string; status: string; start_date: string; end_date: string;
  location: string; budget_amount: number; progress_percent: number;
  client_name: string; description: string; total_area?: number; built_up_area?: number;
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

interface Unit {
  id: string; unit_code: string; unit_type: string; status: string;
  price: number; bedrooms: number; area?: number;
}

interface ProjectDocument {
  id: string; doc_code: string; title_en: string;
  doc_type: string; revision: string; status: string;
  uploaded_at: string; file_url: string | null;
}

interface Milestone {
  id: string; milestone_code: string; name_en: string; name_ar?: string;
  description?: string; target_date: string; achieved_date?: string;
  status: string; weight_percent: number;
}

interface BudgetItem {
  id: string; category: string; name_en: string; name_ar?: string;
  planned_amount: number; actual_amount: number; currency: string; notes?: string;
}

interface TaskSummary {
  total: number; completed: number; in_progress: number; pending: number;
  overdue: number; progress: number;
}

const statusGradients: Record<string, string> = {
  active: 'linear-gradient(135deg, #059669, #10b981)',
  planning: 'linear-gradient(135deg, #2563eb, #3b82f6)',
  completed: 'linear-gradient(135deg, #6b7280, #9ca3af)',
  on_hold: 'linear-gradient(135deg, #d97706, #f59e0b)',
  cancelled: 'linear-gradient(135deg, #dc2626, #ef4444)',
};

const statusColors: Record<string, string> = {
  active: '#10b981', planning: '#3b82f6', completed: '#9ca3af',
  on_hold: '#f59e0b', cancelled: '#ef4444',
};

const statusLabels: Record<string, string> = {
  active: 'Active', planning: 'Planning', completed: 'Completed',
  on_hold: 'On Hold', cancelled: 'Cancelled',
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Project>>({});
  const [tab, setTab] = useState<'overview' | 'dashboard' | 'units' | 'documents' | 'history' | 'site_plan' | 'team' | 'budget' | 'milestones'>('overview');
  const [units, setUnits] = useState<Unit[]>([]);
  const [projectDocs, setProjectDocs] = useState<ProjectDocument[]>([]);
  const [userProfiles, setUserProfiles] = useState<{ id: string; full_name_en: string }[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [taskSummary, setTaskSummary] = useState<TaskSummary>({ total: 0, completed: 0, in_progress: 0, pending: 0, overdue: 0, progress: 0 });
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState<Partial<Milestone>>({});
  const [budgetForm, setBudgetForm] = useState<Partial<BudgetItem>>({});
  const [stakeholderForm, setStakeholderForm] = useState<{ company_id?: string; contact_id?: string; role: string }>({ role: 'subcontractor' });
  const [crmContacts, setCrmContacts] = useState<{ id: string; full_name: string; phone?: string; email?: string }[]>([]);
  const [crmCompanies, setCrmCompanies] = useState<{ id: string; company_name: string }[]>([]);
  const [stakeholders, setStakeholders] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('units').select('*').eq('project_id', id).limit(50),
      supabase.from('documents').select('*').eq('project_id', id).order('uploaded_at', { ascending: false }).limit(5),
      supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
      supabase.from('project_milestones').select('*').eq('project_id', id).order('target_date'),
      supabase.from('project_budget_items').select('*').eq('project_id', id),
      supabase.from('project_stakeholders').select('*, company:companies(company_name), contact:crm_contacts(full_name, email, phone)').eq('project_id', id),
      supabase.from('work_tasks').select('status, progress').eq('project_id', id).limit(1000),
      supabase.from('crm_contacts').select('id, full_name, phone, email').order('full_name').limit(200),
      supabase.from('crm_companies').select('id, company_name').order('company_name').limit(200),
    ]).then(([projRes, unitsRes, docRes, profilesRes, milRes, budRes, stakeRes, taskRes, crmConRes, crmCompRes]) => {
      if (projRes.error) throw new Error(projRes.error.message);
      setProject(projRes.data as Project | null);
      setForm(projRes.data as Project || {});
      setUnits((unitsRes.data || []) as Unit[]);
      setProjectDocs((docRes.data || []) as ProjectDocument[]);
      setUserProfiles((profilesRes.data || []) as { id: string; full_name_en: string }[]);
      setMilestones((milRes.data || []) as Milestone[]);
      setBudgetItems((budRes.data || []) as BudgetItem[]);
      setStakeholders((stakeRes.data || []) as any[]);
      setCrmContacts((crmConRes.data || []) as { id: string; full_name: string; phone?: string; email?: string }[]);
      setCrmCompanies((crmCompRes.data || []) as { id: string; company_name: string }[]);
      const tasks = (taskRes.data || []) as { status: string; progress: number }[];
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'completed').length;
      const in_progress = tasks.filter(t => t.status === 'in_progress' || t.status === 'active').length;
      const pending = tasks.filter(t => t.status === 'pending' || t.status === 'not_started').length;
      setTaskSummary({
        total, completed, in_progress, pending,
        overdue: tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      });
      setLoading(false);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to load project';
      setError(msg);
      toast.error(msg);
      setLoading(false);
    });
  }, [id, toast]);

  async function loadAuditLogs() {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const { data, error: err } = await supabase.from('audit_logs')
        .select('*, user_profile:user_profiles!audit_logs_user_id_fkey(full_name_en)')
        .eq('entity_type', 'projects')
        .eq('entity_id', id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) {
        if (err.code === '42P01') {
          toast.error('No audit logs available yet.');
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
      toast.error('End date must be after start date');
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

  async function addMilestone() {
    if (!id || !milestoneForm.name_en) { toast.error('Name is required'); return; }
    try {
      const { error } = await supabase.from('project_milestones').insert({
        project_id: id, milestone_code: `MS-${Date.now()}`,
        name_en: milestoneForm.name_en, name_ar: milestoneForm.name_ar,
        description: milestoneForm.description, target_date: milestoneForm.target_date,
        weight_percent: milestoneForm.weight_percent || 0,
      });
      if (error) throw error;
      toast.success('Milestone added');
      setMilestoneForm({});
      const { data } = await supabase.from('project_milestones').select('*').eq('project_id', id).order('target_date');
      setMilestones((data || []) as Milestone[]);
    } catch { toast.error('Failed to add milestone'); }
  }

  async function updateMilestoneStatus(milestoneId: string, status: string) {
    try {
      const update: Record<string, string> = { status };
      if (status === 'achieved') update.achieved_date = new Date().toISOString().split('T')[0];
      await supabase.from('project_milestones').update(update).eq('id', milestoneId);
      setMilestones(prev => prev.map(m => m.id === milestoneId ? { ...m, ...update } as Milestone : m));
      toast.success('Milestone updated');
    } catch { toast.error('Update failed'); }
  }

  async function removeMilestone(milestoneId: string) {
    try {
      await supabase.from('project_milestones').delete().eq('id', milestoneId);
      setMilestones(prev => prev.filter(m => m.id !== milestoneId));
      toast.success('Milestone removed');
    } catch { toast.error('Delete failed'); }
  }

  async function addBudgetItem() {
    if (!id || !budgetForm.name_en) { toast.error('Name is required'); return; }
    try {
      const { error } = await supabase.from('project_budget_items').insert({
        project_id: id, category: budgetForm.category || 'other',
        name_en: budgetForm.name_en, name_ar: budgetForm.name_ar,
        planned_amount: budgetForm.planned_amount || 0,
        notes: budgetForm.notes,
      });
      if (error) throw error;
      toast.success('Budget item added');
      setBudgetForm({});
      const { data } = await supabase.from('project_budget_items').select('*').eq('project_id', id);
      setBudgetItems((data || []) as BudgetItem[]);
    } catch { toast.error('Failed to add budget item'); }
  }

  async function removeBudgetItem(itemId: string) {
    try {
      await supabase.from('project_budget_items').delete().eq('id', itemId);
      setBudgetItems(prev => prev.filter(b => b.id !== itemId));
      toast.success('Budget item removed');
    } catch { toast.error('Delete failed'); }
  }

  async function addStakeholder() {
    if (!id) return;
    try {
      const payload: Record<string, unknown> = { project_id: id, role: stakeholderForm.role };
      if (stakeholderForm.company_id) payload.company_id = stakeholderForm.company_id;
      if (stakeholderForm.contact_id) payload.contact_id = stakeholderForm.contact_id;
      await supabase.from('project_stakeholders').insert(payload);
      toast.success('Stakeholder added');
      setStakeholderForm({ role: 'subcontractor' });
      const { data } = await supabase.from('project_stakeholders').select('*, company:companies(company_name), contact:crm_contacts(full_name, email, phone)').eq('project_id', id);
      setStakeholders((data || []) as any[]);
    } catch { toast.error('Failed to add stakeholder'); }
  }

  async function removeStakeholder(stakeholderId: string) {
    try {
      await supabase.from('project_stakeholders').delete().eq('id', stakeholderId);
      setStakeholders(prev => prev.filter(s => s.id !== stakeholderId));
      toast.success('Stakeholder removed');
    } catch { toast.error('Delete failed'); }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" /></div>;
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>;
  if (!project) return <div className="text-center py-20 text-gray-400">Project not found</div>;

  const tabs = [
    { key: 'overview' as const, icon: Building2, label: 'Overview' },
    { key: 'dashboard' as const, icon: BarChart3, label: 'Dashboard' },
    { key: 'site_plan' as const, icon: MapIcon, label: 'Site Plan' },
    { key: 'units' as const, icon: Home, label: `Units (${units.length})` },
    { key: 'milestones' as const, icon: Flag, label: `Milestones (${milestones.length})` },
    { key: 'team' as const, icon: Users, label: 'Team' },
    { key: 'budget' as const, icon: PieChart, label: 'Budget' },
    { key: 'documents' as const, icon: FileText, label: `Docs (${projectDocs.length})` },
    { key: 'history' as const, icon: History, label: 'History' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/projects')} className="btn-sm btn-secondary">
          <ArrowLeft size={16} /> {t('common.back')}
        </button>
        {hasPermission('projects', 'edit') && (
          <button className="btn-sm btn-secondary" onClick={() => setEditing(!editing)}>
            <Edit3 size={14} /> {editing ? 'Cancel' : 'Edit'}
          </button>
        )}
      </div>

      {/* Hero */}
      <div className="rounded-xl overflow-hidden">
        <div className="h-32 relative flex items-end p-6" style={{ background: statusGradients[project.status] || '#6b7280' }}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10 flex items-end justify-between w-full">
            <div>
              <h1 className="text-2xl font-bold text-white">{project.name_en}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-mono px-2 py-0.5 rounded">{project.project_code}</span>
                <span className="text-white/80 text-xs capitalize">{project.project_type?.replace('_', ' ') || 'N/A'}</span>
              </div>
              {project.name_ar && <p className="text-white/70 text-sm mt-1" dir="rtl">{project.name_ar}</p>}
            </div>
            <span className="bg-white/20 backdrop-blur-sm text-white text-sm font-semibold px-3 py-1 rounded-lg">
              {statusLabels[project.status] || project.status}
            </span>
          </div>
        </div>
        <div className="bg-white px-6 py-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Progress</span>
            <span className="font-semibold" style={{ color: statusColors[project.status] }}>{project.progress_percent}%</span>
          </div>
          <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${project.progress_percent}%`, background: statusGradients[project.status] }} />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}>
            <DollarSign size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Budget</p>
            <p className="text-sm font-semibold">{project.budget_amount ? `${project.budget_amount.toLocaleString()} SAR` : '-'}</p>
          </div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-info) 10%, transparent)', color: 'var(--color-info)' }}>
            <Calendar size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Timeline</p>
            <p className="text-sm font-semibold">{project.start_date ? `${project.start_date} — ${project.end_date || '?'}` : 'Not set'}</p>
          </div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-success) 10%, transparent)', color: 'var(--color-success)' }}>
            <Home size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Units</p>
            <p className="text-sm font-semibold">{units.length}</p>
          </div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', color: 'var(--color-warning)' }}>
            <FileText size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Documents</p>
            <p className="text-sm font-semibold">{projectDocs.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map((tabItem) => (
          <button key={tabItem.key} className={`tab flex items-center gap-1.5 ${tab === tabItem.key ? 'tab-active' : ''}`}
            onClick={() => { setTab(tabItem.key); if (tabItem.key === 'history') loadAuditLogs(); }}>
            <tabItem.icon size={15} />
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="card space-y-4 animate-slide-up">
          <h3 className="font-semibold flex items-center gap-2"><Edit3 size={16} /> Edit Project</h3>
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
            <div><label className="label">Budget (SAR)</label><input type="number" className="input" value={form.budget_amount ?? ''} onChange={(e) => setForm({ ...form, budget_amount: e.target.value ? parseFloat(e.target.value) : undefined })} /></div>
            <div><label className="label">Progress (%)</label><input type="number" className="input" min={0} max={100} value={form.progress_percent ?? 0} onChange={(e) => setForm({ ...form, progress_percent: parseInt(e.target.value) || 0 })} /></div>
            <div><label className="label">Total Area (sqm)</label><input type="number" className="input" value={form.total_area ?? ''} onChange={(e) => setForm({ ...form, total_area: e.target.value ? parseFloat(e.target.value) : undefined })} /></div>
            <div><label className="label">Built-up Area (sqm)</label><input type="number" className="input" value={form.built_up_area ?? ''} onChange={(e) => setForm({ ...form, built_up_area: e.target.value ? parseFloat(e.target.value) : undefined })} /></div>
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
            <div className="col-span-2"><label className="label">Partners</label><textarea className="input" rows={2} value={form.partners || ''} onChange={(e) => setForm({ ...form, partners: e.target.value })} placeholder="Partner 1, Partner 2" /></div>
            <div className="col-span-2"><label className="label">Stakeholders</label><textarea className="input" rows={2} value={form.stakeholders || ''} onChange={(e) => setForm({ ...form, stakeholders: e.target.value })} placeholder="Stakeholder A, B" /></div>
            <div className="col-span-2"><hr className="border-gray-200" /></div>
            <div className="col-span-2"><h4 className="font-medium text-gray-700 text-sm">Coordinates</h4></div>
            <div><label className="label">Latitude</label><input type="number" step="any" className="input" value={form.latitude ?? ''} onChange={(e) => setForm({ ...form, latitude: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="24.7136" /></div>
            <div><label className="label">Longitude</label><input type="number" step="any" className="input" value={form.longitude ?? ''} onChange={(e) => setForm({ ...form, longitude: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="46.6753" /></div>
          </div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
            <button className="btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Building2 size={16} /> Project Details</h3>
            <div className="text-sm space-y-3">
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Type</span>
                <span className="font-medium capitalize">{project.project_type?.replace('_', ' ') || '-'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Status</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[project.status] }} />
                  <span className="font-medium capitalize">{statusLabels[project.status] || project.status}</span>
                </span>
              </div>
              {project.client_name && (
                <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                  <span className="text-gray-500 flex items-center gap-1"><User size={14} /> Client</span>
                  <span className="font-medium">{project.client_name}</span>
                </div>
              )}
              {project.location && (
                <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                  <span className="text-gray-500 flex items-center gap-1"><MapPin size={14} /> Location</span>
                  <span className="font-medium">{project.location}</span>
                </div>
              )}
              {project.budget_amount > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                  <span className="text-gray-500 flex items-center gap-1"><DollarSign size={14} /> Budget</span>
                  <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{project.budget_amount.toLocaleString()} SAR</span>
                </div>
              )}
              {project.total_area != null && (
                <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                  <span className="text-gray-500 flex items-center gap-1"><Target size={14} /> Total Area</span>
                  <span className="font-medium">{project.total_area.toLocaleString()} sqm</span>
                </div>
              )}
              {project.built_up_area != null && (
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-gray-500 flex items-center gap-1"><Target size={14} /> Built-up Area</span>
                  <span className="font-medium">{project.built_up_area.toLocaleString()} sqm</span>
                </div>
              )}
            </div>
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Calendar size={16} /> Schedule</h3>
            <div className="text-sm space-y-3">
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Start Date</span>
                <span className="font-medium">{project.start_date || '-'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-gray-500">End Date</span>
                <span className="font-medium">{project.end_date || '-'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">
                  {project.start_date && project.end_date
                    ? `${Math.ceil((new Date(project.end_date).getTime() - new Date(project.start_date).getTime()) / (1000 * 60 * 60 * 24))} days`
                    : '-'}
                </span>
              </div>
            </div>
          </div>

          {project.description && (
            <div className="card col-span-full space-y-3">
              <h3 className="font-semibold text-gray-900">Description</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{project.description}</p>
            </div>
          )}

          {/* Team */}
          {(project.project_manager_id || project.consultant_name || project.partners || project.stakeholders) && (
            <div className="card col-span-full space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users size={16} /> Project Team</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {project.project_manager_id && (
                  <div>
                    <p className="text-gray-500 text-xs">Project Manager</p>
                    <p className="font-medium">{userProfiles.find((u) => u.id === project.project_manager_id)?.full_name_en || 'Unknown'}</p>
                  </div>
                )}
                {project.consultant_name && (
                  <div>
                    <p className="text-gray-500 text-xs">Consultant</p>
                    <p className="font-medium">{project.consultant_name}</p>
                  </div>
                )}
                {project.consultant_company && (
                  <div>
                    <p className="text-gray-500 text-xs">Consultant Company</p>
                    <p className="font-medium">{project.consultant_company}</p>
                  </div>
                )}
                {project.consultant_phone && (
                  <div>
                    <p className="text-gray-500 text-xs flex items-center gap-1"><Phone size={12} /> Phone</p>
                    <p className="font-medium" dir="ltr">{project.consultant_phone}</p>
                  </div>
                )}
                {project.consultant_email && (
                  <div>
                    <p className="text-gray-500 text-xs flex items-center gap-1"><Mail size={12} /> Email</p>
                    <p className="font-medium">{project.consultant_email}</p>
                  </div>
                )}
                {project.partners && (
                  <div className="col-span-full">
                    <p className="text-gray-500 text-xs">Partners</p>
                    <p className="font-medium">{project.partners}</p>
                  </div>
                )}
                {project.stakeholders && (
                  <div className="col-span-full">
                    <p className="text-gray-500 text-xs">Stakeholders</p>
                    <p className="font-medium">{project.stakeholders}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logo + Location */}
          <div className="col-span-full flex gap-4">
            {project.logo_url && (
              <div className="card space-y-2 flex-1">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1"><ImageIcon size={14} /> Logo</h3>
                <img src={project.logo_url} alt="Project logo" className="max-h-20 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
            {(project.latitude != null || project.longitude != null) && (
              <div className="card space-y-2 flex-1">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1"><Globe size={14} /> Coordinates</h3>
                <div className="text-sm space-y-1">
                  {project.latitude != null && <p><span className="text-gray-500">Lat:</span> {project.latitude}</p>}
                  {project.longitude != null && <p><span className="text-gray-500">Lng:</span> {project.longitude}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="card col-span-full">
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
        </div>
      )}

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><CheckCircle size={16} style={{ color: 'var(--color-success)' }} /><span className="text-xs text-gray-500">Tasks</span></div>
              <p className="text-2xl font-bold">{taskSummary.total}</p>
              <p className="text-xs text-gray-400">{taskSummary.completed} completed · {taskSummary.in_progress} in progress</p>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${taskSummary.progress}%` }} />
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Flag size={16} style={{ color: 'var(--color-primary)' }} /><span className="text-xs text-gray-500">Milestones</span></div>
              <p className="text-2xl font-bold">{milestones.length}</p>
              <p className="text-xs text-gray-400">{milestones.filter(m => m.status === 'achieved').length} achieved · {milestones.filter(m => m.status === 'pending').length} pending</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><DollarSign size={16} style={{ color: 'var(--color-warning)' }} /><span className="text-xs text-gray-500">Budget</span></div>
              <p className="text-2xl font-bold">{budgetItems.reduce((s, b) => s + b.planned_amount, 0).toLocaleString()} SAR</p>
              <p className="text-xs text-gray-400">Planned · {budgetItems.reduce((s, b) => s + (b.actual_amount || 0), 0).toLocaleString()} SAR actual</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1"><Users size={16} /><span className="text-xs text-gray-500">Team</span></div>
              <p className="text-2xl font-bold">{stakeholders.length}</p>
              <p className="text-xs text-gray-400">{stakeholders.filter((s: any) => s.role === 'main_contractor').length} contractors</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Activity size={14} /> Task Status</h3>
              <div className="space-y-2">
                {[
                  { label: 'Completed', value: taskSummary.completed, color: '#22c55e', max: Math.max(taskSummary.total, 1) },
                  { label: 'In Progress', value: taskSummary.in_progress, color: '#3b82f6', max: Math.max(taskSummary.total, 1) },
                  { label: 'Pending', value: taskSummary.pending, color: '#9ca3af', max: Math.max(taskSummary.total, 1) },
                  { label: 'Overdue', value: taskSummary.overdue, color: '#ef4444', max: Math.max(taskSummary.total, 1) },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(item.value / item.max) * 100}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp size={14} /> Upcoming Milestones</h3>
              {milestones.filter(m => m.status !== 'achieved').length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No upcoming milestones.</p>
              ) : (
                <div className="space-y-2">
                  {milestones.filter(m => m.status !== 'achieved').sort((a, b) => (a.target_date || '').localeCompare(b.target_date || '')).slice(0, 5).map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg border text-xs" style={{ borderColor: 'var(--color-border)' }}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${m.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{m.name_en}</p>
                        <p className="text-gray-400">{m.target_date ? new Date(m.target_date + 'T00:00:00').toLocaleDateString() : 'No date'}</p>
                      </div>
                      <span className={`badge text-[10px] ${m.status === 'in_progress' ? 'badge-info' : 'badge-neutral'}`}>{m.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card col-span-full">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><DollarSign size={14} /> Budget vs Actual</h3>
              {budgetItems.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No budget items set.</p>
              ) : (
                <div className="space-y-2">
                  {budgetItems.map(b => {
                    const pct = b.planned_amount > 0 ? Math.min((b.actual_amount / b.planned_amount) * 100, 100) : 0;
                    const overBudget = b.actual_amount > b.planned_amount;
                    return (
                      <div key={b.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{b.name_en}</span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>{b.actual_amount.toLocaleString()} / {b.planned_amount.toLocaleString()} SAR</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
                          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min((b.actual_amount / Math.max(b.planned_amount, 1)) * 100, 100)}%` }} />
                          {overBudget && <div className="absolute inset-0 h-full rounded-full bg-red-400/30" style={{ width: '100%' }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><MessageCircle size={14} /> Communication</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button onClick={() => navigate(`/chat?project=${project.id}`)} className="flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                <MessageCircle size={18} style={{ color: 'var(--color-primary)' }} /> Project Chat
              </button>
              <button onClick={() => navigate(`/meetings?project=${project.id}`)} className="flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                <Video size={18} style={{ color: 'var(--color-success)' }} /> Meetings
              </button>
              <button onClick={() => navigate(`/daily-reports?project=${project.id}`)} className="flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                <FileText size={18} style={{ color: 'var(--color-info)' }} /> Daily Reports
              </button>
              <button onClick={() => navigate(`/documents?project=${project.id}`)} className="flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                <FileText size={18} style={{ color: 'var(--color-warning)' }} /> Documents
              </button>
              <button onClick={() => navigate(`/execution?project=${project.id}`)} className="flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                <ClipboardList size={18} style={{ color: 'var(--color-info)' }} /> Tasks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Site Plan Tab */}
      {tab === 'site_plan' && (
        <ProjectSitePlan
          projectId={project.id}
          projectName={project.name_en}
          height="600px"
        />
      )}

      {/* Units Tab */}
      {tab === 'units' && (
        <div>
          {units.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <Home size={40} className="mx-auto mb-2 opacity-30" />
              <p>No units found for this project.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.map((u) => (
                <div key={u.id} className="card cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate(`/units/${u.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{u.unit_code || `Unit ${u.id.slice(0, 8)}`}</p>
                      <p className="text-xs text-gray-500 capitalize">{u.unit_type?.replace('_', ' ') || 'N/A'}</p>
                    </div>
                    <span className={`badge text-xs capitalize ${
                      u.status === 'available' || u.status === 'completed' ? 'badge-success' :
                      u.status === 'reserved' || u.status === 'sold' ? 'badge-info' :
                      'badge-neutral'
                    }`}>{u.status}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {u.bedrooms > 0 && <span className="text-gray-500">{u.bedrooms} Bed</span>}
                    {u.area != null && (u.area ?? 0) > 0 && <span className="text-gray-500">{u.area} sqm</span>}
                  </div>
                  {u.price > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-xs text-gray-500">Price</span>
                      <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{u.price.toLocaleString()} SAR</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Milestones Tab */}
      {tab === 'milestones' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Flag size={14} /> Add Milestone</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input className="input text-sm" placeholder="Name (EN)" value={milestoneForm.name_en || ''} onChange={e => setMilestoneForm({...milestoneForm, name_en: e.target.value})} />
              <input className="input text-sm" placeholder="Name (AR)" value={milestoneForm.name_ar || ''} onChange={e => setMilestoneForm({...milestoneForm, name_ar: e.target.value})} />
              <input type="date" className="input text-sm" value={milestoneForm.target_date || ''} onChange={e => setMilestoneForm({...milestoneForm, target_date: e.target.value})} />
              <input type="number" className="input text-sm" placeholder="Weight %" value={milestoneForm.weight_percent ?? ''} onChange={e => setMilestoneForm({...milestoneForm, weight_percent: parseFloat(e.target.value) || 0})} />
            </div>
            <textarea className="input text-sm mt-3" placeholder="Description..." value={milestoneForm.description || ''} onChange={e => setMilestoneForm({...milestoneForm, description: e.target.value})} />
            <button className="btn-primary btn-sm mt-3" onClick={addMilestone}><Flag size={14} /> Add Milestone</button>
          </div>
          <div className="space-y-2">
            {milestones.length === 0 ? (
              <div className="card text-center py-10 text-gray-400"><Flag size={40} className="mx-auto mb-2 opacity-30" /><p>No milestones yet.</p></div>
            ) : (
              milestones.map(m => (
                <div key={m.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-3 h-3 rounded-full shrink-0 ${
                        m.status === 'achieved' ? 'bg-green-500' :
                        m.status === 'in_progress' ? 'bg-blue-500' :
                        m.status === 'missed' ? 'bg-red-500' : 'bg-gray-300'
                      }`} />
                      <div>
                        <p className="font-semibold text-sm">{m.name_en}</p>
                        {m.name_ar && <p className="text-xs text-gray-400" dir="rtl">{m.name_ar}</p>}
                        {m.description && <p className="text-xs text-gray-500 mt-1">{m.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span><Calendar size={12} className="inline mr-1" />{m.target_date ? new Date(m.target_date + 'T00:00:00').toLocaleDateString() : 'No date'}</span>
                          {m.achieved_date && <span className="text-green-600">Achieved: {new Date(m.achieved_date + 'T00:00:00').toLocaleDateString()}</span>}
                          {m.weight_percent > 0 && <span>Weight: {m.weight_percent}%</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select className="input text-xs py-1 px-2 w-auto" value={m.status} onChange={e => updateMilestoneStatus(m.id, e.target.value)}>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="achieved">Achieved</option>
                        <option value="missed">Missed</option>
                      </select>
                      <button className="btn-sm text-red-500" onClick={() => removeMilestone(m.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Team Tab */}
      {tab === 'team' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><UserPlus size={14} /> Add Stakeholder</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select className="input text-sm" value={stakeholderForm.role} onChange={e => setStakeholderForm({...stakeholderForm, role: e.target.value})}>
                <option value="owner">Owner</option>
                <option value="main_contractor">Main Contractor</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="consultant">Consultant</option>
                <option value="designer">Designer</option>
                <option value="supplier">Supplier</option>
                <option value="government">Government</option>
                <option value="investor">Investor</option>
                <option value="other">Other</option>
              </select>
              <select className="input text-sm" value={stakeholderForm.contact_id || ''} onChange={e => setStakeholderForm({...stakeholderForm, contact_id: e.target.value || undefined, company_id: undefined})}>
                <option value="">Select contact (CRM)</option>
                {crmContacts.map(c => <option key={c.id} value={c.id}>{c.full_name} {c.phone ? `(${c.phone})` : ''}</option>)}
              </select>
              <select className="input text-sm" value={stakeholderForm.company_id || ''} onChange={e => setStakeholderForm({...stakeholderForm, company_id: e.target.value || undefined, contact_id: undefined})}>
                <option value="">Select company (CRM)</option>
                {crmCompanies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <button className="btn-primary btn-sm mt-3" onClick={addStakeholder}><UserPlus size={14} /> Add Stakeholder</button>
          </div>
          <div className="space-y-2">
            {stakeholders.length === 0 ? (
              <div className="card text-center py-10 text-gray-400"><Users size={40} className="mx-auto mb-2 opacity-30" /><p>No stakeholders added yet. Connect CRM contacts or companies.</p></div>
            ) : (
              stakeholders.map((s: any) => (
                <div key={s.id} className="card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: s.role === 'owner' ? '#fef3c7' : s.role === 'main_contractor' ? '#dbeafe' : s.role === 'consultant' ? '#ede9fe' : '#f3f4f6', color: s.role === 'owner' ? '#d97706' : s.role === 'main_contractor' ? '#2563eb' : s.role === 'consultant' ? '#7c3aed' : '#6b7280' }}>
                      {s.role === 'owner' ? 'O' : s.role === 'main_contractor' ? 'MC' : s.role === 'subcontractor' ? 'SC' : s.role === 'consultant' ? 'C' : '?'}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{s.contact?.full_name || s.company?.company_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400 capitalize">{s.role.replace('_', ' ')}</p>
                      {s.contact?.email && <p className="text-xs text-gray-400">{s.contact.email}</p>}
                    </div>
                  </div>
                  <button className="btn-sm text-red-400 hover:text-red-600" onClick={() => removeStakeholder(s.id)}><Trash2 size={14} /></button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Budget Tab */}
      {tab === 'budget' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="card p-3">
              <p className="text-xs text-gray-500">Total Planned</p>
              <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{budgetItems.reduce((s, b) => s + b.planned_amount, 0).toLocaleString()} SAR</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-gray-500">Total Actual</p>
              <p className="text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{budgetItems.reduce((s, b) => s + (b.actual_amount || 0), 0).toLocaleString()} SAR</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-gray-500">Remaining</p>
              <p className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>{(budgetItems.reduce((s, b) => s + b.planned_amount, 0) - budgetItems.reduce((s, b) => s + (b.actual_amount || 0), 0)).toLocaleString()} SAR</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-gray-500">Utilization</p>
              <p className="text-lg font-bold">{budgetItems.reduce((s, b) => s + b.planned_amount, 0) > 0
                ? Math.round((budgetItems.reduce((s, b) => s + (b.actual_amount || 0), 0) / budgetItems.reduce((s, b) => s + b.planned_amount, 0)) * 100) + '%'
                : '0%'}
              </p>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><DollarSign size={14} /> Add Budget Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select className="input text-sm" value={budgetForm.category || 'other'} onChange={e => setBudgetForm({...budgetForm, category: e.target.value})}>
                {['labor','materials','equipment','subcontractor','consultant','permits','admin','contingency','other'].map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <input className="input text-sm" placeholder="Item name" value={budgetForm.name_en || ''} onChange={e => setBudgetForm({...budgetForm, name_en: e.target.value})} />
              <input type="number" className="input text-sm" placeholder="Planned amount (SAR)" value={budgetForm.planned_amount ?? ''} onChange={e => setBudgetForm({...budgetForm, planned_amount: parseFloat(e.target.value) || 0})} />
              <input className="input text-sm" placeholder="Notes" value={budgetForm.notes || ''} onChange={e => setBudgetForm({...budgetForm, notes: e.target.value})} />
            </div>
            <button className="btn-primary btn-sm mt-3" onClick={addBudgetItem}><DollarSign size={14} /> Add Budget Item</button>
          </div>

          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead><tr><th>Category</th><th>Item</th><th>Planned (SAR)</th><th>Actual (SAR)</th><th>Variance</th><th></th></tr></thead>
              <tbody>
                {budgetItems.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No budget items.</td></tr>
                ) : budgetItems.map(b => {
                  const variance = b.actual_amount - b.planned_amount;
                  const pctUsed = b.planned_amount > 0 ? (b.actual_amount / b.planned_amount) * 100 : 0;
                  return (
                    <tr key={b.id}>
                      <td><span className="badge text-xs capitalize">{b.category}</span></td>
                      <td className="font-medium">{b.name_en}</td>
                      <td>{b.planned_amount.toLocaleString()}</td>
                      <td>{b.actual_amount.toLocaleString()}</td>
                      <td>
                        <span className={variance > 0 ? 'text-red-500' : 'text-green-500'}>
                          {variance > 0 ? '+' : ''}{variance.toLocaleString()} ({Math.round(pctUsed)}%)
                        </span>
                      </td>
                      <td><button className="btn-sm text-red-400" onClick={() => removeBudgetItem(b.id)}><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {tab === 'documents' && (
        <div className="card">
          {projectDocs.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <FileText size={40} className="mx-auto mb-2 opacity-30" />
              <p>No documents for this project.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Document No</th><th>Title</th><th>Type</th><th>Version</th><th>Status</th><th>Upload Date</th><th></th></tr>
                  </thead>
                  <tbody>
                    {projectDocs.map((d) => (
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
                          ) : <span className="text-xs text-gray-400">&mdash;</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-center">
                <button onClick={() => navigate(`/documents?project=${id}`)} className="text-primary hover:underline text-sm font-medium">View All &rarr;</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* History Tab */}
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
                      <span className="text-gray-500">{log.user_profile?.full_name_en || log.changed_by || 'System'}</span>
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
                  {log.action === 'create' && <div className="mt-2 bg-gray-50 rounded p-2 text-xs text-gray-600">Created with {(Object.keys(log.new_data || {})).length} fields</div>}
                  {log.action === 'delete' && <div className="mt-2 bg-gray-50 rounded p-2 text-xs text-gray-600">Project deleted</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
