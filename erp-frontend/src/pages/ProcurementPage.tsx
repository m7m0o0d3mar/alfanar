import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { exportCSV } from '../utils/csv';
import CsvImportModal from '../components/CsvImportModal';
import { type SyncConfig } from '../services/syncService';
import { Plus, Download, Upload, Edit3, Search, Eye, Star, TrendingUp, DollarSign, Award, FileText, ShoppingCart, Package, CheckCircle } from 'lucide-react';
import Pagination from '../components/Pagination';

interface PurchaseOrder {
  id: string; po_no: string; title: string; supplier_id: string;
  order_date: string; status: string; total_amount: number; currency: string;
  grand_total: number; project_id: string;
  project?: { project_code: string; name_en: string };
}
interface Supplier {
  id: string; supplier_code: string; name_en: string; name_ar: string; phone: string;
  email: string; address: string; cr_number: string; vat_number: string;
  contact_person: string; is_approved: boolean;
}
interface Project { id: string; name_en: string; project_code: string; }
interface PR { id: string; pr_no: string; title_en: string; urgency: string; status: string; total_estimated: number; currency: string; created_at: string; project_id?: string; project?: { project_code: string; name_en: string }; }
interface SourcingEvent { id: string; event_no: string; title_en: string; type: string; status: string; close_date?: string; project_id?: string; project?: { project_code: string; name_en: string }; }
interface ProcContract { id: string; contract_no: string; title_en: string; type: string; status: string; total_value: number; supplier_name?: string; project_id?: string; project?: { project_code: string; name_en: string }; }
interface SuppEval { id: string; supplier_id: string; overall_score?: number; rating?: string; evaluation_date: string; comments?: string; }
interface ProcBudget { id: string; fiscal_year: number; allocated_amount: number; spent_amount: number; currency: string; project_id?: string; project?: { project_code: string; name_en: string }; }
interface GoodsReceipt { id: string; grn_no: string; po_id: string; warehouse_id: string; receipt_date: string; status: string; notes: string; project_id: string; received_by: string; po?: { po_no: string; title: string }; warehouse?: { name_en: string }; }

type Tab = 'pos' | 'suppliers' | 'pr' | 'sourcing' | 'contracts' | 'goods_receipt' | 'evaluations' | 'budgets';

export default function ProcurementPage() {
  const t = useT();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const pt = (key: string) => t('procurement_enhanced.' + key);
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<Tab>('pr');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const overlayRef = useRef<HTMLDivElement>(null);

  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [prs, setPrs] = useState<PR[]>([]);
  const [events, setEvents] = useState<SourcingEvent[]>([]);
  const [contracts, setContracts] = useState<ProcContract[]>([]);
  const [evaluations, setEvaluations] = useState<SuppEval[]>([]);
  const [budgets, setBudgets] = useState<ProcBudget[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [warehouseList, setWarehouseList] = useState<{ id: string; name_en: string }[]>([]);
  const [receiptForm, setReceiptForm] = useState({ receipt_no: '', po_id: '', warehouse_id: '', receipt_date: new Date().toISOString().slice(0, 10), status: 'draft', notes: '' });
  const [receiptItems, setReceiptItems] = useState<{ material_id: string; qty_received: number; qty_accepted: number; batch_no: string }[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [prForm, setPrForm] = useState({ pr_no: '', title_en: '', project_id: '', urgency: 'normal', category_id: '', total_estimated: 0, currency: 'SAR', notes: '' });
  const [eventForm, setEventForm] = useState({ event_no: '', title_en: '', type: 'rfq', category_id: '', project_id: '', close_date: '', budget_range_min: 0, budget_range_max: 0, award_method: 'lowest_price', notes: '' });
  const [contractForm, setContractForm] = useState({ contract_no: '', title_en: '', supplier_id: '', project_id: '', type: 'purchase', total_value: 0, currency: 'SAR', start_date: '', end_date: '', auto_renew: false, notes: '' });
  const [evalForm, setEvalForm] = useState({ supplier_id: '', evaluation_date: new Date().toISOString().slice(0, 10), period: 'monthly', quality_score: 0, delivery_score: 0, price_score: 0, responsiveness_score: 0, compliance_score: 0, comments: '' });
  const emptyPOForm = { po_no: '', title: '', project_id: '', supplier_id: '', order_date: new Date().toISOString().slice(0, 10), status: 'draft', currency: 'SAR', total_amount: '', grand_total: '', delivery_date: '', notes: '' };
  const [filterProject, setFilterProject] = useState('');
  const [poForm, setPoForm] = useState(emptyPOForm);
  const emptySupForm = { supplier_code: '', name_en: '', name_ar: '', phone: '', email: '', address: '', cr_number: '', vat_number: '', contact_person: '' };
  const [supForm, setSupForm] = useState(emptySupForm);
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<{ description: string; quantity: number; unit_price: number; total: number }[]>([]);

  const nextReceiptNo = () => `GR-${Date.now().toString(36).toUpperCase()}`;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setShowForm(false); setFormError(''); load(); }, [activeTab]);
  useEffect(() => { if (showForm) overlayRef.current?.focus(); }, [showForm]);

  // Handle ?action=new_po or ?action=new_pr from dashboard quick actions
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new_po') {
      setActiveTab('pos');
      setTimeout(() => setShowForm(true), 0);
    } else if (action === 'new_pr') {
      setTimeout(() => setShowForm(true), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'pos', label: 'Purchase Orders', icon: <FileText size={14} /> },
    { key: 'suppliers', label: 'Suppliers', icon: <Award size={14} /> },
    { key: 'pr', label: pt('purchase_requisitions'), icon: <ShoppingCart size={14} /> },
    { key: 'sourcing', label: pt('sourcing'), icon: <TrendingUp size={14} /> },
    { key: 'contracts', label: pt('contracts'), icon: <FileText size={14} /> },
    { key: 'goods_receipt', label: 'Goods Receipt', icon: <Package size={14} /> },
    { key: 'evaluations', label: pt('supplier_performance'), icon: <Star size={14} /> },
    { key: 'budgets', label: pt('budgets'), icon: <DollarSign size={14} /> },
  ];

  async function load() {
    setLoading(true);
    try {
      const [poRes, supRes, projRes, prRes, evRes, ctRes, evalRes, budRes, grRes, whRes] = await Promise.all([
        supabase.from('purchase_orders').select('*, project:projects(project_code, name_en)').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('name_en'),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
        supabase.from('purchase_requisitions').select('*, project:projects(project_code, name_en)').order('created_at', { ascending: false }),
        supabase.from('sourcing_events').select('*, project:projects(project_code, name_en)').order('created_at', { ascending: false }),
        supabase.from('procurement_contracts').select('*, suppliers!inner(name_en), project:projects(project_code, name_en)').order('created_at', { ascending: false }),
        supabase.from('supplier_evaluations').select('*').order('evaluation_date', { ascending: false }),
        supabase.from('procurement_budgets').select('*, project:projects(project_code, name_en)').order('fiscal_year', { ascending: false }),
        supabase.from('goods_receipts').select('*, po:purchase_orders(po_no, title), warehouse:warehouses(name_en)').order('created_at', { ascending: false }),
        supabase.from('warehouses').select('id, name_en').is('is_active', true).order('name_en'),
      ]);
      setPos((poRes.data || []) as PurchaseOrder[]);
      setSuppliers((supRes.data || []) as Supplier[]);
      setProjects((projRes.data || []) as Project[]);
      setPrs((prRes.data || []) as PR[]);
      setEvents((evRes.data || []) as SourcingEvent[]);
      setContracts((ctRes.data || []).map((c: Record<string, unknown>) => ({ ...c, supplier_name: (c as { suppliers: { name_en: string } }).suppliers?.name_en })) as ProcContract[]);
      setEvaluations((evalRes.data || []) as SuppEval[]);
      setBudgets((budRes.data || []) as ProcBudget[]);
      setGoodsReceipts((grRes.data || []) as GoodsReceipt[]);
      setWarehouseList((whRes.data || []) as { id: string; name_en: string }[]);
    } catch (err) { console.error('load failed:', err); toast.error('Failed to load data.'); }
    finally { setLoading(false); }
  }

  function filtered<T>(items: T[], fields: (keyof T)[]): T[] {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(item => fields.some(f => String(item[f] || '').toLowerCase().includes(q)));
  }

  async function savePO() {
    if (!poForm.project_id || !poForm.supplier_id || !poForm.po_no.trim()) { setFormError('Required fields missing'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('purchase_orders').insert({
        po_no: poForm.po_no, title: poForm.title, project_id: poForm.project_id,
        supplier_id: poForm.supplier_id, order_date: poForm.order_date,
        delivery_date: poForm.delivery_date || null, notes: poForm.notes || null,
        total_amount: poForm.total_amount ? parseFloat(poForm.total_amount) : 0,
        grand_total: poForm.grand_total ? parseFloat(poForm.grand_total) : 0,
        status: poForm.status || 'draft', currency: poForm.currency || 'SAR',
      });
      if (error) throw error;
      toast.success(`PO "${poForm.po_no}" created`);
      setShowForm(false); setPoForm(emptyPOForm); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function saveSupplier() {
    if (!supForm.supplier_code.trim() || !supForm.name_en.trim()) { setFormError('Required fields missing'); return; }
    setSaving(true);
    try {
      const payload = { supplier_code: supForm.supplier_code, name_en: supForm.name_en, name_ar: supForm.name_ar || null, phone: supForm.phone || null, email: supForm.email || null, address: supForm.address || null, cr_number: supForm.cr_number || null, vat_number: supForm.vat_number || null, contact_person: supForm.contact_person || null };
      let error;
      if (editingSupId) ({ error } = await supabase.from('suppliers').update(payload).eq('id', editingSupId));
      else ({ error } = await supabase.from('suppliers').insert(payload));
      if (error) throw error;
      toast.success(editingSupId ? `Supplier updated` : `Supplier created`);
      setShowForm(false); setEditingSupId(null); setSupForm(emptySupForm); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function savePR() {
    if (!prForm.title_en.trim()) { setFormError('Title required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('purchase_requisitions').insert({
        pr_no: prForm.pr_no || `PR-${Date.now()}`, title_en: prForm.title_en, project_id: prForm.project_id || null,
        urgency: prForm.urgency, category_id: prForm.category_id || null, total_estimated: prForm.total_estimated,
        currency: prForm.currency, notes: prForm.notes || null,
      });
      if (error) throw error;
      toast.success('Requisition created');
      setShowForm(false); setPrForm({ ...prForm, pr_no: '' }); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function saveEvent() {
    if (!eventForm.title_en.trim()) { setFormError('Title required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('sourcing_events').insert({
        event_no: eventForm.event_no || `SRC-${Date.now()}`, title_en: eventForm.title_en,
        type: eventForm.type, category_id: eventForm.category_id || null, project_id: eventForm.project_id || null,
        close_date: eventForm.close_date || null, budget_range_min: eventForm.budget_range_min || 0,
        budget_range_max: eventForm.budget_range_max || 0, award_method: eventForm.award_method,
        notes: eventForm.notes || null,
      });
      if (error) throw error;
      toast.success('Sourcing event created');
      setShowForm(false); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function saveContract() {
    if (!contractForm.title_en.trim() || !contractForm.supplier_id) { setFormError('Title and supplier required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('procurement_contracts').insert({
        contract_no: contractForm.contract_no || `CT-${Date.now()}`, title_en: contractForm.title_en,
        supplier_id: contractForm.supplier_id, project_id: contractForm.project_id || null,
        type: contractForm.type, total_value: contractForm.total_value, currency: contractForm.currency,
        start_date: contractForm.start_date || null, end_date: contractForm.end_date || null,
        auto_renew: contractForm.auto_renew, notes: contractForm.notes || null,
      });
      if (error) throw error;
      toast.success('Contract created');
      setShowForm(false); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function saveEvaluation() {
    if (!evalForm.supplier_id) { setFormError('Supplier required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('supplier_evaluations').insert(evalForm);
      if (error) throw error;
      toast.success('Evaluation saved');
      setShowForm(false); setEvalForm({ ...evalForm, supplier_id: '' }); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function saveGoodsReceipt() {
    if (!receiptForm.po_id || !receiptForm.warehouse_id) { setFormError('PO and warehouse required'); return; }
    setSaving(true);
    try {
      const receiptNo = receiptForm.receipt_no || nextReceiptNo();
      const po = pos.find(p => p.id === receiptForm.po_id);
      const { data: { user } } = await supabase.auth.getUser();

      const { data: newGR, error: grError } = await supabase.from('goods_receipts').insert({
        grn_no: receiptNo,
        receipt_no: receiptNo,
        po_id: receiptForm.po_id,
        warehouse_id: receiptForm.warehouse_id,
        project_id: po?.project_id || null,
        receipt_date: receiptForm.receipt_date,
        status: receiptForm.status || 'draft',
        notes: receiptForm.notes || null,
        received_by: user?.id || null,
      }).select('id').single();

      if (grError) throw grError;
      if (receiptItems.length > 0 && newGR) {
        const { data: poItems } = await supabase.from('purchase_order_items').select('id, material_id').eq('po_id', receiptForm.po_id);
        const poItemMap = new Map((poItems || []).map(pi => [pi.material_id, pi.id]));

        const { error: liError } = await supabase.from('goods_receipt_items').insert(
          receiptItems.map(item => ({
            goods_receipt_id: newGR.id,
            po_item_id: poItemMap.get(item.material_id) || null,
            quantity_received: item.qty_received,
            quantity_accepted: item.qty_accepted,
            batch_no: item.batch_no || null,
          }))
        );
        if (liError) throw liError;
      }
      toast.success(`Goods Receipt "${receiptNo}" created`);
      setShowForm(false);
      setReceiptForm({ receipt_no: '', po_id: '', warehouse_id: '', receipt_date: new Date().toISOString().slice(0, 10), status: 'draft', notes: '' });
      setReceiptItems([]);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function completeGoodsReceipt(gr: GoodsReceipt) {
    try {
      const { error } = await supabase.from('goods_receipts').update({ status: 'completed' }).eq('id', gr.id);
      if (error) throw error;
      toast.success(`GR "${gr.grn_no}" completed`);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete GR');
    }
  }

  function statusBadge(status: string) {
    const colors: Record<string, string> = { draft: 'badge', pending_approval: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger', cancelled: 'badge', completed: 'badge-success', active: 'badge-success', ordered: 'badge-info' };
    return <span className={`badge capitalize ${colors[status] || 'badge'}`}>{status.replace(/_/g, ' ')}</span>;
  }

  function urgencyBadge(u: string) {
    const colors: Record<string, string> = { low: 'badge', normal: 'badge-info', high: 'badge-warning', critical: 'badge-danger' };
    return <span className={`badge ${colors[u] || 'badge'}`}>{u}</span>;
  }

  function statusBadgeGR(status: string) {
    const colors: Record<string, string> = { draft: 'badge', completed: 'badge-success', cancelled: 'badge-danger' };
    return <span className={`badge capitalize ${colors[status] || 'badge'}`}>{status.replace(/_/g, ' ')}</span>;
  }

  function renderForm() {
    const close = () => setShowForm(false);
    const fields = (children: React.ReactNode) => (
      <div ref={overlayRef} className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={close} onKeyDown={(e) => e.key === 'Escape' && close()} tabIndex={-1}>
        <div className="rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold mb-4">{getFormTitle()}</h3>
          {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
          <div className="space-y-4">{children}</div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary btn-sm" onClick={handleFormSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary btn-sm" onClick={close}>Cancel</button>
          </div>
        </div>
      </div>
    );

    switch (activeTab) {
      case 'pos': return fields(<>
        <div><label className="label">Project *</label><select className="input" value={poForm.project_id} onChange={(e) => setPoForm({ ...poForm, project_id: e.target.value })}><option value="">-- Select --</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}</select></div>
        <div><label className="label">Supplier *</label><select className="input" value={poForm.supplier_id} onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}><option value="">-- Select --</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplier_code} - {s.name_en}</option>)}</select></div>
        <div><label className="label">PO No *</label><input className="input" value={poForm.po_no} onChange={(e) => setPoForm({ ...poForm, po_no: e.target.value })} /></div>
        <div><label className="label">Title</label><input className="input" value={poForm.title} onChange={(e) => setPoForm({ ...poForm, title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Status</label><select className="input" value={poForm.status} onChange={(e) => setPoForm({ ...poForm, status: e.target.value })}><option value="draft">Draft</option><option value="pending_approval">Pending</option><option value="approved">Approved</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>
          <div><label className="label">Currency</label><input className="input" value={poForm.currency} readOnly /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Order Date</label><input type="date" className="input" value={poForm.order_date} onChange={(e) => setPoForm({ ...poForm, order_date: e.target.value })} /></div>
          <div><label className="label">Delivery Date</label><input type="date" className="input" value={poForm.delivery_date} onChange={(e) => setPoForm({ ...poForm, delivery_date: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Total</label><input type="number" className="input" value={poForm.total_amount} onChange={(e) => setPoForm({ ...poForm, total_amount: e.target.value })} /></div>
          <div><label className="label">Grand Total</label><input type="number" className="input" value={poForm.grand_total} onChange={(e) => setPoForm({ ...poForm, grand_total: e.target.value })} /></div>
        </div>
        <div><label className="label">Notes</label><textarea className="input" rows={2} value={poForm.notes} onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })} /></div>
        <div className="border-t pt-4">
          <label className="label mb-2">Line Items</label>
          {lineItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-5 gap-2 mb-2 items-end">
              <div className="col-span-2"><input className="input text-sm" placeholder="Description" value={item.description} onChange={(e) => { const i = [...lineItems]; i[idx].description = e.target.value; i[idx].total = i[idx].quantity * i[idx].unit_price; setLineItems(i); }} /></div>
              <div><input type="number" className="input text-sm" placeholder="Qty" value={item.quantity || ''} onChange={(e) => { const i = [...lineItems]; i[idx].quantity = parseInt(e.target.value) || 0; i[idx].total = i[idx].quantity * i[idx].unit_price; setLineItems(i); }} /></div>
              <div><input type="number" className="input text-sm" placeholder="Price" value={item.unit_price || ''} onChange={(e) => { const i = [...lineItems]; i[idx].unit_price = parseFloat(e.target.value) || 0; i[idx].total = i[idx].quantity * i[idx].unit_price; setLineItems(i); }} /></div>
              <div className="text-sm font-medium pt-2">{item.total.toLocaleString()}</div>
            </div>
          ))}
          <button className="btn-sm btn-secondary mt-1" onClick={() => setLineItems([...lineItems, { description: '', quantity: 0, unit_price: 0, total: 0 }])}>+ Add Line Item</button>
        </div>
      </>);

      case 'suppliers': return fields(<>
        <div><label className="label">Code *</label><input className="input" value={supForm.supplier_code} onChange={(e) => setSupForm({ ...supForm, supplier_code: e.target.value })} /></div>
        <div><label className="label">Name (EN) *</label><input className="input" value={supForm.name_en} onChange={(e) => setSupForm({ ...supForm, name_en: e.target.value })} /></div>
        <div><label className="label">Name (AR)</label><input className="input" value={supForm.name_ar} onChange={(e) => setSupForm({ ...supForm, name_ar: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4"><div><label className="label">Phone</label><input className="input" value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} /></div><div><label className="label">Email</label><input className="input" value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} /></div></div>
        <div className="grid grid-cols-2 gap-4"><div><label className="label">CR Number</label><input className="input" value={supForm.cr_number} onChange={(e) => setSupForm({ ...supForm, cr_number: e.target.value })} /></div><div><label className="label">VAT Number</label><input className="input" value={supForm.vat_number} onChange={(e) => setSupForm({ ...supForm, vat_number: e.target.value })} /></div></div>
        <div><label className="label">Contact Person</label><input className="input" value={supForm.contact_person} onChange={(e) => setSupForm({ ...supForm, contact_person: e.target.value })} /></div>
        <div><label className="label">Address</label><textarea className="input" rows={2} value={supForm.address} onChange={(e) => setSupForm({ ...supForm, address: e.target.value })} /></div>
      </>);

      case 'pr': return fields(<>
        <div><label className="label">{pt('title') || 'Title'} *</label><input className="input" value={prForm.title_en} onChange={(e) => setPrForm({ ...prForm, title_en: e.target.value })} /></div>
        <div><label className="label">PR No</label><input className="input" value={prForm.pr_no} onChange={(e) => setPrForm({ ...prForm, pr_no: e.target.value })} placeholder="Auto-generated if empty" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Project</label><select className="input" value={prForm.project_id} onChange={(e) => setPrForm({ ...prForm, project_id: e.target.value })}><option value="">--</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name_en}</option>)}</select></div>
          <div><label className="label">{pt('urgency')}</label><select className="input" value={prForm.urgency} onChange={(e) => setPrForm({ ...prForm, urgency: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">{pt('estimated_total')}</label><input type="number" className="input" value={prForm.total_estimated} onChange={(e) => setPrForm({ ...prForm, total_estimated: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">Currency</label><input className="input" value={prForm.currency} onChange={(e) => setPrForm({ ...prForm, currency: e.target.value })} /></div>
        </div>
        <div><label className="label">Notes</label><textarea className="input" rows={2} value={prForm.notes} onChange={(e) => setPrForm({ ...prForm, notes: e.target.value })} /></div>
      </>);

      case 'sourcing': return fields(<>
        <div><label className="label">Title *</label><input className="input" value={eventForm.title_en} onChange={(e) => setEventForm({ ...eventForm, title_en: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">{pt('event_type')}</label><select className="input" value={eventForm.type} onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}><option value="rfq">RFQ</option><option value="rfi">RFI</option><option value="rfp">RFP</option><option value="auction">Auction</option></select></div>
          <div><label className="label">{pt('award_method')}</label><select className="input" value={eventForm.award_method} onChange={(e) => setEventForm({ ...eventForm, award_method: e.target.value })}><option value="lowest_price">Lowest Price</option><option value="best_value">Best Value</option><option value="highest_score">Highest Score</option></select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Close Date</label><input type="date" className="input" value={eventForm.close_date} onChange={(e) => setEventForm({ ...eventForm, close_date: e.target.value })} /></div>
          <div><label className="label">Project</label><select className="input" value={eventForm.project_id} onChange={(e) => setEventForm({ ...eventForm, project_id: e.target.value })}><option value="">--</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name_en}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Budget Min</label><input type="number" className="input" value={eventForm.budget_range_min} onChange={(e) => setEventForm({ ...eventForm, budget_range_min: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">Budget Max</label><input type="number" className="input" value={eventForm.budget_range_max} onChange={(e) => setEventForm({ ...eventForm, budget_range_max: parseFloat(e.target.value) || 0 })} /></div>
        </div>
        <div><label className="label">Notes</label><textarea className="input" rows={2} value={eventForm.notes} onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })} /></div>
      </>);

      case 'contracts': return fields(<>
        <div><label className="label">Title *</label><input className="input" value={contractForm.title_en} onChange={(e) => setContractForm({ ...contractForm, title_en: e.target.value })} /></div>
        <div><label className="label">Supplier *</label><select className="input" value={contractForm.supplier_id} onChange={(e) => setContractForm({ ...contractForm, supplier_id: e.target.value })}><option value="">-- Select --</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name_en}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">{pt('contract_type')}</label><select className="input" value={contractForm.type} onChange={(e) => setContractForm({ ...contractForm, type: e.target.value })}><option value="purchase">Purchase</option><option value="service">Service</option><option value="framework">Framework</option><option value="lease">Lease</option><option value="maintenance">Maintenance</option></select></div>
          <div><label className="label">Project</label><select className="input" value={contractForm.project_id} onChange={(e) => setContractForm({ ...contractForm, project_id: e.target.value })}><option value="">--</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name_en}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Start Date</label><input type="date" className="input" value={contractForm.start_date} onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })} /></div>
          <div><label className="label">End Date</label><input type="date" className="input" value={contractForm.end_date} onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">{pt('total_value')}</label><input type="number" className="input" value={contractForm.total_value} onChange={(e) => setContractForm({ ...contractForm, total_value: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">Currency</label><input className="input" value={contractForm.currency} onChange={(e) => setContractForm({ ...contractForm, currency: e.target.value })} /></div>
        </div>
        <div><label className="flex items-center gap-2"><input type="checkbox" checked={contractForm.auto_renew} onChange={(e) => setContractForm({ ...contractForm, auto_renew: e.target.checked })} /> {pt('auto_renew')}</label></div>
        <div><label className="label">Notes</label><textarea className="input" rows={2} value={contractForm.notes} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} /></div>
      </>);

      case 'evaluations': return fields(<>
        <div><label className="label">Supplier *</label><select className="input" value={evalForm.supplier_id} onChange={(e) => setEvalForm({ ...evalForm, supplier_id: e.target.value })}><option value="">-- Select --</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name_en}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Date</label><input type="date" className="input" value={evalForm.evaluation_date} onChange={(e) => setEvalForm({ ...evalForm, evaluation_date: e.target.value })} /></div>
          <div><label className="label">Period</label><select className="input" value={evalForm.period} onChange={(e) => setEvalForm({ ...evalForm, period: e.target.value })}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="biannual">Bi-annual</option><option value="annual">Annual</option></select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">{pt('quality_score')} (0-5)</label><input type="number" step="0.1" min="0" max="5" className="input" value={evalForm.quality_score} onChange={(e) => setEvalForm({ ...evalForm, quality_score: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">{pt('delivery_score')} (0-5)</label><input type="number" step="0.1" min="0" max="5" className="input" value={evalForm.delivery_score} onChange={(e) => setEvalForm({ ...evalForm, delivery_score: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">{pt('price_score')} (0-5)</label><input type="number" step="0.1" min="0" max="5" className="input" value={evalForm.price_score} onChange={(e) => setEvalForm({ ...evalForm, price_score: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">{pt('responsiveness_score')} (0-5)</label><input type="number" step="0.1" min="0" max="5" className="input" value={evalForm.responsiveness_score} onChange={(e) => setEvalForm({ ...evalForm, responsiveness_score: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="label">{pt('compliance_score')} (0-5)</label><input type="number" step="0.1" min="0" max="5" className="input" value={evalForm.compliance_score} onChange={(e) => setEvalForm({ ...evalForm, compliance_score: parseFloat(e.target.value) || 0 })} /></div>
        </div>
        <div><label className="label">Comments</label><textarea className="input" rows={2} value={evalForm.comments} onChange={(e) => setEvalForm({ ...evalForm, comments: e.target.value })} /></div>
      </>);

      case 'goods_receipt': return fields(<>
        <div><label className="label">Receipt No</label><input className="input" value={receiptForm.receipt_no || nextReceiptNo()} onChange={(e) => setReceiptForm({ ...receiptForm, receipt_no: e.target.value })} placeholder="Auto-generated" /></div>
        <div><label className="label">PO *</label><select className="input" value={receiptForm.po_id} onChange={(e) => { setReceiptForm({ ...receiptForm, po_id: e.target.value }); setReceiptItems([]); }}><option value="">-- Select PO --</option>{pos.filter(p => p.status === 'approved' || p.status === 'completed').map(p => <option key={p.id} value={p.id}>{p.po_no} - {p.title}</option>)}</select></div>
        <div><label className="label">Warehouse *</label><select className="input" value={receiptForm.warehouse_id} onChange={(e) => setReceiptForm({ ...receiptForm, warehouse_id: e.target.value })}><option value="">-- Select --</option>{warehouseList.map(w => <option key={w.id} value={w.id}>{w.name_en}</option>)}</select></div>
        <div><label className="label">Receipt Date</label><input type="date" className="input" value={receiptForm.receipt_date} onChange={(e) => setReceiptForm({ ...receiptForm, receipt_date: e.target.value })} /></div>
        <div><label className="label">Status</label><select className="input" value={receiptForm.status} onChange={(e) => setReceiptForm({ ...receiptForm, status: e.target.value })}><option value="draft">Draft</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>
        <div><label className="label">Notes</label><textarea className="input" rows={2} value={receiptForm.notes} onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })} /></div>
        {receiptForm.po_id && <div className="border-t pt-4">
          <label className="label mb-2">Receipt Line Items</label>
          {receiptItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-2 mb-2 items-end">
              <div><input className="input text-sm" placeholder="Material ID" value={item.material_id} onChange={(e) => { const i = [...receiptItems]; i[idx].material_id = e.target.value; setReceiptItems(i); }} /></div>
              <div><input type="number" className="input text-sm" placeholder="Qty Received" value={item.qty_received || ''} onChange={(e) => { const i = [...receiptItems]; i[idx].qty_received = parseInt(e.target.value) || 0; setReceiptItems(i); }} /></div>
              <div><input type="number" className="input text-sm" placeholder="Qty Accepted" value={item.qty_accepted || ''} onChange={(e) => { const i = [...receiptItems]; i[idx].qty_accepted = parseInt(e.target.value) || 0; setReceiptItems(i); }} /></div>
              <div><input className="input text-sm" placeholder="Batch No" value={item.batch_no} onChange={(e) => { const i = [...receiptItems]; i[idx].batch_no = e.target.value; setReceiptItems(i); }} /></div>
            </div>
          ))}
          <button className="btn-sm btn-secondary mt-1" onClick={() => setReceiptItems([...receiptItems, { material_id: '', qty_received: 0, qty_accepted: 0, batch_no: '' }])}>+ Add Line Item</button>
        </div>}
      </>);

      default: return null;
    }
  }

  function getFormTitle(): string {
    switch (activeTab) {
      case 'pos': return 'Create Purchase Order';
      case 'suppliers': return editingSupId ? 'Edit Supplier' : 'Create Supplier';
      case 'pr': return 'New Requisition';
      case 'sourcing': return 'New Sourcing Event';
      case 'contracts': return 'New Contract';
      case 'evaluations': return 'New Evaluation';
      case 'goods_receipt': return 'New Goods Receipt';
      default: return 'Create';
    }
  }

  function handleFormSave() {
    switch (activeTab) {
      case 'pos': savePO(); break;
      case 'suppliers': saveSupplier(); break;
      case 'pr': savePR(); break;
      case 'sourcing': saveEvent(); break;
      case 'contracts': saveContract(); break;
      case 'evaluations': saveEvaluation(); break;
      case 'goods_receipt': saveGoodsReceipt(); break;
    }
  }

  function renderTable() {
    if (loading) return <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>;

    switch (activeTab) {
      case 'pos': {
        const items = filtered(projectFiltered(pos), ['po_no', 'title']);
        return items.length === 0 ? <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No POs found</td></tr> :
          items.slice((page - 1) * pageSize, page * pageSize).map(po => (
            <tr key={po.id}>
              <td className="font-mono text-xs">{po.po_no}</td>
              <td className="font-medium">{po.title}</td>
              <td className="text-xs">{(po as any).project?.project_code || '-'}</td>
              <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{po.order_date}</td>
              <td>{statusBadge(po.status)}</td>
              <td>{po.grand_total ? `${po.grand_total.toLocaleString()} ${po.currency}` : '-'}</td>
              <td><button className="btn-sm btn-secondary" onClick={() => toast.info(`PO ${po.po_no}`)}><Eye size={14} /></button></td>
            </tr>
          ));
      }

      case 'suppliers': {
        const items = filtered(suppliers, ['name_en', 'supplier_code']);
        return items.length === 0 ? <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No suppliers found</td></tr> :
          items.slice((page - 1) * pageSize, page * pageSize).map(s => (
            <tr key={s.id}>
              <td className="font-mono text-xs">{s.supplier_code}</td>
              <td className="font-medium">{s.name_en}</td>
              <td>{s.name_ar || '-'}</td>
              <td>{s.contact_person || '-'}</td>
              <td>{s.phone || '-'}</td>
              <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.email || '-'}</td>
              <td><span className={`badge ${s.is_approved ? 'badge-success' : 'badge'}`}>{s.is_approved ? 'Approved' : 'Pending'}</span></td>
              <td><button className="btn-sm btn-secondary" onClick={() => { setSupForm({ supplier_code: s.supplier_code, name_en: s.name_en, name_ar: s.name_ar || '', phone: s.phone || '', email: s.email || '', address: s.address || '', cr_number: s.cr_number || '', vat_number: s.vat_number || '', contact_person: s.contact_person || '' }); setEditingSupId(s.id); setShowForm(true); }}><Edit3 size={14} /></button></td>
            </tr>
          ));
      }

      case 'pr': {
        const items = filtered(projectFiltered(prs), ['pr_no', 'title_en']);
        return items.length === 0 ? <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No requisitions found</td></tr> :
          items.slice((page - 1) * pageSize, page * pageSize).map(pr => (
            <tr key={pr.id}>
              <td className="font-mono text-xs">{pr.pr_no}</td>
              <td className="font-medium">{pr.title_en}</td>
              <td className="text-xs">{(pr as any).project?.project_code || '-'}</td>
              <td>{urgencyBadge(pr.urgency)}</td>
              <td>{statusBadge(pr.status)}</td>
              <td>{pr.total_estimated ? `${pr.total_estimated.toLocaleString()} ${pr.currency}` : '-'}</td>
              <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{new Date(pr.created_at).toLocaleDateString()}</td>
            </tr>
          ));
      }

      case 'sourcing': {
        const items = filtered(projectFiltered(events), ['event_no', 'title_en']);
        return items.length === 0 ? <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No sourcing events</td></tr> :
          items.slice((page - 1) * pageSize, page * pageSize).map(e => (
            <tr key={e.id}>
              <td className="font-mono text-xs">{e.event_no}</td>
              <td className="font-medium">{e.title_en}</td>
              <td className="text-xs">{(e as any).project?.project_code || '-'}</td>
              <td><span className="badge">{e.type.toUpperCase()}</span></td>
              <td>{statusBadge(e.status)}</td>
              <td className="text-sm">{e.close_date || '-'}</td>
              <td><button className="btn-sm btn-secondary" onClick={() => toast.info(`Event ${e.event_no}`)}><Eye size={14} /></button></td>
            </tr>
          ));
      }

      case 'contracts': {
        const items = filtered(projectFiltered(contracts), ['contract_no', 'title_en']);
        return items.length === 0 ? <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No contracts</td></tr> :
          items.slice((page - 1) * pageSize, page * pageSize).map(c => (
            <tr key={c.id}>
              <td className="font-mono text-xs">{c.contract_no}</td>
              <td className="font-medium">{c.title_en}</td>
              <td className="text-xs">{(c as any).project?.project_code || '-'}</td>
              <td>{c.supplier_name || '-'}</td>
              <td><span className="badge">{c.type}</span></td>
              <td>{statusBadge(c.status)}</td>
              <td>{c.total_value ? `${c.total_value.toLocaleString()} SAR` : '-'}</td>
            </tr>
          ));
      }

      case 'evaluations': {
        return evaluations.length === 0 ? <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No evaluations</td></tr> :
          evaluations.slice((page - 1) * pageSize, page * pageSize).map(ev => (
            <tr key={ev.id}>
              <td className="text-sm">{suppliers.find(s => s.id === ev.supplier_id)?.name_en || ev.supplier_id}</td>
              <td className="text-sm">{ev.evaluation_date}</td>
              <td><span className="font-medium">{ev.overall_score?.toFixed(1) || '-'}</span></td>
              <td>{ev.rating ? <span className={`badge ${ev.rating === 'excellent' ? 'badge-success' : ev.rating === 'good' ? 'badge-info' : ev.rating === 'average' ? 'badge-warning' : 'badge-danger'}`}>{ev.rating}</span> : '-'}</td>
              <td className="text-sm">{ev.comments || '-'}</td>
            </tr>
          ));
      }

      case 'budgets': {
        const projectBudgets = projectFiltered(budgets);
        return projectBudgets.length === 0 ? <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No budgets found</td></tr> :
          projectBudgets.slice((page - 1) * pageSize, page * pageSize).map(b => {
            const pct = b.allocated_amount > 0 ? Math.round((b.spent_amount / b.allocated_amount) * 100) : 0;
            return (
              <tr key={b.id}>
                <td className="font-mono text-xs">{b.fiscal_year}</td>
                <td className="text-xs">{(b as any).project?.project_code || '-'}</td>
                <td>{b.allocated_amount.toLocaleString()} {b.currency}</td>
                <td>{b.spent_amount.toLocaleString()} {b.currency}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
                      <div className={`h-2 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium">{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          });
      }

      case 'goods_receipt': {
        const items = filtered(goodsReceipts, ['grn_no']);
        return items.length === 0 ? <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No goods receipts found</td></tr> :
          items.slice((page - 1) * pageSize, page * pageSize).map(gr => (
            <tr key={gr.id}>
              <td className="font-mono text-xs">{gr.grn_no}</td>
              <td className="text-xs">{(gr as any).po?.po_no || '-'}</td>
              <td className="text-xs">{(gr as any).warehouse?.name_en || '-'}</td>
              <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{gr.receipt_date}</td>
              <td>{statusBadgeGR(gr.status)}</td>
              <td className="text-sm">{gr.notes || '-'}</td>
              <td>
                <div className="flex gap-1">
                  {gr.status === 'draft' && (
                    <button className="btn-sm btn-primary" onClick={() => completeGoodsReceipt(gr)} title="Complete GR">
                      <CheckCircle size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ));
      }
    }
  }

  const projectFiltered = <T extends { project_id?: string }>(items: T[]) =>
    !filterProject ? items : items.filter((i) => i.project_id === filterProject);

  const totalItems: Record<Tab, number> = {
    pos: projectFiltered(pos).length, suppliers: suppliers.length,
    pr: projectFiltered(prs).length, sourcing: projectFiltered(events).length,
    contracts: projectFiltered(contracts).length, goods_receipt: goodsReceipts.length,
    evaluations: evaluations.length,
    budgets: projectFiltered(budgets).length,
  };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('nav.procurement')}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{totalItems[activeTab]} records</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { const data = { pos, suppliers, pr: prs, sourcing: events, contracts, goods_receipt: goodsReceipts, evaluations, budgets }[activeTab]; if (data?.length) exportCSV(data as unknown as Record<string, unknown>[], `${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`); }}><Download size={14} /> Export</button>
          <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}><Upload size={14} /> Import</button>
          {hasPermission('procurement', 'create') && <button className="btn-primary btn-sm" onClick={() => { setFormError(''); setShowForm(true); }}><Plus size={16} /> New</button>}
        </div>
      </div>

      <div className="tabs flex-wrap gap-1">
        {tabs.map(tab => (
          <button key={tab.key} className={`tab inline-flex items-center gap-1.5 ${activeTab === tab.key ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input max-w-[200px]" value={filterProject} onChange={(e) => { setFilterProject(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              {activeTab === 'pos' && <tr><th>PO No</th><th>Title</th><th>Project</th><th>Date</th><th>Status</th><th>Total</th><th>Actions</th></tr>}
              {activeTab === 'suppliers' && <tr><th>Code</th><th>Name (EN)</th><th>Name (AR)</th><th>Contact</th><th>Phone</th><th>Email</th><th>Status</th><th>Actions</th></tr>}
              {activeTab === 'pr' && <tr><th>PR No</th><th>Title</th><th>Project</th><th>Urgency</th><th>Status</th><th>Est. Total</th><th>Date</th></tr>}
              {activeTab === 'sourcing' && <tr><th>Event No</th><th>Title</th><th>Project</th><th>Type</th><th>Status</th><th>Close Date</th><th>Actions</th></tr>}
              {activeTab === 'contracts' && <tr><th>Contract No</th><th>Title</th><th>Project</th><th>Supplier</th><th>Type</th><th>Status</th><th>Value</th></tr>}
              {activeTab === 'evaluations' && <tr><th>Supplier</th><th>Date</th><th>Score</th><th>Rating</th><th>Comments</th><th></th></tr>}
              {activeTab === 'budgets' && <tr><th>Fiscal Year</th><th>Project</th><th>Allocated</th><th>Spent</th><th>Utilization</th><th></th></tr>}
              {activeTab === 'goods_receipt' && <tr><th>Receipt No</th><th>PO No</th><th>Warehouse</th><th>Date</th><th>Status</th><th>Notes</th><th>Actions</th></tr>}
            </thead>
            <tbody>{renderTable()}</tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={totalItems[activeTab]} onChange={setPage} />
      </div>

      {showForm && renderForm()}

      {showImport && activeTab === 'goods_receipt' && (() => {
        const importConfig: SyncConfig = {
          table: 'goods_receipts',
          columns: [{ key: 'receipt_no', label: 'Receipt No', required: true }, { key: 'notes', label: 'Notes' }, { key: 'status', label: 'Status' }],
          defaults: { status: 'draft' },
          fkResolvers: [],
        };
        return <CsvImportModal moduleName="Import" config={importConfig} onClose={() => { setShowImport(false); load(); }} />;
      })()}

      {showImport && activeTab !== 'goods_receipt' && (() => {
        const importConfig: SyncConfig = {
          table: 'purchase_orders',
          columns: [{ key: 'po_no', label: 'PO No', required: true }, { key: 'title', label: 'Title' }],
          defaults: { status: 'draft', currency: 'SAR' },
          fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }, { column: 'supplier_id', table: 'suppliers', lookupField: 'supplier_code', targetField: 'id' }],
        };
        return <CsvImportModal moduleName="Import" config={importConfig} onClose={() => { setShowImport(false); load(); }} />;
      })()}
    </div>
  );
}
