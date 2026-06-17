import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Edit3, XCircle, CheckCircle, Send, RotateCcw, Clock } from 'lucide-react';

interface WorkRequest {
  id: string; wir_no: string; title_en: string; title_ar: string;
  status: string; is_ncr: boolean; request_date: string;
  location: string; project_id: string; description: string;
  discipline: string; inspection_date: string; contractor: string;
  priority: string; requested_by: string; activity_id: string;
  inspector: string; ncr_reason: string;
  item_definition_id: string; unit_id: string;
  qc_approved: boolean; qc_approved_by: string; qc_approved_at: string;
  consultant_approved: boolean; consultant_approved_by: string; consultant_approved_at: string;
  pm_approved: boolean; pm_approved_by: string; pm_approved_at: string;
  rejection_reason: string;
  created_at: string;
  division: string; sub_division: string; activity: string;
  activity_weight: number; zone: string; block: string;
  qc_engineer_id: string; consultant_engineer_id: string;
}

interface TimelineEntry {
  label: string;
  date: string;
  user?: string;
  type: 'created' | 'submitted' | 'approved' | 'rejected' | 'resubmitted';
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'badge' },
  pending_qc: { label: 'Pending QC', color: 'badge-warning' },
  pending_consultant: { label: 'Pending Consultant', color: 'badge-warning' },
  pending_pm: { label: 'Pending PM', color: 'badge-warning' },
  approved: { label: 'Approved', color: 'badge-success' },
  rejected: { label: 'Rejected', color: 'badge-danger' },
};

export default function WIRDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const toast = useToast();
  const { user: authUser } = useAuth();
  const [wir, setWir] = useState<WorkRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<WorkRequest>>({});
  const [activities, setActivities] = useState<{ id: string; code: string; name_en: string }[]>([]);
  const [itemDefinitions, setItemDefinitions] = useState<{ id: string; activity: string; wbs_code: string; division: string; sub_division: string }[]>([]);

  const [units, setUnits] = useState<{ id: string; unit_code: string; zone: string; block: string }[]>([]);
  const [inspectors, setInspectors] = useState<{ id: string; display_name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string; role: string }[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      supabase.from('work_requests').select('*').eq('id', id).single(),
      supabase.from('activity_definitions').select('id, code, name_en').eq('is_active', true).order('name_en'),
      supabase.from('item_definitions').select('id, activity, wbs_code, division, sub_division').order('activity'),
      supabase.from('units').select('id, unit_code, zone, block').order('unit_code'),
      supabase.from('user_profiles').select('id, display_name').order('display_name'),
      supabase.from('user_profiles').select('id, display_name, role'),
    ]).then(([wirRes, actRes, itemDefRes, unitsRes, inspRes, profRes]) => {
      setWir(wirRes.data as WorkRequest | null);
      setForm(wirRes.data as WorkRequest || {});
      setActivities(actRes.data as { id: string; code: string; name_en: string }[] || []);
      setItemDefinitions(itemDefRes.data as { id: string; activity: string; wbs_code: string; division: string; sub_division: string }[] || []);
      setUnits(unitsRes.data as { id: string; unit_code: string; zone: string; block: string }[] || []);
      setInspectors(inspRes.data as { id: string; display_name: string }[] || []);
      setProfiles(profRes.data as { id: string; display_name: string; role: string }[] || []);
      setLoading(false);
    });
  }, [id]);

  const currentUserRole = authUser?.role || '';
  const currentUserId = authUser?.id || '';

  function getProfileName(userId?: string) {
    if (!userId) return '-';
    return profiles.find(p => p.id === userId)?.display_name || userId.slice(0, 8);
  }

  function buildTimeline(): TimelineEntry[] {
    if (!wir) return [];
    const entries: TimelineEntry[] = [];
    entries.push({ label: 'Created', date: wir.created_at || wir.request_date, type: 'created' });

    if (wir.status !== 'draft' && wir.request_date) {
      entries.push({ label: 'Submitted', date: wir.created_at, type: 'submitted' });
    }

    if (wir.qc_approved_at) {
      entries.push({
        label: 'QC Approved', date: wir.qc_approved_at,
        user: getProfileName(wir.qc_approved_by), type: 'approved',
      });
    }
    if (wir.consultant_approved_at) {
      entries.push({
        label: 'Consultant Approved', date: wir.consultant_approved_at,
        user: getProfileName(wir.consultant_approved_by), type: 'approved',
      });
    }
    if (wir.pm_approved_at) {
      entries.push({
        label: 'PM Approved', date: wir.pm_approved_at,
        user: getProfileName(wir.pm_approved_by), type: 'approved',
      });
    }
    if (wir.status === 'rejected' && wir.rejection_reason) {
      entries.push({
        label: 'Rejected', date: new Date().toISOString(),
        user: wir.qc_approved_by ? getProfileName(wir.qc_approved_by) : undefined,
        type: 'rejected',
      });
    }

    return entries;
  }

  const timeline = buildTimeline();

  function canUserApprove(): boolean {
    if (!wir) return false;
    if (wir.status === 'pending_qc' && currentUserRole === 'quality') return true;
    if (wir.status === 'pending_consultant' && currentUserRole === 'consultant') return true;
    if (wir.status === 'pending_pm' && currentUserRole === 'project_manager') return true;
    return false;
  }

  function canUserReject(): boolean {
    return canUserApprove();
  }

  function canSubmit(): boolean {
    return wir?.status === 'draft' && wir?.requested_by === currentUserId;
  }

  function canResubmit(): boolean {
    return wir?.status === 'rejected' && wir?.requested_by === currentUserId;
  }

  async function updateProgressAfterApproval() {
    if (!wir) return;
    try {
      if (wir.unit_id) {
        const { data: existing } = await supabase.from('unit_progress')
          .select('id').eq('unit_id', wir.unit_id)
          .eq('milestone_code', 'wir_approved').maybeSingle();
        if (existing) {
          await supabase.from('unit_progress').update({
            status: 'achieved',
            achieved_date: new Date().toISOString().slice(0, 10),
          }).eq('id', existing.id);
        } else {
          await supabase.from('unit_progress').insert({
            unit_id: wir.unit_id,
            milestone_code: 'wir_approved',
            milestone_name_en: 'WIR Approved',
            weight_percent: 5,
            status: 'achieved',
            achieved_date: new Date().toISOString().slice(0, 10),
          });
        }
      }
    } catch (err) {
      console.error('Progress update failed:', err);
    }
  }

  async function submitWir() {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('work_requests').update({
        status: 'pending_qc',
      }).eq('id', id);
      if (error) throw error;
      toast.success('WIR submitted for QC review');
      reloadWir();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    } finally { setSaving(false); }
  }

  async function handleApprove() {
    if (!id || !wir) return;
    setSaving(true);
    try {
      let newStatus = '';
      const updates: Record<string, unknown> = {};

      if (wir.status === 'pending_qc') {
        updates.qc_approved = true;
        updates.qc_approved_by = currentUserId;
        updates.qc_approved_at = new Date().toISOString();
        newStatus = 'pending_consultant';
      } else if (wir.status === 'pending_consultant') {
        updates.consultant_approved = true;
        updates.consultant_approved_by = currentUserId;
        updates.consultant_approved_at = new Date().toISOString();
        newStatus = 'pending_pm';
      } else if (wir.status === 'pending_pm') {
        updates.pm_approved = true;
        updates.pm_approved_by = currentUserId;
        updates.pm_approved_at = new Date().toISOString();
        newStatus = 'approved';
      } else {
        toast.error('Cannot approve in current status');
        setSaving(false);
        return;
      }
      updates.status = newStatus;

      const { error } = await supabase.from('work_requests').update(updates).eq('id', id);
      if (error) throw error;
      toast.success(`WIR ${newStatus === 'approved' ? 'fully approved' : 'approved, sent to next reviewer'}`);

      if (newStatus === 'approved') {
        await updateProgressAfterApproval();
      }

      await reloadWir();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    } finally { setSaving(false); }
  }

  async function handleReject() {
    if (!id || !wir) return;
    if (!rejectReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('work_requests').update({
        status: 'rejected',
        rejection_reason: rejectReason.trim(),
      }).eq('id', id);
      if (error) throw error;
      toast.success('WIR rejected');
      setShowRejectDialog(false);
      setRejectReason('');
      await reloadWir();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Reject failed');
    } finally { setSaving(false); }
  }

  async function resubmitWir() {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('work_requests').update({
        status: 'pending_qc',
        rejection_reason: null,
        qc_approved: false, qc_approved_by: null, qc_approved_at: null,
        consultant_approved: false, consultant_approved_by: null, consultant_approved_at: null,
        pm_approved: false, pm_approved_by: null, pm_approved_at: null,
      }).eq('id', id);
      if (error) throw error;
      toast.success('WIR resubmitted for QC review');
      await reloadWir();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Resubmit failed');
    } finally { setSaving(false); }
  }

  async function rejectAsNcr() {
    if (!id || !wir) return;
    if (!confirm('Reject this WIR and create NCR?')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('work_requests').update({
        status: 'rejected', is_ncr: true,
        ncr_reason: 'Auto-created from rejected WIR',
        rejection_reason: 'Rejected and converted to NCR',
      }).eq('id', id);
      if (error) throw error;
      toast.success(t('execution.ncr_created'));
      await reloadWir();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally { setSaving(false); }
  }

  async function save() {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('work_requests').update(form).eq('id', id);
      if (error) throw error;
      toast.success('WIR updated');
      setEditing(false);
      await reloadWir();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally { setSaving(false); }
  }

  async function reloadWir() {
    if (!id) return;
    const { data } = await supabase.from('work_requests').select('*').eq('id', id).single();
    setWir(data as WorkRequest | null);
    setForm(data as WorkRequest || {});
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" /></div>;
  if (!wir) return <div className="text-center py-20" style={{ color: 'var(--color-text-secondary)' }}>WIR not found</div>;

  const statusStyle = STATUS_MAP[wir.status] || { label: wir.status, color: 'badge-neutral' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <button onClick={() => navigate('/execution')} className="btn-sm btn-secondary">
          <ArrowLeft size={16} /> {t('common.back')}
        </button>
        <div className="flex gap-2 flex-wrap">
          {canSubmit() && (
            <button className="btn-primary btn-sm" onClick={submitWir} disabled={saving}>
              <Send size={14} /> Submit for Review
            </button>
          )}
          {canResubmit() && (
            <button className="btn-primary btn-sm" onClick={resubmitWir} disabled={saving}>
              <RotateCcw size={14} /> Resubmit
            </button>
          )}
          {canUserApprove() && (
            <>
              <button className="btn-sm btn-success" onClick={handleApprove} disabled={saving}>
                <CheckCircle size={14} /> Approve
              </button>
              <button className="btn-sm btn-danger" onClick={() => setShowRejectDialog(true)} disabled={saving}>
                <XCircle size={14} /> Reject
              </button>
            </>
          )}
          {wir.status === 'rejected' && (
            <button className="btn-sm btn-danger" onClick={rejectAsNcr} disabled={saving}>
              <XCircle size={14} /> Reject & Create NCR
            </button>
          )}
          <button className="btn-sm btn-secondary" onClick={() => setEditing(!editing)}>
            <Edit3 size={14} /> {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{wir.title_en}</h1>
            <p className="text-sm font-mono mt-1" style={{ color: 'var(--color-text-secondary)' }}>{wir.wir_no}</p>
          </div>
          <div className="flex gap-2 items-center">
            <span className={`badge text-xs ${statusStyle.color}`}>{statusStyle.label}</span>
            {wir.is_ncr && <span className="badge badge-danger">NCR</span>}
          </div>
        </div>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Clock size={16} /> Workflow Timeline
          </h3>
          <div className="space-y-1">
            {timeline.map((entry, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: entry.type === 'approved' ? 'var(--color-success)' :
                      entry.type === 'rejected' ? 'var(--color-danger)' :
                      'var(--color-text-muted)'
                  }} />
                <div className="flex-1">
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>{entry.label}</span>
                  {entry.user && <span style={{ color: 'var(--color-text-secondary)' }}> by {entry.user}</span>}
                  <span className="ml-2" style={{ color: 'var(--color-text-secondary)' }}>{new Date(entry.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejection reason */}
      {wir.status === 'rejected' && wir.rejection_reason && (
        <div className="p-4 rounded-xl border border-red-200" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)'}}>
          <h4 className="text-sm font-semibold text-red-700 mb-1">Rejection Reason</h4>
          <p className="text-sm text-red-600">{wir.rejection_reason}</p>
        </div>
      )}

      {editing ? (
        <div className="card space-y-4">
          <h3 className="font-semibold">Edit WIR</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Title (EN)</label><input className="input" value={form.title_en || ''} onChange={(e) => setForm({ ...form, title_en: e.target.value })} /></div>
            <div><label className="label">Title (AR)</label><input className="input text-right" dir="rtl" value={form.title_ar || ''} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} /></div>
            <div><label className="label">Activity</label>
              <select className="input" value={form.activity_id || ''} onChange={(e) => setForm({ ...form, activity_id: e.target.value || undefined })}>
                <option value="">-- Select Activity --</option>
                {activities.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name_en}</option>)}
              </select>
            </div>
            <div><label className="label">Item Definition</label>
              <select className="input" value={form.item_definition_id || ''} onChange={(e) => setForm({ ...form, item_definition_id: e.target.value || undefined })}>
                <option value="">-- Select Item Definition --</option>
                {itemDefinitions.map(i => <option key={i.id} value={i.id}>{i.wbs_code} - {i.activity}</option>)}
              </select>
            </div>

            <div><label className="label">Division</label><input className="input" value={form.division || ''} onChange={(e) => setForm({ ...form, division: e.target.value })} /></div>
            <div><label className="label">Sub-Division</label><input className="input" value={form.sub_division || ''} onChange={(e) => setForm({ ...form, sub_division: e.target.value })} /></div>
            <div><label className="label">Zone</label><input className="input" value={form.zone || ''} onChange={(e) => setForm({ ...form, zone: e.target.value })} /></div>
            <div><label className="label">Block</label><input className="input" value={form.block || ''} onChange={(e) => setForm({ ...form, block: e.target.value })} /></div>
            <div><label className="label">Unit</label>
              <select className="input" value={form.unit_id || ''} onChange={(e) => setForm({ ...form, unit_id: e.target.value || undefined })}>
                <option value="">-- Select Unit --</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.unit_code}</option>)}
              </select>
            </div>
            <div><label className="label">Location</label><input className="input" value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><label className="label">Discipline</label><input className="input" value={form.discipline || ''} onChange={(e) => setForm({ ...form, discipline: e.target.value })} /></div>
            <div><label className="label">Inspection Date</label><input type="date" className="input" value={form.inspection_date || ''} onChange={(e) => setForm({ ...form, inspection_date: e.target.value })} /></div>
            <div><label className="label">Contractor</label><input className="input" value={form.contractor || ''} onChange={(e) => setForm({ ...form, contractor: e.target.value })} /></div>
            <div><label className="label">Inspector</label>
              <select className="input" value={form.inspector || ''} onChange={(e) => setForm({ ...form, inspector: e.target.value || undefined })}>
                <option value="">-- Select Inspector --</option>
                {inspectors.map((i) => <option key={i.id} value={i.id}>{i.display_name}</option>)}
              </select>
            </div>
            <div><label className="label">QC Engineer</label>
              <select className="input" value={form.qc_engineer_id || ''} onChange={(e) => setForm({ ...form, qc_engineer_id: e.target.value || undefined })}>
                <option value="">-- Select QC Engineer --</option>
                {profiles.filter(p => ['engineer','qc','consultant'].includes(p.role)).map(p => <option key={p.id} value={p.id}>{p.display_name} ({p.role})</option>)}
              </select>
            </div>
            <div><label className="label">Consultant</label>
              <select className="input" value={form.consultant_engineer_id || ''} onChange={(e) => setForm({ ...form, consultant_engineer_id: e.target.value || undefined })}>
                <option value="">-- Select Consultant --</option>
                {profiles.filter(p => ['engineer','qc','consultant'].includes(p.role)).map(p => <option key={p.id} value={p.id}>{p.display_name} ({p.role})</option>)}
              </select>
            </div>
            <div><label className="label">Priority</label>
              <select className="input" value={form.priority || 'medium'} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['low','medium','high','critical'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Status</label>
              <select className="input" value={form.status || 'draft'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['draft','pending_qc','pending_consultant','pending_pm','approved','rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          {wir.is_ncr && <div><label className="label">NCR Reason</label><textarea className="input" rows={2} value={form.ncr_reason || ''} onChange={(e) => setForm({ ...form, ncr_reason: e.target.value })} /></div>}
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Details</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Request Date</span><span>{wir.request_date}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Location</span><span>{wir.location || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Discipline</span><span>{wir.discipline || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Division</span><span>{wir.division || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Sub-Division</span><span>{wir.sub_division || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Activity</span><span>{wir.activity || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Zone</span><span>{wir.zone || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Block</span><span>{wir.block || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Contractor</span><span>{wir.contractor || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Priority</span><span className={`badge capitalize ${wir.priority === 'critical' ? 'badge-danger' : wir.priority === 'high' ? 'badge-warning' : 'badge'}`}>{wir.priority || 'medium'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>NCR</span><span>{wir.is_ncr ? 'Yes' : 'No'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Item Definition</span><span>{wir.item_definition_id ? (itemDefinitions.find(i => i.id === wir.item_definition_id)?.activity || '-') : (wir.activity || '-')}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Unit</span><span>{wir.unit_id ? (units.find(u => u.id === wir.unit_id)?.unit_code || '-') : '-'}</span></div>
            </div>
          </div>
          <div className="card space-y-3">
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Inspection & Team</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Inspection Date</span><span>{wir.inspection_date || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Inspector</span><span>{wir.inspector ? (inspectors.find(i => i.id === wir.inspector)?.display_name || wir.inspector) : '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>QC Engineer</span><span>{getProfileName(wir.qc_engineer_id)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Consultant</span><span>{getProfileName(wir.consultant_engineer_id)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`badge text-xs ${statusStyle.color}`}>{statusStyle.label}</span></div>
            </div>
          </div>

          {/* Approval status cards */}
          <div className="card col-span-full space-y-3">
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Approval Workflow</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-3 rounded-lg border text-sm ${wir.qc_approved ? 'border-green-200' : wir.status === 'rejected' && !wir.qc_approved ? 'border-red-200' : ''}`} style={!wir.qc_approved && !(wir.status === 'rejected' && !wir.qc_approved) ? { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' } : {}}>
                <div className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>QC Engineer</div>
                {wir.qc_approved ? (
                  <div className="text-green-700"><CheckCircle size={14} className="inline mr-1" />Approved by {getProfileName(wir.qc_approved_by)}<br /><span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{wir.qc_approved_at ? new Date(wir.qc_approved_at).toLocaleDateString() : ''}</span></div>
                ) : wir.status === 'rejected' ? (
                  <div className="text-red-700"><XCircle size={14} className="inline mr-1" />Rejected</div>
                ) : (
                  <div style={{ color: 'var(--color-text-secondary)' }}><Clock size={14} className="inline mr-1" />Pending</div>
                )}
              </div>
              <div className={`p-3 rounded-lg border text-sm ${wir.consultant_approved ? 'border-green-200' : wir.status === 'rejected' && !wir.consultant_approved && wir.qc_approved ? 'border-red-200' : ''}`} style={!wir.consultant_approved && !(wir.status === 'rejected' && !wir.consultant_approved && wir.qc_approved) ? { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' } : {}}>
                <div className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>Consultant</div>
                {wir.consultant_approved ? (
                  <div className="text-green-700"><CheckCircle size={14} className="inline mr-1" />Approved by {getProfileName(wir.consultant_approved_by)}<br /><span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{wir.consultant_approved_at ? new Date(wir.consultant_approved_at).toLocaleDateString() : ''}</span></div>
                ) : wir.status === 'rejected' && wir.qc_approved ? (
                  <div className="text-red-700"><XCircle size={14} className="inline mr-1" />Rejected</div>
                ) : wir.status === 'pending_qc' || wir.status === 'draft' ? (
                  <div style={{ color: 'var(--color-text-secondary)' }}><Clock size={14} className="inline mr-1" />Awaiting QC</div>
                ) : (
                  <div style={{ color: 'var(--color-text-secondary)' }}><Clock size={14} className="inline mr-1" />Pending</div>
                )}
              </div>
              <div className={`p-3 rounded-lg border text-sm ${wir.pm_approved ? 'border-green-200' : wir.status === 'rejected' && wir.consultant_approved ? 'border-red-200' : ''}`} style={!wir.pm_approved && !(wir.status === 'rejected' && wir.consultant_approved) ? { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' } : {}}>
                <div className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>Project Manager</div>
                {wir.pm_approved ? (
                  <div className="text-green-700"><CheckCircle size={14} className="inline mr-1" />Approved by {getProfileName(wir.pm_approved_by)}<br /><span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{wir.pm_approved_at ? new Date(wir.pm_approved_at).toLocaleDateString() : ''}</span></div>
                ) : wir.status === 'rejected' && wir.consultant_approved ? (
                  <div className="text-red-700"><XCircle size={14} className="inline mr-1" />Rejected</div>
                ) : wir.status === 'pending_pm' ? (
                  <div style={{ color: 'var(--color-text-secondary)' }}><Clock size={14} className="inline mr-1" />Pending</div>
                ) : (
                  <div style={{ color: 'var(--color-text-secondary)' }}><Clock size={14} className="inline mr-1" />Awaiting previous</div>
                )}
              </div>
            </div>
          </div>

          <div className="card col-span-full space-y-3">
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Description</h3>
            <p className="text-sm" style={{ color: 'var(--color-text)' }}>{wir.description || 'No description'}</p>
            {wir.ncr_reason && (
              <div className="mt-4 p-3 rounded-lg" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)'}}>
                <h4 className="text-sm font-semibold text-red-700 mb-1">NCR Reason</h4>
                <p className="text-sm text-red-600">{wir.ncr_reason}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setShowRejectDialog(false); setRejectReason(''); }}>
          <div className="rounded-xl p-6 w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Reject WIR</h3>
            <div>
              <label className="label">Rejection Reason *</label>
              <textarea className="input" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain why this WIR is being rejected..." />
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-danger btn-sm" onClick={handleReject} disabled={saving}>{saving ? 'Rejecting...' : 'Confirm Reject'}</button>
              <button className="btn-secondary btn-sm" onClick={() => { setShowRejectDialog(false); setRejectReason(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
