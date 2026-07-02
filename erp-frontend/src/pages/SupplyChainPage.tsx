import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import {
  TrendingUp, ShoppingCart, FileText, Package, Award, DollarSign,
  Warehouse, ArrowRight, Activity,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const C: Record<string, { bg: string; textColor: string }> = {
  blue: { bg: 'rgba(59,130,246,0.12)', textColor: '#3b82f6' },
  amber: { bg: 'rgba(245,158,11,0.12)', textColor: '#d97706' },
  green: { bg: 'rgba(34,197,94,0.12)', textColor: '#16a34a' },
  red: { bg: 'rgba(239,68,68,0.12)', textColor: '#dc2626' },
  purple: { bg: 'rgba(168,85,247,0.12)', textColor: '#a855f7' },
};

function KpiCard({ icon: Icon, label, value, bg, textColor, loading, onClick }: {
  icon: LucideIcon; label: string; value: string; bg: string; textColor: string; loading: boolean; onClick?: () => void;
}) {
  if (loading) {
    return (
      <div className="stat-glass animate-pulse p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: 'var(--color-skeleton)' }} />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-16 rounded" style={{ backgroundColor: 'var(--color-skeleton)' }} />
            <div className="h-3 w-24 rounded" style={{ backgroundColor: 'var(--color-skeleton)' }} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="stat-glass p-4 transition-all hover:shadow-md" style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg, color: textColor }}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold truncate">{value}</p>
          <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function SupplyChainPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [prCount, setPrCount] = useState(0);
  const [activePoCount, setActivePoCount] = useState(0);
  const [pendingReceipts, setPendingReceipts] = useState(0);
  const [activeContractCount, setActiveContractCount] = useState(0);
  const [contractTotalValue, setContractTotalValue] = useState(0);
  const [supplierCount, setSupplierCount] = useState(0);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [funnelEvents, setFunnelEvents] = useState(0);
  const [funnelGoodsReceipts, setFunnelGoodsReceipts] = useState(0);
  const [topSuppliers, setTopSuppliers] = useState<{ name: string; avgScore: number }[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [
        prRes, poRes, pendingRes, activeContractsRes,
        supRes, invRes, matRes, whRes,
        movementsRes, evaluationsRes, sourcingRes, goodsReceiptRes,
      ] = await Promise.all([
        supabase.from('purchase_requisitions').select('id', { count: 'exact', head: true }),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).in('status', ['pending_approval', 'approved']),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('procurement_contracts').select('id, total_value').eq('status', 'active'),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }),
        supabase.from('inventory').select('quantity, unit_price'),
        supabase.from('materials').select('id', { count: 'exact', head: true }),
        supabase.from('warehouses').select('id', { count: 'exact', head: true }),
        supabase.from('stock_movements').select('*, materials(code, name_en)').order('created_at', { ascending: false }).limit(10),
        supabase.from('supplier_evaluations').select('supplier_id, overall_score').not('overall_score', 'is', null),
        supabase.from('sourcing_events').select('id', { count: 'exact', head: true }),
        supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('movement_type', 'received'),
      ]);

      const prC = prRes.count ?? 0;
      const poC = poRes.count ?? 0;
      const pendC = pendingRes.count ?? 0;
      const supC = supRes.count ?? 0;
      const matC = matRes.count ?? 0;
      const whC = whRes.count ?? 0;
      const contractArr = activeContractsRes.data ?? [];
      const totalContractVal = contractArr.reduce((s: number, c: any) => s + (Number(c.total_value) || 0), 0);

      setPrCount(prC);
      setActivePoCount(poC);
      setPendingReceipts(pendC);
      setActiveContractCount(contractArr.length);
      setContractTotalValue(totalContractVal);
      setSupplierCount(supC);

      const invVal = ((invRes.data ?? []) as { quantity: number; unit_price: number }[]).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
      setInventoryValue(invVal);

      setFunnelEvents(sourcingRes.count ?? 0);
      setFunnelGoodsReceipts(goodsReceiptRes.count ?? 0);
      setRecentMovements(movementsRes.data ?? []);

      const evalMap = new Map<string, number[]>();
      (evaluationsRes.data ?? []).forEach((e: any) => {
        const arr = evalMap.get(e.supplier_id) || [];
        arr.push(Number(e.overall_score) || 0);
        evalMap.set(e.supplier_id, arr);
      });
      const avgScores = Array.from(evalMap.entries())
        .map(([sid, scores]) => ({ supplierId: sid, avgScore: scores.reduce((a, b) => a + b, 0) / scores.length }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 5);

      if (avgScores.length > 0) {
        const supNameRes = await supabase.from('suppliers').select('id, name_en').in('id', avgScores.map(s => s.supplierId));
        const nameMap = new Map((supNameRes.data ?? []).map((s: any) => [s.id, s.name_en]));
        setTopSuppliers(avgScores.map(s => ({ name: nameMap.get(s.supplierId) || s.supplierId.slice(0, 8), avgScore: s.avgScore })));
      } else {
        setTopSuppliers([]);
      }

      setTotalRecords(prC + poC + supC + matC + whC + contractArr.length);
    } catch (err) {
      console.error('Supply chain data error:', err);
      toast.error(t('supply_chain.load_error') || 'Failed to load supply chain data');
    } finally {
      setLoading(false);
    }
  }

  const kpis = [
    { icon: ShoppingCart, label: t('supply_chain.total_prs') || 'Total PRs', value: String(prCount), ...C.blue, onClick: () => navigate('/procurement') },
    { icon: FileText, label: t('supply_chain.active_pos') || 'Active POs', value: String(activePoCount), ...C.amber, onClick: () => navigate('/procurement') },
    { icon: Package, label: t('supply_chain.pending_receipts') || 'Pending Receipts', value: String(pendingReceipts), ...C.red },
    { icon: Award, label: t('supply_chain.active_contracts') || 'Active Contracts', value: `${activeContractCount} / ${contractTotalValue.toLocaleString()} SAR`, ...C.green, onClick: () => navigate('/procurement') },
    { icon: TrendingUp, label: t('supply_chain.suppliers') || 'Suppliers', value: String(supplierCount), ...C.purple, onClick: () => navigate('/procurement') },
    { icon: DollarSign, label: t('supply_chain.inventory_value') || 'Inventory Value', value: `${inventoryValue.toLocaleString()} SAR`, ...C.blue },
  ];

  const funnelSteps = [
    { label: t('supply_chain.requisitions') || 'PRs', count: prCount, icon: ShoppingCart, color: '#3b82f6' },
    { label: t('supply_chain.sourcing_events') || 'Sourcing Events', count: funnelEvents, icon: TrendingUp, color: '#d97706' },
    { label: t('supply_chain.purchase_orders') || 'POs', count: activePoCount, icon: FileText, color: '#16a34a' },
    { label: t('supply_chain.goods_receipts') || 'Goods Receipts', count: funnelGoodsReceipts, icon: Package, color: '#a855f7' },
  ];

  const maxScore = topSuppliers.length > 0 ? Math.max(...topSuppliers.map(s => s.avgScore)) : 5;

  const typeBadge: Record<string, string> = { received: 'badge-success', issued: 'badge-danger', transfer: 'badge-warning', adjustment: 'badge-info' };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.blue.bg, color: C.blue.textColor }}>
            <Activity size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              {t('supply_chain.title') || 'Supply Chain'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {totalRecords} {t('supply_chain.total_records') || 'total records'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} loading={loading} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            {t('supply_chain.procurement_funnel') || 'Procurement Funnel'}
          </h3>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-10 rounded" style={{ backgroundColor: 'var(--color-skeleton)' }} />)}
            </div>
          ) : (
            <div className="space-y-0">
              {funnelSteps.map((step, idx) => (
                <div key={step.label}>
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${step.color}18`, color: step.color }}>
                      <step.icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{step.label}</span>
                      <span className="text-lg font-bold shrink-0" style={{ color: step.color }}>{step.count}</span>
                    </div>
                  </div>
                  {idx < funnelSteps.length - 1 && (
                    <div className="flex justify-center py-0.5">
                      <ArrowRight size={16} style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            {t('supply_chain.supplier_performance') || 'Supplier Performance'}
          </h3>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 rounded" style={{ backgroundColor: 'var(--color-skeleton)' }} />)}
            </div>
          ) : topSuppliers.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t('supply_chain.no_evaluations') || 'No evaluations yet'}
            </p>
          ) : (
            <div className="space-y-4">
              {topSuppliers.map((s, idx) => {
                const pct = (s.avgScore / maxScore) * 100;
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {idx + 1}. {s.name}
                      </span>
                      <span className="font-semibold shrink-0 ml-2" style={{ color: s.avgScore >= 4 ? '#16a34a' : s.avgScore >= 3 ? '#d97706' : '#dc2626' }}>
                        {s.avgScore.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.max(pct, 4)}%`,
                        backgroundColor: pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} style={{ color: 'var(--color-text-muted)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {t('supply_chain.recent_activity') || 'Recent Activity'}
          </h3>
        </div>
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 rounded" style={{ backgroundColor: 'var(--color-skeleton)' }} />)}
          </div>
        ) : recentMovements.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t('supply_chain.no_movements') || 'No recent stock movements'}
          </p>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('supply_chain.movement_no') || 'Movement No'}</th>
                    <th>{t('supply_chain.material') || 'Material'}</th>
                    <th>{t('supply_chain.type') || 'Type'}</th>
                    <th>{t('supply_chain.quantity') || 'Quantity'}</th>
                    <th>{t('supply_chain.date') || 'Date'}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMovements.map((m: any) => (
                    <tr key={m.id}>
                      <td className="font-mono text-xs">{m.movement_no}</td>
                      <td className="text-sm font-medium">
                        {m.materials ? `${m.materials.code} - ${m.materials.name_en}` : m.material_id?.slice(0, 8) || '-'}
                      </td>
                      <td>
                        <span className={`badge capitalize ${typeBadge[m.movement_type] || 'badge'}`}>
                          {m.movement_type}
                        </span>
                      </td>
                      <td className="font-mono text-sm">{Number(m.quantity).toLocaleString()}</td>
                      <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          {t('supply_chain.quick_actions') || 'Quick Actions'}
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-primary btn-sm flex items-center gap-1.5"
            onClick={() => { navigate('/procurement?action=new_pr'); toast.info(t('supply_chain.navigating_pr') || 'Navigating to New PR'); }}
          >
            <ShoppingCart size={14} /> {t('supply_chain.new_pr') || 'New PR'}
          </button>
          <button
            className="btn-primary btn-sm flex items-center gap-1.5"
            onClick={() => { navigate('/procurement?action=new_po'); toast.info(t('supply_chain.navigating_po') || 'Navigating to New PO'); }}
          >
            <FileText size={14} /> {t('supply_chain.new_po') || 'New PO'}
          </button>
          <button
            className="btn-primary btn-sm flex items-center gap-1.5"
            onClick={() => { navigate('/contracts?action=new'); toast.info(t('supply_chain.navigating_contract') || 'Navigating to New Contract'); }}
          >
            <Award size={14} /> {t('supply_chain.new_contract') || 'New Contract'}
          </button>
          <button
            className="btn-secondary btn-sm flex items-center gap-1.5"
            onClick={() => { navigate('/warehouse'); toast.info(t('supply_chain.navigating_inventory') || 'Navigating to Inventory'); }}
          >
            <Warehouse size={14} /> {t('supply_chain.view_inventory') || 'View Inventory'}
          </button>
        </div>
      </div>
    </div>
  );
}
