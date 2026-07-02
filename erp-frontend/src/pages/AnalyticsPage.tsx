import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import {
  BarChart3, Target, DollarSign, TrendingUp, TicketCheck, Users,
  Building2, Phone, ClipboardList, Activity, Plus, FileText,
  PieChart, Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CardSkeleton } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';
import { savedReportsApi } from '../services/api';
import ReportBuilderModal from './ReportBuilderModal';

interface KpiCard {
  icon: LucideIcon; label: string; value: string; color: string; onClick?: () => void;
}

const KPI_COLORS: Record<string, string> = {
  blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b', purple: '#8b5cf6',
  teal: '#14b8a6', red: '#ef4444', pink: '#ec4899', indigo: '#6366f1',
};

const REPORT_TYPE_ICONS: Record<string, LucideIcon> = {
  table: ClipboardList, bar: BarChart3, line: TrendingUp, pie: PieChart, metric: Target,
};

interface PipelineStage {
  stage_name: string; deal_count: number; total_amount: number; color: string; sort_order: number;
}

interface SalesKPI {
  total_deals: number; won_deals: number; lost_deals: number; open_deals: number;
  won_amount: number; pipeline_value: number; total_pipeline: number;
  win_rate: number; total_companies: number; total_contacts: number;
  total_interactions: number; total_tasks: number; total_tickets: number;
}

interface MonthlyTrend {
  month: string; amount: number; count: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format(amount);
}

function PipelineFunnel({ stages }: { stages: PipelineStage[] }) {
  const maxAmount = Math.max(...stages.map(s => s.total_amount), 1);
  return (
    <div className="space-y-2">
      {stages.map((stage) => {
        const pct = maxAmount > 0 ? (stage.total_amount / maxAmount) * 100 : 0;
        return (
          <div key={stage.stage_name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="font-medium">{stage.stage_name}</span>
              </div>
              <div className="flex gap-3">
                <span>{stage.deal_count} deals</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{formatCurrency(stage.total_amount)}</span>
              </div>
            </div>
            <div className="w-full progress-bar h-2">
              <div className="progress-bar-fill h-2 rounded" style={{ width: `${pct}%`, backgroundColor: stage.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RevenueChart({ data }: { data: MonthlyTrend[] }) {
  const maxAmount = Math.max(...data.map(d => d.amount), 1);
  return (
    <div className="flex items-end gap-1 h-40 pt-4">
      {data.map((d) => {
        const h = maxAmount > 0 ? (d.amount / maxAmount) * 100 : 0;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{d.count}</span>
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{ height: `${Math.max(h, 2)}%`, backgroundColor: '#3b82f6', opacity: 0.7 + (h / 100) * 0.3 }}
              title={`${d.month}: ${formatCurrency(d.amount)} (${d.count} deals)`}
            />
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{d.month.slice(0, 3)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [, setSalesKpi] = useState<SalesKPI | null>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [recentDeals, setRecentDeals] = useState<any[]>([]);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [savedReports, setSavedReports] = useState<any[]>([]);

  useEffect(() => {
    loadAnalytics();
    loadSavedReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSavedReports() {
    try {
      const reports = await savedReportsApi.list();
      setSavedReports(reports || []);
    } catch (err) {
      console.error('Failed to load saved reports:', err);
    }
  }

  async function handleDeleteReport(id: string) {
    try {
      await savedReportsApi.remove(id);
      toast.success('Report deleted');
      loadSavedReports();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete report');
    }
  }

  async function loadAnalytics() {
    try {
      const [pipeRes, kpiRes, dealsRes] = await Promise.all([
        supabase.from('v_crm_pipeline_analytics').select('*').order('sort_order', { ascending: true }),
        supabase.from('v_crm_sales_kpis').select('*').single(),
        supabase.from('crm_deals').select('deal_name, amount, is_won, is_lost, pipeline_stage_id, created_at, crm_pipeline_stages!inner(name_en, color)').order('created_at', { ascending: false }).limit(5),
      ]);

      setStages(pipeRes.data || []);
      setSalesKpi(kpiRes.data);
      setRecentDeals(dealsRes.data || []);

      if (kpiRes.data) {
        const s = kpiRes.data;
        setKpis([
          { icon: Target, label: 'Pipeline Value', value: formatCurrency(s.pipeline_value), color: 'blue', onClick: () => navigate('/crm') },
          { icon: TrendingUp, label: 'Win Rate', value: `${s.win_rate}%`, color: 'green', onClick: () => navigate('/crm') },
          { icon: DollarSign, label: 'Won Deals', value: String(s.won_deals), color: 'amber', onClick: () => navigate('/crm') },
          { icon: TicketCheck, label: 'Total Tickets', value: String(s.total_tickets), color: 'purple', onClick: () => navigate('/support') },
          { icon: Building2, label: 'Companies', value: String(s.total_companies), color: 'teal', onClick: () => navigate('/crm') },
          { icon: Users, label: 'Contacts', value: String(s.total_contacts), color: 'indigo', onClick: () => navigate('/crm') },
        ]);
      }

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data: deals } = await supabase
        .from('crm_deals')
        .select('amount, created_at')
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      if (deals) {
        const byMonth: Record<string, MonthlyTrend> = {};
        deals.forEach(d => {
          const m = new Date(d.created_at).toLocaleString('en', { month: 'short', year: '2-digit' });
          if (!byMonth[m]) byMonth[m] = { month: m, amount: 0, count: 0 };
          byMonth[m].amount += Number(d.amount || 0);
          byMonth[m].count += 1;
        });
        setMonthlyTrends(Object.values(byMonth));
      }
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <><div className="page-enter space-y-6">
      <div className="welcome-gradient p-6 md:p-8">
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
            <BarChart3 size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Sales Analytics</h1>
            <p className="text-sm text-white/80">CRM and sales performance dashboard</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={() => { setEditingReport(null); setShowReportBuilder(true); }}>
          <Plus size={14} /> Report Builder
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          : kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="stat-glass cursor-pointer" onClick={k.onClick}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${KPI_COLORS[k.color]}15`, color: KPI_COLORS[k.color] }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{k.value}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{k.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} />
            <h2 className="text-lg font-semibold">Pipeline Funnel</h2>
          </div>
          {loading ? <CardSkeleton /> : <PipelineFunnel stages={stages} />}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} />
            <h2 className="text-lg font-semibold">Revenue Trend (6 Months)</h2>
          </div>
          {loading ? <CardSkeleton /> : monthlyTrends.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No revenue data yet</p>
          ) : (
            <RevenueChart data={monthlyTrends} />
          )}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={16} />
            <h2 className="text-lg font-semibold">Recent Deals</h2>
          </div>
          <button className="btn-sm btn-secondary" onClick={() => navigate('/crm')}>
            View All
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Deal Name</th>
                <th>Stage</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentDeals.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No deals found</td></tr>
              ) : recentDeals.map((d: any) => (
                <tr key={d.id} className="clickable" onClick={() => navigate('/crm')}>
                  <td className="font-medium">{d.deal_name}</td>
                  <td>
                    <span className="badge text-xs" style={{ backgroundColor: `${d.crm_pipeline_stages?.color || '#6B7280'}20`, color: d.crm_pipeline_stages?.color || '#6B7280' }}>
                      {d.crm_pipeline_stages?.name_en || '-'}
                    </span>
                  </td>
                  <td>{formatCurrency(Number(d.amount || 0))}</td>
                  <td>
                    {d.is_won ? <span className="badge badge--green">Won</span> :
                     d.is_lost ? <span className="badge badge--red">Lost</span> :
                     <span className="badge badge--yellow">Open</span>}
                  </td>
                  <td className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{new Date(d.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickCard icon={Phone} title="Support Tickets" desc="Manage support cases and SLA" onClick={() => navigate('/support')} />
        <QuickCard icon={Users} title="CRM Contacts" desc="View and manage contacts" onClick={() => navigate('/crm')} />
        <QuickCard icon={ClipboardList} title="Export Report" desc="Download analytics report" onClick={() => {}} />
      </div>

      {savedReports.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <FileText size={16} /> Your Saved Reports
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {savedReports.map(r => {
              const Icon = REPORT_TYPE_ICONS[r.report_type] || ClipboardList;
              return (
                <div
                  key={r.id}
                  className="glass-card p-4 cursor-pointer hover:border-[var(--color-primary)] transition-colors"
                  onClick={() => { setEditingReport(r); setShowReportBuilder(true); }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 6%, transparent)', color: 'var(--color-text-secondary)' }}>
                      <Icon size={18} />
                    </div>
                    <button
                      className="btn-ghost p-1 rounded"
                      onClick={e => { e.stopPropagation(); handleDeleteReport(r.id); }}
                      title="Delete report"
                    >
                      <Trash2 size={14} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                  </div>
                  <p className="text-sm font-semibold truncate">{r.name_en}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{r.name_ar}</p>
                  <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {savedReports.length === 0 && (
        <div className="glass-card p-6 text-center">
          <FileText size={32} className="mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No saved reports yet.</p>
          <button className="btn-primary btn-sm mt-3" onClick={() => { setEditingReport(null); setShowReportBuilder(true); }}>
            <Plus size={14} /> Create Your First Report
          </button>
        </div>
      )}
    </div>

      {showReportBuilder && (
        <ReportBuilderModal
          report={editingReport}
          onClose={() => { setShowReportBuilder(false); setEditingReport(null); }}
          onSaved={() => { loadSavedReports(); }}
        />
      )}
    </>);
}

function QuickCard({ icon: Icon, title, desc, onClick }: { icon: LucideIcon; title: string; desc: string; onClick: () => void }) {
  return (
    <div className="card hover:shadow-md transition-shadow cursor-pointer p-4" onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 6%, transparent)', color: 'var(--color-text-secondary)' }}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
        </div>
      </div>
    </div>
  );
}
