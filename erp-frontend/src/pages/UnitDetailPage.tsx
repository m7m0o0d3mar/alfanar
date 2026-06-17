import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Edit3, Layers, MapPin, DollarSign, Home, Bath, Bed, Calendar, Tag } from 'lucide-react';

interface Unit {
  id: string; project_id: string; unit_code: string; unit_type: string;
  floor_number: number | null; area_sqm: number | null; bedrooms: number;
  bathrooms: number; status: string; price: number | null; currency: string;
  handover_date: string | null; is_active: boolean;
  projects?: { name_en: string; project_code: string } | null;
}

export default function UnitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const toast = useToast();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Unit>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    loadUnit();
  }, [id]);

  async function loadUnit() {
    setLoading(true);
    const { data, error } = await supabase
      .from('units')
      .select('*, projects(name_en, project_code)')
      .eq('id', id)
      .single();
    if (error) {
      setError(error.message);
    } else {
      setUnit(data as Unit);
      setForm(data as Unit);
    }
    setLoading(false);
  }

  async function save() {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('units').update(form).eq('id', id);
      if (error) throw error;
      toast.success('Unit updated');
      setEditing(false);
      const { data } = await supabase.from('units').select('*, projects(name_en, project_code)').eq('id', id).single();
      setUnit(data as Unit);
    } catch (err: unknown) {
      console.error('Unit update failed:', err);
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" /></div>;
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>;
  if (!unit) return <div className="text-center py-20 text-gray-400">Unit not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/units')} className="btn-sm btn-secondary">
          <ArrowLeft size={16} /> {t('common.back')}
        </button>
        <button className="btn-sm btn-secondary" onClick={() => setEditing(!editing)}>
          <Edit3 size={14} /> {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{unit.unit_code}</h1>
            <p className="text-sm text-gray-500 mt-1">{unit.projects?.name_en || '-'}</p>
          </div>
          <span className={`badge text-xs ${
            unit.status === 'available' ? 'badge-success' :
            unit.status === 'reserved' ? 'badge-warning' :
            unit.status === 'sold' ? 'badge-danger' :
            'badge-info'
          } capitalize`}>{unit.status}</span>
        </div>
      </div>

      {editing && (
        <div className="card space-y-4">
          <h3 className="font-semibold">Edit Unit</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Unit Code *</label><input className="input" value={form.unit_code || ''} onChange={(e) => setForm({ ...form, unit_code: e.target.value })} /></div>
            <div><label className="label">Type</label><select className="input" value={form.unit_type || ''} onChange={(e) => setForm({ ...form, unit_type: e.target.value })}>
              {['apartment','villa','office','shop','warehouse','penthouse','duplex','studio','plot','floor'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select></div>
            <div><label className="label">Floor</label><input type="number" className="input" value={form.floor_number ?? ''} onChange={(e) => setForm({ ...form, floor_number: e.target.value ? parseInt(e.target.value) : null })} /></div>
            <div><label className="label">Area (sqm)</label><input type="number" className="input" value={form.area_sqm ?? ''} onChange={(e) => setForm({ ...form, area_sqm: e.target.value ? parseFloat(e.target.value) : null })} /></div>
            <div><label className="label">Bedrooms</label><input type="number" className="input" value={form.bedrooms ?? 1} onChange={(e) => setForm({ ...form, bedrooms: parseInt(e.target.value) || 1 })} /></div>
            <div><label className="label">Bathrooms</label><input type="number" className="input" value={form.bathrooms ?? 1} onChange={(e) => setForm({ ...form, bathrooms: parseInt(e.target.value) || 1 })} /></div>
            <div><label className="label">Status</label><select className="input" value={form.status || ''} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {['available','reserved','sold','booked'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
            <div><label className="label">Price</label><input type="number" className="input" value={form.price ?? ''} onChange={(e) => setForm({ ...form, price: e.target.value ? parseFloat(e.target.value) : null })} /></div>
            <div className="col-span-2"><label className="label">Handover Date</label><input type="date" className="input" value={form.handover_date || ''} onChange={(e) => setForm({ ...form, handover_date: e.target.value || null })} /></div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Layers size={16} /> Unit Info</h3>
          <div className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-gray-500">Code</span><span className="font-mono">{unit.unit_code}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Project</span><span>{unit.projects?.name_en || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="capitalize">{unit.unit_type}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="capitalize">{unit.status}</span></div>
          </div>
        </div>
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Home size={16} /> Specifications</h3>
          <div className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><MapPin size={14} /> Floor</span><span>{unit.floor_number ?? '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><Tag size={14} /> Area</span><span>{unit.area_sqm ? `${unit.area_sqm} m²` : '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><Bed size={14} /> Bedrooms</span><span>{unit.bedrooms}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><Bath size={14} /> Bathrooms</span><span>{unit.bathrooms}</span></div>
          </div>
        </div>
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><DollarSign size={16} /> Pricing</h3>
          <div className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-gray-500">Price</span><span>{unit.price ? `${unit.price.toLocaleString()} ${unit.currency || 'SAR'}` : '-'}</span></div>
          </div>
        </div>
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Calendar size={16} /> Dates</h3>
          <div className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-gray-500">Handover Date</span><span>{unit.handover_date || '-'}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
