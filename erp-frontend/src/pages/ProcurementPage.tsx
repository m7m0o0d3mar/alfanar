import { useState, useEffect, useRef } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { exportCSV } from '../utils/csv';
import CsvImportModal from '../components/CsvImportModal';
import { type SyncConfig } from '../services/syncService';
import { Plus, Download, Upload, Edit3, Search, Eye } from 'lucide-react';
import Pagination from '../components/Pagination';

interface PurchaseOrder {
  id: string; po_no: string; title: string; supplier_id: string;
  order_date: string; status: string; total_amount: number; currency: string;
  grand_total: number; project_id: string;
}

interface Supplier {
  id: string; supplier_code: string; name_en: string; name_ar: string; phone: string;
  email: string; address: string; cr_number: string; vat_number: string;
  contact_person: string; is_approved: boolean;
}

interface Project {
  id: string; name_en: string; project_code: string;
}

export default function ProcurementPage() {
  const t = useT();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'pos' | 'suppliers'>('pos');
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showForm) overlayRef.current?.focus();
  }, [showForm]);

  const emptyForm = { po_no: '', title: '', project_id: '', supplier_id: '', order_date: new Date().toISOString().slice(0, 10), status: 'draft', currency: 'SAR', total_amount: '', grand_total: '', delivery_date: '', payment_terms: '', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const emptySupplierForm = { supplier_code: '', name_en: '', name_ar: '', phone: '', email: '', address: '', cr_number: '', vat_number: '', contact_person: '' };
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<{ description: string; quantity: number; unit_price: number; total: number }[]>([]);

  useEffect(() => { load(); }, [activeTab]);

  async function load() {
    setLoading(true);
    try {
      const [posRes, supRes, projRes] = await Promise.all([
        activeTab === 'pos' ? supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.from('suppliers').select('id, supplier_code, name_en, name_ar, contact_person, phone, email, address, cr_number, vat_number, is_approved').order('name_en'),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
      ]);
      setPos((posRes.data || []) as PurchaseOrder[]);
      setSuppliers((supRes.data || []) as Supplier[]);
      setProjects((projRes.data || []) as Project[]);
    } catch (err) {
      console.error('Failed to load procurement data:', err);
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  const filteredPos = pos.filter((p) => !search || p.po_no.toLowerCase().includes(search.toLowerCase()) || p.title.toLowerCase().includes(search.toLowerCase()));
  const filteredSuppliers = suppliers.filter((s) => !search || s.name_en.toLowerCase().includes(search.toLowerCase()) || s.supplier_code.toLowerCase().includes(search.toLowerCase()));

  async function save() {
    setFormError('');
    if (activeTab === 'pos') {
      if (!form.project_id) { setFormError('Project is required'); return; }
      if (!form.supplier_id) { setFormError('Supplier is required'); return; }
      if (!form.po_no.trim()) { setFormError('PO No is required'); return; }
      setSaving(true);
      try {
        const { error } = await supabase.from('purchase_orders').insert({
          po_no: form.po_no, title: form.title, project_id: form.project_id,
          supplier_id: form.supplier_id, order_date: form.order_date,
          total_amount: form.total_amount ? parseFloat(form.total_amount) : 0,
          grand_total: form.grand_total ? parseFloat(form.grand_total) : 0,
          status: form.status || 'draft',
          currency: form.currency || 'SAR',
        });
        if (error) throw error;
        toast.success(`PO "${form.po_no}" created`);
        setShowForm(false); setForm(emptyForm); load();
      } catch (err: unknown) {
        console.error('PO save failed:', err);
        const msg = err instanceof Error ? err.message : 'Save failed';
        setFormError(msg);
        toast.error(msg);
      } finally { setSaving(false); }
    } else {
      if (!supplierForm.supplier_code.trim()) { setFormError('Supplier code is required'); return; }
      if (!supplierForm.name_en.trim()) { setFormError('Supplier name is required'); return; }
      setSaving(true);
      try {
        const payload = {
          supplier_code: supplierForm.supplier_code,
          name_en: supplierForm.name_en,
          name_ar: supplierForm.name_ar || null,
          phone: supplierForm.phone || null,
          email: supplierForm.email || null,
          address: supplierForm.address || null,
          cr_number: supplierForm.cr_number || null,
          vat_number: supplierForm.vat_number || null,
          contact_person: supplierForm.contact_person || null,
        };
        let error;
        if (editingSupplierId) {
          ({ error } = await supabase.from('suppliers').update(payload).eq('id', editingSupplierId));
        } else {
          ({ error } = await supabase.from('suppliers').insert(payload));
        }
        if (error) throw error;
        toast.success(editingSupplierId ? `Supplier "${supplierForm.name_en}" updated` : `Supplier "${supplierForm.name_en}" created`);
        setShowForm(false); setEditingSupplierId(null); setSupplierForm(emptySupplierForm); load();
      } catch (err: unknown) {
        console.error('Supplier save failed:', err);
        const msg = err instanceof Error ? err.message : 'Save failed';
        setFormError(msg);
        toast.error(msg);
      } finally { setSaving(false); }
    }
  }

  const poColumns = [
    { key: 'po_no', label: 'PO No', required: true },
    { key: 'title', label: 'Title', required: true },
    { key: 'order_date', label: 'Order Date' },
    { key: 'status', label: 'Status' },
    { key: 'grand_total', label: 'Grand Total', type: 'number' as const },
  ];

  const supplierColumns = [
    { key: 'supplier_code', label: 'Supplier Code', required: true },
    { key: 'name_en', label: 'Name (EN)', required: true },
    { key: 'name_ar', label: 'Name (AR)' },
    { key: 'contact_person', label: 'Contact Person' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
  ];

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('nav.procurement')}</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{activeTab === 'pos' ? `${pos.length} POs` : `${suppliers.length} Suppliers`}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => {
            const data = activeTab === 'pos' ? filteredPos : filteredSuppliers;
            if (data.length) exportCSV(data as unknown as Record<string, unknown>[], `${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
          }}><Download size={14} /> {t('admin.export_csv')}</button>
          <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}><Upload size={14} /> {t('admin.import_csv')}</button>
          <button className="btn-primary btn-sm" onClick={() => { setFormError(''); setEditingSupplierId(null); if (activeTab === 'pos') setForm(emptyForm); else setSupplierForm(emptySupplierForm); setShowForm(true); }}>
            <Plus size={16} /> {activeTab === 'pos' ? 'New PO' : 'New Supplier'}
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'pos' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('pos')}>Purchase Orders</button>
        <button className={`tab ${activeTab === 'suppliers' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('suppliers')}>Suppliers</button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
        <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {activeTab === 'pos' ? (
                  <><th>PO No</th><th>Title</th><th>Date</th><th>Status</th><th>Total</th><th>{t('common.actions')}</th></>
                ) : (
                  <><th>Code</th><th>Name (EN)</th><th>Name (AR)</th><th>Contact</th><th>Phone</th><th>Email</th><th>Status</th><th>{t('common.actions')}</th></>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
              ) : activeTab === 'pos' && filteredPos.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.no_results')}</td></tr>
              ) : activeTab === 'suppliers' && filteredSuppliers.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.no_results')}</td></tr>
              ) : activeTab === 'pos' ? (
                filteredPos.slice((page - 1) * pageSize, page * pageSize).map((po) => (
                  <tr key={po.id}>
                    <td className="font-mono text-xs">{po.po_no}</td>
                    <td className="font-medium">{po.title}</td>
                    <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{po.order_date}</td>
                    <td><span className={`badge capitalize ${po.status === 'approved' ? 'badge-success' : po.status === 'draft' ? 'badge' : 'badge-warning'}`}>{po.status}</span></td>
                    <td>{po.grand_total ? `${po.grand_total.toLocaleString()} ${po.currency}` : '-'}</td>
                    <td><button className="btn-sm btn-secondary" onClick={() => toast.info(`PO ${po.po_no} view coming soon`)}><Eye size={14} /></button></td>
                  </tr>
                ))
              ) : (
                filteredSuppliers.slice((page - 1) * pageSize, page * pageSize).map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.supplier_code}</td>
                    <td className="font-medium">{s.name_en}</td>
                    <td>{s.name_ar || '-'}</td>
                    <td>{s.contact_person || '-'}</td>
                    <td>{s.phone || '-'}</td>
                    <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.email || '-'}</td>
                    <td><span className={`badge ${s.is_approved === true ? 'badge-success' : 'badge'}`}>{s.is_approved === true ? 'Approved' : 'Pending'}</span></td>
                    <td><button className="btn-sm btn-secondary" onClick={() => { setSupplierForm({ supplier_code: s.supplier_code, name_en: s.name_en, name_ar: s.name_ar || '', phone: s.phone || '', email: s.email || '', address: s.address || '', cr_number: s.cr_number || '', vat_number: s.vat_number || '', contact_person: s.contact_person || '' }); setEditingSupplierId(s.id); setShowForm(true); }}><Edit3 size={14} /></button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={activeTab === 'pos' ? filteredPos.length : filteredSuppliers.length} onChange={setPage} />
      </div>

      {showForm && (
        <div ref={overlayRef} className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)} onKeyDown={(e) => e.key === 'Escape' && setShowForm(false)} tabIndex={-1}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{activeTab === 'pos' ? 'Create Purchase Order' : 'Create Supplier'}</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              {activeTab === 'pos' ? (
                <>
                  <div><label className="label">Project *</label>
                    <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                      <option value="">-- Select Project --</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Supplier *</label>
                    <select className="input" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                      <option value="">-- Select Supplier --</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplier_code} - {s.name_en}</option>)}
                    </select>
                  </div>
                  <div><label className="label">PO No *</label><input className="input" value={form.po_no} onChange={(e) => setForm({ ...form, po_no: e.target.value })} /></div>
                  <div><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Status</label>
                      <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        <option value="draft">Draft</option>
                        <option value="pending_approval">Pending Approval</option>
                        <option value="approved">Approved</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div><label className="label">Currency</label><input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} readOnly /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Order Date</label><input type="date" className="input" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} /></div>
                    <div><label className="label">Delivery Date</label><input type="date" className="input" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Payment Terms</label><input className="input" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></div>
                    <div><label className="label">Total Amount</label><input type="number" className="input" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                  <div className="border-t pt-4">
                    <label className="label mb-2">Line Items</label>
                    {lineItems.map((item, idx) => (
                      <div key={`item-${idx}`} className="grid grid-cols-5 gap-2 mb-2 items-end">
                        <div className="col-span-2"><input className="input text-sm" placeholder="Description" value={item.description} onChange={(e) => {
                          const items = [...lineItems]; items[idx].description = e.target.value; items[idx].total = items[idx].quantity * items[idx].unit_price; setLineItems(items);
                        }} /></div>
                        <div><input type="number" className="input text-sm" placeholder="Qty" value={item.quantity || ''} onChange={(e) => {
                          const items = [...lineItems]; items[idx].quantity = parseInt(e.target.value) || 0; items[idx].total = items[idx].quantity * items[idx].unit_price; setLineItems(items);
                        }} /></div>
                        <div><input type="number" className="input text-sm" placeholder="Price" value={item.unit_price || ''} onChange={(e) => {
                          const items = [...lineItems]; items[idx].unit_price = parseFloat(e.target.value) || 0; items[idx].total = items[idx].quantity * items[idx].unit_price; setLineItems(items);
                        }} /></div>
                        <div className="text-sm font-medium pt-2">{item.total.toLocaleString()}</div>
                      </div>
                    ))}
                    <button className="btn-sm btn-secondary mt-1" onClick={() => setLineItems([...lineItems, { description: '', quantity: 0, unit_price: 0, total: 0 }])}>+ Add Line Item</button>
                    {lineItems.length > 0 && (
                      <div className="text-right mt-2 text-sm font-semibold">Subtotal: {lineItems.reduce((s, i) => s + i.total, 0).toLocaleString()}</div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div><label className="label">Supplier Code *</label><input className="input" value={supplierForm.supplier_code} onChange={(e) => setSupplierForm({ ...supplierForm, supplier_code: e.target.value })} /></div>
                  <div><label className="label">Name (EN) *</label><input className="input" value={supplierForm.name_en} onChange={(e) => setSupplierForm({ ...supplierForm, name_en: e.target.value })} /></div>
                  <div><label className="label">Name (AR)</label><input className="input" value={supplierForm.name_ar} onChange={(e) => setSupplierForm({ ...supplierForm, name_ar: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Phone</label><input className="input" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></div>
                    <div><label className="label">Email</label><input className="input" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">CR Number</label><input className="input" value={supplierForm.cr_number} onChange={(e) => setSupplierForm({ ...supplierForm, cr_number: e.target.value })} /></div>
                    <div><label className="label">VAT Number</label><input className="input" value={supplierForm.vat_number} onChange={(e) => setSupplierForm({ ...supplierForm, vat_number: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Contact Person</label><input className="input" value={supplierForm.contact_person} onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })} /></div>
                  <div><label className="label">Address</label><textarea className="input" rows={2} value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} /></div>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : t('common.save')}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (() => {
        const importConfig: SyncConfig = {
          table: activeTab === 'pos' ? 'purchase_orders' : 'suppliers',
          columns: activeTab === 'pos' ? poColumns : supplierColumns,
          defaults: activeTab === 'pos' ? { status: 'draft', currency: 'SAR' } : {},
          fkResolvers: activeTab === 'pos' ? [
            { column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' },
            { column: 'supplier_id', table: 'suppliers', lookupField: 'supplier_code', targetField: 'id' },
          ] : [],
        };
        return (
          <CsvImportModal
            moduleName={activeTab === 'pos' ? 'Purchase Orders' : 'Suppliers'}
            config={importConfig}
            onClose={() => { setShowImport(false); load(); }}
          />
        );
      })()}
    </div>
  );
}
