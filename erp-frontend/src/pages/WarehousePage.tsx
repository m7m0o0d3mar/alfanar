import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import { exportCSV } from '../utils/csv';
import { formatDate } from '../utils/date';
import CsvImportModal from '../components/CsvImportModal';
import { Plus, Download, Upload, Search, Edit3, Trash2, CheckCircle, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Warehouse { id: string; code: string; name_en: string; name_ar?: string; location?: string; project_id?: string; is_active: boolean; }
interface Material { id: string; code: string; name_en: string; name_ar?: string; category_id?: string; unit: string; default_price: number; is_active: boolean; }
interface MaterialCategory { id: string; code: string; name_en: string; name_ar?: string; }
interface InventoryItem { material_id: string; warehouse_id: string; material_code: string; material_name: string; unit: string; warehouse_code: string; warehouse_name: string; net_quantity: number; avg_unit_price: number; default_price: number; batch_count: number; }
interface StockMovement { id: string; movement_no: string; movement_type: string; warehouse_id: string; material_id: string; quantity: number; unit_price?: number; batch_no?: string; notes?: string; created_at: string; materials?: { code: string; name_en: string }; warehouses?: { code: string; name_en: string }; }
interface PR { id: string; pr_no: string; project_id?: string; status: string; notes?: string; created_at: string; }
interface WarehouseBin { id: string; warehouse_id: string; code: string; name_en?: string; name_ar?: string; zone?: string; max_capacity?: number; capacity_unit?: string; is_active?: boolean; warehouse?: { name_en: string }; }
interface StockAdjustment { id: string; adjustment_no: string; warehouse_id: string; adjustment_type: string; status: string; notes?: string; created_at: string; warehouse_name?: string; }
interface MatRequest { id: string; request_no: string; project_id?: string; task_id?: string; warehouse_id?: string; request_date: string; required_date?: string; status: string; priority: string; notes?: string; created_at: string; project?: { project_code: string; name_en: string }; }
interface MatRequestItem { id: string; request_id: string; material_id: string; quantity_requested: number; quantity_issued: number; unit?: string; materials?: { code: string; name_en: string }; }

type Tab = 'warehouses' | 'materials' | 'inventory' | 'movements' | 'requisitions' | 'bins' | 'adjustments' | 'material_requests';

const emptyItem = { code: '', name_en: '', name_ar: '', location: '', project_id: '', unit: 'pcs', category_id: '', default_price: 0, is_active: true, warehouse_id: '', material_id: '', quantity: 0, min_quantity: 0, unit_price: 0, batch_no: '', expiry_date: '', movement_type: 'received', notes: '', pr_no: '', status: 'draft', adjustment_type: 'surplus', priority: 'normal', zone: '', max_capacity: 0, capacity_unit: 'unit', request_no: '', request_date: '', required_date: '', task_id: '' };

export default function WarehousePage() {
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('warehouses');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formError, setFormError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [requisitions, setRequisitions] = useState<PR[]>([]);
  const [projects, setProjects] = useState<{ id: string; name_en: string; project_code: string }[]>([]);
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [matRequests, setMatRequests] = useState<MatRequest[]>([]);
  const [matRequestItems, setMatRequestItems] = useState<Record<string, MatRequestItem[]>>({});
  const [form, setForm] = useState(emptyItem);
  const [mrFormItems, setMrFormItems] = useState<{ material_id: string; quantity_requested: number; unit: string }[]>([]);
  const [viewingMrId, setViewingMrId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); load(); }, [activeTab]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  async function load() {
    setLoading(true);
    try {
      const [wRes, mRes, cRes, iRes, movRes, prRes, pRes, bRes, adjRes, mrRes, mriRes] = await Promise.all([
        supabase.from('warehouses').select('*').order('name_en'),
        supabase.from('materials').select('*').order('name_en'),
        supabase.from('material_categories').select('*').order('name_en'),
        activeTab === 'inventory' ? (async () => {
          const { data: d1 } = await supabase.from('inventory').select('*, materials(code, name_en, unit), warehouses(code, name_en)').order('id');
          if (d1 && d1.length > 0) {
            const mapped = d1.map((item: Record<string, unknown>) => ({
              material_id: item.material_id,
              warehouse_id: item.warehouse_id,
              material_code: (item.materials as Record<string, unknown>)?.['code'] || '',
              material_name: (item.materials as Record<string, unknown>)?.['name_en'] || '',
              unit: (item.materials as Record<string, unknown>)?.['unit'] || '',
              warehouse_code: (item.warehouses as Record<string, unknown>)?.['code'] || '',
              warehouse_name: (item.warehouses as Record<string, unknown>)?.['name_en'] || '',
              net_quantity: item.quantity as number || 0,
              avg_unit_price: (item.unit_price as number) || 0,
              default_price: 0,
              batch_count: item.batch_no ? 1 : 0,
            }));
            return { data: mapped, error: null };
          }
          return { data: [], error: null };
        })() : Promise.resolve({ data: [] }),
        activeTab === 'movements' ? (async () => {
          let d1: any[] | null = null;
          try {
            const r = await supabase.from('stock_movements').select('*, materials(code, name_en), warehouses(code, name_en)').limit(200);
            d1 = r.data;
          } catch (err) {
            console.error('Stock movements with joins failed:', err);
          }
          if (d1 && d1.length > 0) return { data: d1, error: null };
          try {
            const r = await supabase.from('stock_movements').select('*').limit(200);
            if (r.data && r.data.length > 0) return { data: r.data.map((m: Record<string, unknown>) => ({ ...m, materials: null, warehouses: null })), error: null };
          } catch (err) {
            console.error('Stock movements fallback failed:', err);
          }
          return { data: [], error: null };
        })() : Promise.resolve({ data: [] }),
        activeTab === 'requisitions' ? supabase.from('purchase_requisitions').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
        activeTab === 'bins' ? supabase.from('warehouse_bins').select('*, warehouse:warehouses(name_en)').order('code') : Promise.resolve({ data: [] }),
        activeTab === 'adjustments' ? supabase.from('stock_adjustments').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        activeTab === 'material_requests' ? supabase.from('material_requests').select('*, project:projects(project_code, name_en)').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        activeTab === 'material_requests' ? supabase.from('material_request_items').select('*, materials(code, name_en)') : Promise.resolve({ data: [] }),
      ]);
      setWarehouses(wRes.data as Warehouse[] || []);
      setMaterials(mRes.data as Material[] || []);
      setCategories(cRes.data as MaterialCategory[] || []);
      setInventory(iRes.data as InventoryItem[] || []);
      setMovements(movRes.data as StockMovement[] || []);
      setRequisitions(prRes.data as PR[] || []);
      setProjects(pRes.data as { id: string; name_en: string; project_code: string }[] || []);
      setBins(bRes.data as WarehouseBin[] || []);
      setAdjustments(adjRes.data as StockAdjustment[] || []);
      setMatRequests(mrRes.data as MatRequest[] || []);
      const mriData = mriRes.data as MatRequestItem[] || [];
      const grouped: Record<string, MatRequestItem[]> = {};
      for (const item of mriData) {
        if (!grouped[item.request_id]) grouped[item.request_id] = [];
        grouped[item.request_id].push(item);
      }
      setMatRequestItems(grouped);
    } catch (err) {
      console.error('Failed to load warehouse data:', err);
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  function filter<T extends Record<string, unknown>>(items: T[], keys: string[]): T[] {
    if (!debouncedSearch) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter((item) => keys.some(k => String(item[k] ?? '').toLowerCase().includes(q)));
  }

  async function save() {
    setFormError('');
    if (!form.code.trim() || !form.name_en.trim()) { setFormError('Code and Name are required'); return; }
    setSaving(true);
    try {
      let table = '';
      let payload: Record<string, unknown> = {};

      if (activeTab === 'warehouses') {
        table = 'warehouses';
        payload = { code: form.code, name_en: form.name_en, name_ar: form.name_ar || null, location: form.location || null, project_id: form.project_id || null };
        if (editId) payload.id = editId;
      } else if (activeTab === 'materials') {
        table = 'materials';
        payload = { code: form.code, name_en: form.name_en, name_ar: form.name_ar || null, category_id: form.category_id || null, unit: form.unit || 'pcs', default_price: form.default_price || 0 };
        if (editId) payload.id = editId;
      } else if (activeTab === 'inventory') {
        table = 'inventory';
        payload = { warehouse_id: form.warehouse_id, material_id: form.material_id, quantity: form.quantity, min_quantity: form.min_quantity || 0, unit_price: form.unit_price || null, batch_no: form.batch_no || null, expiry_date: form.expiry_date || null };
      } else if (activeTab === 'movements') {
        table = 'stock_movements';
        const { data: { user } } = await supabase.auth.getUser();
        payload = { movement_no: form.code, movement_type: form.movement_type, warehouse_id: form.warehouse_id, material_id: form.material_id, quantity: form.quantity, unit_price: form.unit_price || null, batch_no: form.batch_no || null, notes: form.notes || null, created_by: user?.id };
      } else if (activeTab === 'requisitions') {
        table = 'purchase_requisitions';
        payload = { pr_no: form.code, project_id: form.project_id || null, status: form.status, notes: form.notes || null };
      } else if (activeTab === 'bins') {
        table = 'warehouse_bins';
        payload = { code: form.code, name_en: form.name_en || null, name_ar: form.name_ar || null, zone: form.zone || null, warehouse_id: form.warehouse_id, max_capacity: form.max_capacity || null, capacity_unit: form.capacity_unit || null, is_active: form.is_active };
        if (editId) payload.id = editId;
      } else if (activeTab === 'adjustments') {
        table = 'stock_adjustments';
        payload = { adjustment_no: form.code, warehouse_id: form.warehouse_id, adjustment_type: form.adjustment_type, status: form.status, notes: form.notes || null };
      } else if (activeTab === 'material_requests') {
        table = 'material_requests';
        payload = { request_no: form.code, project_id: form.project_id || null, task_id: form.task_id || null, warehouse_id: form.warehouse_id || null, request_date: form.request_date || new Date().toISOString().slice(0, 10), required_date: form.required_date || null, status: form.status, priority: form.priority, notes: form.notes || null };
        if (!editId) {
          const { data: newMr, error: mrErr } = await supabase.from('material_requests').insert(payload).select('id').single();
          if (mrErr) throw mrErr;
          if (mrFormItems.length > 0 && newMr) {
            const { error: liErr } = await supabase.from('material_request_items').insert(
              mrFormItems.map(item => ({ request_id: newMr.id, material_id: item.material_id, quantity_requested: item.quantity_requested, unit: item.unit || null }))
            );
            if (liErr) throw liErr;
          }
          toast.success('Material Request created');
          setShowForm(false); setEditId(null); setForm({ ...emptyItem }); setMrFormItems([]); load();
          setSaving(false);
          return;
        }
      } else {
        setFormError('Invalid tab');
        setSaving(false);
        return;
      }

      if (editId) {
        const { error } = await supabase.from(table).update(payload).eq('id', editId);
        if (error) throw error;
        toast.success('Updated successfully');
      } else {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
        toast.success('Created successfully');
      }

      setShowForm(false); setEditId(null); setForm({ ...emptyItem }); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function issueMaterialRequest(mr: MatRequest) {
    try {
      // Fetch MR items and set quantity_issued = quantity_requested (auto full issue)
      const { data: items } = await supabase.from('material_request_items').select('id, quantity_requested').eq('request_id', mr.id);
      if (items && items.length > 0) {
        const updates = items.map(i => supabase.from('material_request_items').update({ quantity_issued: i.quantity_requested } as any).eq('id', i.id));
        await Promise.all(updates);
      }
      const { error } = await supabase.from('material_requests').update({ status: 'issued' }).eq('id', mr.id);
      if (error) throw error;
      toast.success(`MR "${mr.request_no}" issued — stock movements created`);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to issue MR');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const tableMap: Record<string, string> = { warehouses: 'warehouses', materials: 'materials', inventory: 'inventory', movements: 'stock_movements', requisitions: 'purchase_requisitions', bins: 'warehouse_bins', adjustments: 'stock_adjustments', material_requests: 'material_requests' };
    const table = tableMap[activeTab as string] || '';
    if (!table) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Deleted');
      setDeleteTarget(null); load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function openEditForm(item: any) {
    setFormError('');
    setEditId(item.id);
    setForm({
      code: item.code || item.movement_no || item.pr_no || item.adjustment_no || item.request_no || '',
      name_en: item.name_en || '',
      name_ar: item.name_ar || '',
      location: item.location || '',
      project_id: item.project_id || '',
      unit: item.unit || 'pcs',
      category_id: item.category_id || '',
      default_price: item.default_price || 0,
      warehouse_id: item.warehouse_id || '',
      material_id: item.material_id || '',
      quantity: item.quantity || 0,
      min_quantity: item.min_quantity || 0,
      unit_price: item.unit_price || 0,
      batch_no: item.batch_no || '',
      expiry_date: item.expiry_date || '',
      movement_type: item.movement_type || 'received',
      notes: item.notes || '',
      pr_no: item.pr_no || '',
      status: item.status || 'draft',
      is_active: item.is_active !== undefined ? item.is_active : true,
      adjustment_type: item.adjustment_type || 'surplus',
      priority: item.priority || 'normal',
      zone: item.zone || '',
      max_capacity: item.max_capacity || 0,
      capacity_unit: item.capacity_unit || 'unit',
      request_no: item.request_no || '',
      request_date: item.request_date || '',
      required_date: item.required_date || '',
      task_id: item.task_id || '',
    });
    setMrFormItems(matRequestItems[item.id]?.map(i => ({ material_id: i.material_id, quantity_requested: i.quantity_requested, unit: i.unit || '' })) || []);
    setShowForm(true);
  }

  function openNewForm() {
    setFormError(''); setEditId(null); setForm({ ...emptyItem }); setMrFormItems([]); setShowForm(true);
  }

  function renderTable(items: any[], cols: { key: string; label: string; render?: (item: any) => React.ReactNode }[], _emptyKey: string) {
    const filtered = filter(items, cols.map(c => c.key));
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
    return (
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr>{cols.map(c => <th key={c.key}>{c.label}</th>)}<th>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={cols.length + 1} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={cols.length + 1}><EmptyState title={'No records'} description="Add your first record to get started." actionLabel="Add New" onAction={activeTab === 'inventory' ? undefined : openNewForm} /></td></tr>
              ) : (
                paged.map((item) => (
                  <tr key={item.id}>
                    {cols.map(c => <td key={c.key}>{c.render ? c.render(item) : String(item[c.key] ?? '')}</td>)}
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-sm btn-secondary" onClick={() => openEditForm(item)}><Edit3 size={12} /></button>
                        {hasPermission('warehouse', 'delete') && (
                          <button className="btn-sm btn-danger" onClick={() => setDeleteTarget({ id: item.id, label: item.name_en || item.code || item.movement_no || item.pr_no })}><Trash2 size={12} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
      </div>
    );
  }

  // Column definitions
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.project_code]));

  const warehouseCols = [
    { key: 'code', label: 'Code', render: (w: Warehouse) => <span className="font-mono text-xs">{w.code}</span> },
    { key: 'name_en', label: 'Name (EN)' },
    { key: 'location', label: 'Location' },
    { key: 'project_id', label: 'Project', render: (w: Warehouse) => projectMap[w.project_id || ''] || '-' },
    { key: 'is_active', label: 'Status', render: (w: Warehouse) => <span className={`badge ${w.is_active ? 'badge-success' : 'badge'}`}>{w.is_active ? 'Active' : 'Inactive'}</span> },
  ];

  const materialCols = [
    { key: 'code', label: 'Code', render: (m: Material) => <span className="font-mono text-xs">{m.code}</span> },
    { key: 'name_en', label: 'Name (EN)' },
    { key: 'unit', label: 'Unit' },
    { key: 'default_price', label: 'Unit Price', render: (m: Material) => m.default_price ? `${Number(m.default_price).toFixed(2)} SAR` : '-' },
  ];

  const inventoryCols = [
    { key: 'material_code', label: 'Code', render: (i: InventoryItem) => <span className="font-mono text-xs">{i.material_code}</span> },
    { key: 'material_name', label: 'Material' },
    { key: 'warehouse_name', label: 'Warehouse' },
    { key: 'net_quantity', label: 'Net Qty', render: (i: InventoryItem) => {
      const isNegative = i.net_quantity < 0;
          return <span className={`font-mono text-xs ${isNegative ? 'text-red-600 font-semibold' : ''}`}>{i.net_quantity} {i.unit}</span>;
    }},
    { key: 'avg_unit_price', label: 'Avg Price', render: (i: InventoryItem) => `${Number(i.avg_unit_price).toFixed(2)} SAR` },
    { key: 'batch_count', label: 'Batches', render: (i: InventoryItem) => i.batch_count },
  ];

  const movementCols = [
    { key: 'movement_no', label: 'No', render: (m: StockMovement) => <span className="font-mono text-xs">{m.movement_no}</span> },
    { key: 'material_id', label: 'Material', render: (m: StockMovement) => m.materials ? `${m.materials.code} - ${m.materials.name_en}` : m.material_id?.slice(0, 8) },
    { key: 'warehouse_id', label: 'Warehouse', render: (m: StockMovement) => m.warehouses ? m.warehouses.name_en : m.warehouse_id?.slice(0, 8) },
    { key: 'movement_type', label: 'Type', render: (m: StockMovement) => <span className={`badge capitalize ${m.movement_type === 'received' ? 'badge-success' : m.movement_type === 'issued' ? 'badge-danger' : m.movement_type === 'transfer' ? 'badge' : 'badge'}`}>{m.movement_type}</span> },
    { key: 'quantity', label: 'Qty' },
    { key: 'batch_no', label: 'Batch', render: (m: StockMovement) => m.batch_no || '-' },
    { key: 'created_at', label: 'Date', render: (m: StockMovement) => formatDate(m.created_at) },
  ];

  const requisitionCols = [
    { key: 'pr_no', label: 'PR No', render: (p: PR) => <span className="font-mono text-xs">{p.pr_no}</span> },
    { key: 'project_id', label: 'Project', render: (p: PR) => projectMap[p.project_id || ''] || '-' },
    { key: 'status', label: 'Status', render: (p: PR) => <span className={`badge capitalize ${p.status === 'approved' ? 'badge-success' : p.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{p.status}</span> },
    { key: 'notes', label: 'Notes', render: (p: PR) => p.notes || '-' },
    { key: 'created_at', label: 'Date', render: (p: PR) => formatDate(p.created_at) },
  ];

  const binCols = [
    { key: 'code', label: 'Code', render: (b: WarehouseBin) => <span className="font-mono text-xs">{b.code}</span> },
    { key: 'name_en', label: 'Name (EN)' },
    { key: 'zone', label: 'Zone' },
    { key: 'warehouse_id', label: 'Warehouse', render: (b: WarehouseBin) => (b as any).warehouse?.name_en || b.warehouse_id?.slice(0, 8) },
    { key: 'max_capacity', label: 'Capacity', render: (b: WarehouseBin) => b.max_capacity ? `${b.max_capacity} ${b.capacity_unit || ''}` : '-' },
    { key: 'is_active', label: 'Status', render: (b: WarehouseBin) => <span className={`badge ${b.is_active ? 'badge-success' : 'badge'}`}>{b.is_active ? 'Active' : 'Inactive'}</span> },
  ];

  const adjCols = [
    { key: 'adjustment_no', label: 'Adjustment No', render: (a: StockAdjustment) => <span className="font-mono text-xs">{a.adjustment_no}</span> },
    { key: 'warehouse_id', label: 'Warehouse' },
    { key: 'adjustment_type', label: 'Type', render: (a: StockAdjustment) => {
      const colors: Record<string, string> = { surplus: 'badge-success', damage: 'badge-danger', loss: 'badge-warning', expiry: 'badge', correction: 'badge-info', return: 'badge' };
      return <span className={`badge capitalize ${colors[a.adjustment_type] || 'badge'}`}>{a.adjustment_type}</span>;
    }},
    { key: 'status', label: 'Status', render: (a: StockAdjustment) => {
      const colors: Record<string, string> = { draft: 'badge', pending_approval: 'badge-warning', approved: 'badge-success', completed: 'badge-info', cancelled: 'badge-danger' };
      return <span className={`badge capitalize ${colors[a.status] || 'badge'}`}>{a.status}</span>;
    }},
    { key: 'notes', label: 'Notes', render: (a: StockAdjustment) => a.notes || '-' },
    { key: 'created_at', label: 'Date', render: (a: StockAdjustment) => formatDate(a.created_at) },
  ];

  const showNewButton = activeTab !== 'inventory';

  function renderForm() {
    const { hasPermission } = useAuth();
    const isWarehouse = activeTab === 'warehouses';
    const isMaterial = activeTab === 'materials';
    const isInventory = activeTab === 'inventory';
    const isMovement = activeTab === 'movements';
    const isRequisition = activeTab === 'requisitions';
    const isBins = activeTab === 'bins';
    const isAdjustment = activeTab === 'adjustments';
    const isMatReq = activeTab === 'material_requests';

    const titleMap: Record<string, string> = { warehouses: 'Warehouse', materials: 'Material', inventory: 'Inventory Item', movements: 'Stock Movement', requisitions: 'Purchase Requisition', bins: 'Warehouse Bin', adjustments: 'Stock Adjustment', material_requests: 'Material Request' };

    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
        <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-semibold mb-4">{editId ? 'Edit' : 'New'} {titleMap[activeTab as string] || ''}</h3>
          {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}

          <div className="space-y-4">
            {/* Code + Name_en (warehouses, materials, movements, requisitions) */}
            {!isInventory && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Code *</label><input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
                <div><label className="label">Name (EN) *</label><input className="input" value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} /></div>
              </div>
            )}
            {!isInventory && <div><label className="label">Name (AR)</label><input className="input text-right" dir="rtl" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} /></div>}

            {/* Inventory: Material + Warehouse selects */}
            {isInventory && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Material *</label>
                    <select className="input" value={form.material_id} onChange={e => setForm({ ...form, material_id: e.target.value })}>
                      <option value="">-- Select --</option>
                      {materials.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.code} - {m.name_en}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Warehouse *</label>
                    <select className="input" value={form.warehouse_id} onChange={e => setForm({ ...form, warehouse_id: e.target.value })}>
                      <option value="">-- Select --</option>
                      {warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.code} - {w.name_en}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Quantity *</label><input type="number" className="input" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="label">Min Quantity</label><input type="number" className="input" value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Unit Price</label><input type="number" className="input" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="label">Batch No</label><input className="input" value={form.batch_no} onChange={e => setForm({ ...form, batch_no: e.target.value })} /></div>
                </div>
                <div><label className="label">Expiry Date</label><input type="date" className="input" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} /></div>
              </>
            )}

            {/* Warehouse: Project + Location */}
            {isWarehouse && (
              <>
                <div><label className="label">Project</label>
                  <select className="input" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                  </select>
                </div>
                <div><label className="label">Location</label><input className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
              </>
            )}

            {/* Material: Category + Unit + Price */}
            {isMaterial && (
              <>
                <div><label className="label">Category</label>
                  <select className="input" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name_en}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Unit</label>
                    <select className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                      {['pcs','kg','ton','m','m2','m3','l','box','roll','set'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Unit Price</label><input type="number" className="input" value={form.default_price} onChange={e => setForm({ ...form, default_price: parseFloat(e.target.value) || 0 })} /></div>
                </div>
              </>
            )}

            {/* Movement */}
            {isMovement && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Movement Type *</label>
                    <select className="input" value={form.movement_type} onChange={e => setForm({ ...form, movement_type: e.target.value })}>
                      <option value="received">Received</option>
                      <option value="issued">Issued</option>
                      <option value="transfer">Transfer</option>
                      <option value="adjustment">Adjustment</option>
                      <option value="return">Return</option>
                    </select>
                  </div>
                  <div><label className="label">Qty *</label><input type="number" className="input" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <div><label className="label">Warehouse *</label>
                  <select className="input" value={form.warehouse_id} onChange={e => setForm({ ...form, warehouse_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.code} - {w.name_en}</option>)}
                  </select>
                </div>
                {form.movement_type === 'transfer' && (
                  <div><label className="label">Destination Warehouse</label>
                    <select className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>
                      <option value="">-- Select --</option>
                      {warehouses.filter(w => w.is_active && w.id !== form.warehouse_id).map(w => <option key={w.id} value={w.id}>{w.code} - {w.name_en}</option>)}
                    </select>
                  </div>
                )}
                <div><label className="label">Material *</label>
                  <select className="input" value={form.material_id} onChange={e => setForm({ ...form, material_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {materials.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.code} - {m.name_en}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Unit Price</label><input type="number" className="input" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="label">Batch No</label><input className="input" value={form.batch_no} onChange={e => setForm({ ...form, batch_no: e.target.value })} /></div>
                </div>
                <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              </>
            )}

            {/* Requisition */}
            {isRequisition && (
              <>
                <div><label className="label">Project</label>
                  <select className="input" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                  </select>
                </div>
                <div><label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {['draft','submitted','approved','rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              </>
            )}

            {/* Bin */}
            {isBins && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Code *</label><input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
                  <div><label className="label">Name (EN)</label><input className="input" value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} /></div>
                </div>
                <div><label className="label">Name (AR)</label><input className="input text-right" dir="rtl" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Zone</label><input className="input" value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} /></div>
                  <div><label className="label">Warehouse *</label>
                    <select className="input" value={form.warehouse_id} onChange={e => setForm({ ...form, warehouse_id: e.target.value })}>
                      <option value="">-- Select --</option>
                      {warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.code} - {w.name_en}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Max Capacity</label><input type="number" className="input" value={form.max_capacity} onChange={e => setForm({ ...form, max_capacity: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="label">Capacity Unit</label>
                    <select className="input" value={form.capacity_unit} onChange={e => setForm({ ...form, capacity_unit: e.target.value })}>
                      {['unit','kg','ton','m3','l','box','pallet'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
              </>
            )}

            {/* Adjustment */}
            {isAdjustment && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Adjustment No *</label><input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
                  <div><label className="label">Type *</label>
                    <select className="input" value={form.adjustment_type} onChange={e => setForm({ ...form, adjustment_type: e.target.value })}>
                      {['surplus','damage','loss','expiry','correction','return'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className="label">Warehouse *</label>
                  <select className="input" value={form.warehouse_id} onChange={e => setForm({ ...form, warehouse_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.code} - {w.name_en}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Status</label>
                    <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                      {['draft','pending_approval','approved','completed','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              </>
            )}

            {/* Material Request */}
            {isMatReq && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Request No *</label><input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
                  <div><label className="label">Priority</label>
                    <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                      {['low','normal','high','urgent'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Project</label>
                    <select className="input" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                      <option value="">-- Select --</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Warehouse</label>
                    <select className="input" value={form.warehouse_id} onChange={e => setForm({ ...form, warehouse_id: e.target.value })}>
                      <option value="">-- Select --</option>
                      {warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.code} - {w.name_en}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className="label">Task ID (optional)</label><input className="input" value={form.task_id} onChange={e => setForm({ ...form, task_id: e.target.value })} placeholder="Link to execution task" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Request Date</label><input type="date" className="input" value={form.request_date} onChange={e => setForm({ ...form, request_date: e.target.value })} /></div>
                  <div><label className="label">Required Date</label><input type="date" className="input" value={form.required_date} onChange={e => setForm({ ...form, required_date: e.target.value })} /></div>
                </div>
                <div><label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {['draft','pending_approval','approved','partially_issued','issued','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                {/* Line Items */}
                {form.project_id && (
                  <div className="border-t pt-4">
                    <label className="label mb-2">Request Items</label>
                    {mrFormItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2 mb-2 items-end">
                        <div>
                          <select className="input text-sm" value={item.material_id} onChange={(e) => { const i = [...mrFormItems]; i[idx].material_id = e.target.value; const mat = materials.find(m => m.id === e.target.value); if (mat) i[idx].unit = mat.unit; setMrFormItems(i); }}>
                            <option value="">-- Material --</option>
                            {materials.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.code} - {m.name_en}</option>)}
                          </select>
                        </div>
                        <div><input type="number" className="input text-sm" placeholder="Qty" value={item.quantity_requested || ''} onChange={(e) => { const i = [...mrFormItems]; i[idx].quantity_requested = parseFloat(e.target.value) || 0; setMrFormItems(i); }} /></div>
                        <div className="flex gap-1 items-center">
                          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{item.unit || ''}</span>
                          <button className="btn-sm btn-danger ml-auto" onClick={() => { setMrFormItems(mrFormItems.filter((_, i) => i !== idx)); }}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                    <button className="btn-sm btn-secondary mt-1" onClick={() => setMrFormItems([...mrFormItems, { material_id: '', quantity_requested: 0, unit: '' }])}>+ Add Item</button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            {hasPermission('warehouse') && <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : editId ? 'Update' : 'Save'}</button>}
            <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('warehouse.title')}</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{warehouses.length} Warehouses</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-sm btn-secondary" onClick={() => {
            let data: unknown[] = [];
            if (activeTab === 'warehouses') data = warehouses;
            else if (activeTab === 'materials') data = materials;
            else if (activeTab === 'inventory') data = inventory;
            else if (activeTab === 'movements') data = movements;
            else if (activeTab === 'requisitions') data = requisitions;
            else if (activeTab === 'bins') data = bins;
            else if (activeTab === 'adjustments') data = adjustments;
            else if (activeTab === 'material_requests') data = matRequests;
            if (data.length) exportCSV(data as unknown as Record<string, unknown>[], `${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
          }}><Download size={14} /> Export</button>
          {(activeTab === 'warehouses' || activeTab === 'materials') && <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}><Upload size={14} /> Import</button>}
          {showNewButton && hasPermission('warehouse', 'create') && <button className="btn-primary btn-sm" onClick={openNewForm}><Plus size={16} /> New</button>}
        </div>
      </div>

      <div className="tabs overflow-x-auto">
        {(['warehouses','materials','inventory','movements','requisitions','bins','adjustments','material_requests'] as Tab[]).map(tab => (
          <button key={tab} className={`tab whitespace-nowrap ${activeTab === tab ? 'tab-active' : ''}`} onClick={() => setActiveTab(tab)}>{t(`warehouse.${tab}`)}</button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
        <input className="input ps-9" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {activeTab === 'warehouses' && renderTable(warehouses, warehouseCols, 'no_warehouses')}
      {activeTab === 'materials' && renderTable(materials, materialCols, 'no_materials')}
      {activeTab === 'inventory' && renderTable(inventory, inventoryCols, 'no_inventory')}
      {activeTab === 'movements' && renderTable(movements, movementCols, 'no_movements')}
      {activeTab === 'requisitions' && renderTable(requisitions, requisitionCols, 'no_requisitions')}
      {activeTab === 'bins' && renderTable(bins, binCols, 'no_bins')}
      {activeTab === 'adjustments' && renderTable(adjustments, adjCols, 'no_adjustments')}
      {activeTab === 'material_requests' && (() => {
        const filtered = !debouncedSearch ? matRequests : matRequests.filter(mr => mr.request_no?.toLowerCase().includes(debouncedSearch.toLowerCase()) || mr.project?.name_en?.toLowerCase().includes(debouncedSearch.toLowerCase()));
        const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
        return (
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Request No</th><th>Project</th><th>Priority</th><th>Status</th><th>Date</th><th>Required Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7}><EmptyState title="No material requests" description="Add your first request to get started." actionLabel="Add New" onAction={openNewForm} /></td></tr>
                  ) : (
                    paged.map(mr => (
                      <tr key={mr.id}>
                        <td><span className="font-mono text-xs">{mr.request_no}</span></td>
                        <td className="text-xs">{mr.project ? `${mr.project.project_code} - ${mr.project.name_en}` : projectMap[mr.project_id || ''] || '-'}</td>
                        <td><span className={`badge capitalize ${mr.priority === 'urgent' ? 'badge-danger' : mr.priority === 'high' ? 'badge-warning' : mr.priority === 'normal' ? 'badge-info' : 'badge'}`}>{mr.priority}</span></td>
                        <td><span className={`badge capitalize ${mr.status === 'issued' ? 'badge-info' : mr.status === 'approved' ? 'badge-success' : mr.status === 'cancelled' ? 'badge-danger' : mr.status === 'partially_issued' ? 'badge-info' : mr.status === 'pending_approval' ? 'badge-warning' : 'badge'}`}>{mr.status}</span></td>
                        <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(mr.created_at)}</td>
                        <td className="text-sm">{mr.required_date ? formatDate(mr.required_date) : '-'}</td>
                        <td>
                          <div className="flex gap-1">
                            {matRequestItems[mr.id]?.length > 0 && (
                              <button className="btn-sm btn-secondary" onClick={() => setViewingMrId(mr.id)} title="View Items"><Eye size={14} /></button>
                            )}
                            {mr.status === 'approved' && (
                              <button className="btn-sm btn-primary" onClick={() => issueMaterialRequest(mr)} title="Issue Materials"><CheckCircle size={14} /></button>
                            )}
                            <button className="btn-sm btn-secondary" onClick={() => openEditForm(mr)}><Edit3 size={12} /></button>
                            {hasPermission('warehouse', 'delete') && (
                              <button className="btn-sm btn-danger" onClick={() => setDeleteTarget({ id: mr.id, label: mr.request_no })}><Trash2 size={12} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
          </div>
        );
      })()}

      {viewingMrId && (() => {
        const items = matRequestItems[viewingMrId] || [];
        const mr = matRequests.find(r => r.id === viewingMrId);
        return (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setViewingMrId(null)}>
            <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-1">{mr?.request_no || 'Items'}</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>{items.length} item(s)</p>
              <table className="table mb-4">
                <thead><tr><th>Material</th><th>Qty Requested</th><th>Qty Issued</th></tr></thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="text-sm">{item.materials ? `${item.materials.code} - ${item.materials.name_en}` : item.material_id?.slice(0, 8)}</td>
                      <td className="text-sm">{item.quantity_requested}</td>
                      <td className="text-sm">{item.quantity_issued}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn-primary btn-sm" onClick={() => setViewingMrId(null)}>Close</button>
            </div>
          </div>
        );
      })()}

      {showForm && renderForm()}
      {showImport && <CsvImportModal
        moduleName={activeTab}
        config={
          activeTab === 'warehouses'
            ? {
                table: 'warehouses',
                columns: [
                  { key: 'code', label: 'Code', required: true },
                  { key: 'name_en', label: 'Name (EN)', required: true },
                  { key: 'name_ar', label: 'Name (AR)' },
                  { key: 'location', label: 'Location' },
                ],
                defaults: { is_active: true },
              }
            : {
                table: 'materials',
                columns: [
                  { key: 'code', label: 'Code', required: true },
                  { key: 'name_en', label: 'Name (EN)', required: true },
                  { key: 'unit', label: 'Unit' },
                ],
                defaults: { is_active: true },
              }
        }
        onClose={() => { setShowImport(false); load(); }}
      />}
      {deleteTarget && <ConfirmDialog title="Delete Record" message={`Are you sure you want to delete "${deleteTarget.label}"?`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}
