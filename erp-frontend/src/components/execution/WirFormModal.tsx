import { useT } from '../../hooks/useTranslation';
import { type Project, type UserProfile } from '../../pages/ExecutionPage';

interface WirFormState {
  project_id: string; wir_no: string; title_en: string; title_ar: string;
  location: string; status: string; activity_id: string; item_definition_id: string;
  unit_id: string; inspector: string; description: string;
  division: string; sub_division: string; activity: string; activity_weight: number;
  zone: string; block: string; qc_engineer_id: string; consultant_engineer_id: string;
}

interface Props {
  show: boolean;
  projects: Project[];
  wrDivisions: string[];
  wrSubDivisions: string[];
  wrActivities: { id: string; activity: string; activity_weight: number }[];
  wrZones: string[];
  wrBlocks: string[];
  units: { id: string; project_id: string; unit_code: string; unit_type: string; zone: string; block: string }[];
  inspectors: { id: string; full_name_en: string }[];
  userProfiles: UserProfile[];
  wirForm: WirFormState;
  formError: string;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  onChange: (form: WirFormState) => void;
}

export default function WirFormModal({ show, projects, wrDivisions, wrSubDivisions, wrActivities, wrZones, wrBlocks, units, inspectors, userProfiles, wirForm, formError, saving, onSave, onClose, onChange }: Props) {
  const t = useT();
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Create Work Request</h3>
        {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
        <div className="space-y-4">
          <div><label className="label">Project *</label>
            <select className="input" value={wirForm.project_id} onChange={(e) => onChange({ ...wirForm, project_id: e.target.value })}>
              <option value="">-- Select Project --</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
            </select>
          </div>
          <div><label className="label">WR No</label>
            <input className="input bg-gray-50" value="Auto-generated" disabled />
          </div>
          <div><label className="label">Title (EN) *</label><input className="input" value={wirForm.title_en} onChange={(e) => onChange({ ...wirForm, title_en: e.target.value })} /></div>
          <div><label className="label">Title (AR)</label><input className="input text-right" dir="rtl" value={wirForm.title_ar} onChange={(e) => onChange({ ...wirForm, title_ar: e.target.value })} /></div>
          <div><label className="label">Division *</label>
            <select className="input" value={wirForm.division} onChange={(e) => onChange({ ...wirForm, division: e.target.value, sub_division: '', activity: '', activity_weight: 0 })}>
              <option value="">-- Select Division --</option>
              {wrDivisions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {wrSubDivisions.length > 0 && (
            <div><label className="label">Sub-Division</label>
              <select className="input" value={wirForm.sub_division} onChange={(e) => onChange({ ...wirForm, sub_division: e.target.value, activity: '', activity_weight: 0 })}>
                <option value="">-- Select Sub-Division --</option>
                {wrSubDivisions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          {wrActivities.length > 0 && (
            <div><label className="label">Activity *</label>
              <select className="input" value={wirForm.activity} onChange={(e) => onChange({ ...wirForm, activity: e.target.value })}>
                <option value="">-- Select Activity --</option>
                {wrActivities.map((a) => <option key={a.activity} value={a.activity}>{a.activity}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Activity Weight (%)</label><input className="input bg-gray-50" value={wirForm.activity_weight} readOnly /></div>
          </div>
          <div><label className="label">Zone</label>
            <select className="input" value={wirForm.zone} onChange={(e) => onChange({ ...wirForm, zone: e.target.value, block: '', unit_id: '' })}>
              <option value="">-- Select Zone --</option>
              {wrZones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          {wrBlocks.length > 0 && (
            <div><label className="label">Block</label>
              <select className="input" value={wirForm.block} onChange={(e) => onChange({ ...wirForm, block: e.target.value, unit_id: '' })}>
                <option value="">-- Select Block --</option>
                {wrBlocks.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          {wirForm.block && (
            <div><label className="label">Unit</label>
              <select className="input" value={wirForm.unit_id} onChange={(e) => onChange({ ...wirForm, unit_id: e.target.value })}>
                <option value="">-- Select Unit --</option>
                {units.filter(u => u.project_id === wirForm.project_id && u.zone === wirForm.zone && u.block === wirForm.block).map((u) => <option key={u.id} value={u.id}>{u.unit_code} - {u.unit_type}</option>)}
              </select>
            </div>
          )}
          <div><label className="label">Location</label><input className="input" value={wirForm.location} onChange={(e) => onChange({ ...wirForm, location: e.target.value })} /></div>
          <div><label className="label">Status</label>
            <select className="input" value={wirForm.status} onChange={(e) => onChange({ ...wirForm, status: e.target.value })}>
              <option value="draft">draft</option>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </div>
          <div><label className="label">Inspector</label>
            <select className="input" value={wirForm.inspector} onChange={(e) => onChange({ ...wirForm, inspector: e.target.value })}>
              <option value="">-- Select Inspector --</option>
              {inspectors.map((i) => <option key={i.id} value={i.id}>{i.full_name_en}</option>)}
            </select>
          </div>
          <div><label className="label">QC Engineer</label>
            <select className="input" value={wirForm.qc_engineer_id} onChange={(e) => onChange({ ...wirForm, qc_engineer_id: e.target.value })}>
              <option value="">-- Select QC Engineer --</option>
              {userProfiles.filter(p => p.role === 'qc' || p.role === 'engineer').map((p) => <option key={p.id} value={p.id}>{p.full_name_en} ({p.role})</option>)}
            </select>
          </div>
          <div><label className="label">Consultant</label>
            <select className="input" value={wirForm.consultant_engineer_id} onChange={(e) => onChange({ ...wirForm, consultant_engineer_id: e.target.value })}>
              <option value="">-- Select Consultant --</option>
              {userProfiles.filter(p => p.role === 'consultant').map((p) => <option key={p.id} value={p.id}>{p.full_name_en} ({p.role})</option>)}
            </select>
          </div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={wirForm.description} onChange={(e) => onChange({ ...wirForm, description: e.target.value })} /></div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary btn-sm" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : t('common.save')}</button>
          <button className="btn-secondary btn-sm" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
