import { useT } from '../../hooks/useTranslation';
import { type Project } from '../../pages/ExecutionPage';

interface ItemFormState {
  project_id: string; division: string; sub_division: string; activity: string;
  activity_weight: number; wbs_code: string; wbs_description: string;
  booked_budget: number; open_budget: number; budget_rate: number;
  quantity: number; unit_price: number;
}

interface Props {
  show: boolean;
  projects: Project[];
  itemForm: ItemFormState;
  formError: string;
  saving: boolean;
  editingItemId: string | null;
  onSave: () => void;
  onClose: () => void;
  onChange: (form: ItemFormState) => void;
}

export default function ItemFormModal({ show, projects, itemForm, formError, saving, editingItemId, onSave, onClose, onChange }: Props) {
  const t = useT();
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { onClose(); }}>
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{editingItemId ? 'Edit' : 'Create'} Item Definition</h3>
        {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Project *</label>
            <select className="input" value={itemForm.project_id} onChange={(e) => onChange({ ...itemForm, project_id: e.target.value })}>
              <option value="">-- Select Project --</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
            </select>
          </div>
          <div><label className="label">Division *</label><input className="input" value={itemForm.division} onChange={(e) => onChange({ ...itemForm, division: e.target.value })} /></div>
          <div><label className="label">Sub-Division</label><input className="input" value={itemForm.sub_division} onChange={(e) => onChange({ ...itemForm, sub_division: e.target.value })} /></div>
          <div><label className="label">Activity *</label><input className="input" value={itemForm.activity} onChange={(e) => onChange({ ...itemForm, activity: e.target.value })} /></div>
          <div><label className="label">Activity Weight (%)</label><input type="number" className="input" value={itemForm.activity_weight} onChange={(e) => onChange({ ...itemForm, activity_weight: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">WBS Code *</label><input className="input" value={itemForm.wbs_code} onChange={(e) => onChange({ ...itemForm, wbs_code: e.target.value })} /></div>
          <div className="col-span-2"><label className="label">WBS Description</label><input className="input" value={itemForm.wbs_description} onChange={(e) => onChange({ ...itemForm, wbs_description: e.target.value })} /></div>
          <div><label className="label">Booked Budget (SAR)</label><input type="number" className="input" value={itemForm.booked_budget} onChange={(e) => onChange({ ...itemForm, booked_budget: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">Open Budget (SAR)</label><input type="number" className="input" value={itemForm.open_budget} onChange={(e) => onChange({ ...itemForm, open_budget: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">Budget Rate</label><input type="number" className="input" value={itemForm.budget_rate} onChange={(e) => onChange({ ...itemForm, budget_rate: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">Contingency (auto)</label><input type="number" className="input bg-gray-50" value={(itemForm.booked_budget - itemForm.open_budget).toFixed(2)} readOnly /></div>
          <div><label className="label">Quantity</label><input type="number" className="input" value={itemForm.quantity} onChange={(e) => onChange({ ...itemForm, quantity: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">Unit Price (SAR)</label><input type="number" className="input" value={itemForm.unit_price} onChange={(e) => onChange({ ...itemForm, unit_price: parseFloat(e.target.value) || 0 })} /></div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary btn-sm" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : t('common.save')}</button>
          <button className="btn-secondary btn-sm" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
