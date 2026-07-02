import { useState, useEffect, useMemo } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { approvalsApi, workflowsApi } from '../services/api';
import EmptyState from '../components/EmptyState';
import { exportCSV } from '../utils/csv';
import { formatDate } from '../utils/date';
import CsvImportModal from '../components/CsvImportModal';
import Pagination from '../components/Pagination';
import type { ApprovalRequest, ApprovalStep, WorkflowDefinition, WorkflowStep } from '../types';
import type { SyncConfig } from '../services/syncService';
import { Plus, Download, Upload, Search, CheckCircle, XCircle, Eye, Clock, BarChart3, ListChecks, ThumbsUp, Send, ChevronRight, RefreshCw, FileText, User, Calendar, Copy, Save, FolderOpen, Building2, AlertTriangle, Edit3, Trash2, Settings, Shield, X, CheckSquare, Square } from 'lucide-react';

const MODULES = ['quality', 'hse', 'hr', 'procurement', 'finance', 'sales', 'technical', 'documents', 'execution'] as const;
const STATUSES = ['pending', 'in_progress', 'approved', 'rejected', 'cancelled'] as const;
type TabKey = 'dashboard' | 'requests' | 'templates';

const tableMap: Record<string, string> = {
  quality: 'work_requests', hse: 'safety_incidents', hr: 'employees',
  procurement: 'purchase_orders', finance: 'contract_invoices',
  sales: 'leads', technical: 'technical_tickets', documents: 'documents',
  execution: 'work_requests',
};

interface Template {
  id: string; name_en: string; name_ar?: string; module_code: string;
  project_id?: string; department?: string; workflow_id?: string; is_default: boolean;
}
interface DeptManager { id: string; department: string; manager_id: string; manager_name?: string; deputy_id?: string; deputy_name?: string; }
type ApprovalRequestEx = ApprovalRequest & { due_date?: string; department?: string; };

function statusBadge(status: string) {
  const cls = status === 'approved' ? 'badge-success' : status === 'rejected' ? 'badge-danger' : status === 'cancelled' ? 'badge' : 'badge-warning';
  return <span className={`badge text-xs ${cls}`}>{status}</span>;
}

export default function ApprovalsPage() {
  const t = useT();
  const toast = useToast();
  const { user: authUser, hasPermission } = useAuth();
  const currentUserId = authUser?.id;

  const [tab, setTab] = useState<TabKey>('dashboard');
  const [requests, setRequests] = useState<ApprovalRequestEx[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [moduleFilter, setModuleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  interface StepDisplay extends ApprovalStep { assigned_to_name?: string; acted_by_name?: string; }
  const [steps, setSteps] = useState<StepDisplay[]>([]);
  const [projects, setProjects] = useState<{ id: string; name_en: string; project_code: string }[]>([]);
  const [approvers, setApprovers] = useState<{ id: string; full_name_en: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ title_en: '', title_ar: '', module_code: 'quality', project_id: '', approver_id: '', ref_record_id: '', description: '', due_date: '', department: '', template_id: '' });
  const [refRecords, setRefRecords] = useState<{ id: string; label: string }[]>([]);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [deptManagers, setDeptManagers] = useState<DeptManager[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState({ name_en: '', name_ar: '', module_code: 'quality', project_id: '', department: '', workflow_id: '', is_default: false });
  const [departments, setDepartments] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [showDeptManagerModal, setShowDeptManagerModal] = useState(false);
  const [editingDeptManager, setEditingDeptManager] = useState<DeptManager | null>(null);
  const [deptManagerForm, setDeptManagerForm] = useState({ department: '', manager_id: '', deputy_id: '' });
  const [users, setUsers] = useState<{ id: string; full_name_en: string }[]>([]);

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [wfSteps, setWfSteps] = useState<WorkflowStep[]>([]);
  const [showWorkflowForm, setShowWorkflowForm] = useState(false);
  const [workflowForm, setWorkflowForm] = useState({ name_en: '', name_ar: '', is_default: false });
  const [showStepForm, setShowStepForm] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [stepForm, setStepForm] = useState({ step_order: 1, from_status_code: '', to_status_code: '', allowed_roles: [] as string[], action_label_en: '', action_label_ar: '', require_attachment: false, require_comment: false });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const roles = ['admin', 'developer', 'main_contractor', 'subcontractor', 'engineer', 'quality', 'hse', 'hr', 'finance', 'consultant', 'client', 'sales', 'project_manager'];

  useEffect(() => { load(); loadTemplates(); loadDeptManagers(); loadWorkflows(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [debouncedSearch, moduleFilter, statusFilter, projectFilter, departmentFilter]);
  useEffect(() => { if (selectedRequest) loadSteps(selectedRequest.id); else setSteps([]); }, [selectedRequest]);
  useEffect(() => { if (selectedWorkflow) loadWfSteps(selectedWorkflow.id); else setWfSteps([]); }, [selectedWorkflow]);

  const pendingCount = useMemo(() => requests.filter(r => r.status === 'pending' || r.status === 'in_progress').length, [requests]);
  const approvedCount = useMemo(() => requests.filter(r => r.status === 'approved').length, [requests]);
  const rejectedCount = useMemo(() => requests.filter(r => r.status === 'rejected').length, [requests]);
  const myPendingCount = useMemo(() => requests.filter(r => (r.status === 'pending' || r.status === 'in_progress') && (r.approver_id === currentUserId)).length, [requests, currentUserId]);
  const overdueCount = useMemo(() => requests.filter(r => (r.status === 'pending' || r.status === 'in_progress') && r.due_date && new Date(r.due_date) < new Date()).length, [requests]);

  async function load() {
    setLoading(true);
    try {
      const [reqRes, projRes, apprRes, usersRes] = await Promise.all([
        approvalsApi.list(),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
        supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
        supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
      ]);
      setRequests(reqRes as ApprovalRequestEx[]);
      setProjects((projRes.data || []) as any[]);
      setApprovers((apprRes.data || []) as any[]);
      setUsers((usersRes.data || []) as any[]);
      setDepartments([...new Set((reqRes as ApprovalRequestEx[]).map(r => r.department).filter(Boolean))] as string[]);
    } catch (err) {
      console.error('Failed to load:', err);
      toast.error('Failed to load data.');
    } finally { setLoading(false); }
  }

  async function loadTemplates() {
    try {
      const { data } = await supabase.from('approval_templates').select('*').order('name_en');
      setTemplates((data || []) as Template[]);
    } catch { /* ignore */ }
  }

  async function loadDeptManagers() {
    try {
      const { data } = await supabase.from('department_managers').select('*');
      const mgrs = (data || []) as DeptManager[];
      const usersRes = await supabase.from('user_profiles').select('id, full_name_en');
      const us = (usersRes.data || []) as { id: string; full_name_en: string }[];
      setDeptManagers(mgrs.map(m => ({
        ...m,
        manager_name: us.find(u => u.id === m.manager_id)?.full_name_en,
        deputy_name: m.deputy_id ? us.find(u => u.id === m.deputy_id)?.full_name_en : undefined,
      })));
    } catch { /* ignore */ }
  }

  async function loadWorkflows() {
    try {
      const wfs = await workflowsApi.list('approvals');
      setWorkflows(wfs);
    } catch { /* ignore */ }
  }

  async function loadWfSteps(workflowId: string) {
    try {
      const steps = await workflowsApi.getSteps(workflowId);
      setWfSteps(steps);
    } catch { /* ignore */ }
  }

  async function loadSteps(requestId: string) {
    const [stepsData, usersRes] = await Promise.all([
      approvalsApi.listSteps(requestId),
      supabase.from('user_profiles').select('id, full_name_en'),
    ]);
    const us = (usersRes.data || []) as { id: string; full_name_en: string }[];
    setSteps(stepsData.map(s => ({
      ...s,
      assigned_to_name: s.step_user_id ? (us.find(u => u.id === s.step_user_id)?.full_name_en || s.step_user_id.slice(0, 8)) : s.step_role,
      acted_by_name: s.acted_by ? (us.find(u => u.id === s.acted_by)?.full_name_en || undefined) : undefined,
    })));
  }

  async function loadRefRecords(moduleCode: string) {
    const tbl = tableMap[moduleCode];
    if (!tbl) { setRefRecords([]); return; }
    let query = supabase.from(tbl).select('*');
    if (moduleCode === 'quality') query = query.eq('is_ncr', true);
    const { data } = await query.limit(50);
    if (data) {
      setRefRecords(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        label: (r.title_en || r.title || r.name_en || r.full_name_en || r.full_name || r.description || r.invoice_no || r.ticket_no || r.incident_no || r.id) as string,
      })));
    }
  }

  const filtered = useMemo(() => requests.filter(r => {
    if (debouncedSearch && !r.request_no?.toLowerCase().includes(debouncedSearch.toLowerCase()) && !r.title_en?.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    if (moduleFilter && r.module_code !== moduleFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (projectFilter && r.project_id !== projectFilter) return false;
    if (departmentFilter && r.department !== departmentFilter) return false;
    return true;
  }), [requests, debouncedSearch, moduleFilter, statusFilter, projectFilter, departmentFilter]);

  const filteredCount = filtered.length;

  function handleModuleChange(moduleCode: string) {
    setForm({ ...form, module_code: moduleCode, ref_record_id: '' });
    loadRefRecords(moduleCode);
  }

  async function handleTemplateApply(tpl: Template) {
    setForm({ ...form, title_en: tpl.name_en, title_ar: tpl.name_ar || '', module_code: tpl.module_code, project_id: tpl.project_id || '', template_id: tpl.id });
    loadRefRecords(tpl.module_code);
    setShowForm(true);
  }

  function openTemplateForm(tpl?: Template) {
    if (tpl) {
      setEditingTemplate(tpl);
      setTemplateForm({ name_en: tpl.name_en, name_ar: tpl.name_ar || '', module_code: tpl.module_code, project_id: tpl.project_id || '', department: tpl.department || '', workflow_id: tpl.workflow_id || '', is_default: tpl.is_default });
    } else {
      setEditingTemplate(null);
      setTemplateForm({ name_en: '', name_ar: '', module_code: 'quality', project_id: '', department: '', workflow_id: '', is_default: false });
    }
    setShowTemplateForm(true);
  }

  async function saveTemplate() {
    if (!templateForm.name_en.trim()) { toast.error('Template name required'); return; }
    try {
      if (editingTemplate) {
        await supabase.from('approval_templates').update(templateForm).eq('id', editingTemplate.id);
        toast.success('Template updated');
      } else {
        await supabase.from('approval_templates').insert(templateForm);
        toast.success('Template saved');
      }
      setShowTemplateForm(false);
      setEditingTemplate(null);
      setTemplateForm({ name_en: '', name_ar: '', module_code: 'quality', project_id: '', department: '', workflow_id: '', is_default: false });
      loadTemplates();
    } catch { toast.error('Failed to save template'); }
  }

  async function deleteTemplate(id: string) {
    try {
      await supabase.from('approval_templates').delete().eq('id', id);
      toast.success('Template deleted');
      setShowDeleteConfirm(null);
      loadTemplates();
    } catch { toast.error('Failed to delete template'); }
  }

  function openDeptManagerModal(mgr?: DeptManager) {
    if (mgr) {
      setEditingDeptManager(mgr);
      setDeptManagerForm({ department: mgr.department, manager_id: mgr.manager_id, deputy_id: mgr.deputy_id || '' });
    } else {
      setEditingDeptManager(null);
      setDeptManagerForm({ department: '', manager_id: '', deputy_id: '' });
    }
    setShowDeptManagerModal(true);
  }

  async function saveDeptManager() {
    if (!deptManagerForm.department.trim() || !deptManagerForm.manager_id) { toast.error('Department and manager required'); return; }
    try {
      const payload = {
        department: deptManagerForm.department,
        manager_id: deptManagerForm.manager_id,
        deputy_id: deptManagerForm.deputy_id || undefined,
      };
      if (editingDeptManager) {
        await supabase.from('department_managers').update(payload).eq('id', editingDeptManager.id);
        toast.success('Department manager updated');
      } else {
        await supabase.from('department_managers').insert(payload);
        toast.success('Department manager created');
      }
      setShowDeptManagerModal(false);
      setEditingDeptManager(null);
      setDeptManagerForm({ department: '', manager_id: '', deputy_id: '' });
      loadDeptManagers();
    } catch { toast.error('Failed to save department manager'); }
  }

  async function deleteDeptManager(id: string) {
    try {
      await supabase.from('department_managers').delete().eq('id', id);
      toast.success('Department manager deleted');
      loadDeptManagers();
    } catch { toast.error('Failed to delete department manager'); }
  }

  function openWorkflowForm(wf?: WorkflowDefinition) {
    if (wf) {
      setSelectedWorkflow(wf);
      setWorkflowForm({ name_en: wf.name_en, name_ar: wf.name_ar || '', is_default: wf.is_default });
    } else {
      setSelectedWorkflow(null);
      setWorkflowForm({ name_en: '', name_ar: '', is_default: false });
    }
    setShowWorkflowForm(true);
  }

  async function saveWorkflow() {
    if (!workflowForm.name_en.trim()) { toast.error('Workflow name required'); return; }
    try {
      const payload = { ...workflowForm, module_code: 'approvals' };
      if (selectedWorkflow) {
        await workflowsApi.upsert({ ...payload, id: selectedWorkflow.id });
        toast.success('Workflow updated');
      } else {
        await workflowsApi.upsert(payload);
        toast.success('Workflow created');
      }
      setShowWorkflowForm(false);
      setSelectedWorkflow(null);
      setWorkflowForm({ name_en: '', name_ar: '', is_default: false });
      loadWorkflows();
    } catch { toast.error('Failed to save workflow'); }
  }

  async function deleteWorkflow(id: string) {
    try {
      await supabase.from('workflow_definitions').delete().eq('id', id);
      toast.success('Workflow deleted');
      setSelectedWorkflow(null);
      setWfSteps([]);
      loadWorkflows();
    } catch { toast.error('Failed to delete workflow'); }
  }

  function openStepForm(step?: WorkflowStep) {
    if (step) {
      setEditingStep(step);
      setStepForm({ step_order: step.step_order, from_status_code: step.from_status_code, to_status_code: step.to_status_code, allowed_roles: step.allowed_roles || [], action_label_en: step.action_label_en, action_label_ar: step.action_label_ar || '', require_attachment: step.require_attachment, require_comment: step.require_comment });
    } else {
      setEditingStep(null);
      setStepForm({ step_order: (wfSteps.length || 0) + 1, from_status_code: '', to_status_code: '', allowed_roles: [], action_label_en: '', action_label_ar: '', require_attachment: false, require_comment: false });
    }
    setShowStepForm(true);
  }

  async function saveStep() {
    if (!stepForm.action_label_en.trim() || stepForm.allowed_roles.length === 0) { toast.error('Action label and at least one role required'); return; }
    if (!selectedWorkflow) { toast.error('No workflow selected'); return; }
    try {
      const payload = { workflow_id: selectedWorkflow.id, ...stepForm };
      if (editingStep) {
        await workflowsApi.upsertStep({ ...payload, id: editingStep.id });
        toast.success('Step updated');
      } else {
        await workflowsApi.upsertStep(payload);
        toast.success('Step created');
      }
      setShowStepForm(false);
      setEditingStep(null);
      loadWfSteps(selectedWorkflow.id);
    } catch { toast.error('Failed to save step'); }
  }

  async function deleteStep(id: string) {
    if (!selectedWorkflow) return;
    try {
      await workflowsApi.removeStep(id);
      toast.success('Step deleted');
      loadWfSteps(selectedWorkflow.id);
    } catch { toast.error('Failed to delete step'); }
  }

  function toggleRole(role: string) {
    setStepForm(prev => ({
      ...prev,
      allowed_roles: prev.allowed_roles.includes(role) ? prev.allowed_roles.filter(r => r !== role) : [...prev.allowed_roles, role],
    }));
  }

  function toggleSelectAll() {
    if (selectedIds.size === paginatedRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRequests.map(r => r.id)));
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  async function handleBulkAction(action: 'approved' | 'rejected') {
    if (selectedIds.size === 0) { toast.error('No requests selected'); return; }
    setSaving(true);
    try {
      for (const id of selectedIds) {
        await approvalsApi.update(id, { status: action });
      }
      toast.success(`${selectedIds.size} requests ${action}`);
      setSelectedIds(new Set());
      load();
    } catch { toast.error('Bulk action failed'); } finally { setSaving(false); }
  }

  async function save() {
    setFormError('');
    if (!form.title_en.trim()) { setFormError('Title is required'); return; }
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const userId = user?.user?.id;
      if (!userId) { setFormError('Not authenticated'); return; }

      const newReq = await approvalsApi.create({
        title_en: form.title_en, title_ar: form.title_ar || undefined,
        module_code: form.module_code, status: 'pending',
        description: form.description || undefined,
        project_id: form.project_id || undefined, approver_id: form.approver_id || undefined,
        ref_record_id: form.ref_record_id || undefined,
        due_date: form.due_date || undefined, department: form.department || undefined,
        template_id: form.template_id || undefined,
        requested_by: userId, current_step: 1, total_steps: 1,
      } as any);

      const wfDefs = await workflowsApi.list(form.module_code);
      const defaultWf = wfDefs.find(w => w.is_default) || wfDefs[0];
      const wfSteps = defaultWf ? await workflowsApi.getSteps(defaultWf.id) : [];

      if (wfSteps.length > 0) {
        const { data: us } = await supabase.from('user_profiles').select('id, role').eq('is_active', true);
        const allUsers = (us || []) as { id: string; role: string }[];
        let stepOrder = 1;
        for (const ws of wfSteps) {
          const roles = ws.allowed_roles || [];
          const candidates = allUsers.filter(u => roles.includes(u.role));
          const assignedUsers = candidates.length > 0 ? candidates.map(c => c.id) : roles.length > 0 ? roles : ['approver'];
          for (const uid of assignedUsers) {
            await approvalsApi.createStep({ approval_request_id: newReq.id, step_order: stepOrder, step_role: roles[0] || 'approver', step_user_id: uid.length === 36 ? uid : undefined, status: 'pending' });
            stepOrder++;
          }
        }
        await approvalsApi.update(newReq.id, { total_steps: stepOrder - 1 });
      } else if (form.approver_id) {
        await approvalsApi.createStep({ approval_request_id: newReq.id, step_order: 1, step_user_id: form.approver_id, step_role: 'approver', status: 'pending' });
      }

      toast.success(`Approval "${form.title_en}" created`);
      setShowForm(false);
      setForm({ title_en: '', title_ar: '', module_code: 'quality', project_id: '', approver_id: '', ref_record_id: '', description: '', due_date: '', department: '', template_id: '' });
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function handleStepAction(stepId: string, action: 'approved' | 'rejected') {
    setSaving(true);
    try {
      await approvalsApi.updateStep(stepId, { status: action, decided_at: new Date().toISOString(), decided_by: currentUserId || undefined, acted_by: currentUserId || undefined });
      if (selectedRequest && currentUserId) {
        const currentStep = selectedRequest.current_step || 1;
        const totalSteps = selectedRequest.total_steps || 1;
        if (action === 'rejected') {
          await approvalsApi.update(selectedRequest.id, { status: 'rejected' });
          toast.error('Request rejected');
        } else if (currentStep >= totalSteps) {
          await approvalsApi.update(selectedRequest.id, { status: 'approved', current_step: totalSteps });
          toast.success('Request fully approved');
          if (selectedRequest.ref_record_id && selectedRequest.module_code) {
            const tbl = tableMap[selectedRequest.module_code];
            if (tbl) {
              let q = supabase.from(tbl).update({ status: 'approved' }).eq('id', selectedRequest.ref_record_id);
              if (selectedRequest.module_code === 'quality') q = q.eq('is_ncr', true);
              await q;
            }
            try { await supabase.from('approval_activity_results').insert({ approval_request_id: selectedRequest.id, activity_id: null, unit_id: null, quantity_approved: 1, notes: 'Auto-approved' }); } catch { /* ignore */ }
          }
        } else {
          await approvalsApi.update(selectedRequest.id, { status: 'in_progress', current_step: currentStep + 1 });
          toast.success(`Step ${currentStep} approved → step ${currentStep + 1}`);
        }
        await loadSteps(selectedRequest.id);
        load();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally { setSaving(false); }
  }

  const importConfig: SyncConfig = {
    table: 'approval_requests',
    columns: [{ key: 'request_no', label: 'Request No', required: true }, { key: 'title_en', label: 'Title', required: true }, { key: 'module_code', label: 'Module' }, { key: 'status', label: 'Status' }],
    defaults: { status: 'pending', module_code: 'approvals' },
  };

  const paginatedRequests = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const TemplatesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Approval Templates</h3>
        {hasPermission('approvals', 'create') && <button className="btn-sm btn-primary" onClick={() => openTemplateForm()}><Plus size={14} /> New Template</button>}
      </div>
      {templates.length === 0 ? (
        <EmptyState title="No templates" description="Save approval templates for reuse" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(tpl => (
            <div key={tpl.id} className="card p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{tpl.name_en}</p>
                  {tpl.name_ar && <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{tpl.name_ar}</p>}
                </div>
                {tpl.is_default && <span className="badge badge-info text-[10px]">Default</span>}
              </div>
              <div className="flex gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="capitalize">{tpl.module_code}</span>
                {tpl.project_id && <span>· {(projects.find(p => p.id === tpl.project_id))?.project_code || 'Project'}</span>}
                {tpl.department && <span>· {tpl.department}</span>}
              </div>
              <div className="flex gap-2 mt-2">
                <button className="btn-sm btn-primary flex-1" onClick={() => handleTemplateApply(tpl)}><Copy size={12} /> Use</button>
                {hasPermission('approvals', 'edit') && (
                  <>
                    <button className="btn-sm btn-secondary" onClick={() => openTemplateForm(tpl)}><Edit3 size={12} /></button>
                    <button className="btn-sm btn-secondary" onClick={() => setShowDeleteConfirm(tpl.id)}><Trash2 size={12} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(null)}>
          <div className="rounded-xl p-6 w-full max-w-sm shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Are you sure you want to delete this template?</p>
            <div className="flex gap-2 mt-6">
              <button className="btn-primary btn-sm" style={{ backgroundColor: 'var(--color-danger)' }} onClick={() => deleteTemplate(showDeleteConfirm)}><Trash2 size={14} /> Delete</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowTemplateForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingTemplate ? 'Edit Template' : 'New Template'}</h3>
              <button onClick={() => setShowTemplateForm(false)}><XCircle size={20} style={{ color: 'var(--color-text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Name *</label><input className="input" value={templateForm.name_en} onChange={e => setTemplateForm({...templateForm, name_en: e.target.value})} /></div>
              <div><label className="label">Name (Arabic)</label><input className="input" value={templateForm.name_ar} onChange={e => setTemplateForm({...templateForm, name_ar: e.target.value})} /></div>
              <div><label className="label">Module</label>
                <select className="input" value={templateForm.module_code} onChange={e => setTemplateForm({...templateForm, module_code: e.target.value})}>
                  {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div><label className="label">Project</label>
                <select className="input" value={templateForm.project_id} onChange={e => setTemplateForm({...templateForm, project_id: e.target.value})}>
                  <option value="">— Any —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Department</label>
                <select className="input" value={templateForm.department} onChange={e => setTemplateForm({...templateForm, department: e.target.value})}>
                  <option value="">— Any —</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><label className="label">Workflow</label>
                <select className="input" value={templateForm.workflow_id} onChange={e => setTemplateForm({...templateForm, workflow_id: e.target.value})}>
                  <option value="">— None —</option>
                  {workflows.map(w => <option key={w.id} value={w.id}>{w.name_en}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tpl-default" checked={templateForm.is_default} onChange={e => setTemplateForm({...templateForm, is_default: e.target.checked})} />
                <label htmlFor="tpl-default" className="text-sm">Default template</label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button className="btn-primary btn-sm" onClick={saveTemplate}><Save size={14} /> {editingTemplate ? 'Update' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowTemplateForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const DashboardTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="stat-glass"><BarChart3 size={20} className="text-primary" /><div><p className="stat-label">Total</p><p className="stat-value">{requests.length}</p></div></div>
        <div className="stat-glass"><FileText size={20} className="text-amber-500" /><div><p className="stat-label">Pending</p><p className="stat-value">{pendingCount}</p></div></div>
        <div className="stat-glass"><ThumbsUp size={20} className="text-green-500" /><div><p className="stat-label">Approved</p><p className="stat-value">{approvedCount}</p></div></div>
        <div className="stat-glass"><XCircle size={20} className="text-red-500" /><div><p className="stat-label">Rejected</p><p className="stat-value">{rejectedCount}</p></div></div>
        <div className="stat-glass"><User size={20} className="text-blue-500" /><div><p className="stat-label">My Pending</p><p className="stat-value">{myPendingCount}</p></div></div>
        <div className="stat-glass"><AlertTriangle size={20} className="text-red-500" /><div><p className="stat-label">Overdue</p><p className="stat-value">{overdueCount}</p></div></div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Building2 size={16} /> Department Managers</h3>
          {hasPermission('approvals', 'create') && <button className="btn-sm btn-primary" onClick={() => openDeptManagerModal()}><Plus size={14} /> Add Dept Manager</button>}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Department</th><th>Manager</th><th>Deputy</th><th></th></tr></thead>
            <tbody>
              {deptManagers.length === 0 ? <tr><td colSpan={4}><EmptyState title="No department managers" description="Add department managers to organize approvals" /></td></tr>
              : deptManagers.map(dm => (
                <tr key={dm.id}>
                  <td className="font-medium text-sm">{dm.department}</td>
                  <td className="text-sm">{dm.manager_name || dm.manager_id.slice(0, 8)}</td>
                  <td className="text-sm">{dm.deputy_name || (dm.deputy_id ? dm.deputy_id.slice(0, 8) : '—')}</td>
                  <td>
                    {hasPermission('approvals', 'edit') && (
                      <div className="flex gap-1">
                        <button className="btn-sm btn-secondary" onClick={() => openDeptManagerModal(dm)}><Edit3 size={12} /></button>
                        <button className="btn-sm btn-secondary" onClick={() => deleteDeptManager(dm.id)}><Trash2 size={12} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Settings size={16} /> Workflows</h3>
          {hasPermission('approvals', 'create') && <button className="btn-sm btn-primary" onClick={() => openWorkflowForm()}><Plus size={14} /> New Workflow</button>}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            {workflows.length === 0 ? <EmptyState title="No workflows" description="Define approval workflows" />
            : <div className="space-y-2">{workflows.map(wf => (
              <div key={wf.id} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${selectedWorkflow?.id === wf.id ? '' : ''}`}
                style={{ backgroundColor: selectedWorkflow?.id === wf.id ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'var(--color-surface)' }}
                onClick={() => setSelectedWorkflow(wf)}>
                <div>
                  <p className="text-sm font-medium">{wf.name_en}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{wf.name_ar}</p>
                </div>
                <div className="flex items-center gap-2">
                  {wf.is_default && <span className="badge badge-info text-[10px]">Default</span>}
                  <ChevronRight size={14} style={{ color: 'var(--color-text-secondary)' }} />
                </div>
              </div>
            ))}</div>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Steps {selectedWorkflow ? `— ${selectedWorkflow.name_en}` : ''}</h4>
              {selectedWorkflow && hasPermission('approvals', 'create') && (
                <div className="flex gap-1">
                  <button className="btn-sm btn-primary" onClick={() => openStepForm()}><Plus size={12} /> Step</button>
                  <button className="btn-sm btn-secondary" onClick={() => openWorkflowForm(selectedWorkflow)}><Edit3 size={12} /></button>
                  <button className="btn-sm btn-secondary" onClick={() => deleteWorkflow(selectedWorkflow.id)}><Trash2 size={12} /></button>
                </div>
              )}
            </div>
            {!selectedWorkflow ? <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Select a workflow</p>
            : wfSteps.length === 0 ? <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>No steps defined</p>
            : <div className="space-y-2">{wfSteps.map((s, _i) => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
                <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium shrink-0" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>{s.step_order}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{s.action_label_en}</p>
                    {hasPermission('approvals', 'edit') && (
                      <div className="flex gap-1">
                        <button className="btn-sm btn-secondary" onClick={() => openStepForm(s)}><Edit3 size={11} /></button>
                        <button className="btn-sm btn-secondary" onClick={() => deleteStep(s.id)}><Trash2 size={11} /></button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {s.from_status_code || '*'}{' → '}{s.to_status_code || '*'}
                    {s.allowed_roles?.length > 0 && <span> · Roles: {s.allowed_roles.join(', ')}</span>}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {s.require_attachment && <span className="flex items-center gap-1"><Shield size={10} /> Attachment</span>}
                    {s.require_comment && <span className="flex items-center gap-1"><Shield size={10} /> Comment</span>}
                  </div>
                </div>
              </div>
            ))}</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Clock size={16} /> Recent Requests</h3>
            <button className="btn-sm btn-secondary" onClick={() => setTab('requests')}>View All <ChevronRight size={14} /></button>
          </div>
          {loading ? <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
            : requests.length === 0 ? <EmptyState title="No requests yet" description="Create your first approval request" actionLabel="New Request" onAction={() => { setFormError(''); setShowForm(true); }} />
            : <div className="space-y-2">{requests.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg clickable" style={{ backgroundColor: 'var(--color-surface)' }} onClick={() => { setSelectedRequest(r); setTab('requests'); }}>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{r.title_en}</p><div className="flex gap-2 mt-1"><span className="text-[10px] font-mono" style={{ color: 'var(--color-text-secondary)' }}>{r.request_no || '—'}</span><span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{r.module_code}</span></div></div>
                <div className="flex items-center gap-2 shrink-0">{statusBadge(r.status)}<ChevronRight size={14} style={{ color: 'var(--color-text-secondary)' }} /></div>
              </div>
            ))}</div>}
        </div>
        <div className="card">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {hasPermission('approvals', 'create') && <button className="btn-primary flex items-center justify-center gap-2 py-3" onClick={() => { setFormError(''); setShowForm(true); }}><Plus size={18} /> New Request</button>}
            <button className="btn-secondary flex items-center justify-center gap-2 py-3" onClick={() => setTab('templates')}><FolderOpen size={18} /> Templates</button>
            <button className="btn-secondary flex items-center justify-center gap-2 py-3" onClick={() => { if (requests.length) exportCSV(requests as any[], `approvals_${new Date().toISOString().slice(0, 10)}.csv`); }}><Download size={18} /> Export All</button>
            <button className="btn-secondary flex items-center justify-center gap-2 py-3" onClick={load}><RefreshCw size={18} /> Refresh</button>
          </div>
          <div className="mt-6">
            <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>Summary by Module</h4>
            <div className="space-y-2">{MODULES.map(m => { const cnt = requests.filter(r => r.module_code === m).length; if (!cnt) return null; return <div key={m} className="flex items-center justify-between text-sm px-1"><span className="capitalize">{m}</span><span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>{cnt}</span></div>; })}</div>
          </div>
        </div>
      </div>

      {showDeptManagerModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowDeptManagerModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingDeptManager ? 'Edit Department Manager' : 'Add Department Manager'}</h3>
              <button onClick={() => setShowDeptManagerModal(false)}><XCircle size={20} style={{ color: 'var(--color-text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Department *</label><input className="input" value={deptManagerForm.department} onChange={e => setDeptManagerForm({...deptManagerForm, department: e.target.value})} placeholder="e.g. Engineering" /></div>
              <div><label className="label">Manager *</label>
                <select className="input" value={deptManagerForm.manager_id} onChange={e => setDeptManagerForm({...deptManagerForm, manager_id: e.target.value})}>
                  <option value="">— Select Manager —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Deputy</label>
                <select className="input" value={deptManagerForm.deputy_id} onChange={e => setDeptManagerForm({...deptManagerForm, deputy_id: e.target.value})}>
                  <option value="">— Select Deputy —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button className="btn-primary btn-sm" onClick={saveDeptManager}><Save size={14} /> {editingDeptManager ? 'Update' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowDeptManagerModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showWorkflowForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowWorkflowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{selectedWorkflow ? 'Edit Workflow' : 'New Workflow'}</h3>
              <button onClick={() => setShowWorkflowForm(false)}><XCircle size={20} style={{ color: 'var(--color-text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Name *</label><input className="input" value={workflowForm.name_en} onChange={e => setWorkflowForm({...workflowForm, name_en: e.target.value})} /></div>
              <div><label className="label">Name (Arabic)</label><input className="input" value={workflowForm.name_ar} onChange={e => setWorkflowForm({...workflowForm, name_ar: e.target.value})} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="wf-default" checked={workflowForm.is_default} onChange={e => setWorkflowForm({...workflowForm, is_default: e.target.checked})} />
                <label htmlFor="wf-default" className="text-sm">Default workflow</label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button className="btn-primary btn-sm" onClick={saveWorkflow}><Save size={14} /> {selectedWorkflow ? 'Update' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowWorkflowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showStepForm && selectedWorkflow && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowStepForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingStep ? 'Edit Step' : 'Add Step'} — {selectedWorkflow.name_en}</h3>
              <button onClick={() => setShowStepForm(false)}><XCircle size={20} style={{ color: 'var(--color-text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Step Order</label><input type="number" className="input" value={stepForm.step_order} onChange={e => setStepForm({...stepForm, step_order: parseInt(e.target.value) || 1})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">From Status</label><input className="input" value={stepForm.from_status_code} onChange={e => setStepForm({...stepForm, from_status_code: e.target.value})} placeholder="e.g. pending" /></div>
                <div><label className="label">To Status</label><input className="input" value={stepForm.to_status_code} onChange={e => setStepForm({...stepForm, to_status_code: e.target.value})} placeholder="e.g. approved" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Action Label *</label><input className="input" value={stepForm.action_label_en} onChange={e => setStepForm({...stepForm, action_label_en: e.target.value})} placeholder="e.g. Review & Approve" /></div>
                <div><label className="label">Action Label (Arabic)</label><input className="input" value={stepForm.action_label_ar} onChange={e => setStepForm({...stepForm, action_label_ar: e.target.value})} /></div>
              </div>
              <div><label className="label">Allowed Roles *</label>
                <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto p-2 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  {roles.map(role => (
                    <label key={role} className="flex items-center gap-2 text-sm cursor-pointer px-1 py-0.5">
                      <input type="checkbox" checked={stepForm.allowed_roles.includes(role)} onChange={() => toggleRole(role)} />
                      <span>{role.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={stepForm.require_attachment} onChange={e => setStepForm({...stepForm, require_attachment: e.target.checked})} />
                  Require Attachment
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={stepForm.require_comment} onChange={e => setStepForm({...stepForm, require_comment: e.target.checked})} />
                  Require Comment
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button className="btn-primary btn-sm" onClick={saveStep}><Save size={14} /> {editingStep ? 'Update' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowStepForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const RequestsTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold">Requests {filteredCount > 0 && <span className="text-sm font-normal" style={{ color: 'var(--color-text-secondary)' }}>({filteredCount})</span>}</h3>
          <div className="flex gap-2 flex-wrap">
            {hasPermission('approvals', 'create') && <button className="btn-sm btn-primary" onClick={() => { setFormError(''); setShowForm(true); }}><Plus size={14} /> New</button>}
            <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as any[], `approvals.csv`); }}><Download size={14} /> Export</button>
            <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}><Upload size={14} /> Import</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[140px]"><Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} /><input className="input ps-8 text-sm" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <select className="input text-sm w-auto" value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}><option value="">All Modules</option>{MODULES.map(m => <option key={m} value={m}>{m}</option>)}</select>
          <select className="input text-sm w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">All Status</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
          <select className="input text-sm w-auto" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}><option value="">All Projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_code}</option>)}</select>
          <select className="input text-sm w-auto" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}><option value="">All Depts</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }}>
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <button className="btn-sm btn-primary" onClick={() => handleBulkAction('approved')} disabled={saving}><CheckCircle size={12} /> Approve All</button>
            <button className="btn-sm btn-secondary" style={{ color: 'var(--color-danger)' }} onClick={() => handleBulkAction('rejected')} disabled={saving}><XCircle size={12} /> Reject All</button>
            <button className="btn-sm btn-secondary" onClick={() => setSelectedIds(new Set())}>Clear</button>
          </div>
        )}
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th className="w-8"><button onClick={toggleSelectAll} className="p-1">{selectedIds.size === paginatedRequests.length && paginatedRequests.length > 0 ? <CheckSquare size={14} /> : <Square size={14} />}</button></th>
              <th>No</th><th>Title</th><th>Module</th><th>Status</th><th>Due</th><th>Date</th><th></th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={8}><EmptyState title="No requests" description="Create an approval request to start the workflow." actionLabel="New Request" onAction={() => { setFormError(''); setShowForm(true); }} /></td></tr>
              : paginatedRequests.map(r => (
                <tr key={r.id} className={`${selectedRequest?.id === r.id ? 'bg-blue-50' : ''} clickable`} onClick={() => setSelectedRequest(r)}>
                  <td className="w-8" onClick={e => e.stopPropagation()}><button onClick={() => toggleSelect(r.id)} className="p-1">{selectedIds.has(r.id) ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}</button></td>
                  <td className="font-mono text-xs">{r.request_no || '—'}</td>
                  <td className="font-medium text-sm">{r.title_en}</td>
                  <td className="text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>{r.module_code}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td className="text-xs">{r.due_date ? <span className={new Date(r.due_date) < new Date() && r.status !== 'approved' ? 'text-red-500' : ''}>{formatDate(r.due_date)}</span> : '—'}</td>
                  <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(r.created_at)}</td>
                  <td><button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setSelectedRequest(r); }}><Eye size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
      </div>
      <div className="card space-y-4">
        <div className="flex items-center gap-2"><ListChecks size={18} className="text-primary" /><h3 className="font-semibold">Workflow Steps</h3></div>
        {!selectedRequest ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Select a request</p>
        ) : (
          <>
            <div className="p-3 rounded-lg text-sm space-y-1" style={{ backgroundColor: 'var(--color-surface)' }}>
              <div className="flex items-center justify-between">
                <p className="font-medium">{selectedRequest.request_no || '—'}</p>
                <button className="btn-sm btn-secondary p-1" onClick={() => setSelectedRequest(null)}><X size={12} /></button>
              </div>
              <p className="font-semibold">{selectedRequest.title_en}</p>
              <div className="flex gap-2 mt-1"><span className="text-[10px] capitalize px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)10', color: 'var(--color-primary)' }}>{selectedRequest.module_code}</span>{statusBadge(selectedRequest.status)}</div>
              {selectedRequest.description && <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{selectedRequest.description}</p>}
              <div className="flex gap-3 mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(selectedRequest.created_at)}</span>
                {(selectedRequest as ApprovalRequestEx).department && <span className="flex items-center gap-1"><Building2 size={11} /> {(selectedRequest as ApprovalRequestEx).department}</span>}
                {(selectedRequest as ApprovalRequestEx).due_date && <span className="flex items-center gap-1"><AlertTriangle size={11} /> Due: {formatDate((selectedRequest as ApprovalRequestEx).due_date)}</span>}
              </div>
              {selectedRequest.project_id && <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Project: {(projects.find(p => p.id === selectedRequest?.project_id))?.project_code || '—'}</p>}
            </div>
            <div className="space-y-0">
              {steps.length === 0 ? <div className="text-center py-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>No steps defined</div>
              : steps.map((step, idx) => {
                const isStepCurrent = step.step_order === (selectedRequest?.current_step || 1);
                const isPending = step.status === 'pending';
                const isLast = idx === steps.length - 1;
                const showActions = isPending && isStepCurrent && hasPermission('approvals', 'edit');
                return (
                  <div key={step.id} className="relative flex gap-4 pb-4">
                    {!isLast && <div className="absolute start-[11px] top-6 bottom-0 w-0.5" style={{ backgroundColor: step.status === 'approved' ? 'var(--color-success)' : 'var(--color-border)' }} />}
                    <div className="shrink-0 mt-1">
                      {step.status === 'approved' ? <CheckCircle size={22} className="text-green-500" />
                      : step.status === 'rejected' ? <XCircle size={22} className="text-red-500" />
                      : isStepCurrent ? <div className="w-[22px] h-[22px] rounded-full border-2 border-primary flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-primary" /></div>
                      : <div className="w-[22px] h-[22px] rounded-full border-2" style={{ borderColor: 'var(--color-border)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Step {step.step_order}</span>
                        <div className="flex items-center gap-2">{isStepCurrent && isPending && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-primary)10', color: 'var(--color-primary)' }}>Active</span>}{statusBadge(step.status)}</div>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}><User size={10} className="inline me-1" />{step.assigned_to_name || step.step_role}</p>
                      {step.step_role && <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Role: {step.step_role}</p>}
                      {step.comment && <p className="text-xs mt-1 italic" style={{ color: 'var(--color-text-secondary)' }}>"{step.comment}"</p>}
                      {step.decided_at && <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(step.decided_at)}</p>}
                      {step.acted_by_name && <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>by {step.acted_by_name}</p>}
                      {showActions && <div className="flex gap-2 mt-2"><button className="btn-sm text-xs btn-success flex items-center gap-1" onClick={() => handleStepAction(step.id, 'approved')} disabled={saving}><CheckCircle size={12} /> Approve</button><button className="btn-sm text-xs btn-danger flex items-center gap-1" onClick={() => handleStepAction(step.id, 'rejected')} disabled={saving}><XCircle size={12} /> Reject</button></div>}
                      {isPending && !isStepCurrent && step.step_order <= (selectedRequest?.current_step || 1) && <p className="text-xs mt-1 italic flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}><Clock size={10} /> Awaiting action</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Progress: {selectedRequest.current_step || 0} / {selectedRequest.total_steps || 0} steps</p>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('nav.approvals')}</h1><p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{pendingCount} pending · {approvedCount} approved · {rejectedCount} rejected {overdueCount > 0 && `· ${overdueCount} overdue`}</p></div>
      </div>
      <div className="flex gap-1 border-b pb-0" style={{ borderColor: 'var(--color-border)' }}>
        {(['dashboard', 'requests', 'templates'] as const).map(k => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === k ? 'text-primary border-primary' : 'border-transparent hover:text-gray-600'}`} style={{ color: tab === k ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
            {k === 'dashboard' ? <><BarChart3 size={14} className="inline me-1.5" />Dashboard</> : k === 'requests' ? <><ListChecks size={14} className="inline me-1.5" />Requests</> : <><FolderOpen size={14} className="inline me-1.5" />Templates</>}
          </button>
        ))}
      </div>
      {tab === 'dashboard' ? <DashboardTab /> : tab === 'templates' ? <TemplatesTab /> : <RequestsTab />}

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Approval Request</h3>
              <button onClick={() => setShowForm(false)}><XCircle size={20} style={{ color: 'var(--color-text-secondary)' }} /></button>
            </div>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Title *</label><input className="input" value={form.title_en} onChange={e => setForm({...form, title_en: e.target.value})} /></div>
                <div><label className="label">Title (Arabic)</label><input className="input" value={form.title_ar} onChange={e => setForm({...form, title_ar: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Project</label><select className="input" value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})}><option value="">— Select —</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}</select></div>
                <div><label className="label">Department</label><select className="input" value={form.department} onChange={e => setForm({...form, department: e.target.value})}><option value="">— Select —</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Module</label><select className="input" value={form.module_code} onChange={e => handleModuleChange(e.target.value)}>{MODULES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className="label">Due Date</label><input type="date" className="input" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
              </div>
              {refRecords.length > 0 && (
                <div><label className="label">Reference Record</label><select className="input" value={form.ref_record_id} onChange={e => setForm({...form, ref_record_id: e.target.value})}><option value="">— Select —</option>{refRecords.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
              )}
              <div><label className="label">Approver (Step 1)</label><select className="input" value={form.approver_id} onChange={e => setForm({...form, approver_id: e.target.value})}><option value="">— Select Approver —</option>{approvers.map(a => <option key={a.id} value={a.id}>{a.full_name_en}</option>)}</select></div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            </div>
            <div className="flex gap-2 mt-6">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : <><Send size={14} className="inline me-1" />Submit</>}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showImport && <CsvImportModal moduleName="Approvals" config={importConfig} onClose={() => { setShowImport(false); load(); }} />}
    </div>
  );
}
