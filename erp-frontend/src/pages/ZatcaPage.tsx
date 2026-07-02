import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { useT } from '../hooks/useTranslation';
import { Receipt, Plus, Search, Download, CheckCircle, XCircle, Clock, QrCode, FileText } from 'lucide-react';
import Pagination from '../components/Pagination';
import { exportCSV } from '../utils/csv';
import { useAuth } from '../context/AuthContext';

interface ZatcaInvoice {
  id: string; invoice_no: string; invoice_type: string; direction: string;
  status: string; issue_date: string; seller_name: string; buyer_name: string;
  total_excluding_vat: number; total_vat: number; total_including_vat: number;
  qr_base64: string; cryptographic_stamp: string; deal_id: string; project_id?: string;
}

function formatCurrency(value: number, locale = 'en-SA'): string {
  try {
    return value?.toLocaleString(locale, { style: 'currency', currency: 'SAR' }) ?? 'SAR 0.00';
  } catch { return `SAR ${(value ?? 0).toFixed(2)}`; }
}

export default function ZatcaPage() {
  const t = useT(); const toast = useToast();
  const { hasPermission } = useAuth();
  const [invoices, setInvoices] = useState<ZatcaInvoice[]>([]);
  const [projects, setProjects] = useState<{ id: string; project_code: string }[]>([]);
  const [filterProject, setFilterProject] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const pageSize = 25;
  const [showForm, setShowForm] = useState(false); const [saving, setSaving] = useState(false); const [formError, setFormError] = useState('');
  const [showQr, setShowQr] = useState<ZatcaInvoice | null>(null);
  const [form, setForm] = useState({
    buyer_name: '', buyer_vat: '', invoice_type: 'standard', project_id: '',
    lines: [{ description: '', quantity: 1, unit_price: 0, vat_rate: 15 }],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from('zatca_invoices').select('*').order('issue_date', { ascending: false });
      if (filterProject) q = q.eq('project_id', filterProject);
      const { data } = await q;
      setInvoices((data || []) as ZatcaInvoice[]);
      const { data: projData } = await supabase.from('projects').select('id, project_code').eq('is_active', true).order('project_code');
      setProjects(projData || []);
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [toast, filterProject]);

  useEffect(() => { load(); }, [load]);

  function computeLineTotals(lines: typeof form.lines) {
    return lines.map(l => {
      const totalExVat = l.quantity * l.unit_price;
      const vatAmt = totalExVat * l.vat_rate / 100;
      return { ...l, total_excluding_vat: totalExVat, vat_amount: vatAmt, total_including_vat: totalExVat + vatAmt };
    });
  }

  async function save() {
    setFormError('');
    if (!form.buyer_name.trim()) { setFormError('Buyer name is required'); return; }
    if (form.lines.length === 0 || !form.lines[0].description.trim()) { setFormError('At least one line item is required'); return; }
    setSaving(true);
    try {
      const computedLines = computeLineTotals(form.lines);
      const totalExVat = computedLines.reduce((s, l) => s + l.total_excluding_vat, 0);
      const totalVat = computedLines.reduce((s, l) => s + l.vat_amount, 0);
      const totalIncVat = computedLines.reduce((s, l) => s + l.total_including_vat, 0);
      const nextNo = `ZATCA-${Date.now().toString().slice(-6)}`;

      const { data: invData, error: invError } = await supabase.from('zatca_invoices').insert({
        invoice_no: nextNo, invoice_type: form.invoice_type, status: 'draft',
        seller_name: 'Alfanar ERP', seller_vat: '300123456700003',
        buyer_name: form.buyer_name, buyer_vat: form.buyer_vat || null,
        total_excluding_vat: totalExVat, total_vat: totalVat, total_including_vat: totalIncVat,
        currency: 'SAR', vat_rate: 15,
        project_id: form.project_id || null,
      }).select('id').single();
      if (invError) throw invError;

      const linesToInsert = computedLines.map((l, i) => ({
        invoice_id: invData.id, line_no: i + 1, description: l.description,
        quantity: l.quantity, unit_price: l.unit_price,
        total_excluding_vat: l.total_excluding_vat, vat_rate: l.vat_rate,
        vat_amount: l.vat_amount, total_including_vat: l.total_including_vat,
      }));
      const { error: linesError } = await supabase.from('zatca_invoice_lines').insert(linesToInsert);
      if (linesError) throw linesError;

      toast.success(`Invoice ${nextNo} created`); setShowForm(false);
      setForm({ buyer_name: '', buyer_vat: '', invoice_type: 'standard', project_id: '', lines: [{ description: '', quantity: 1, unit_price: 0, vat_rate: 15 }] });
      load();
    } catch (err: unknown) { const msg = err instanceof Error ? err.message : 'Save failed'; setFormError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  const filtered = invoices.filter((inv) => !search || inv.invoice_no.toLowerCase().includes(search.toLowerCase()) || (inv.buyer_name || '').toLowerCase().includes(search.toLowerCase()));
  const getStatusBadge = (s: string) => { const m: Record<string, string> = { draft: 'badge', submitted: 'badge-info', reported: 'badge-success', cancelled: 'badge-danger', rejected: 'badge-danger' }; return m[s] || 'badge'; };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Receipt size={24} style={{ color: '#10B981' }} /> E-Invoicing (ZATCA)
        </h1>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as any, `zatca_invoices_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> Export
          </button>
          {hasPermission('finance', 'create') && <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}><Plus size={16} /> New Invoice</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoices', value: invoices.length, icon: Receipt, color: '#10B981' },
          { label: 'Draft', value: invoices.filter(i => i.status === 'draft').length, icon: Clock, color: '#6B7280' },
          { label: 'Reported', value: invoices.filter(i => i.status === 'reported').length, icon: CheckCircle, color: '#22C55E' },
          { label: 'Cancelled', value: invoices.filter(i => i.status === 'cancelled').length, icon: XCircle, color: '#EF4444' },
        ].map((c) => (
          <div key={c.label} className="card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${c.color}15` }}><c.icon size={20} style={{ color: c.color }} /></div>
            <div><p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{c.label}</p><p className="text-xl font-bold">{c.value}</p></div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <select className="select text-sm" style={{ width: '150px' }} value={filterProject} onChange={e => { setFilterProject(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_code}</option>)}
        </select>
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-9" placeholder="Search invoices..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead><tr><th>Invoice No</th><th>Type</th><th>Buyer</th><th>Total (Inc. VAT)</th><th>VAT</th><th>Status</th><th>Project</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No e-invoices yet. Create your first ZATCA-compliant invoice.</td></tr>
            ) : (
              filtered.slice((page - 1) * pageSize, page * pageSize).map((inv) => (
                <tr key={inv.id}>
                  <td className="font-mono text-xs">{inv.invoice_no}</td>
                  <td><span className="badge capitalize text-xs">{inv.invoice_type}</span></td>
                  <td className="font-medium">{inv.buyer_name || '-'}</td>
                  <td className="font-mono text-sm">{formatCurrency(inv.total_including_vat)}</td>
                  <td className="font-mono text-sm" style={{ color: '#EF4444' }}>{formatCurrency(inv.total_vat)}</td>
                  <td><span className={`badge capitalize ${getStatusBadge(inv.status)}`}>{inv.status}</span></td>
                  <td className="text-xs">{projects.find(p => p.id === inv.project_id)?.project_code || '-'}</td>
                  <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : '-'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn-sm btn-secondary" onClick={() => setShowQr(inv)} title="QR Code"><QrCode size={14} /></button>
                      <button className="btn-sm btn-secondary" onClick={() => { const xml = (inv as any).xml_payload || (inv as any).cryptographic_stamp; toast.info(xml ? `XML: ${inv.invoice_no}` : 'No XML stored'); }} title="View XML"><FileText size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Receipt size={16} /> Create ZATCA E-Invoice</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="label">Buyer Name *</label><input className="input" value={form.buyer_name} onChange={(e) => setForm({...form, buyer_name: e.target.value})} /></div>
              <div><label className="label">Buyer VAT</label><input className="input" value={form.buyer_vat} onChange={(e) => setForm({...form, buyer_vat: e.target.value})} /></div>
              <div><label className="label">Invoice Type</label>
                <select className="input" value={form.invoice_type} onChange={(e) => setForm({...form, invoice_type: e.target.value})}>
                  <option value="standard">Standard Invoice</option><option value="simplified">Simplified Invoice</option>
                  <option value="debit_note">Debit Note</option><option value="credit_note">Credit Note</option>
                </select>
              </div>
              <div><label className="label">Project</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({...form, project_id: e.target.value})}>
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code}</option>)}
                </select>
              </div>
            </div>
            <h4 className="text-sm font-semibold mb-2">Line Items</h4>
            {form.lines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-end mb-2">
                <div className="flex-1"><label className="label">Description</label><input className="input" value={line.description} onChange={(e) => { const lines = [...form.lines]; lines[idx].description = e.target.value; setForm({...form, lines}); }} /></div>
                <div className="w-20"><label className="label">Qty</label><input type="number" className="input" min={1} value={line.quantity} onChange={(e) => { const lines = [...form.lines]; lines[idx].quantity = Number(e.target.value); setForm({...form, lines}); }} /></div>
                <div className="w-28"><label className="label">Unit Price (SAR)</label><input type="number" className="input" min={0} step={0.01} value={line.unit_price} onChange={(e) => { const lines = [...form.lines]; lines[idx].unit_price = Number(e.target.value); setForm({...form, lines}); }} /></div>
                <div className="w-20"><label className="label">VAT %</label>
                  <select className="input" value={line.vat_rate} onChange={(e) => { const lines = [...form.lines]; lines[idx].vat_rate = Number(e.target.value); setForm({...form, lines}); }}>
                    <option value={15}>15%</option><option value={0}>0%</option><option value={5}>5%</option>
                  </select>
                </div>
                {idx === form.lines.length - 1 && (
                  <button className="btn-sm btn-secondary mb-0.5" onClick={() => setForm({...form, lines: [...form.lines, { description: '', quantity: 1, unit_price: 0, vat_rate: 15 }] })}>+</button>
                )}
              </div>
            ))}
            <div className="border-t pt-3 mt-3 flex gap-2" style={{ borderColor: 'var(--color-border)' }}>
              {hasPermission('finance', 'create') && <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Creating...' : 'Create Invoice'}</button>}
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showQr && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowQr(null)}>
          <div className="rounded-xl p-6 w-full max-w-sm shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">ZATCA QR Code</h3>
              <button className="btn-sm btn-secondary" onClick={() => setShowQr(null)}>Close</button>
            </div>
            <div className="bg-white p-4 rounded-lg flex justify-center">
              <QrCode size={200} style={{ color: '#000' }} />
            </div>
            <p className="text-xs text-center mt-2" style={{ color: 'var(--color-text-secondary)' }}>{showQr.invoice_no}</p>
            <div className="text-xs mt-3 space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
              <p><strong>Seller:</strong> {showQr.seller_name}</p>
              <p><strong>VAT:</strong> {showQr.total_vat?.toFixed(2)} SAR</p>
              <p><strong>Total:</strong> {showQr.total_including_vat?.toFixed(2)} SAR</p>
              <p><strong>Date:</strong> {showQr.issue_date ? new Date(showQr.issue_date).toISOString() : '-'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
