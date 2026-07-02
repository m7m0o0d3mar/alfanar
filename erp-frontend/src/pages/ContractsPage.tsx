import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import { exportCSV } from '../utils/csv';
import { formatDate } from '../utils/date';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import { Plus, Download, Search, Eye, Edit3, Trash2, FileText, Layers, GitCompareArrows, Calendar, Receipt } from 'lucide-react';

interface Project {
  id: string; project_code: string; name_en: string;
}

interface Contractor {
  id: string; name_en: string;
}

interface Contract {
  id: string; contract_no: string; project_id: string; contractor_id: string;
  contract_type: string; category: string; status: string; contract_amount: number;
  currency: string; start_date: string; end_date: string; description: string;
  title_en: string; signing_date: string; variations_total: number;
  created_at: string;
  project?: { project_code: string; name_en: string };
  contractor?: { name_en: string };
}

interface ScopeItem {
  id: string; contract_id: string; item_code: string; description_en: string;
  unit_of_measure: string; quantity: number; unit_price: number; total_price: number;
}

interface Variation {
  id: string; contract_id: string; variation_no: string; title_en: string;
  variation_type: string; amount: number; status: string;
}

interface Amendment {
  id: string; contract_id: string; amendment_no: string; description: string;
  change_type: string; amount: number; previous_value: number; new_value: number;
  days_added: number; status: string;
}

interface PaymentSchedule {
  id: string; contract_id: string; milestone_no: string; description: string;
  amount: number; percentage: number; due_date: string; status: string;
}

interface ContractInvoice {
  id: string; contract_id: string; invoice_no: string; invoice_date: string;
  amount: number; status: string; invoice_type: string;
  retention_pct: number; retention_amount: number; net_amount: number;
  due_date: string; paid_date: string; paid_amount: number; notes: string;
}
interface ContractInvoiceItem {
  id: string; invoice_id: string; scope_item_id: string;
  quantity: number; unit_price: number; total_amount: number; notes: string;
}

type Tab = 'contracts' | 'scope' | 'variations' | 'payments' | 'invoices';

const CONTRACT_TYPES = ['lump_sum', 'unit_price', 'cost_plus', 'time_material', 'other'] as const;
const CONTRACT_CATEGORIES = ['subcontract', 'prime', 'service', 'supply', 'lease'] as const;
const CONTRACT_STATUSES = ['draft', 'active', 'completed', 'terminated', 'suspended'] as const;
const CHANGE_TYPES = ['addition', 'deduction', 'scope_change'] as const;
const PS_STATUSES = ['pending', 'achieved', 'invoiced', 'paid'] as const;
const INV_STATUSES = ['draft', 'submitted', 'approved', 'paid', 'rejected'] as const;

const statusColor: Record<string, string> = {
  draft: '#6b7280', active: '#10b981', completed: '#3b82f6',
  terminated: '#ef4444', suspended: '#f59e0b',
};

const changeTypeColor: Record<string, string> = {
  addition: '#10b981', deduction: '#ef4444', scope_change: '#f59e0b', time_extension: '#3b82f6',
};

const psStatusColor: Record<string, string> = {
  pending: '#6b7280', achieved: '#10b981', invoiced: '#3b82f6', paid: '#8b5cf6',
};

const invStatusColor: Record<string, string> = {
  draft: '#6b7280', submitted: '#f59e0b', approved: '#3b82f6',
  paid: '#10b981', rejected: '#ef4444',
};

export default function ContractsPage() {
  const t = useT();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('contracts');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const debouncedSearch = useDebounce(search);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
  const [invoices, setInvoices] = useState<ContractInvoice[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    contract_no: '', project_id: '', contractor_id: '', contract_type: 'lump_sum',
    category: 'subcontract', status: 'draft', contract_amount: '', currency: 'SAR',
    start_date: '', end_date: '', description: '',
    title_en: '', signing_date: '', variations_total: '',
  });

  const [showScopeForm, setShowScopeForm] = useState(false);
  const [scopeForm, setScopeForm] = useState({ contract_id: '', item_code: '', description_en: '', unit_of_measure: 'each', quantity: '', unit_price: '', total_price: '' });
  const [editScopeId, setEditScopeId] = useState<string | null>(null);

  const [showVarForm, setShowVarForm] = useState(false);
  const [varForm, setVarForm] = useState({ contract_id: '', variation_no: '', title_en: '', variation_type: 'addition', amount: '', status: 'pending' });
  const [editVarId, setEditVarId] = useState<string | null>(null);

  const [showAmdForm, setShowAmdForm] = useState(false);
  const [amdForm, setAmdForm] = useState({ contract_id: '', amendment_no: '', description: '', change_type: 'addition', amount: '', previous_value: '', new_value: '', days_added: '', status: 'pending' });

  const [showPsForm, setShowPsForm] = useState(false);
  const [psForm, setPsForm] = useState({ contract_id: '', milestone_no: '', description: '', amount: '', percentage: '', due_date: '', status: 'pending' });
  const [editPsId, setEditPsId] = useState<string | null>(null);

  const [showInvForm, setShowInvForm] = useState(false);
  const [invForm, setInvForm] = useState({ contract_id: '', invoice_no: '', invoice_date: new Date().toISOString().slice(0, 10), amount: '', status: 'draft', invoice_type: 'progress', retention_pct: '10', retention_amount: '', due_date: '', paid_date: '', paid_amount: '', notes: '' });
  const [editInvId, setEditInvId] = useState<string | null>(null);
  const [viewInvoiceItems, setViewInvoiceItems] = useState<{ invoiceId: string; items: ContractInvoiceItem[] } | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: string } | null>(null);

  const [filterProject, setFilterProject] = useState('');
  const [selectedContractId, setSelectedContractId] = useState('');

  useEffect(() => { setPage(1); }, [activeTab, debouncedSearch, filterProject]);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      try {
        const [projRes, contrRes] = await Promise.all([
          supabase.from('projects').select('id, project_code, name_en').eq('is_active', true).order('name_en'),
          supabase.from('contractors').select('id, name_en').order('name_en'),
        ]);
        setProjects((projRes.data || []) as Project[]);
        setContractors((contrRes.data || []) as Contractor[]);

        if (activeTab === 'contracts') {
          const { data } = await supabase
            .from('contracts')
            .select('*, project:projects(project_code, name_en), contractor:contractors(name_en)')
            .order('created_at', { ascending: false });
          setContracts((data || []) as Contract[]);
        } else if (activeTab === 'scope') {
          const { data } = await supabase.from('contract_scope_items').select('*').order('order');
          setScopeItems((data || []) as ScopeItem[]);
        } else if (activeTab === 'variations') {
          const [vRes, aRes] = await Promise.all([
            supabase.from('contract_variations').select('*').order('created_at', { ascending: false }),
            supabase.from('contract_amendments').select('*').order('created_at', { ascending: false }),
          ]);
          setVariations((vRes.data || []) as Variation[]);
          setAmendments((aRes.data || []) as Amendment[]);
        } else if (activeTab === 'payments') {
          const { data } = await supabase.from('contract_payment_schedules').select('*').order('milestone_no');
          setPaymentSchedules((data || []) as PaymentSchedule[]);
        } else if (activeTab === 'invoices') {
          const { data } = await supabase.from('contract_invoices').select('*').order('created_at', { ascending: false });
          setInvoices((data || []) as ContractInvoice[]);
        }
      } catch (err) {
        console.error('Failed to load:', err);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeTab, toast]);

  function getFilteredContracts(): Contract[] {
    let items = contracts;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(c =>
        c.contract_no.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.project?.name_en || '').toLowerCase().includes(q) ||
        (c.contractor?.name_en || '').toLowerCase().includes(q)
      );
    }
    if (filterProject) items = items.filter(c => c.project_id === filterProject);
    return items;
  }

  function getFilteredScope(): ScopeItem[] {
    let items = selectedContractId ? scopeItems.filter(s => s.contract_id === selectedContractId) : scopeItems;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(s =>
        (s.item_code || '').toLowerCase().includes(q) ||
        (s.description_en || '').toLowerCase().includes(q)
      );
    }
    return items;
  }

  function getFilteredVariations(): Variation[] {
    let items = selectedContractId ? variations.filter(v => v.contract_id === selectedContractId) : variations;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(v =>
        (v.variation_no || '').toLowerCase().includes(q) ||
        (v.title_en || '').toLowerCase().includes(q)
      );
    }
    return items;
  }

  function getFilteredAmendments(): Amendment[] {
    let items = selectedContractId ? amendments.filter(a => a.contract_id === selectedContractId) : amendments;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(a =>
        (a.amendment_no || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q)
      );
    }
    return items;
  }

  function getFilteredPayments(): PaymentSchedule[] {
    let items = selectedContractId ? paymentSchedules.filter(p => p.contract_id === selectedContractId) : paymentSchedules;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(p =>
        (p.milestone_no || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }
    return items;
  }

  function getFilteredInvoices(): ContractInvoice[] {
    let items = selectedContractId ? invoices.filter(i => i.contract_id === selectedContractId) : invoices;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(i => (i.invoice_no || '').toLowerCase().includes(q));
    }
    return items;
  }

  function resetForm() {
    setForm({
      contract_no: '', project_id: '', contractor_id: '', contract_type: 'lump_sum',
      category: 'subcontract', status: 'draft', contract_amount: '', currency: 'SAR',
      start_date: '', end_date: '', description: '',
      title_en: '', signing_date: '', variations_total: '',
    });
    setEditId(null);
    setFormError('');
  }

  function openEdit(c: Contract) {
    setForm({
      contract_no: c.contract_no, project_id: c.project_id, contractor_id: c.contractor_id,
      contract_type: c.contract_type, category: c.category, status: c.status,
      contract_amount: String(c.contract_amount), currency: c.currency,
      start_date: c.start_date || '', end_date: c.end_date || '',
      description: c.description || '', title_en: c.title_en || '',
      signing_date: c.signing_date || '', variations_total: String(c.variations_total || ''),
    });
    setEditId(c.id);
    setFormError('');
    setShowForm(true);
  }

  async function saveContract() {
    if (!form.contract_no.trim() || !form.project_id || !form.contractor_id) {
      setFormError('Contract No, Project, and Contractor are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        contract_no: form.contract_no, project_id: form.project_id,
        contractor_id: form.contractor_id, contract_type: form.contract_type, category: form.category,
        status: form.status, contract_amount: parseFloat(form.contract_amount) || 0,
        currency: form.currency, start_date: form.start_date || null,
        end_date: form.end_date || null, description: form.description || null,
        title_en: form.title_en || null, signing_date: form.signing_date || null,
        variations_total: parseFloat(form.variations_total) || 0,
      };
      let error;
      if (editId) {
        ({ error } = await supabase.from('contracts').update(payload).eq('id', editId));
      } else {
        ({ error } = await supabase.from('contracts').insert(payload));
      }
      if (error) throw error;
      toast.success(editId ? 'Contract updated' : 'Contract created');
      setShowForm(false);
      resetForm();
      const { data } = await supabase
        .from('contracts')
        .select('*, project:projects(project_code, name_en), contractor:contractors(name_en)')
        .order('created_at', { ascending: false });
      setContracts((data || []) as Contract[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteContract(id: string) {
    try {
      await supabase.from('contracts').delete().eq('id', id);
      setContracts(prev => prev.filter(c => c.id !== id));
      toast.success('Contract deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete contract');
    }
  }

  async function saveScopeItem() {
    if (!scopeForm.contract_id || !scopeForm.description_en.trim()) {
      setFormError('Contract and description required'); return;
    }
    setSaving(true);
    try {
      const qty = parseFloat(scopeForm.quantity) || 0;
      const up = parseFloat(scopeForm.unit_price) || 0;
      const tp = parseFloat(scopeForm.total_price) || (qty * up);
      const payload = {
        contract_id: scopeForm.contract_id, item_code: scopeForm.item_code || null,
        description_en: scopeForm.description_en, unit_of_measure: scopeForm.unit_of_measure,
        quantity: qty, unit_price: up, total_price: tp,
      };
      let error;
      if (editScopeId) {
        ({ error } = await supabase.from('contract_scope_items').update(payload).eq('id', editScopeId));
      } else {
        ({ error } = await supabase.from('contract_scope_items').insert(payload));
      }
      if (error) throw error;
      toast.success(editScopeId ? 'Scope item updated' : 'Scope item created');
      setShowScopeForm(false);
      setEditScopeId(null);
      setScopeForm({ contract_id: '', item_code: '', description_en: '', unit_of_measure: 'each', quantity: '', unit_price: '', total_price: '' });
      const { data } = await supabase.from('contract_scope_items').select('*').order('order');
      setScopeItems((data || []) as ScopeItem[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function deleteScopeItem(id: string) {
    try {
      await supabase.from('contract_scope_items').delete().eq('id', id);
      setScopeItems(prev => prev.filter(s => s.id !== id));
      toast.success('Scope item deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete scope item');
    }
  }

  async function saveVariation() {
    if (!varForm.contract_id || !varForm.title_en.trim()) {
      setFormError('Contract and description required'); return;
    }
    setSaving(true);
    try {
      const payload = {
        contract_id: varForm.contract_id, variation_no: varForm.variation_no || null,
        title_en: varForm.title_en, variation_type: varForm.variation_type,
        amount: parseFloat(varForm.amount) || 0, status: varForm.status,
      };
      let error;
      if (editVarId) {
        ({ error } = await supabase.from('contract_variations').update(payload).eq('id', editVarId));
      } else {
        ({ error } = await supabase.from('contract_variations').insert(payload));
      }
      if (error) throw error;
      toast.success(editVarId ? 'Variation updated' : 'Variation created');
      setShowVarForm(false);
      setEditVarId(null);
      setVarForm({ contract_id: '', variation_no: '', title_en: '', variation_type: 'addition', amount: '', status: 'pending' });
      const { data } = await supabase.from('contract_variations').select('*').order('created_at', { ascending: false });
      setVariations((data || []) as Variation[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function deleteVariation(id: string) {
    try {
      await supabase.from('contract_variations').delete().eq('id', id);
      setVariations(prev => prev.filter(v => v.id !== id));
      toast.success('Variation deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete variation');
    }
  }

  async function saveAmendment() {
    if (!amdForm.contract_id || !amdForm.description.trim()) {
      setFormError('Contract and description required'); return;
    }
    setSaving(true);
    try {
      const payload = {
        contract_id: amdForm.contract_id, amendment_no: amdForm.amendment_no || null,
        description: amdForm.description, change_type: amdForm.change_type,
        amount: parseFloat(amdForm.amount) || 0,
        previous_value: parseFloat(amdForm.previous_value) || 0,
        new_value: parseFloat(amdForm.new_value) || 0,
        days_added: parseInt(amdForm.days_added) || 0,
        status: amdForm.status,
      };
      const { error } = await supabase.from('contract_amendments').insert(payload);
      if (error) throw error;
      toast.success('Amendment created');
      setShowAmdForm(false);
      setAmdForm({ contract_id: '', amendment_no: '', description: '', change_type: 'addition', amount: '', previous_value: '', new_value: '', days_added: '', status: 'pending' });
      const { data } = await supabase.from('contract_amendments').select('*').order('created_at', { ascending: false });
      setAmendments((data || []) as Amendment[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function savePaymentSchedule() {
    if (!psForm.contract_id || !psForm.description.trim()) {
      setFormError('Contract and description required'); return;
    }
    setSaving(true);
    try {
      const payload = {
        contract_id: psForm.contract_id, milestone_no: psForm.milestone_no || null,
        description: psForm.description, amount: parseFloat(psForm.amount) || 0,
        percentage: parseFloat(psForm.percentage) || 0,
        due_date: psForm.due_date || null, status: psForm.status,
      };
      let error;
      if (editPsId) {
        ({ error } = await supabase.from('contract_payment_schedules').update(payload).eq('id', editPsId));
      } else {
        ({ error } = await supabase.from('contract_payment_schedules').insert(payload));
      }
      if (error) throw error;
      toast.success(editPsId ? 'Payment schedule updated' : 'Payment schedule created');
      setShowPsForm(false);
      setEditPsId(null);
      setPsForm({ contract_id: '', milestone_no: '', description: '', amount: '', percentage: '', due_date: '', status: 'pending' });
      const { data } = await supabase.from('contract_payment_schedules').select('*').order('milestone_no');
      setPaymentSchedules((data || []) as PaymentSchedule[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function deletePaymentSchedule(id: string) {
    try {
      await supabase.from('contract_payment_schedules').delete().eq('id', id);
      setPaymentSchedules(prev => prev.filter(p => p.id !== id));
      toast.success('Payment schedule deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete payment schedule');
    }
  }

  async function saveInvoice() {
    if (!invForm.contract_id || !invForm.invoice_no.trim()) {
      setFormError('Contract and invoice no required'); return;
    }
    setSaving(true);
    try {
      const amt = parseFloat(invForm.amount) || 0;
      const retPct = parseFloat(invForm.retention_pct) || 0;
      const retAmt = parseFloat(invForm.retention_amount) || (amt * retPct / 100);
      const payload = {
        contract_id: invForm.contract_id, invoice_no: invForm.invoice_no,
        invoice_date: invForm.invoice_date, amount: amt,
        status: invForm.status, invoice_type: invForm.invoice_type,
        retention_pct: retPct, retention_amount: retAmt,
        due_date: invForm.due_date || null, paid_date: invForm.paid_date || null,
        paid_amount: parseFloat(invForm.paid_amount) || 0, notes: invForm.notes || null,
      };
      let error;
      if (editInvId) {
        ({ error } = await supabase.from('contract_invoices').update(payload).eq('id', editInvId));
      } else {
        ({ error } = await supabase.from('contract_invoices').insert(payload));
      }
      if (error) throw error;
      toast.success(editInvId ? 'Invoice updated' : 'Invoice created');
      setShowInvForm(false);
      setEditInvId(null);
      setInvForm({ contract_id: '', invoice_no: '', invoice_date: new Date().toISOString().slice(0, 10), amount: '', status: 'draft', invoice_type: 'progress', retention_pct: '10', retention_amount: '', due_date: '', paid_date: '', paid_amount: '', notes: '' });
      const { data } = await supabase.from('contract_invoices').select('*').order('created_at', { ascending: false });
      setInvoices((data || []) as ContractInvoice[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function loadInvoiceItems(invoiceId: string) {
    try {
      const { data } = await supabase
        .from('contract_invoice_items')
        .select('*, scope_item:contract_scope_items(item_code, description_en, unit_of_measure)')
        .eq('invoice_id', invoiceId);
      setViewInvoiceItems({ invoiceId, items: (data || []) as any });
    } catch (err) {
      console.error('Failed to load invoice items:', err);
      toast.error('Failed to load invoice items');
    }
  }

  async function deleteInvoice(id: string) {
    try {
      await supabase.from('contract_invoices').delete().eq('id', id);
      setInvoices(prev => prev.filter(i => i.id !== id));
      toast.success('Invoice deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete invoice');
    }
  }

  function exportTab() {
    switch (activeTab) {
      case 'contracts':
        exportCSV(getFilteredContracts() as unknown as Record<string, unknown>[], `contracts_${new Date().toISOString().slice(0, 10)}.csv`);
        break;
      case 'scope':
        exportCSV(getFilteredScope() as unknown as Record<string, unknown>[], `scope_items_${new Date().toISOString().slice(0, 10)}.csv`);
        break;
      case 'variations': {
        const data = [...getFilteredVariations(), ...getFilteredAmendments()];
        exportCSV(data as unknown as Record<string, unknown>[], `variations_${new Date().toISOString().slice(0, 10)}.csv`);
        break;
      }
      case 'payments':
        exportCSV(getFilteredPayments() as unknown as Record<string, unknown>[], `payment_schedules_${new Date().toISOString().slice(0, 10)}.csv`);
        break;
      case 'invoices':
        exportCSV(getFilteredInvoices() as unknown as Record<string, unknown>[], `invoices_${new Date().toISOString().slice(0, 10)}.csv`);
        break;
    }
  }

  function renderContractForm() {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
        <div className="rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-semibold mb-4">{editId ? 'Edit Contract' : 'New Contract'}</h3>
          {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>{formError}</div>}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Contract No *</label><input className="input" value={form.contract_no} onChange={e => setForm({ ...form, contract_no: e.target.value })} /></div>
              <div><label className="label">Currency</label>
                <select className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                  {['SAR', 'USD', 'EUR', 'GBP'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Project *</label>
                <select className="input" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">-- Select --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Contractor *</label>
                <select className="input" value={form.contractor_id} onChange={e => setForm({ ...form, contractor_id: e.target.value })}>
                  <option value="">-- Select --</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Type</label>
                  <select className="input" value={form.contract_type} onChange={e => setForm({ ...form, contract_type: e.target.value })}>
                    {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CONTRACT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {CONTRACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label">Contract Amount</label><input type="number" className="input" value={form.contract_amount} onChange={e => setForm({ ...form, contract_amount: e.target.value })} /></div>
            </div>
            <div><label className="label">Title</label><input className="input" value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Start Date</label><input type="date" className="input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><label className="label">End Date</label><input type="date" className="input" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Signing Date</label><input type="date" className="input" value={form.signing_date} onChange={e => setForm({ ...form, signing_date: e.target.value })} /></div>
              <div><label className="label">Variations Total</label><input type="number" className="input" value={form.variations_total} onChange={e => setForm({ ...form, variations_total: e.target.value })} /></div>
            </div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 mt-6">
            <button className="btn-primary btn-sm" onClick={saveContract} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary btn-sm" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  function renderContractsTab() {
    const filtered = getFilteredContracts();
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Contract No</th><th>Project</th><th>Contractor</th><th>Type</th>
                  <th>Category</th><th>Status</th><th>Total Value</th><th>Dates</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No contracts found</td></tr>
                ) : paginated.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono text-xs font-semibold">{c.contract_no}</td>
                    <td className="text-sm">{(c as any).project?.name_en || '-'}</td>
                    <td className="text-sm">{(c as any).contractor?.name_en || '-'}</td>
                    <td><span className="badge">{c.contract_type.replace(/_/g, ' ')}</span></td>
                    <td><span className="badge">{c.category}</span></td>
                    <td><span className="badge capitalize" style={{ backgroundColor: `color-mix(in srgb, ${statusColor[c.status] || '#6b7280'} 20%, transparent)`, color: statusColor[c.status] || '#6b7280' }}>{c.status}</span></td>
                    <td className="font-mono text-xs">{c.contract_amount.toLocaleString()} {c.currency}</td>
                    <td className="text-xs">
                      {formatDate(c.start_date)} – {formatDate(c.end_date)}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-sm btn-secondary" title="View" onClick={() => toast.info(`Contract: ${c.contract_no}`)}><Eye size={14} /></button>
                        {hasPermission('contracts', 'create') && (
                          <button className="btn-sm btn-secondary" title="Edit" onClick={() => openEdit(c)}><Edit3 size={14} /></button>
                        )}
                        {hasPermission('contracts', 'delete') && (
                          <button className="btn-sm btn-secondary" title="Delete" onClick={() => setConfirmDelete({ id: c.id, type: 'contract' })}><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
        </div>
        {showForm && renderContractForm()}
      </div>
    );
  }

  function renderScopeTab() {
    const filtered = getFilteredScope();
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
    const grandTotal = filtered.reduce((s, i) => s + (i.total_price || 0), 0);
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="flex items-center justify-between p-4 pb-0 flex-wrap gap-2">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Layers size={16} /> Scope Items (BOQ)</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute start-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input className="input ps-7 py-1 text-sm w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {hasPermission('contracts', 'create') && (
                <button className="btn-primary btn-sm" onClick={() => { setScopeForm({ contract_id: selectedContractId, item_code: '', description_en: '', unit_of_measure: 'each', quantity: '', unit_price: '', total_price: '' }); setEditScopeId(null); setFormError(''); setShowScopeForm(true); }}><Plus size={14} /> New Item</button>
              )}
            </div>
          </div>
          <div className="p-4 pb-0">
            <select className="input max-w-xs" value={selectedContractId} onChange={e => setSelectedContractId(e.target.value)}>
              <option value="">All Contracts</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Contract</th><th>Item No</th><th>Description</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No scope items found</td></tr>
                ) : paginated.map(s => {
                  const con = contracts.find(c => c.id === s.contract_id);
                  return (
                    <tr key={s.id}>
                      <td className="font-mono text-xs">{con?.contract_no || s.contract_id.slice(0, 8)}</td>
                      <td className="font-mono text-xs">{s.item_code || '-'}</td>
                      <td className="text-sm">{s.description_en}</td>
                      <td className="text-xs">{s.unit_of_measure}</td>
                      <td className="font-mono text-xs">{s.quantity}</td>
                      <td className="font-mono text-xs">{s.unit_price.toLocaleString()}</td>
                      <td className="font-mono text-xs font-semibold">{s.total_price.toLocaleString()}</td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn-sm btn-secondary" title="Edit" onClick={() => { setScopeForm({ contract_id: s.contract_id, item_code: s.item_code || '', description_en: s.description_en, unit_of_measure: s.unit_of_measure, quantity: String(s.quantity), unit_price: String(s.unit_price), total_price: String(s.total_price) }); setEditScopeId(s.id); setFormError(''); setShowScopeForm(true); }}><Edit3 size={14} /></button>
                          <button className="btn-sm btn-secondary" title="Delete" onClick={() => setConfirmDelete({ id: s.id, type: 'scope' })}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4 flex justify-end">
            <span className="text-sm font-semibold">Grand Total: <span className="font-mono">{grandTotal.toLocaleString()} SAR</span></span>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
        </div>
        {showScopeForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowScopeForm(false)}>
            <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">{editScopeId ? 'Edit Scope Item' : 'New Scope Item'}</h3>
              {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>{formError}</div>}
              <div className="space-y-4">
                <div><label className="label">Contract</label>
                  <select className="input" value={scopeForm.contract_id} onChange={e => setScopeForm({ ...scopeForm, contract_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Item Code</label><input className="input" value={scopeForm.item_code} onChange={e => setScopeForm({ ...scopeForm, item_code: e.target.value })} /></div>
                  <div><label className="label">Unit</label>
                    <select className="input" value={scopeForm.unit_of_measure} onChange={e => setScopeForm({ ...scopeForm, unit_of_measure: e.target.value })}>
                      {['each', 'm2', 'm3', 'm', 'kg', 'ton', 'lump_sum', 'hour', 'day', 'week', 'month'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className="label">Description (EN) *</label><textarea className="input" rows={2} value={scopeForm.description_en} onChange={e => setScopeForm({ ...scopeForm, description_en: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="label">Quantity</label><input type="number" className="input" value={scopeForm.quantity} onChange={e => { const q = e.target.value; const up = scopeForm.unit_price; setScopeForm({ ...scopeForm, quantity: q, total_price: String((parseFloat(q) || 0) * (parseFloat(up) || 0)) }); }} /></div>
                  <div><label className="label">Unit Price</label><input type="number" className="input" value={scopeForm.unit_price} onChange={e => { const up = e.target.value; const q = scopeForm.quantity; setScopeForm({ ...scopeForm, unit_price: up, total_price: String((parseFloat(q) || 0) * (parseFloat(up) || 0)) }); }} /></div>
                  <div><label className="label">Total</label><input type="number" className="input" value={scopeForm.total_price} onChange={e => setScopeForm({ ...scopeForm, total_price: e.target.value })} /></div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button className="btn-primary btn-sm" onClick={saveScopeItem} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="btn-secondary btn-sm" onClick={() => { setShowScopeForm(false); setEditScopeId(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderVariationsTab() {
    const filteredV = getFilteredVariations();
    const filteredA = getFilteredAmendments();
    const paginatedV = filteredV.slice((page - 1) * pageSize, page * pageSize);
    const paginatedA = filteredA.slice(0, 5);
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="flex items-center justify-between p-4 pb-0 flex-wrap gap-2">
            <h3 className="font-semibold text-sm flex items-center gap-2"><GitCompareArrows size={16} /> Variations</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute start-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input className="input ps-7 py-1 text-sm w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {hasPermission('contracts', 'create') && (
                <button className="btn-primary btn-sm" onClick={() => { setVarForm({ contract_id: selectedContractId, variation_no: '', title_en: '', variation_type: 'addition', amount: '', status: 'pending' }); setEditVarId(null); setFormError(''); setShowVarForm(true); }}><Plus size={14} /> New Variation</button>
              )}
            </div>
          </div>
          <div className="p-4 pb-0">
            <select className="input max-w-xs" value={selectedContractId} onChange={e => setSelectedContractId(e.target.value)}>
              <option value="">All Contracts</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Contract</th><th>Var No</th><th>Description</th><th>Type</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
                ) : paginatedV.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No variations found</td></tr>
                ) : paginatedV.map(v => {
                  const con = contracts.find(c => c.id === v.contract_id);
                  return (
                    <tr key={v.id}>
                      <td className="font-mono text-xs">{con?.contract_no || v.contract_id.slice(0, 8)}</td>
                      <td className="font-mono text-xs">{v.variation_no || '-'}</td>
                      <td className="text-sm">{v.title_en}</td>
                      <td><span className="badge capitalize" style={{ backgroundColor: `color-mix(in srgb, ${changeTypeColor[v.variation_type] || '#6b7280'} 20%, transparent)`, color: changeTypeColor[v.variation_type] || '#6b7280' }}>{v.variation_type.replace(/_/g, ' ')}</span></td>
                      <td className="font-mono text-xs">{v.amount.toLocaleString()}</td>
                      <td><span className="badge capitalize">{v.status}</span></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn-sm btn-secondary" title="Edit" onClick={() => { setVarForm({ contract_id: v.contract_id, variation_no: v.variation_no || '', title_en: v.title_en, variation_type: v.variation_type, amount: String(v.amount), status: v.status }); setEditVarId(v.id); setFormError(''); setShowVarForm(true); }}><Edit3 size={14} /></button>
                          <button className="btn-sm btn-secondary" title="Delete" onClick={() => setConfirmDelete({ id: v.id, type: 'variation' })}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filteredV.length} onChange={setPage} />
        </div>

        <div className="card">
          <div className="flex items-center justify-between p-4 pb-0 flex-wrap gap-2">
            <h3 className="font-semibold text-sm flex items-center gap-2"><FileText size={16} /> Amendments</h3>
            {hasPermission('contracts', 'create') && (
              <button className="btn-primary btn-sm" onClick={() => { setAmdForm({ contract_id: selectedContractId, amendment_no: '', description: '', change_type: 'addition', amount: '', previous_value: '', new_value: '', days_added: '', status: 'pending' }); setFormError(''); setShowAmdForm(true); }}><Plus size={14} /> New Amendment</button>
            )}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Contract</th><th>Amd No</th><th>Description</th><th>Type</th><th>Amount</th><th>Prev Value</th><th>New Value</th><th>Days Added</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
                ) : paginatedA.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No amendments found</td></tr>
                ) : paginatedA.map(a => {
                  const con = contracts.find(c => c.id === a.contract_id);
                  return (
                    <tr key={a.id}>
                      <td className="font-mono text-xs">{con?.contract_no || a.contract_id.slice(0, 8)}</td>
                      <td className="font-mono text-xs">{a.amendment_no || '-'}</td>
                      <td className="text-sm">{a.description}</td>
                      <td><span className="badge capitalize">{a.change_type.replace(/_/g, ' ')}</span></td>
                      <td className="font-mono text-xs">{a.amount.toLocaleString()}</td>
                      <td className="font-mono text-xs">{a.previous_value.toLocaleString()}</td>
                      <td className="font-mono text-xs">{a.new_value.toLocaleString()}</td>
                      <td className="font-mono text-xs">{a.days_added}</td>
                      <td><span className="badge capitalize">{a.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {showVarForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowVarForm(false)}>
            <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">{editVarId ? 'Edit Variation' : 'New Variation'}</h3>
              {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>{formError}</div>}
              <div className="space-y-4">
                <div><label className="label">Contract</label>
                  <select className="input" value={varForm.contract_id} onChange={e => setVarForm({ ...varForm, contract_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Variation No</label><input className="input" value={varForm.variation_no} onChange={e => setVarForm({ ...varForm, variation_no: e.target.value })} /></div>
                  <div><label className="label">Variation Type</label>
                    <select className="input" value={varForm.variation_type} onChange={e => setVarForm({ ...varForm, variation_type: e.target.value })}>
                      {['addition', 'deduction', 'scope_change', 'time_extension'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className="label">Title (EN) *</label><textarea className="input" rows={2} value={varForm.title_en} onChange={e => setVarForm({ ...varForm, title_en: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Amount</label><input type="number" className="input" value={varForm.amount} onChange={e => setVarForm({ ...varForm, amount: e.target.value })} /></div>
                  <div><label className="label">Status</label>
                    <select className="input" value={varForm.status} onChange={e => setVarForm({ ...varForm, status: e.target.value })}>
                      {['pending', 'approved', 'rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button className="btn-primary btn-sm" onClick={saveVariation} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="btn-secondary btn-sm" onClick={() => { setShowVarForm(false); setEditVarId(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {showAmdForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowAmdForm(false)}>
            <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">New Amendment</h3>
              {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>{formError}</div>}
              <div className="space-y-4">
                <div><label className="label">Contract</label>
                  <select className="input" value={amdForm.contract_id} onChange={e => setAmdForm({ ...amdForm, contract_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Amendment No</label><input className="input" value={amdForm.amendment_no} onChange={e => setAmdForm({ ...amdForm, amendment_no: e.target.value })} /></div>
                  <div><label className="label">Change Type</label>
                    <select className="input" value={amdForm.change_type} onChange={e => setAmdForm({ ...amdForm, change_type: e.target.value })}>
                      {CHANGE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className="label">Description *</label><textarea className="input" rows={2} value={amdForm.description} onChange={e => setAmdForm({ ...amdForm, description: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="label">Amount</label><input type="number" className="input" value={amdForm.amount} onChange={e => setAmdForm({ ...amdForm, amount: e.target.value })} /></div>
                  <div><label className="label">Prev Value</label><input type="number" className="input" value={amdForm.previous_value} onChange={e => setAmdForm({ ...amdForm, previous_value: e.target.value })} /></div>
                  <div><label className="label">New Value</label><input type="number" className="input" value={amdForm.new_value} onChange={e => setAmdForm({ ...amdForm, new_value: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Days Added</label><input type="number" className="input" value={amdForm.days_added} onChange={e => setAmdForm({ ...amdForm, days_added: e.target.value })} /></div>
                  <div><label className="label">Status</label>
                    <select className="input" value={amdForm.status} onChange={e => setAmdForm({ ...amdForm, status: e.target.value })}>
                      {['pending', 'approved', 'rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button className="btn-primary btn-sm" onClick={saveAmendment} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="btn-secondary btn-sm" onClick={() => setShowAmdForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderPaymentsTab() {
    const filtered = getFilteredPayments();
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
    const totalAmount = filtered.reduce((s, p) => s + (p.amount || 0), 0);
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="flex items-center justify-between p-4 pb-0 flex-wrap gap-2">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Calendar size={16} /> Payment Schedules</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute start-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input className="input ps-7 py-1 text-sm w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {hasPermission('contracts', 'create') && (
                <button className="btn-primary btn-sm" onClick={() => { setPsForm({ contract_id: selectedContractId, milestone_no: '', description: '', amount: '', percentage: '', due_date: '', status: 'pending' }); setEditPsId(null); setFormError(''); setShowPsForm(true); }}><Plus size={14} /> New Milestone</button>
              )}
            </div>
          </div>
          <div className="p-4 pb-0">
            <select className="input max-w-xs" value={selectedContractId} onChange={e => setSelectedContractId(e.target.value)}>
              <option value="">All Contracts</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Contract</th><th>Milestone</th><th>Description</th><th>Amount</th><th>%</th><th>Due Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No payment schedules found</td></tr>
                ) : paginated.map(p => {
                  const con = contracts.find(c => c.id === p.contract_id);
                  return (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{con?.contract_no || p.contract_id.slice(0, 8)}</td>
                      <td className="font-mono text-xs">{p.milestone_no || '-'}</td>
                      <td className="text-sm">{p.description}</td>
                      <td className="font-mono text-xs">{p.amount.toLocaleString()}</td>
                      <td className="font-mono text-xs">{p.percentage}%</td>
                      <td className="text-xs">{formatDate(p.due_date)}</td>
                      <td><span className="badge capitalize" style={{ backgroundColor: `color-mix(in srgb, ${psStatusColor[p.status] || '#6b7280'} 20%, transparent)`, color: psStatusColor[p.status] || '#6b7280' }}>{p.status}</span></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn-sm btn-secondary" title="Edit" onClick={() => { setPsForm({ contract_id: p.contract_id, milestone_no: p.milestone_no || '', description: p.description, amount: String(p.amount), percentage: String(p.percentage), due_date: p.due_date || '', status: p.status }); setEditPsId(p.id); setFormError(''); setShowPsForm(true); }}><Edit3 size={14} /></button>
                          <button className="btn-sm btn-secondary" title="Delete" onClick={() => setConfirmDelete({ id: p.id, type: 'payment' })}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4 flex justify-end">
            <span className="text-sm font-semibold">Total Scheduled: <span className="font-mono">{totalAmount.toLocaleString()} SAR</span></span>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
        </div>
        {showPsForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowPsForm(false)}>
            <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">{editPsId ? 'Edit Payment Schedule' : 'New Payment Schedule'}</h3>
              {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>{formError}</div>}
              <div className="space-y-4">
                <div><label className="label">Contract</label>
                  <select className="input" value={psForm.contract_id} onChange={e => setPsForm({ ...psForm, contract_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Milestone No</label><input className="input" value={psForm.milestone_no} onChange={e => setPsForm({ ...psForm, milestone_no: e.target.value })} /></div>
                  <div><label className="label">Status</label>
                    <select className="input" value={psForm.status} onChange={e => setPsForm({ ...psForm, status: e.target.value })}>
                      {PS_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className="label">Description *</label><textarea className="input" rows={2} value={psForm.description} onChange={e => setPsForm({ ...psForm, description: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="label">Amount</label><input type="number" className="input" value={psForm.amount} onChange={e => setPsForm({ ...psForm, amount: e.target.value })} /></div>
                  <div><label className="label">Percentage</label><input type="number" step="0.1" className="input" value={psForm.percentage} onChange={e => setPsForm({ ...psForm, percentage: e.target.value })} /></div>
                  <div><label className="label">Due Date</label><input type="date" className="input" value={psForm.due_date} onChange={e => setPsForm({ ...psForm, due_date: e.target.value })} /></div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button className="btn-primary btn-sm" onClick={savePaymentSchedule} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="btn-secondary btn-sm" onClick={() => { setShowPsForm(false); setEditPsId(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderInvoicesTab() {
    const filtered = getFilteredInvoices();
    const paginated: ContractInvoice[] = filtered.slice((page - 1) * pageSize, page * pageSize);
    const totalAmount = filtered.reduce((s, i) => s + (i.amount || 0), 0);
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="flex items-center justify-between p-4 pb-0 flex-wrap gap-2">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Receipt size={16} /> Invoices (Payment Certificates)</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute start-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input className="input ps-7 py-1 text-sm w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {hasPermission('contracts', 'create') && (
                <button className="btn-primary btn-sm" onClick={() => { setInvForm({ contract_id: selectedContractId, invoice_no: '', invoice_date: new Date().toISOString().slice(0, 10), amount: '', status: 'draft', invoice_type: 'progress', retention_pct: '10', retention_amount: '', due_date: '', paid_date: '', paid_amount: '', notes: '' }); setEditInvId(null); setFormError(''); setShowInvForm(true); }}><Plus size={14} /> New Invoice</button>
              )}
            </div>
          </div>
          <div className="p-4 pb-0">
            <select className="input max-w-xs" value={selectedContractId} onChange={e => setSelectedContractId(e.target.value)}>
              <option value="">All Contracts</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Contract</th><th>Invoice No</th><th>Type</th><th>Date</th><th>Gross</th><th>Retention</th><th>Net</th><th>Paid</th><th>Due Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No invoices found</td></tr>
                ) : paginated.map((i: ContractInvoice) => {
                  const con = contracts.find(c => c.id === i.contract_id);
                  const netAmt = i.net_amount || (i.amount - (i.retention_amount || 0));
                  return (
                    <tr key={i.id}>
                      <td className="font-mono text-xs">{con?.contract_no || i.contract_id.slice(0, 8)}</td>
                      <td className="font-mono text-xs font-semibold">{i.invoice_no}</td>
                      <td><span className="badge text-xs">{i.invoice_type || 'progress'}</span></td>
                      <td className="text-sm">{formatDate(i.invoice_date)}</td>
                      <td className="font-mono text-xs">{i.amount.toLocaleString()}</td>
                      <td className="font-mono text-xs" style={{ color: 'var(--color-danger)' }}>{i.retention_amount ? `(${i.retention_amount.toLocaleString()})` : '-'}</td>
                      <td className="font-mono text-xs font-semibold">{netAmt.toLocaleString()}</td>
                      <td className="font-mono text-xs">{i.paid_amount ? i.paid_amount.toLocaleString() : '-'}</td>
                      <td className="text-xs">{i.due_date ? formatDate(i.due_date) : '-'}</td>
                      <td><span className="badge capitalize" style={{ backgroundColor: `color-mix(in srgb, ${invStatusColor[i.status] || '#6b7280'} 20%, transparent)`, color: invStatusColor[i.status] || '#6b7280' }}>{i.status}</span></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn-sm btn-secondary" title="View Items" onClick={() => loadInvoiceItems(i.id)}><Eye size={14} /></button>
                          <button className="btn-sm btn-secondary" title="Edit" onClick={() => { setInvForm({ contract_id: i.contract_id, invoice_no: i.invoice_no, invoice_date: i.invoice_date, amount: String(i.amount), status: i.status, invoice_type: i.invoice_type || 'progress', retention_pct: String(i.retention_pct || '10'), retention_amount: String(i.retention_amount || ''), due_date: i.due_date || '', paid_date: i.paid_date || '', paid_amount: String(i.paid_amount || ''), notes: i.notes || '' }); setEditInvId(i.id); setFormError(''); setShowInvForm(true); }}><Edit3 size={14} /></button>
                          <button className="btn-sm btn-secondary" title="Delete" onClick={() => setConfirmDelete({ id: i.id, type: 'invoice' })}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4 flex justify-end gap-4">
            <span className="text-sm font-semibold">Total Gross: <span className="font-mono">{totalAmount.toLocaleString()} SAR</span></span>
            <span className="text-sm font-semibold">Total Retention: <span className="font-mono" style={{ color: 'var(--color-danger)' }}>{filtered.reduce((s, i) => s + (i.retention_amount || 0), 0).toLocaleString()} SAR</span></span>
            <span className="text-sm font-semibold">Total Net: <span className="font-mono">{filtered.reduce((s, i) => s + (i.net_amount || i.amount - (i.retention_amount || 0)), 0).toLocaleString()} SAR</span></span>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
        </div>
        {showInvForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowInvForm(false)}>
            <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">{editInvId ? 'Edit Invoice' : 'New Invoice'}</h3>
              {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>{formError}</div>}
              <div className="space-y-4">
                <div><label className="label">Contract</label>
                  <select className="input" value={invForm.contract_id} onChange={e => setInvForm({ ...invForm, contract_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Invoice No *</label><input className="input" value={invForm.invoice_no} onChange={e => setInvForm({ ...invForm, invoice_no: e.target.value })} /></div>
                  <div><label className="label">Invoice Date</label><input type="date" className="input" value={invForm.invoice_date} onChange={e => setInvForm({ ...invForm, invoice_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Invoice Type</label>
                    <select className="input" value={invForm.invoice_type} onChange={e => setInvForm({ ...invForm, invoice_type: e.target.value })}>
                      {['progress', 'advance', 'final', 'retention', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Status</label>
                    <select className="input" value={invForm.status} onChange={e => setInvForm({ ...invForm, status: e.target.value })}>
                      {INV_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Amount (Gross)</label><input type="number" className="input" value={invForm.amount} onChange={e => setInvForm({ ...invForm, amount: e.target.value })} /></div>
                  <div><label className="label">Due Date</label><input type="date" className="input" value={invForm.due_date} onChange={e => setInvForm({ ...invForm, due_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Retention %</label><input type="number" step="0.1" className="input" value={invForm.retention_pct} onChange={e => setInvForm({ ...invForm, retention_pct: e.target.value })} /></div>
                  <div><label className="label">Retention Amount</label><input type="number" className="input" value={invForm.retention_amount} onChange={e => setInvForm({ ...invForm, retention_amount: e.target.value })} placeholder="Auto-calc if empty" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Paid Amount</label><input type="number" className="input" value={invForm.paid_amount} onChange={e => setInvForm({ ...invForm, paid_amount: e.target.value })} /></div>
                  <div><label className="label">Paid Date</label><input type="date" className="input" value={invForm.paid_date} onChange={e => setInvForm({ ...invForm, paid_date: e.target.value })} /></div>
                </div>
                <div><label className="label">Notes</label><textarea className="input" rows={2} value={invForm.notes} onChange={e => setInvForm({ ...invForm, notes: e.target.value })} /></div>
              </div>
              <div className="flex gap-2 mt-6">
                <button className="btn-primary btn-sm" onClick={saveInvoice} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="btn-secondary btn-sm" onClick={() => { setShowInvForm(false); setEditInvId(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        {viewInvoiceItems && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setViewInvoiceItems(null)}>
            <div className="rounded-xl p-6 w-full max-w-2xl shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Invoice Items <span className="font-mono text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}>{invoices.find(i => i.id === viewInvoiceItems.invoiceId)?.invoice_no || viewInvoiceItems.invoiceId.slice(0, 8)}</span></h3>
              {viewInvoiceItems.items.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)' }}>No line items linked to this invoice.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Item Code</th><th>Description</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                      {viewInvoiceItems.items.map((item: any) => (
                        <tr key={item.id}>
                          <td className="font-mono text-xs">{item.scope_item?.item_code || (item as any).scope_item_id?.slice(0, 8)}</td>
                          <td className="text-sm">{item.scope_item?.description_en || '-'}</td>
                          <td className="text-xs">{item.scope_item?.unit_of_measure || '-'}</td>
                          <td className="font-mono text-xs">{item.quantity}</td>
                          <td className="font-mono text-xs">{item.unit_price.toLocaleString()}</td>
                          <td className="font-mono text-xs font-semibold">{(item.total_amount || item.quantity * item.unit_price).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end mt-4">
                <button className="btn-secondary btn-sm" onClick={() => setViewInvoiceItems(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function handleDelete() {
    if (!confirmDelete) return;
    const { id, type } = confirmDelete;
    setConfirmDelete(null);
    switch (type) {
      case 'contract': deleteContract(id); break;
      case 'scope': deleteScopeItem(id); break;
      case 'variation': deleteVariation(id); break;
      case 'payment': deletePaymentSchedule(id); break;
      case 'invoice': deleteInvoice(id); break;
    }
  }

  const totalRecords = activeTab === 'contracts' ? contracts.length
    : activeTab === 'scope' ? scopeItems.length
    : activeTab === 'variations' ? variations.length + amendments.length
    : activeTab === 'payments' ? paymentSchedules.length
    : invoices.length;

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Execution Contracts</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>{totalRecords} records</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-sm btn-secondary" onClick={exportTab}><Download size={14} /> Export</button>
          {hasPermission('contracts', 'create') && activeTab === 'contracts' && (
            <button className="btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true); }}><Plus size={16} /> New Contract</button>
          )}
        </div>
      </div>

      <div className="tabs overflow-x-auto">
        <button className={`tab whitespace-nowrap ${activeTab === 'contracts' ? 'tab-active' : ''}`} onClick={() => { setActiveTab('contracts'); setSelectedContractId(''); }}><FileText size={14} /> Contracts</button>
        <button className={`tab whitespace-nowrap ${activeTab === 'scope' ? 'tab-active' : ''}`} onClick={() => { setActiveTab('scope'); setSelectedContractId(''); }}><Layers size={14} /> Scope Items</button>
        <button className={`tab whitespace-nowrap ${activeTab === 'variations' ? 'tab-active' : ''}`} onClick={() => { setActiveTab('variations'); setSelectedContractId(''); }}><GitCompareArrows size={14} /> Variations & Amendments</button>
        <button className={`tab whitespace-nowrap ${activeTab === 'payments' ? 'tab-active' : ''}`} onClick={() => { setActiveTab('payments'); setSelectedContractId(''); }}><Calendar size={14} /> Payment Schedules</button>
        <button className={`tab whitespace-nowrap ${activeTab === 'invoices' ? 'tab-active' : ''}`} onClick={() => { setActiveTab('invoices'); setSelectedContractId(''); }}><Receipt size={14} /> Invoices</button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input className="input ps-9" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {(activeTab === 'contracts') && (
          <select className="input max-w-[200px]" value={filterProject} onChange={e => { setFilterProject(e.target.value); setPage(1); }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
          </select>
        )}
      </div>

      {activeTab === 'contracts' && renderContractsTab()}
      {activeTab === 'scope' && renderScopeTab()}
      {activeTab === 'variations' && renderVariationsTab()}
      {activeTab === 'payments' && renderPaymentsTab()}
      {activeTab === 'invoices' && renderInvoicesTab()}

      {confirmDelete && (
        <ConfirmDialog
          title="Confirm Delete"
          message="Are you sure you want to delete this item? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
