import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { exportCSV } from '../utils/csv';
import CsvImportModal from '../components/CsvImportModal';
import { type SyncConfig } from '../services/syncService';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Upload, Edit3, Search, Eye } from 'lucide-react';
import Pagination from '../components/Pagination';

interface Unit {
  id: string; project_id: string; unit_code: string; unit_type: string;
  floor_number: number | null; area_sqm: number | null; bedrooms: number;
  bathrooms: number; status: string; price: number | null; currency: string;
  handover_date: string | null; is_active: boolean;
  zone: string | null; block: string | null; unit_model: string | null;
  land_area: number | null; building_price_per_m2: number | null;
  land_price_per_m2: number | null; discount_land_pct: number | null;
  discount_bua_pct: number | null; salesperson_id: string | null;
  commission_id: string | null; sale_type: string | null;
  notes: string | null; update_date: string | null;
  created_at: string; updated_at: string;
  projects?: { name_en: string; project_code: string } | null;
}

interface Project {
  id: string; name_en: string; project_code: string;
}

interface Employee {
  id: string; full_name_en: string; employee_code: string;
}

interface Commission {
  id: string; commission_name_en: string;
}

const defaultForm = {
  project_id: '', unit_code: '', unit_type: 'apartment', floor_number: null as number | null,
  area_sqm: null as number | null, bedrooms: 1, bathrooms: 1,
  status: 'available', price: null as number | null, handover_date: null as string | null,
  zone: null as string | null, block: null as string | null, unit_model: null as string | null,
  land_area: null as number | null, building_price_per_m2: null as number | null,
  land_price_per_m2: null as number | null, discount_land_pct: null as number | null,
  discount_bua_pct: null as number | null, salesperson_id: null as string | null,
  commission_id: null as string | null, sale_type: null as string | null,
  notes: null as string | null, update_date: null as string | null,
};

export default function UnitsPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [formError, setFormError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [unitsRes, projectsRes, employeesRes, commissionsRes] = await Promise.all([
        supabase.from('units').select('*, projects(name_en, project_code)').order('unit_code'),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
        supabase.from('employees').select('id, full_name_en, employee_code').eq('is_active', true).order('full_name_en'),
        supabase.from('commissions').select('*').order('commission_name_en'),
      ]);
      setUnits((unitsRes.data || []) as Unit[]);
      setProjects((projectsRes.data || []) as Project[]);
      setEmployees((employeesRes.data || []) as Employee[]);
      setCommissions((commissionsRes.data || []) as Commission[]);
    } catch (err) {
      console.error('Failed to load units data:', err);
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  const filtered = units.filter((u) =>
    (!search || u.unit_code.toLowerCase().includes(search.toLowerCase()) ||
    u.unit_type.toLowerCase().includes(search.toLowerCase())) &&
    (!projectFilter || u.project_id === projectFilter)
  );

  // Cascade dropdown options — project-based filtering (reusable pattern for WR/Tasks)
  const projectUnits = units.filter(u => u.project_id === form.project_id);
  const availableZones = [...new Set(projectUnits.map(u => u.zone).filter(Boolean))] as string[];
  const availableBlocks = [...new Set(projectUnits.map(u => u.block).filter(Boolean))] as string[];
  const availableModels = [...new Set(projectUnits.map(u => u.unit_model).filter(Boolean))] as string[];

  async function save() {
    setFormError('');
    if (!form.project_id) { setFormError('Project is required'); return; }
    if (!form.unit_code.trim()) { setFormError('Unit Code is required'); return; }
    setSaving(true);
    const payload: Record<string, unknown> = {
      project_id: form.project_id,
      unit_code: form.unit_code.trim(),
      unit_type: form.unit_type,
      floor_number: form.floor_number,
      area_sqm: form.area_sqm,
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      status: form.status,
      price: form.price,
      handover_date: form.handover_date || null,
      zone: form.zone || null,
      block: form.block || null,
      unit_model: form.unit_model || null,
      land_area: form.land_area,
      building_price_per_m2: form.building_price_per_m2,
      land_price_per_m2: form.land_price_per_m2,
      discount_land_pct: form.discount_land_pct,
      discount_bua_pct: form.discount_bua_pct,
      salesperson_id: form.salesperson_id || null,
      commission_id: form.commission_id || null,
      sale_type: form.sale_type || null,
      notes: form.notes || null,
    };
    try {
      if (editing) {
        const { error } = await supabase.from('units').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success(`Unit "${form.unit_code}" updated`);
      } else {
        const { error } = await supabase.from('units').insert(payload);
        if (error) throw error;
        toast.success(`Unit "${form.unit_code}" created`);
      }
      setShowForm(false); setEditing(null); setForm(defaultForm); load();
    } catch (err: unknown) {
      console.error('Unit update error:', err);
      setFormError(err instanceof Error ? err.message : 'Save failed');
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  const importConfig: SyncConfig = {
    table: 'units',
    columns: [
      { key: 'unit_code', label: 'Unit Code', required: true },
      { key: 'unit_type', label: 'Unit Type', required: true },
      { key: 'zone', label: 'Zone' },
      { key: 'block', label: 'Block' },
      { key: 'unit_model', label: 'Unit Model' },
      { key: 'floor_number', label: 'Floor', type: 'number' as const },
      { key: 'area_sqm', label: 'Area (sqm)', type: 'number' as const },
      { key: 'land_area', label: 'Land Area', type: 'number' as const },
      { key: 'bedrooms', label: 'Bedrooms', type: 'number' as const },
      { key: 'bathrooms', label: 'Bathrooms', type: 'number' as const },
      { key: 'status', label: 'Status' },
      { key: 'price', label: 'Price', type: 'number' as const },
      { key: 'building_price_per_m2', label: 'Building Price/m²', type: 'number' as const },
      { key: 'land_price_per_m2', label: 'Land Price/m²', type: 'number' as const },
      { key: 'discount_land_pct', label: 'Discount Land %', type: 'number' as const },
      { key: 'discount_bua_pct', label: 'Discount BUA %', type: 'number' as const },
      { key: 'sale_type', label: 'Sale Type' },
      { key: 'notes', label: 'Notes' },
    ],
    fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }],
    uniqueKeys: ['unit_code'],
    defaults: { status: 'available', unit_type: 'apartment', bedrooms: 1, bathrooms: 1 },
  };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.units')}</h1>
          <p className="text-gray-500 mt-1">{units.length} records</p>
        </div>
        <div className="flex gap-2">
            <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as unknown as Record<string, unknown>[], `units_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> {t('admin.export_csv')}
          </button>
          <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={14} /> {t('admin.import_csv')}
          </button>
          <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setForm(defaultForm); setFormError(''); setShowForm(true); }}>
            <Plus size={16} /> {t('common.create')}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input max-w-xs" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th><th>Type</th><th>Project</th><th>Zone</th><th>Block</th>
                <th>Model</th><th>Floor</th><th>Area</th><th>Land Price</th>
                <th>Bldg Price</th><th>Total Price</th><th>Beds</th><th>Status</th>
                <th>Sale Type</th><th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={15} className="text-center py-8 text-gray-400">{t('common.loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={15} className="text-center py-8 text-gray-400">{t('admin.no_results')}</td></tr>
              ) : (
                filtered.slice((page - 1) * pageSize, page * pageSize).map((u) => {
                  const landPrice = (u.land_area ?? 0) * (u.land_price_per_m2 ?? 0);
                  const buildingPrice = (u.area_sqm ?? 0) * (u.building_price_per_m2 ?? 0);
                  const discountLandAmt = landPrice * (u.discount_land_pct ?? 0) / 100;
                  const discountBuaAmt = buildingPrice * (u.discount_bua_pct ?? 0) / 100;
                  const totalPrice = (landPrice - discountLandAmt) + (buildingPrice - discountBuaAmt);
                  return (
                  <tr key={u.id} className="clickable" onClick={() => navigate(`/units/${u.id}`)}>
                    <td className="font-mono text-xs">{u.unit_code}</td>
                    <td className="capitalize">{u.unit_type}</td>
                    <td className="text-sm text-gray-500">{u.projects?.name_en || '-'}</td>
                    <td>{u.zone || '-'}</td>
                    <td>{u.block || '-'}</td>
                    <td>{u.unit_model || '-'}</td>
                    <td>{u.floor_number ?? '-'}</td>
                    <td>{u.area_sqm ? `${u.area_sqm} m²` : '-'}</td>
                    <td>{landPrice ? `${landPrice.toLocaleString()} SAR` : '-'}</td>
                    <td>{buildingPrice ? `${buildingPrice.toLocaleString()} SAR` : '-'}</td>
                    <td>{totalPrice ? `${totalPrice.toLocaleString()} SAR` : '-'}</td>
                    <td>{u.bedrooms}</td>
                    <td><span className={`badge ${u.status === 'available' ? 'badge-success' : 'badge-info'} capitalize`}>{u.status}</span></td>
                    <td className="capitalize">{u.sale_type || '-'}</td>
                    <td>
                      <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setDetailUnit(u); }}>
                        <Eye size={14} />
                      </button>
                      <button className="btn-sm btn-secondary ms-1" onClick={(e) => { e.stopPropagation(); setEditing(u); setForm({ ...defaultForm, project_id: u.project_id, unit_code: u.unit_code, unit_type: u.unit_type, floor_number: u.floor_number, area_sqm: u.area_sqm, bedrooms: u.bedrooms, bathrooms: u.bathrooms, status: u.status, price: u.price, handover_date: u.handover_date, zone: u.zone, block: u.block, unit_model: u.unit_model, land_area: u.land_area, building_price_per_m2: u.building_price_per_m2, land_price_per_m2: u.land_price_per_m2, discount_land_pct: u.discount_land_pct, discount_bua_pct: u.discount_bua_pct, salesperson_id: u.salesperson_id, commission_id: u.commission_id, sale_type: u.sale_type, notes: u.notes, update_date: u.update_date }); setFormError(''); setShowForm(true); }}>
                        <Edit3 size={14} />
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{editing ? 'Edit Unit' : 'Create Unit'}</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Project *</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">-- Select Project --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Unit Code *</label><input className="input" value={form.unit_code} onChange={(e) => setForm({ ...form, unit_code: e.target.value })} /></div>
              <div><label className="label">Type</label><select className="input" value={form.unit_type} onChange={(e) => setForm({ ...form, unit_type: e.target.value })}>
                {['apartment','villa','office','shop','warehouse','penthouse','duplex','studio','plot','floor'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
              <div><label className="label">Zone</label><input className="input" list="zone-datalist" value={form.zone ?? ''} onChange={(e) => setForm({ ...form, zone: e.target.value || null })} />{form.project_id && <datalist id="zone-datalist">{availableZones.map((z) => <option key={z} value={z} />)}</datalist>}</div>
              <div><label className="label">Block</label><input className="input" list="block-datalist" value={form.block ?? ''} onChange={(e) => setForm({ ...form, block: e.target.value || null })} />{form.project_id && <datalist id="block-datalist">{availableBlocks.map((b) => <option key={b} value={b} />)}</datalist>}</div>
              <div><label className="label">Unit Model</label><input className="input" list="model-datalist" value={form.unit_model ?? ''} onChange={(e) => setForm({ ...form, unit_model: e.target.value || null })} />{form.project_id && <datalist id="model-datalist">{availableModels.map((m) => <option key={m} value={m} />)}</datalist>}</div>
              <div><label className="label">Floor</label><input type="number" className="input" value={form.floor_number ?? ''} onChange={(e) => setForm({ ...form, floor_number: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div><label className="label">Area (sqm)</label><input type="number" className="input" value={form.area_sqm ?? ''} onChange={(e) => setForm({ ...form, area_sqm: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              <div><label className="label">Land Area</label><input type="number" className="input" value={form.land_area ?? ''} onChange={(e) => setForm({ ...form, land_area: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              <div><label className="label">Bldg Price/m²</label><input type="number" className="input" value={form.building_price_per_m2 ?? ''} onChange={(e) => setForm({ ...form, building_price_per_m2: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              <div><label className="label">Land Price/m²</label><input type="number" className="input" value={form.land_price_per_m2 ?? ''} onChange={(e) => setForm({ ...form, land_price_per_m2: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              <div><label className="label">Discount Land %</label><input type="number" className="input" value={form.discount_land_pct ?? ''} onChange={(e) => setForm({ ...form, discount_land_pct: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              <div><label className="label">Discount BUA %</label><input type="number" className="input" value={form.discount_bua_pct ?? ''} onChange={(e) => setForm({ ...form, discount_bua_pct: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              <div><label className="label">Bedrooms</label><input type="number" className="input" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: parseInt(e.target.value) || 1 })} /></div>
              <div><label className="label">Bathrooms</label><input type="number" className="input" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: parseInt(e.target.value) || 1 })} /></div>
              <div><label className="label">Status</label><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['available','reserved','sold','booked'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
              <div><label className="label">Price (SAR)</label><input type="number" className="input" value={form.price ?? ''} onChange={(e) => setForm({ ...form, price: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              <div><label className="label">Handover Date</label><input type="date" className="input" value={form.handover_date ?? ''} onChange={(e) => setForm({ ...form, handover_date: e.target.value || null })} /></div>
              <div><label className="label">Sale Type</label><select className="input" value={form.sale_type ?? ''} onChange={(e) => setForm({ ...form, sale_type: e.target.value || null })}>
                <option value="">-- Select --</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="other">Other</option>
              </select></div>
              <div><label className="label">Salesperson</label><select className="input" value={form.salesperson_id ?? ''} onChange={(e) => setForm({ ...form, salesperson_id: e.target.value || null })}>
                <option value="">-- Select --</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name_en} ({emp.employee_code})</option>)}
              </select></div>
              <div><label className="label">Commission</label><select className="input" value={form.commission_id ?? ''} onChange={(e) => setForm({ ...form, commission_id: e.target.value || null })}>
                <option value="">-- Select --</option>
                {commissions.map((c) => <option key={c.id} value={c.id}>{c.commission_name_en}</option>)}
              </select></div>
              <div><label className="label">Update Date</label><input className="input" value={form.update_date ?? ''} disabled /></div>
              <div className="col-span-2"><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} /></div>
            </div>

            {(form.land_area || form.area_sqm || form.land_price_per_m2 || form.building_price_per_m2 || form.discount_land_pct || form.discount_bua_pct) && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg grid grid-cols-2 gap-3 text-sm">
                <div className="text-gray-500">Land Price:</div>
                <div className="font-semibold text-right">{((form.land_area ?? 0) * (form.land_price_per_m2 ?? 0)).toLocaleString()} SAR</div>
                <div className="text-gray-500">Building Price:</div>
                <div className="font-semibold text-right">{((form.area_sqm ?? 0) * (form.building_price_per_m2 ?? 0)).toLocaleString()} SAR</div>
                <div className="text-gray-500">Discount Land Amount:</div>
                <div className="font-semibold text-right">{((form.land_area ?? 0) * (form.land_price_per_m2 ?? 0) * (form.discount_land_pct ?? 0) / 100).toLocaleString()} SAR</div>
                <div className="text-gray-500">Discount BUA Amount:</div>
                <div className="font-semibold text-right">{((form.area_sqm ?? 0) * (form.building_price_per_m2 ?? 0) * (form.discount_bua_pct ?? 0) / 100).toLocaleString()} SAR</div>
                <div className="text-gray-700 font-medium border-t pt-1">Total Price:</div>
                <div className="font-bold text-right border-t pt-1">
                  {((form.land_area ?? 0) * (form.land_price_per_m2 ?? 0) * (1 - (form.discount_land_pct ?? 0) / 100) + (form.area_sqm ?? 0) * (form.building_price_per_m2 ?? 0) * (1 - (form.discount_bua_pct ?? 0) / 100)).toLocaleString()} SAR
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : t('common.save')}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {detailUnit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setDetailUnit(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Unit Details — {detailUnit.unit_code}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-gray-500 font-medium col-span-2 border-b pb-1 mb-1">General</div>
              <div className="text-gray-500">Unit Code:</div><div className="font-medium">{detailUnit.unit_code}</div>
              <div className="text-gray-500">Project:</div><div className="font-medium">{detailUnit.projects?.name_en || '-'}</div>
              <div className="text-gray-500">Type:</div><div className="font-medium capitalize">{detailUnit.unit_type}</div>
              <div className="text-gray-500">Zone:</div><div className="font-medium">{detailUnit.zone || '-'}</div>
              <div className="text-gray-500">Block:</div><div className="font-medium">{detailUnit.block || '-'}</div>
              <div className="text-gray-500">Unit Model:</div><div className="font-medium">{detailUnit.unit_model || '-'}</div>
              <div className="text-gray-500">Floor:</div><div className="font-medium">{detailUnit.floor_number ?? '-'}</div>
              <div className="text-gray-500">Area:</div><div className="font-medium">{detailUnit.area_sqm ? `${detailUnit.area_sqm} m²` : '-'}</div>
              <div className="text-gray-500">Land Area:</div><div className="font-medium">{detailUnit.land_area ? `${detailUnit.land_area} m²` : '-'}</div>
              <div className="text-gray-500">Bedrooms:</div><div className="font-medium">{detailUnit.bedrooms}</div>
              <div className="text-gray-500">Bathrooms:</div><div className="font-medium">{detailUnit.bathrooms}</div>
              <div className="text-gray-500">Status:</div><div className="font-medium capitalize">{detailUnit.status}</div>
              <div className="text-gray-500">Currency:</div><div className="font-medium">{detailUnit.currency || '-'}</div>

              <div className="text-gray-500 font-medium col-span-2 border-b pb-1 mb-1 mt-2">Pricing</div>
              <div className="text-gray-500">Price:</div><div className="font-medium">{detailUnit.price ? `${detailUnit.price.toLocaleString()} SAR` : '-'}</div>
              <div className="text-gray-500">Building Price/m²:</div><div className="font-medium">{detailUnit.building_price_per_m2 ? `${detailUnit.building_price_per_m2.toLocaleString()} SAR` : '-'}</div>
              <div className="text-gray-500">Land Price/m²:</div><div className="font-medium">{detailUnit.land_price_per_m2 ? `${detailUnit.land_price_per_m2.toLocaleString()} SAR` : '-'}</div>
              <div className="text-gray-500">Land Price:</div><div className="font-medium">{(() => { const v = (detailUnit.land_area ?? 0) * (detailUnit.land_price_per_m2 ?? 0); return v ? `${v.toLocaleString()} SAR` : '-'; })()}</div>
              <div className="text-gray-500">Building Price:</div><div className="font-medium">{(() => { const v = (detailUnit.area_sqm ?? 0) * (detailUnit.building_price_per_m2 ?? 0); return v ? `${v.toLocaleString()} SAR` : '-'; })()}</div>
              <div className="text-gray-500">Discount Land %:</div><div className="font-medium">{detailUnit.discount_land_pct != null ? `${detailUnit.discount_land_pct}%` : '-'}</div>
              <div className="text-gray-500">Discount BUA %:</div><div className="font-medium">{detailUnit.discount_bua_pct != null ? `${detailUnit.discount_bua_pct}%` : '-'}</div>
              <div className="text-gray-500">Discount Land Amount:</div><div className="font-medium">{(() => { const v = (detailUnit.land_area ?? 0) * (detailUnit.land_price_per_m2 ?? 0) * (detailUnit.discount_land_pct ?? 0) / 100; return v ? `${v.toLocaleString()} SAR` : '-'; })()}</div>
              <div className="text-gray-500">Discount BUA Amount:</div><div className="font-medium">{(() => { const v = (detailUnit.area_sqm ?? 0) * (detailUnit.building_price_per_m2 ?? 0) * (detailUnit.discount_bua_pct ?? 0) / 100; return v ? `${v.toLocaleString()} SAR` : '-'; })()}</div>
              <div className="text-gray-700 font-semibold border-t pt-1">Total Price:</div><div className="font-bold border-t pt-1">{(() => { const lp = (detailUnit.land_area ?? 0) * (detailUnit.land_price_per_m2 ?? 0); const bp = (detailUnit.area_sqm ?? 0) * (detailUnit.building_price_per_m2 ?? 0); const dl = lp * (detailUnit.discount_land_pct ?? 0) / 100; const db = bp * (detailUnit.discount_bua_pct ?? 0) / 100; const t = lp - dl + bp - db; return t ? `${t.toLocaleString()} SAR` : '-'; })()}</div>

              <div className="text-gray-500 font-medium col-span-2 border-b pb-1 mb-1 mt-2">Sales Info</div>
              <div className="text-gray-500">Sale Type:</div><div className="font-medium capitalize">{detailUnit.sale_type || '-'}</div>
              <div className="text-gray-500">Salesperson:</div><div className="font-medium">{(() => { const sp = detailUnit.salesperson_id ? employees.find(e => e.id === detailUnit.salesperson_id) : null; return sp ? `${sp.full_name_en} (${sp.employee_code})` : detailUnit.salesperson_id || '-'; })()}</div>
              <div className="text-gray-500">Commission:</div><div className="font-medium">{(() => { const c = detailUnit.commission_id ? commissions.find(c => c.id === detailUnit.commission_id) : null; return c?.commission_name_en || '-'; })()}</div>

              <div className="text-gray-500 font-medium col-span-2 border-b pb-1 mb-1 mt-2">Dates & Notes</div>
              <div className="text-gray-500">Handover Date:</div><div className="font-medium">{detailUnit.handover_date || '-'}</div>
              <div className="text-gray-500">Update Date:</div><div className="font-medium">{detailUnit.update_date || '-'}</div>
              <div className="text-gray-500">Created At:</div><div className="font-medium">{detailUnit.created_at ? new Date(detailUnit.created_at).toLocaleString() : '-'}</div>
              <div className="text-gray-500">Updated At:</div><div className="font-medium">{detailUnit.updated_at ? new Date(detailUnit.updated_at).toLocaleString() : '-'}</div>
              <div className="text-gray-500">Notes:</div><div className="font-medium">{detailUnit.notes || '-'}</div>
            </div>
            <div className="flex justify-end mt-4">
              <button className="btn-secondary btn-sm" onClick={() => setDetailUnit(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {showImport && <CsvImportModal moduleName="Units" config={importConfig} onClose={() => { setShowImport(false); load(); }} />}
    </div>
  );
}
