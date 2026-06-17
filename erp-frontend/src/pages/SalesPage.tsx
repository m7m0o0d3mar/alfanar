import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { exportCSV } from '../utils/csv';
import CsvImportModal from '../components/CsvImportModal';
import { type SyncConfig } from '../services/syncService';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Upload, Eye, Search, Trash2 } from 'lucide-react';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';

interface Project {
  id: string; name_en: string; project_code: string;
}

interface UnitOption {
  id: string; unit_code: string; unit_type: string; price: number | null; project_id?: string;
}

interface CustomerOption {
  id: string; full_name_en: string; customer_code: string;
}

export default function SalesPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name_en: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'leads' | 'customers' | 'unit_sales'>('leads');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formError, setFormError] = useState('');
  const emptyLeadForm = { lead_no: '', full_name: '', phone: '', email: '' };
  const emptyCustomerForm = { customer_code: '', full_name_en: '', phone: '', email: '' };
  const emptySaleForm = { unit_id: '', customer_id: '', sale_price: '' };
  const [leadForm, setLeadForm] = useState(emptyLeadForm);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [detailLead, setDetailLead] = useState<Record<string, unknown> | null>(null);
  const [editLeadMode, setEditLeadMode] = useState(false);
  const [editLeadForm, setEditLeadForm] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [deleting, setDeleting] = useState<{ table: string; id: string; label: string } | null>(null);

  const tables: Record<string, string> = { leads: 'leads', customers: 'customers', unit_sales: 'unit_sales' };

  useEffect(() => { setPage(1); load(); }, [tab]);

  useEffect(() => {
    if (detailLead) {
      setEditLeadMode(false);
      setEditLeadForm({});
    }
  }, [detailLead]);

  async function load() {
    setLoading(true);
    try {
      const tbl = tables[tab];
      const [dataRes, projRes, unitsRes, custRes, userRes] = await Promise.all([
        supabase.from(tbl).select(tbl === 'unit_sales' ? '*, unit:unit_id(*), customer:customer_id(*)' : '*').order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
        supabase.from('units').select('id, unit_code, unit_type, price, project_id').eq('is_active', true).order('unit_code'),
        supabase.from('customers').select('id, full_name_en, customer_code').order('full_name_en'),
        supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
      ]);
      setData((dataRes.data || []) as unknown as Record<string, unknown>[]);
      setProjects((projRes.data || []) as Project[]);
      setUnits((unitsRes.data || []) as UnitOption[]);
      setCustomers((custRes.data || []) as CustomerOption[]);
      setUsers((userRes.data || []) as { id: string; full_name_en: string }[]);
    } catch (err) {
      console.error('Failed to load sales data:', err);
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(table: string, id: string) {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted successfully');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
    setDeleting(null);
  }

  const filtered = data.filter((i) => {
    const searchVal = search.toLowerCase();
    if (!search) return true;
    if (tab === 'unit_sales') {
      return String(i.sale_no || i.sale_price || '').toLowerCase().includes(searchVal) || String(i.unit_id || '').toLowerCase().includes(searchVal);
    }
    return String(i.full_name || i.full_name_en || i.company_name || i.lead_no || '').toLowerCase().includes(searchVal);
  });

  const columnsMap = {
    leads: [
      { key: 'lead_no', label: 'Lead No', required: false },
      { key: 'full_name', label: 'Full Name', required: true },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'email', label: 'Email', required: false },
      { key: 'status', label: 'Status', required: false },
      { key: 'assigned_to', label: 'Assigned To', required: false },
    ],
    customers: [
      { key: 'customer_code', label: 'Customer Code', required: true },
      { key: 'full_name_en', label: 'Full Name', required: true },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'email', label: 'Email', required: false },
    ],
    unit_sales: [
      { key: 'sale_no', label: 'Sale No' },
      { key: 'unit_id', label: 'Unit', required: true },
      { key: 'customer_id', label: 'Customer', required: true },
      { key: 'sale_price', label: 'Sale Price', type: 'number' as const, required: false },
      { key: 'sale_date', label: 'Sale Date', required: false },
      { key: 'status', label: 'Status', required: false },
    ],
  };
  const columns = columnsMap[tab] as { key: string; label: string; required?: boolean; type?: 'string' | 'number' | 'date' }[];

  function renderCellValue(row: Record<string, unknown>, c: { key: string; type?: string }) {
    if (tab === 'unit_sales' && c.key === 'unit_id')
      return String((row.unit as Record<string, unknown>)?.unit_code || row.unit_id || '-');
    if (tab === 'unit_sales' && c.key === 'customer_id')
      return String((row.customer as Record<string, unknown>)?.full_name_en || row.customer_id || '-');
    if (c.key === 'assigned_to')
      return row[c.key] ? (users.find(u => u.id === row[c.key])?.full_name_en || String(row[c.key])) : '-';
    if (c.type === 'number')
      return `${Number(row[c.key] || 0).toLocaleString()} SAR`;
    return String(row[c.key] || '-');
  }

  async function save() {
    setFormError('');
    setSaving(true);
    try {
      let payload: Record<string, unknown>;
      if (tab === 'leads') {
        if (!leadForm.full_name.trim()) { setFormError('Full Name is required'); setSaving(false); return; }
        payload = { lead_no: leadForm.lead_no || null, full_name: leadForm.full_name, phone: leadForm.phone || null, email: leadForm.email || null, status: 'new' };
      } else if (tab === 'customers') {
        if (!customerForm.full_name_en.trim()) { setFormError('Full Name is required'); setSaving(false); return; }
        payload = { customer_code: customerForm.customer_code || customerForm.full_name_en, full_name_en: customerForm.full_name_en, phone: customerForm.phone || null, email: customerForm.email || null };
      } else {
        if (!saleForm.unit_id) { setFormError('Unit is required'); setSaving(false); return; }
        if (!saleForm.customer_id) { setFormError('Customer is required'); setSaving(false); return; }
        const selectedUnit = units.find(u => u.id === saleForm.unit_id);
        payload = { unit_id: saleForm.unit_id, customer_id: saleForm.customer_id, sale_price: saleForm.sale_price ? Number(saleForm.sale_price) : 0, sale_date: new Date().toISOString().slice(0, 10), status: 'reserved', project_id: selectedUnit?.project_id || null };
      }
      const { error } = await supabase.from(tables[tab]).insert(payload);
      if (error) throw error;
      toast.success(`${tab.slice(0, -1)} created`);
      setShowForm(false); setLeadForm(emptyLeadForm); setCustomerForm(emptyCustomerForm); setSaleForm(emptySaleForm); load();
    } catch (err: unknown) {
      console.error('Sales save failed:', err);
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  async function generateLeadNo(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LD-${year}-`;
    const { data } = await supabase
      .from('leads')
      .select('lead_no')
      .like('lead_no', `${prefix}%`)
      .order('lead_no', { ascending: false })
      .limit(1);
    const lastSeq = data && data.length > 0
      ? parseInt((data[0] as { lead_no: string }).lead_no.replace(prefix, ''), 10) || 0
      : 0;
    return `${prefix}${String(lastSeq + 1).padStart(3, '0')}`;
  }

  async function saveLeadEdit() {
    if (!detailLead) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('leads').update(editLeadForm).eq('id', detailLead.id);
      if (error) throw error;
      toast.success('Lead updated');
      setEditLeadMode(false);
      setDetailLead({ ...detailLead, ...editLeadForm });
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally { setSaving(false); }
  }

  function handleOpenForm() {
    setFormError('');
    if (tab === 'leads') {
      generateLeadNo().then((no) => setLeadForm(prev => ({ ...prev, lead_no: no })));
    } else if (tab === 'customers') {
      setCustomerForm(emptyCustomerForm);
    } else {
      setSaleForm(emptySaleForm);
    }
    setShowForm(true);
  }

  const importConfig: SyncConfig = tab === 'leads'
    ? {
        table: 'leads',
        columns: columnsMap.leads,
        defaults: { status: 'new' },
      }
    : tab === 'customers'
    ? {
        table: 'customers',
        columns: columnsMap.customers,
      }
    : {
        table: 'unit_sales',
        columns: columnsMap.unit_sales,
        fkResolvers: [
          { column: 'unit_id', table: 'units', lookupField: 'unit_code', targetField: 'id' },
          { column: 'customer_id', table: 'customers', lookupField: 'customer_code', targetField: 'id' },
        ],
        defaults: { status: 'reserved' },
      };

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.sales')}</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as unknown as Record<string, unknown>[], `sales_${tab}_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> {t('admin.export_csv')}
          </button>
          <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={14} /> {t('admin.import_csv')}
          </button>
          <button className="btn-primary btn-sm" onClick={handleOpenForm}>
            <Plus size={16} /> New {tab === 'unit_sales' ? 'Sale' : tab === 'leads' ? 'Lead' : 'Customer'}
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'leads' ? 'tab-active' : ''}`} onClick={() => setTab('leads')}>Leads</button>
        <button className={`tab ${tab === 'customers' ? 'tab-active' : ''}`} onClick={() => setTab('customers')}>Customers</button>
        <button className={`tab ${tab === 'unit_sales' ? 'tab-active' : ''}`} onClick={() => setTab('unit_sales')}>Unit Sales</button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="text-center py-8 text-gray-400">{t('common.loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="text-center py-8 text-gray-400">{t('admin.no_results')}</td></tr>
              ) : (
                  filtered.slice((page - 1) * pageSize, page * pageSize).map((i: unknown) => {
                  const row = i as Record<string, unknown>;
                  return (
                    <tr key={row.id as string} className="clickable" onClick={() => tab === 'leads' ? setDetailLead(row) : toast.info('Full page view coming soon')}>
                      {columns.map((c) => (
                        <td key={c.key} className="text-sm">
                          {renderCellValue(row, c)}
                        </td>
                      ))}
                       <td>
                         {tab === 'leads' ? (
                           <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setDetailLead(row); }}><Eye size={14} /></button>
                         ) : (
                           <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); toast.info('Full page view coming soon'); }}><Eye size={14} /></button>
                         )}
                         <button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); setDeleting({ table: tables[tab], id: row.id as string, label: String(row.id) }); }}><Trash2 size={14} /></button>
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
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New {tab === 'unit_sales' ? 'Sale' : tab === 'leads' ? 'Lead' : 'Customer'}</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              {tab === 'unit_sales' ? (
                <>
                  <div><label className="label">Unit *</label>
                    <select className="input" value={saleForm.unit_id} onChange={(e) => setSaleForm({ ...saleForm, unit_id: e.target.value })}>
                      <option value="">-- Select Unit --</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.unit_code} - {u.unit_type} {u.price ? `(${u.price.toLocaleString()} SAR)` : ''}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Customer *</label>
                    <select className="input" value={saleForm.customer_id} onChange={(e) => setSaleForm({ ...saleForm, customer_id: e.target.value })}>
                      <option value="">-- Select Customer --</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_code} - {c.full_name_en}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Sale Price</label><input type="number" className="input" value={saleForm.sale_price} onChange={(e) => setSaleForm({ ...saleForm, sale_price: e.target.value })} /></div>
                </>
              ) : tab === 'leads' ? (
                <>
                  <div><label className="label">Lead No</label><input className="input" value={leadForm.lead_no} onChange={(e) => setLeadForm({ ...leadForm, lead_no: e.target.value })} /></div>
                  <div><label className="label">Full Name *</label><input className="input" value={leadForm.full_name} onChange={(e) => setLeadForm({ ...leadForm, full_name: e.target.value })} /></div>
                  <div><label className="label">Phone</label><input className="input" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} /></div>
                  <div><label className="label">Email</label><input className="input" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} /></div>
                </>
              ) : (
                <>
                  <div><label className="label">Customer Code</label><input className="input" value={customerForm.customer_code} onChange={(e) => setCustomerForm({ ...customerForm, customer_code: e.target.value })} /></div>
                  <div><label className="label">Full Name *</label><input className="input" value={customerForm.full_name_en} onChange={(e) => setCustomerForm({ ...customerForm, full_name_en: e.target.value })} /></div>
                  <div><label className="label">Phone</label><input className="input" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} /></div>
                  <div><label className="label">Email</label><input className="input" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} /></div>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {detailLead && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setDetailLead(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{editLeadMode ? 'Edit Lead' : 'Lead Details'}</h3>
            <div className="space-y-3">
              {Object.entries(detailLead).filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k)).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b pb-2 items-center">
                  <span className="font-medium text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                  {editLeadMode ? (
                    <input
                      className="input text-sm w-64"
                      value={editLeadForm[key] ?? String(val ?? '')}
                      onChange={e => setEditLeadForm({ ...editLeadForm, [key]: e.target.value })}
                    />
                  ) : (
                    <span className="text-gray-900">{key === 'assigned_to' && val ? (users.find(u => u.id === val)?.full_name_en || String(val)) : val != null ? String(val) : '-'}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              {editLeadMode ? (
                <>
                  <button className="btn-primary btn-sm" onClick={saveLeadEdit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="btn-secondary btn-sm" onClick={() => { setEditLeadMode(false); setEditLeadForm({}); }}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="btn-primary btn-sm" onClick={() => {
                    setEditLeadForm(Object.fromEntries(
                      Object.entries(detailLead).map(([k, v]) => [k, v != null ? String(v) : ''])
                    ));
                    setEditLeadMode(true);
                  }}>Edit</button>
                  <button className="btn-secondary btn-sm" onClick={() => setDetailLead(null)}>Close</button>
                </>
              )}
            </div>
            <div className="mt-3">
              <button className="btn-secondary btn-sm w-full" onClick={() => toast.info('Full page view coming soon')}>
                فتح الصفحة الكاملة
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && <CsvImportModal moduleName={`Sales ${tab}`} config={importConfig} onClose={() => { setShowImport(false); load(); }} />}

      {deleting && (
        <ConfirmDialog
          title="Delete"
          message={`Are you sure you want to delete "${deleting.label}"?`}
          variant="danger"
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleting.table, deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
