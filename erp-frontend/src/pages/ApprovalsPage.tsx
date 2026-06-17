import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import EmptyState from '../components/EmptyState';
import { exportCSV } from '../utils/csv';
import { formatDate } from '../utils/date';
import CsvImportModal from '../components/CsvImportModal';
import { type SyncConfig } from '../services/syncService';
import { Plus, Download, Upload, Search, CheckCircle, XCircle, Eye, EyeOff, ListChecks } from 'lucide-react';
import Pagination from '../components/Pagination';

interface Approval {
  id: string; request_no: string; title_en: string; module_code: string;
  status: string; requested_by: string; created_at: string; description: string;
  project_id: string; approver_id: string; ref_record_id: string;
}

interface ApprovalStep {
  id: string; approval_request_id: string; step_order: number;
  step_user_id: string; step_role: string; status: string;
  comments: string; decided_at: string;
  acted_by?: string; assigned_to_name?: string; acted_by_name?: string;
}

export default function ApprovalsPage() {
  const t = useT();
  const toast = useToast();
  const [requests, setRequests] = useState<Approval[]>([]);
  const [projects, setProjects] = useState<{ id: string; name_en: string; project_code: string }[]>([]);
  const [approvers, setApprovers] = useState<{ id: string; full_name_en: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [form, setForm] = useState({ request_no: '', title_en: '', module_code: 'quality', description: '', project_id: '', approver_id: '', ref_record_id: '' });
  const [refRecords, setRefRecords] = useState<{ id: string; label: string }[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Approval | null>(null);
  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  useEffect(() => {
    if (selectedRequest) loadSteps(selectedRequest.id);
    else setSteps([]);
  }, [selectedRequest]);
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id;

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  async function load() {
    setLoading(true);
    try {
      const [reqRes, projRes, apprRes] = await Promise.all([
        supabase.from('approval_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
        supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
      ]);
      setRequests((reqRes.data || []) as Approval[]);
      setProjects((projRes.data || []) as { id: string; name_en: string; project_code: string }[]);
      setApprovers((apprRes.data || []) as { id: string; full_name_en: string }[]);
    } catch (err) {
      console.error('Failed to load approvals data:', err);
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  const filtered = requests.filter((r) => !debouncedSearch ||
    r.request_no?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    r.title_en?.toLowerCase().includes(debouncedSearch.toLowerCase()));

  async function loadRefRecords(moduleCode: string) {
    const tableMap: Record<string, string> = {
      quality: 'work_requests', hse: 'safety_incidents', hr: 'employees',
      procurement: 'purchase_orders', finance: 'contract_invoices',
      sales: 'leads', technical: 'technical_tickets', documents: 'documents',
      execution: 'work_requests',
    };
    const tbl = tableMap[moduleCode];
    if (!tbl) { setRefRecords([]); return; }
    let query = supabase.from(tbl).select('id, title_en, title, name_en, full_name_en');
    if (moduleCode === 'quality') query = query.eq('is_ncr', true);
    const { data } = await query.limit(50);
    if (data) {
      setRefRecords(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        label: (r.title_en || r.title || r.name_en || r.full_name_en || r.id) as string,
      })));
    }
  }

  function handleModuleChange(moduleCode: string) {
    setForm({ ...form, module_code: moduleCode, ref_record_id: '' });
    loadRefRecords(moduleCode);
  }

  async function save() {
    setFormError('');
    if (!form.request_no.trim()) { setFormError('Request No is required'); return; }
    if (!form.title_en.trim()) { setFormError('Title is required'); return; }
    setSaving(true);
    try {
      const { data: newReq, error } = await supabase.from('approval_requests').insert({
        request_no: form.request_no, title_en: form.title_en,
        module_code: form.module_code, status: 'pending',
        description: form.description || null, project_id: form.project_id || null,
        approver_id: form.approver_id || null, ref_record_id: form.ref_record_id || null,
        requested_by: (await supabase.auth.getUser()).data.user?.id,
      }).select('id').single();
      if (error) throw error;

      // Workflow enforcement: auto-create approval_steps
      if (form.approver_id && newReq) {
        await supabase.from('approval_steps').insert({
          approval_request_id: newReq.id, step_order: 1,
          step_user_id: form.approver_id, step_role: 'approver',
          status: 'pending',
        });
      }

      toast.success(`Approval "${form.request_no}" created`);
      setShowForm(false); setForm({ request_no: '', title_en: '', module_code: 'quality', description: '', project_id: '', approver_id: '', ref_record_id: '' }); load();
    } catch (err: unknown) {
      console.error('Approval save failed:', err);
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function loadSteps(requestId: string) {
    const [stepsRes, usersRes] = await Promise.all([
      supabase.from('approval_steps')
        .select('*').eq('approval_request_id', requestId).order('step_order'),
      supabase.from('user_profiles').select('id, full_name_en'),
    ]);
    const users = (usersRes.data || []) as { id: string; full_name_en: string }[];
    const steps = ((stepsRes.data || []) as ApprovalStep[]).map(s => ({
      ...s,
      assigned_to_name: users.find(u => u.id === s.step_user_id)?.full_name_en || undefined,
      acted_by_name: s.acted_by ? (users.find(u => u.id === s.acted_by)?.full_name_en || undefined) : undefined,
    }));
    setSteps(steps);
  }

  function viewRequest(req: Approval) {
    setSelectedRequest(req);
  }

  async function handleStepAction(stepId: string, action: 'approved' | 'rejected') {
    setSaving(true);
    try {
      const { error } = await supabase.from('approval_steps').update({
        status: action, decided_at: new Date().toISOString(),
        acted_by: (await supabase.auth.getUser()).data.user?.id,
      }).eq('id', stepId);
      if (error) throw error;

      // Update parent request status
      if (selectedRequest) {
        const newStatus = action === 'rejected' ? 'rejected' : 'approved';
        await supabase.from('approval_requests').update({ status: newStatus }).eq('id', selectedRequest.id).select();

        // Update referenced record status
        if (selectedRequest.ref_record_id && selectedRequest.module_code) {
          const tableMap: Record<string, string> = {
            quality: 'work_requests', hse: 'safety_incidents', hr: 'employees',
            procurement: 'purchase_orders', finance: 'contract_invoices',
            sales: 'leads', technical: 'technical_tickets', documents: 'documents',
            execution: 'work_requests',
          };
          const tbl = tableMap[selectedRequest.module_code];
          if (tbl) {
            let updateQuery = supabase.from(tbl).update({ status: newStatus }).eq('id', selectedRequest.ref_record_id);
            if (selectedRequest.module_code === 'quality') updateQuery = updateQuery.eq('is_ncr', true);
            await updateQuery;
          }
        }

        // If approved, link to activity progress via approval_activity_results
        if (action === 'approved' && selectedRequest.ref_record_id) {
          try {
            await supabase.from('approval_activity_results').insert({
              approval_request_id: selectedRequest.id,
              activity_id: null, unit_id: null, quantity_approved: 1,
              notes: 'Auto-approved via workflow',
            });
          } catch {
            // Silently skip if table/ref not available
          }
        }

        toast.success(`Step ${action}`);
        await loadSteps(selectedRequest.id);
        load();
      }
    } catch (err: unknown) {
      console.error('Step action failed:', err);
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally { setSaving(false); }
  }

  const columns = [
    { key: 'request_no', label: 'Request No', required: true },
    { key: 'title_en', label: 'Title', required: true },
    { key: 'module_code', label: 'Module' },
    { key: 'status', label: 'Status' },
    { key: 'requested_by', label: 'Requested By' },
  ];

  const importConfig: SyncConfig = {
    table: 'approval_requests',
    columns: [
      { key: 'request_no', label: 'Request No', required: true },
      { key: 'title_en', label: 'Title', required: true },
      { key: 'module_code', label: 'Module' },
      { key: 'status', label: 'Status' },
    ],
    defaults: { status: 'pending', module_code: 'approvals' },
  };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('nav.approvals')}</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{requests.length} Requests</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as unknown as Record<string, unknown>[], `approvals_${new Date().toISOString().slice(0, 10)}.csv`); }}><Download size={14} /> Export</button>
          <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}><Upload size={14} /> Import</button>
          <button className="btn-primary btn-sm" onClick={() => { setFormError(''); setShowForm(true); }}><Plus size={16} /> New Request</button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
        <input className="input ps-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requests list */}
        <div className="lg:col-span-2 card">
          <h3 className="font-semibold mb-3">Approval Requests</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Request No</th><th>Title</th><th>Module</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <EmptyState title="No approval requests" description="Create an approval request to start the workflow." actionLabel="New Request" onAction={() => { setFormError(''); setShowForm(true); }} />
                ) : (
                  filtered.slice((page - 1) * pageSize, page * pageSize).map(r => (
                    <tr key={r.id} className={`${selectedRequest?.id === r.id ? 'bg-blue-50' : ''} clickable`} onClick={() => viewRequest(r)}>
                      <td className="font-mono text-xs">{r.request_no}</td>
                      <td className="font-medium text-sm">{r.title_en}</td>
                      <td className="text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>{r.module_code}</td>
                      <td><span className={`badge text-xs ${r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{r.status}</span></td>
                      <td>
                        <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); viewRequest(r); }} title="View Details">
                          {selectedRequest?.id === r.id ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
        </div>

        {/* Detail panel */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <ListChecks size={18} className="text-primary" />
            <h3 className="font-semibold">Workflow Steps</h3>
          </div>

          {!selectedRequest ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Select a request to view steps</p>
          ) : (
            <>
              <div className="p-3 rounded-lg text-sm space-y-1" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}>
                <p className="font-medium" style={{ color: 'var(--color-text)' }}>{selectedRequest.request_no}</p>
                <p style={{ color: 'var(--color-text-secondary)' }}>{selectedRequest.title_en}</p>
                <span className={`badge text-xs mt-1 ${selectedRequest.status === 'approved' ? 'badge-success' : selectedRequest.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{selectedRequest.status}</span>
              </div>

              <div className="space-y-2">
                {steps.length === 0 ? (
                  <div className="text-center py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>No workflow steps defined</div>
                ) : (
                  steps.map((step, idx) => {
                    const isCurrentUser = currentUserId === step.step_user_id;
                    const isPending = step.status === 'pending';
                    return (
                      <div key={step.id} className={`p-3 rounded-lg border text-sm ${step.status === 'approved' ? 'border-green-200' : step.status === 'rejected' ? 'border-red-200' : 'border-gray-200'}`} style={step.status !== 'approved' && step.status !== 'rejected' ? { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' } : {}}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">Step {step.step_order}</span>
                          <span className={`badge text-xs ${step.status === 'approved' ? 'badge-success' : step.status === 'rejected' ? 'badge-danger' : 'badge'}`}>{step.status}</span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{step.assigned_to_name || step.step_user_id?.slice(0, 8)}</p>
                        {step.comments && <p className="text-xs mt-1 italic" style={{ color: 'var(--color-text-secondary)' }}>"{step.comments}"</p>}
                        {step.decided_at && <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(step.decided_at)}</p>}
                        {step.acted_by_name && <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>by {step.acted_by_name}</p>}
                        {isPending && isCurrentUser && (
                          <div className="flex gap-1 mt-2">
                            <button className="btn-sm text-xs btn-success" onClick={() => handleStepAction(step.id, 'approved')} disabled={saving}><CheckCircle size={12} /> Approve</button>
                            <button className="btn-sm text-xs btn-danger" onClick={() => handleStepAction(step.id, 'rejected')} disabled={saving}><XCircle size={12} /> Reject</button>
                          </div>
                        )}
                        {isPending && !isCurrentUser && (
                          <p className="text-xs mt-1 italic" style={{ color: 'var(--color-text-secondary)' }}>Awaiting action from {step.assigned_to_name || '—'}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Approval Request</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Request No *</label><input className="input" value={form.request_no} onChange={e => setForm({ ...form, request_no: e.target.value })} /></div>
              <div><label className="label">Title *</label><input className="input" value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} /></div>
              <div><label className="label">Project</label>
                <select className="input" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">-- Select Project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Module</label>
                <select className="input" value={form.module_code} onChange={e => handleModuleChange(e.target.value)}>
                  {['quality','hse','hr','procurement','finance','sales','technical','documents','execution'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {refRecords.length > 0 && (
                <div><label className="label">Reference Record</label>
                  <select className="input" value={form.ref_record_id} onChange={e => setForm({ ...form, ref_record_id: e.target.value })}>
                    <option value="">-- Select Record --</option>
                    {refRecords.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
              )}
              <div><label className="label">Approver (Step 1)</label>
                <select className="input" value={form.approver_id} onChange={e => setForm({ ...form, approver_id: e.target.value })}>
                  <option value="">-- Select Approver --</option>
                  {approvers.map(a => <option key={a.id} value={a.id}>{a.full_name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImport && <CsvImportModal moduleName="Approvals" config={importConfig} onClose={() => { setShowImport(false); load(); }} />}
    </div>
  );
}
