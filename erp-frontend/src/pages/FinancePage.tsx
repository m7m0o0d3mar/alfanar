import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import EmptyState from '../components/EmptyState';
import { exportCSV } from '../utils/csv';
import CsvImportModal from '../components/CsvImportModal';
import { type SyncConfig } from '../services/syncService';
import { Plus, Download, Upload, Search, TrendingDown, TrendingUp, DollarSign, FileText } from 'lucide-react';
import Pagination from '../components/Pagination';

interface Invoice { id: string; invoice_no: string; contract_id: string; po_no: string; amount: number; invoice_date: string; due_date: string; status: string; notes: string; }
interface BudgetEntry { id: string; budget_code: string; description: string; project_id: string; category: string; budget_type: string; total_budget: number; used_amount: number; currency: string; }
interface Project { id: string; name_en: string; project_code: string; }
interface PO { id: string; po_no: string; project_id: string; supplier_id: string; total_amount: number; status: string; }
interface Contract { id: string; contract_no: string; title_en: string; }

type Tab = 'invoices' | 'budget' | 'budget_vs_actual';

export default function FinancePage() {
  const t = useT();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [budget, setBudget] = useState<BudgetEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [form, setForm] = useState({
    invoice_no: '', contract_id: '', po_no: '', amount: '',
    invoice_date: new Date().toISOString().slice(0, 10), due_date: '',
    notes: '', project_id: '', category: '', budget_type: 'operating',
    currency: 'SAR', description: '',
  });

  useEffect(() => { load(); }, [activeTab]);
  useEffect(() => { setPage(1); }, [activeTab]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  async function load() {
    setLoading(true);
    try {
      const tbl = activeTab === 'invoices' ? 'contract_invoices' : 'budget';
      const [invRes, budRes, projRes, poRes, conRes] = await Promise.all([
        activeTab === 'invoices' ? supabase.from(tbl).select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        activeTab === 'budget' || activeTab === 'budget_vs_actual' ? supabase.from('budget').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
        activeTab === 'invoices' ? supabase.from('purchase_orders').select('id, po_no, project_id, supplier_id, total_amount, status').order('po_no') : Promise.resolve({ data: [] }),
        activeTab === 'invoices' ? supabase.from('contracts').select('id, contract_no, title_en').order('contract_no') : Promise.resolve({ data: [] }),
      ]);
      setInvoices(invRes.data as Invoice[] || []);
      setBudget(budRes.data as BudgetEntry[] || []);
      setProjects(projRes.data as Project[] || []);
      setPos(poRes.data as PO[] || []);
      setContracts(conRes.data as Contract[] || []);
    } catch (err) {
      console.error('Failed to load finance data:', err);
      toast.error('Failed to load finance data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const filtered = (activeTab === 'invoices' ? invoices : budget).filter(i => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    const code = (activeTab === 'invoices' ? (i as Invoice).invoice_no : (i as BudgetEntry).budget_code) || '';
    const desc = activeTab === 'budget' ? (i as BudgetEntry).description : (i as Invoice).notes;
    return code.toLowerCase().includes(q) || ((desc || '')).toLowerCase().includes(q);
  });

  async function autoCreateInvoicesFromPOs() {
    const approvedPos = pos.filter(p => p.status === 'Approved' || p.status === 'approved' || p.status === 'Paid' || p.status === 'paid');
    const existingInvoiceNos = new Set(invoices.map(i => i.invoice_no).filter(Boolean));
    const toCreate = approvedPos.filter(p => !existingInvoiceNos.has(`INV-${p.po_no}`));
    if (toCreate.length === 0) {
      toast.info('All approved POs already have invoices.');
      return;
    }
    setSaving(true);
    let created = 0;
    for (const po of toCreate) {
      const invoiceNo = `INV-${po.po_no}`;
      try {
        const { error } = await supabase.from('contract_invoices').insert({
          invoice_no: invoiceNo, invoice_type: 'progress',
          amount: po.total_amount || 0,
          invoice_date: new Date().toISOString().slice(0, 10),
          status: 'draft', notes: `Auto-created from PO ${po.po_no}`,
          po_no: po.po_no,
        });
        if (!error) created++;
      } catch (err) {
        console.error('Auto-create invoice failed:', err);
      }
    }
    toast.success(`Created ${created} of ${toCreate.length} invoice(s) from approved POs`);
    if (created < toCreate.length) toast.info(`${toCreate.length - created} invoice(s) failed to create`);
    load();
    setSaving(false);
  }

  async function save() {
    setFormError('');
    if (!form.invoice_no.trim() && activeTab !== 'budget_vs_actual') { setFormError('Code is required'); return; }
    if (activeTab === 'invoices' && !form.contract_id) { setFormError('Contract is required'); return; }
    setSaving(true);
    try {
      if (activeTab === 'invoices') {
        const { error } = await supabase.from('contract_invoices').insert({
          invoice_no: form.invoice_no, invoice_type: 'progress',
          contract_id: form.contract_id || null,
          invoice_date: form.invoice_date, amount: form.amount ? parseFloat(form.amount) : 0,
          due_date: form.due_date || null, notes: form.notes || null,
          po_no: form.po_no || null,
          status: 'draft',
        });
        if (error) throw error;
        toast.success(`Invoice "${form.invoice_no}" created`);
      } else {
        const { error } = await supabase.from('budget').insert({
          budget_code: form.invoice_no, description: form.description || form.invoice_no,
          total_budget: form.amount ? parseFloat(form.amount) : 0,
          project_id: form.project_id || null, category: form.category || null,
          budget_type: form.budget_type, currency: form.currency,
        });
        if (error) throw error;
        toast.success(`Budget entry "${form.invoice_no}" created`);
      }
      setShowForm(false);
      setForm({ invoice_no: '', contract_id: '', po_no: '', amount: '', invoice_date: new Date().toISOString().slice(0, 10), due_date: '', notes: '', project_id: '', category: '', budget_type: 'operating', currency: 'SAR', description: '' });
      load();
    } catch (err: unknown) {
      console.error('Finance save failed:', err);
      const tbl = activeTab === 'invoices' ? 'contract_invoices' : 'budget';
      const msg = friendlyError(err, tbl);
      setFormError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  const invoiceColumns = [
    { key: 'invoice_no', label: 'Invoice No', required: true },
    { key: 'invoice_type', label: 'Invoice Type' },
    { key: 'contract_id', label: 'Contract ID' },
    { key: 'amount', label: 'Amount', type: 'number' as const },
    { key: 'invoice_date', label: 'Invoice Date', required: true },
    { key: 'due_date', label: 'Due Date' },
    { key: 'status', label: 'Status' },
  ];
  const budgetColumns = [
    { key: 'budget_code', label: 'Budget Code', required: true },
    { key: 'description', label: 'Description' },
    { key: 'total_budget', label: 'Total Budget', type: 'number' as const },
    { key: 'used_amount', label: 'Used Amount', type: 'number' as const },
  ];

  function friendlyError(err: unknown, table: string): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('violates foreign key constraint')) {
      if (msg.includes('contract_id')) return 'Contract ID not found. Make sure the contract exists or leave blank to use the first available.';
      if (msg.includes('project_id')) return 'Project not found. Please check the project reference.';
      return 'Referenced record not found. Please check your data.';
    }
    if (msg.includes('violates not-null constraint')) {
      const col = msg.match(/column "([^"]+)"/)?.[1] || 'unknown';
      return `"${col}" is required but was left empty.`;
    }
    if (msg.includes('violates check constraint') || msg.includes('invalid input value')) {
      if (msg.includes('invoice_type')) return 'Invoice Type must be one of: progress, advance, final, retention, other.';
      return 'One of the values is invalid. Check the import template for allowed values.';
    }
    if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
      if (msg.includes('invoice_no') || msg.includes('contract_id')) return 'An invoice with this number already exists for this contract.';
      return 'A record with the same unique identifier already exists.';
    }
    return `Database error: ${msg}`;
  }

  const importConfig: SyncConfig = activeTab === 'invoices'
    ? {
        table: 'contract_invoices',
        columns: invoiceColumns,
        defaults: { invoice_type: 'other', status: 'pending' },
      }
    : {
        table: 'budget',
        columns: budgetColumns,
        defaults: { currency: 'SAR' },
      };

  const budgetVsActual = projects.map(p => {
    const projectBudget = budget.filter(b => b.project_id === p.id);
    const totalBudget = projectBudget.reduce((s, b) => s + (Number(b.total_budget) || 0), 0);
    const totalUsed = projectBudget.reduce((s, b) => s + (Number(b.used_amount) || 0), 0);
    const invoiceTotal = invoices.filter(i => i.status === 'paid' || i.status === 'approved')
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);
    return { project: p, totalBudget, totalUsed, invoiceTotal, remaining: totalBudget - totalUsed, pctUsed: totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0 };
  }).filter(b => b.totalBudget > 0);

  const openNewForm = () => { setFormError(''); setForm({ invoice_no: '', contract_id: '', po_no: '', amount: '', invoice_date: new Date().toISOString().slice(0, 10), due_date: '', notes: '', project_id: '', category: '', budget_type: 'operating', currency: 'SAR', description: '' }); setShowForm(true); };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.finance')}</h1>
          <p className="text-gray-500 mt-1">{activeTab === 'invoices' ? `${invoices.length} Invoices` : activeTab === 'budget' ? `${budget.length} Budget Entries` : `${budgetVsActual.length} Projects`}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-sm btn-secondary" onClick={() => { const data = activeTab === 'invoices' ? filtered : activeTab === 'budget' ? filtered : budgetVsActual; if (data.length) exportCSV(data as unknown as Record<string, unknown>[], `finance_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`); }}><Download size={14} /> Export</button>
          {activeTab !== 'budget_vs_actual' && <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}><Upload size={14} /> Import</button>}
          {activeTab === 'invoices' && <button className="btn-sm btn-secondary" onClick={autoCreateInvoicesFromPOs} disabled={saving}><TrendingUp size={14} /> Auto from POs</button>}
          {activeTab !== 'budget_vs_actual' && <button className="btn-primary btn-sm" onClick={openNewForm}><Plus size={16} /> {activeTab === 'invoices' ? 'New Invoice' : 'New Budget'}</button>}
        </div>
      </div>

      <div className="tabs overflow-x-auto">
        <button className={`tab whitespace-nowrap ${activeTab === 'invoices' ? 'tab-active' : ''}`} onClick={() => setActiveTab('invoices')}>Invoices</button>
        <button className={`tab whitespace-nowrap ${activeTab === 'budget' ? 'tab-active' : ''}`} onClick={() => setActiveTab('budget')}>Budget</button>
        <button className={`tab whitespace-nowrap ${activeTab === 'budget_vs_actual' ? 'tab-active' : ''}`} onClick={() => setActiveTab('budget_vs_actual')}>Budget vs Actual</button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input ps-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Invoices tab */}
      {activeTab === 'invoices' && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Invoice No</th><th>PO</th><th>Amount</th><th>Date</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr>
                : (filtered as Invoice[]).length === 0 ? <EmptyState title="No invoices" description="Create an invoice linked to a PO or project." actionLabel="New Invoice" onAction={openNewForm} />
                : (filtered as Invoice[]).slice((page - 1) * pageSize, page * pageSize).map(inv => (
                    <tr key={inv.id}>
                      <td className="font-mono text-xs">{inv.invoice_no}</td>
                      <td className="font-mono text-xs">{inv.invoice_no?.startsWith('INV-') ? inv.invoice_no.slice(4) : '-'}</td>
                      <td className="font-mono text-xs">{Number(inv.amount || 0).toLocaleString()} SAR</td>
                      <td className="text-sm">{inv.invoice_date}</td>
                      <td className="text-sm">{inv.due_date || '-'}</td>
                      <td><span className={`badge capitalize ${inv.status === 'paid' ? 'badge-success' : inv.status === 'draft' ? 'badge-neutral' : 'badge-warning'}`}>{inv.status}</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={(filtered as Invoice[]).length} onChange={setPage} />
        </div>
      )}

      {/* Budget tab */}
      {activeTab === 'budget' && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Code</th><th>Description</th><th>Category</th><th>Type</th><th>Total</th><th>Used</th><th>Remaining</th><th>%</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
                : (filtered as BudgetEntry[]).length === 0 ? <EmptyState title="No budget entries" description="Create budget entries to track project spending." actionLabel="New Budget" onAction={openNewForm} />
                : (filtered as BudgetEntry[]).slice((page - 1) * pageSize, page * pageSize).map(b => {
                    const used = Number(b.used_amount || 0);
                    const total = Number(b.total_budget || 0);
                    const pct = total > 0 ? (used / total) * 100 : 0;
                    return (
                      <tr key={b.id}>
                        <td className="font-mono text-xs">{b.budget_code.replace('BUG-', 'BDG-')}</td>
                        <td className="text-sm">{b.description}</td>
                        <td className="text-sm">{b.category || '-'}</td>
                        <td><span className="badge capitalize">{b.budget_type}</span></td>
                        <td className="font-mono text-xs">{total.toLocaleString()} {b.currency}</td>
                        <td className="font-mono text-xs">{used.toLocaleString()}</td>
                        <td className="font-mono text-xs">{(total - used).toLocaleString()}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full overflow-hidden" style={{backgroundColor: 'color-mix(in srgb, var(--color-text) 10%, transparent)'}}>
                              <div className="h-full rounded-full" style={{
                                width: `${Math.min(pct, 100)}%`,
                                backgroundColor: pct > 90 ? 'var(--color-danger)' : pct > 70 ? 'var(--color-warning)' : 'var(--color-success)'
                              }} />
                            </div>
                            <span className="text-xs" style={{color: 'var(--color-text-secondary)'}}>{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={(filtered as BudgetEntry[]).length} onChange={setPage} />
        </div>
      )}

      {/* Budget vs Actual tab */}
      {activeTab === 'budget_vs_actual' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Summary cards */}
          <div className="stat-card">
            <div className="stat-card-icon" style={{backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)'}}><DollarSign size={24} style={{color: 'var(--color-primary)'}} /></div>
            <div><p className="stat-card-label">Total Budget</p><p className="stat-card-value">{budget.reduce((s, b) => s + Number(b.total_budget), 0).toLocaleString()} SAR</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 12%, transparent)'}}><TrendingDown size={24} style={{color: 'var(--color-danger)'}} /></div>
            <div><p className="stat-card-label">Total Spent</p><p className="stat-card-value">{budget.reduce((s, b) => s + Number(b.used_amount || 0), 0).toLocaleString()} SAR</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon" style={{backgroundColor: 'color-mix(in srgb, var(--color-success) 12%, transparent)'}}><TrendingUp size={24} style={{color: 'var(--color-success)'}} /></div>
            <div><p className="stat-card-label">Remaining</p><p className="stat-card-value">{(budget.reduce((s, b) => s + Number(b.total_budget), 0) - budget.reduce((s, b) => s + Number(b.used_amount || 0), 0)).toLocaleString()} SAR</p></div>
          </div>

          {/* Per-project breakdown */}
          <div className="lg:col-span-3 card">
            <h3 className="font-semibold mb-4">Budget vs Actual by Project</h3>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th className="min-w-[200px]">Project</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>Status</th></tr></thead>
                <tbody>
                  {budgetVsActual.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">No budget data available</td></tr>
                  ) : (
                    budgetVsActual.map(b => (
                      <tr key={b.project.id}>
                        <td className="font-medium min-w-[200px]">{b.project.project_code} - {b.project.name_en}</td>
                        <td className="font-mono text-xs whitespace-nowrap">{b.totalBudget.toLocaleString()} SAR</td>
                        <td className="font-mono text-xs whitespace-nowrap">{b.totalUsed.toLocaleString()} SAR</td>
                        <td className={`font-mono text-xs whitespace-nowrap ${b.remaining < 0 ? 'text-red-600 font-bold' : ''}`}>{b.remaining.toLocaleString()} SAR</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full overflow-hidden" style={{backgroundColor: 'color-mix(in srgb, var(--color-text) 10%, transparent)'}}>
                              <div className="h-full rounded-full" style={{
                                width: `${Math.min(b.pctUsed, 100)}%`,
                                backgroundColor: b.pctUsed > 90 ? 'var(--color-danger)' : b.pctUsed > 70 ? 'var(--color-warning)' : 'var(--color-success)'
                              }} />
                            </div>
                            <span className={`badge text-xs ${b.pctUsed > 90 ? 'badge-danger' : b.pctUsed > 70 ? 'badge-warning' : 'badge-success'}`}>{b.pctUsed > 90 ? 'Critical' : b.pctUsed > 70 ? 'Warning' : 'On Track'}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{activeTab === 'invoices' ? 'New Invoice' : 'New Budget Entry'}</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">{activeTab === 'invoices' ? 'Invoice No' : 'Budget Code'} *</label>
                <input className="input" value={form.invoice_no} onChange={e => setForm({ ...form, invoice_no: e.target.value })} />
              </div>
              {activeTab === 'invoices' ? (
                <>
                  <div><label className="label">Contract *</label>
                    <select className="input" value={form.contract_id} onChange={e => setForm({ ...form, contract_id: e.target.value })}>
                      <option value="">-- Select Contract --</option>
                      {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no} - {c.title_en}</option>)}
                    </select>
                  </div>
                  <div><label className="label">PO Reference</label>
                    <select className="input" value={form.po_no} onChange={e => setForm({ ...form, po_no: e.target.value })}>
                      <option value="">-- None (Direct Invoice) --</option>
                      {pos.filter(p => p.status !== 'cancelled').map(p => <option key={p.id} value={p.po_no}>{p.po_no} - {Number(p.total_amount || 0).toLocaleString()} SAR</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Amount</label><input type="number" className="input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                    <div><label className="label">Date</label><input type="date" className="input" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Due Date</label><input type="date" className="input" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
                    <div><label className="label">Status</label>
                      <select className="input" value="draft" disabled>
                        <option value="draft">Draft</option>
                      </select>
                    </div>
                  </div>
                  <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                </>
              ) : (
                <>
                  <div><label className="label">Project</label>
                    <select className="input" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                      <option value="">-- Select Project --</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Category</label><input className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
                    <div><label className="label">Budget Type</label>
                      <select className="input" value={form.budget_type} onChange={e => setForm({ ...form, budget_type: e.target.value })}>
                        {['operating','capital','maintenance','labor','material','equipment','overhead','other'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Amount</label><input type="number" className="input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                    <div><label className="label">Currency</label>
                      <select className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                        {['SAR','USD','EUR','GBP'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
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

      {showImport && <CsvImportModal moduleName={activeTab === 'invoices' ? 'Invoices' : 'Budget'} config={importConfig} onClose={() => { setShowImport(false); load(); }} />}
    </div>
  );
}
