import { useT } from '../../hooks/useTranslation';
import { type Project, type UserProfile } from '../../pages/ExecutionPage';

interface TaskFormState {
  project_id: string; task_code: string; title_en: string; status: string;
  progress: number; assigned_to: string; activity_id: string; division: string;
  sub_division: string; activity: string; zone: string; block: string;
  unit_id: string; priority: string; target_date: string; description: string;
}

interface Props {
  show: boolean;
  projects: Project[];
  taskDivisions: string[];
  taskSubDivisions: string[];
  taskActivities: { activity: string; activity_weight: number }[];
  taskZones: string[];
  taskBlocks: string[];
  units: { id: string; project_id: string; unit_code: string; unit_type: string; zone: string; block: string }[];
  userProfiles: UserProfile[];
  taskForm: TaskFormState;
  formError: string;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  onChange: (form: TaskFormState) => void;
}

export default function TaskFormModal({ show, projects, taskDivisions, taskSubDivisions, taskActivities, taskZones, taskBlocks, units, userProfiles, taskForm, formError, saving, onSave, onClose, onChange }: Props) {
  const t = useT();
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Create Work Task</h3>
        {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
        <div className="space-y-4">
          <div><label className="label">Project *</label>
            <select className="input" value={taskForm.project_id} onChange={(e) => onChange({ ...taskForm, project_id: e.target.value })}>
              <option value="">-- Select Project --</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
            </select>
          </div>
          <div><label className="label">Task Code</label>
            <input className="input bg-gray-50" value="Auto-generated" disabled />
          </div>
          <div><label className="label">Division *</label>
            <select className="input" value={taskForm.division} onChange={(e) => onChange({ ...taskForm, division: e.target.value, sub_division: '', activity: '' })}>
              <option value="">-- Select Division --</option>
              {taskDivisions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {taskSubDivisions.length > 0 && (
            <div><label className="label">Sub-Division</label>
              <select className="input" value={taskForm.sub_division} onChange={(e) => onChange({ ...taskForm, sub_division: e.target.value, activity: '' })}>
                <option value="">-- Select Sub-Division --</option>
                {taskSubDivisions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          {taskActivities.length > 0 && (
            <div><label className="label">Activity *</label>
              <select className="input" value={taskForm.activity} onChange={(e) => onChange({ ...taskForm, activity: e.target.value })}>
                <option value="">-- Select Activity --</option>
                {taskActivities.map((a) => <option key={a.activity} value={a.activity}>{a.activity}</option>)}
              </select>
            </div>
          )}
          <div><label className="label">Zone</label>
            <select className="input" value={taskForm.zone} onChange={(e) => onChange({ ...taskForm, zone: e.target.value, block: '', unit_id: '' })}>
              <option value="">-- Select Zone --</option>
              {taskZones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          {taskBlocks.length > 0 && (
            <div><label className="label">Block</label>
              <select className="input" value={taskForm.block} onChange={(e) => onChange({ ...taskForm, block: e.target.value, unit_id: '' })}>
                <option value="">-- Select Block --</option>
                {taskBlocks.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          {taskForm.block && (
            <div><label className="label">Unit</label>
              <select className="input" value={taskForm.unit_id} onChange={(e) => onChange({ ...taskForm, unit_id: e.target.value })}>
                <option value="">-- Select Unit --</option>
                {units.filter(u => u.project_id === taskForm.project_id && u.zone === taskForm.zone && u.block === taskForm.block).map((u) => <option key={u.id} value={u.id}>{u.unit_code} - {u.unit_type}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Assigned To</label>
              <select className="input" value={taskForm.assigned_to} onChange={(e) => onChange({ ...taskForm, assigned_to: e.target.value })}>
                <option value="">-- Select User --</option>
                {userProfiles.map((u) => <option key={u.id} value={u.id}>{u.full_name_en} ({u.role})</option>)}
              </select>
            </div>
            <div><label className="label">Priority</label>
              <select className="input" value={taskForm.priority} onChange={(e) => onChange({ ...taskForm, priority: e.target.value })}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Target Date</label><input type="date" className="input" value={taskForm.target_date} onChange={(e) => onChange({ ...taskForm, target_date: e.target.value })} /></div>
            <div><label className="label">Status</label>
              <select className="input" value={taskForm.status} onChange={(e) => onChange({ ...taskForm, status: e.target.value })}>
                {['open','in_progress','review','completed','cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Progress (%)</label><input type="number" className="input" min={0} max={100} value={taskForm.progress} onChange={(e) => onChange({ ...taskForm, progress: parseInt(e.target.value) || 0 })} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={taskForm.description} onChange={(e) => onChange({ ...taskForm, description: e.target.value })} /></div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary btn-sm" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : t('common.save')}</button>
          <button className="btn-secondary btn-sm" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
