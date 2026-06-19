import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Edit3, ExternalLink } from 'lucide-react';
import { formatDate } from '../utils/date';

interface WorkTask {
  id: string; task_code: string; title_en: string; description: string;
  status: string; progress: number; assigned_to: string;
  project_id: string; activity_id: string; created_at: string;
  division: string; sub_division: string; activity: string;
  zone: string; block: string; unit_id: string; priority: string;
  target_date: string; actual_completion_date: string;
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const toast = useToast();
  const [task, setTask] = useState<WorkTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<WorkTask>>({});
  const [activities, setActivities] = useState<{ id: string; code: string; name_en: string }[]>([]);
  const [relatedWirs, setRelatedWirs] = useState<{ id: string; wir_no: string; title_en: string; status: string }[]>([]);
  const [userProfiles, setUserProfiles] = useState<{ id: string; full_name_en: string }[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      supabase.from('work_tasks').select('*').eq('id', id).single(),
      supabase.from('activity_definitions').select('id, code, name_en').eq('is_active', true).order('name_en'),
      supabase.from('work_requests').select('id, wir_no, title_en, status')
        .eq('activity_id', supabase.rpc?.toString() || '').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
    ]).then(([taskRes, actRes, , userRes]) => {
      const t = taskRes.data as WorkTask | null;
      setTask(t); setForm(t || {}); setActivities(actRes.data as { id: string; code: string; name_en: string }[] || []);
      setUserProfiles((userRes.data || []) as { id: string; full_name_en: string }[]);
      if (t?.activity_id) {
        supabase.from('work_requests').select('id, wir_no, title_en, status')
          .eq('activity_id', t.activity_id).order('created_at', { ascending: false })
          .then(r => setRelatedWirs(r.data as { id: string; wir_no: string; title_en: string; status: string }[] || []));
      }
      setLoading(false);
    });
  }, [id]);

  async function save() {
    if (!id) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = { ...form };
      if (form.status === 'completed') {
        updates.actual_completion_date = new Date().toISOString().slice(0, 10);
      }
      const { error } = await supabase.from('work_tasks').update(updates).eq('id', id);
      if (error) throw error;
      toast.success('Task updated');
      setEditing(false);
      const { data } = await supabase.from('work_tasks').select('*').eq('id', id).single();
      setTask(data as WorkTask | null);
    } catch (err: unknown) {
      console.error('Task update failed:', err);
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" /></div>;
  if (!task) return <div className="text-center py-20" style={{ color: 'var(--color-text-secondary)' }}>Task not found</div>;

  const priorityColor = task.priority === 'high' ? 'badge-danger' : task.priority === 'low' ? 'badge' : 'badge';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <button onClick={() => navigate('/execution')} className="btn-sm btn-secondary">
          <ArrowLeft size={16} /> {t('common.back')}
        </button>
        <button className="btn-sm btn-secondary" onClick={() => setEditing(!editing)}>
          <Edit3 size={14} /> {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{task.title_en}</h1>
            <p className="text-sm font-mono mt-1" style={{ color: 'var(--color-text-secondary)' }}>{task.task_code}</p>
          </div>
          <div className="flex gap-2 items-center">
            <span className={`badge text-xs capitalize ${priorityColor}`}>{task.priority || 'medium'}</span>
            <span className={`badge text-xs ${task.status === 'completed' ? 'badge-success' : 'badge'}`}>{task.status}</span>
          </div>
        </div>
      </div>

      {editing ? (
        <div className="card space-y-4">
          <h3 className="font-semibold">{t('execution.task_detail')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Title</label><input className="input" value={form.title_en || ''} onChange={e => setForm({ ...form, title_en: e.target.value })} /></div>
            <div><label className="label">Status</label>
              <select className="input" value={form.status || 'open'} onChange={e => setForm({ ...form, status: e.target.value })}>
                {['open','in_progress','review','completed','cancelled'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Division</label><input className="input" value={form.division || ''} onChange={e => setForm({ ...form, division: e.target.value })} /></div>
            <div><label className="label">Sub-Division</label><input className="input" value={form.sub_division || ''} onChange={e => setForm({ ...form, sub_division: e.target.value })} /></div>
            <div><label className="label">Activity</label><input className="input" value={form.activity || ''} onChange={e => setForm({ ...form, activity: e.target.value })} /></div>
            <div>
              <select className="input" value={form.activity_id || ''} onChange={e => setForm({ ...form, activity_id: e.target.value || undefined })}>
                <option value="">-- Select Activity Def --</option>
                {activities.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name_en}</option>)}
              </select>
            </div>
            <div><label className="label">Zone</label><input className="input" value={form.zone || ''} onChange={e => setForm({ ...form, zone: e.target.value })} /></div>
            <div><label className="label">Block</label><input className="input" value={form.block || ''} onChange={e => setForm({ ...form, block: e.target.value })} /></div>
            <div><label className="label">Priority</label>
              <select className="input" value={form.priority || 'medium'} onChange={e => setForm({ ...form, priority: e.target.value })}>
                {['high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Target Date</label><input type="date" className="input" value={form.target_date || ''} onChange={e => setForm({ ...form, target_date: e.target.value })} /></div>
            <div><label className="label">Progress (%)</label><input type="number" className="input" min={0} max={100} value={form.progress || 0} onChange={e => setForm({ ...form, progress: parseInt(e.target.value) || 0 })} /></div>
            <div><label className="label">Assigned To</label>
              <select className="input" value={form.assigned_to || ''} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">-- Select User --</option>
                {userProfiles.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
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
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Task Code</span><span className="font-mono">{task.task_code}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Status</span><span className="capitalize">{task.status}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Priority</span><span className={`badge text-xs capitalize ${priorityColor}`}>{task.priority || 'medium'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Division</span><span>{task.division || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Sub-Division</span><span>{task.sub_division || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Activity</span><span>{task.activity || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Zone</span><span>{task.zone || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Block</span><span>{task.block || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Progress</span><span>{task.progress}%</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Target Date</span><span>{task.target_date || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Actual Completion</span><span>{task.actual_completion_date || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Assigned To</span><span>{task.assigned_to ? (userProfiles.find(u => u.id === task.assigned_to)?.full_name_en || '-') : '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Created</span><span>{formatDate(task.created_at)}</span></div>
            </div>
          </div>
          <div className="card space-y-3">
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Progress</h3>
            <div className="w-full h-4 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${task.progress}%` }} />
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>{task.progress}% complete</p>
          </div>
          <div className="card space-y-3">
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Description</h3>
            <p className="text-sm" style={{ color: 'var(--color-text)' }}>{task.description || 'No description'}</p>
          </div>
          {relatedWirs.length > 0 && (
            <div className="card space-y-3">
              <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Related WIRs</h3>
              <div className="space-y-2">
                {relatedWirs.map(w => (
                  <div key={w.id} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
                    <div>
                      <span className="font-mono text-xs">{w.wir_no}</span>
                      <span className="ms-2 text-sm">{w.title_en}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs ${w.status === 'approved' ? 'badge-success' : w.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{w.status}</span>
                      <button className="btn-sm btn-secondary" onClick={() => navigate(`/execution/wir/${w.id}`)}><ExternalLink size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
