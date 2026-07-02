import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { aiAnalytics, type AnalyticsInsight } from '../services/aiAnalytics';
import {
  Building2, ShoppingCart, ClipboardCheck, AlertTriangle,
  Activity, DollarSign, BarChart3, PlusCircle, FileText,
  FolderOpen, GripVertical, X, RefreshCw, ChevronRight, Lightbulb, Package,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const SUMMARY_COLORS: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
  amber: { bg: 'rgba(245,158,11,0.12)', text: '#d97706' },
  red: { bg: 'rgba(239,68,68,0.12)', text: '#dc2626' },
  green: { bg: 'rgba(34,197,94,0.12)', text: '#16a34a' },
};

interface WidgetDefinition {
  id: string;
  title: string;
  defaultVisible: boolean;
}

const ALL_WIDGETS: WidgetDefinition[] = [
  { id: 'recent_activity', title: 'Recent Activity', defaultVisible: true },
  { id: 'budget_status', title: 'Budget Status', defaultVisible: true },
  { id: 'procurement_spend', title: 'Procurement Spend', defaultVisible: true },
  { id: 'quick_actions', title: 'Quick Actions', defaultVisible: true },
  { id: 'ai_insights', title: 'AI Insights', defaultVisible: true },
  { id: 'stock_movements', title: 'Stock Movements', defaultVisible: false },
  { id: 'upcoming_deadlines', title: 'Upcoming Deadlines', defaultVisible: false },
];

function loadWidgetPrefs(): Set<string> {
  try {
    const raw = localStorage.getItem('dashboard_widgets');
    if (!raw) return new Set(ALL_WIDGETS.filter((w) => w.defaultVisible).map((w) => w.id));
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return new Set(Object.entries(parsed).filter(([, v]) => v).map(([k]) => k));
  } catch {
    return new Set(ALL_WIDGETS.filter((w) => w.defaultVisible).map((w) => w.id));
  }
}

function saveWidgetPrefs(visible: Set<string>) {
  const obj: Record<string, boolean> = {};
  ALL_WIDGETS.forEach((w) => { obj[w.id] = visible.has(w.id); });
  try { localStorage.setItem('dashboard_widgets', JSON.stringify(obj)); } catch { /* localStorage blocked */ }
}

function KpiCard({
  icon: Icon, label, value, colorKey, loading, onClick,
}: {
  icon: LucideIcon; label: string; value: string; colorKey: string; loading: boolean; onClick?: () => void;
}) {
  const c = SUMMARY_COLORS[colorKey] ?? SUMMARY_COLORS.blue;
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
    <div
      className="stat-glass p-4 transition-all hover:shadow-md"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: c.bg, color: c.text }}>
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

function Widget({ title, children, className = '', onRemove }: {
  title: string; children: React.ReactNode; className?: string; onRemove?: () => void;
}) {
  return (
    <div className={`glass-card p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{title}</h3>
        {onRemove && (
          <button onClick={onRemove} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

interface SummaryRow {
  icon: LucideIcon;
  label: string;
  colorKey: string;
  value: string;
  loading: boolean;
  onClick?: () => void;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const t = useT();
  const { settings } = useSettings();

  function getGlobalWidgetConfig(): { enabled: Set<string>; required: Set<string>; layout: string } {
    try {
      const stored = settings.dashboard_widgets;
      if (typeof stored === 'string') {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return { enabled: new Set(parsed), required: new Set(), layout: '2' };
        if (typeof parsed === 'object' && parsed !== null) {
          return {
            enabled: new Set(Array.isArray(parsed.enabled) ? parsed.enabled : ALL_WIDGETS.map(w => w.id)),
            required: new Set(Array.isArray(parsed.required) ? parsed.required : []),
            layout: String(parsed.layout || settings.dashboard_layout || '2'),
          };
        }
      } else if (Array.isArray(stored)) {
        return { enabled: new Set(stored), required: new Set(), layout: '2' };
      }
    } catch { /* ignore */ }
    return { enabled: new Set(ALL_WIDGETS.filter(w => w.defaultVisible).map(w => w.id)), required: new Set(), layout: settings.dashboard_layout || '2' };
  }

  const globalConfig = getGlobalWidgetConfig();

  const [visibleWidgets, setVisibleWidgets] = useState<Set<string>>(() => {
    const user = loadWidgetPrefs();
    return new Set([...user].filter(id => globalConfig.enabled.has(id)));
  });
  const [showCustomize, setShowCustomize] = useState(false);

  const dashboardLayout = globalConfig.layout === '3' ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2';

  const [summaryCards, setSummaryCards] = useState<SummaryRow[]>([]);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [budgetData, setBudgetData] = useState<{ total_budget: number; spent: number } | null>(null);
  const [spendByCurrency, setSpendByCurrency] = useState<{ currency: string; total: number }[]>([]);
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);

  const loadKpis = useCallback(async () => {
    const placeholders: SummaryRow[] = [
      { icon: Building2, label: t('dashboard.total_projects') || 'Total Projects', value: '—', colorKey: 'blue', loading: true },
      { icon: ShoppingCart, label: t('dashboard.open_pos') || 'Open POs', value: '—', colorKey: 'amber', loading: true },
      { icon: ClipboardCheck, label: t('dashboard.pending_approvals') || 'Pending Approvals', value: '—', colorKey: 'red', loading: true },
      { icon: AlertTriangle, label: t('dashboard.open_ncrs') || 'Open NCRs', value: '—', colorKey: 'green', loading: true },
      { icon: FileText, label: 'Active Contracts', value: '—', colorKey: 'blue', loading: true },
      { icon: Activity, label: 'Open Tasks', value: '—', colorKey: 'amber', loading: true },
    ];
    setSummaryCards(placeholders);

    try {
      const [projectCount, poCount, prCount, ncrCount, contractCount, taskCount, budgetRes, spendRes, notifRes, stockMovRes, deadlineRes] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).in('status', ['draft', 'pending_approval']),
        supabase.from('purchase_requisitions').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase.from('quality_ncr').select('id', { count: 'exact', head: true }).not('status', 'in', '("closed","verified")'),
        supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).not('status', 'in', '("completed","cancelled")'),
        supabase.from('budget').select('total_budget, spent').limit(1).maybeSingle(),
        supabase.from('purchase_orders').select('currency, total_amount').not('total_amount', 'is', null),
        supabase.from('notifications').select('id, title, created_at, type').order('created_at', { ascending: false }).limit(10),
        supabase.from('stock_movements').select('id, reference_type, quantity, created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('contracts').select('id, contract_no, end_date, contractor:contractors(name_en)').eq('status', 'active').not('end_date', 'is', null).order('end_date', { ascending: true }).limit(5),
      ]);

      setSummaryCards([
        { icon: Building2, label: t('dashboard.total_projects') || 'Total Projects', value: String(projectCount.count ?? 0), colorKey: 'blue', loading: false, onClick: () => navigate('/projects') },
        { icon: ShoppingCart, label: t('dashboard.open_pos') || 'Open POs', value: String(poCount.count ?? 0), colorKey: 'amber', loading: false, onClick: () => navigate('/procurement') },
        { icon: ClipboardCheck, label: t('dashboard.pending_approvals') || 'Pending Approvals', value: String(prCount.count ?? 0), colorKey: 'red', loading: false, onClick: () => navigate('/approvals') },
        { icon: AlertTriangle, label: t('dashboard.open_ncrs') || 'Open NCRs', value: String(ncrCount.count ?? 0), colorKey: 'green', loading: false, onClick: () => navigate('/quality') },
        { icon: FileText, label: 'Active Contracts', value: String(contractCount.count ?? 0), colorKey: 'blue', loading: false, onClick: () => navigate('/contracts') },
        { icon: Activity, label: 'Open Tasks', value: String(taskCount.count ?? 0), colorKey: 'amber', loading: false, onClick: () => navigate('/execution') },
      ]);

      if (budgetRes.data) setBudgetData(budgetRes.data);

      const currencyMap: Record<string, number> = {};
      (spendRes.data ?? []).forEach((r) => {
        const cur = r.currency ?? 'USD';
        currencyMap[cur] = (currencyMap[cur] ?? 0) + (Number(r.total_amount) || 0);
      });
      setSpendByCurrency(Object.entries(currencyMap).map(([currency, total]) => ({ currency, total })));

      setNotifications((notifRes.data ?? []) as typeof notifications);
      setRecentMovements((stockMovRes.data ?? []) as typeof recentMovements);
      setUpcomingDeadlines((deadlineRes.data ?? []) as typeof upcomingDeadlines);

      // Load AI insights
      setInsightsLoading(true);
      const [spendInsights, anomalies] = await Promise.all([
        aiAnalytics.getSpendInsights(),
        aiAnalytics.getAnomalyDetection(),
      ]);
      setInsights([...spendInsights, ...anomalies]);
      setInsightsLoading(false);
    } catch (err) {
      console.error('Dashboard data error:', err);
      setSummaryCards(placeholders.map((p) => ({ ...p, loading: false })));
      setInsightsLoading(false);
    }
  }, [navigate, t]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  function toggleWidget(id: string) {
    if (globalConfig.required.has(id)) return;
    setVisibleWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else if (globalConfig.enabled.has(id)) next.add(id);
      saveWidgetPrefs(next);
      return next;
    });
  }

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('nav.dashboard')}</h1>
        <div className="flex items-center gap-2">
          <button
            className="btn-sm btn-secondary flex items-center gap-1.5"
            onClick={() => { loadKpis(); toast.success(t('dashboard.refreshed') || 'Dashboard refreshed'); }}
          >
            <RefreshCw size={14} /> {t('dashboard.refresh') || 'Refresh'}
          </button>
          <button
            className="btn-sm btn-secondary flex items-center gap-1.5"
            onClick={() => setShowCustomize(!showCustomize)}
          >
            <GripVertical size={14} /> {t('dashboard.customize') || 'Customize'}
          </button>
        </div>
      </div>

      {/* Customize Panel */}
      {showCustomize && (
        <div className="glass-card p-4 space-y-2">
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
            {t('dashboard.toggle_widgets') || 'Toggle Widgets'}
          </p>
          <div className="flex flex-wrap gap-3">
            {ALL_WIDGETS.map((w) => {
              const isRequired = globalConfig.required.has(w.id);
              return (
                <label key={w.id} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: isRequired ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={visibleWidgets.has(w.id) || isRequired}
                    disabled={isRequired}
                    onChange={() => toggleWidget(w.id)}
                    className="rounded"
                  />
                  {t(`dashboard.widget_${w.id}`) || w.title}
                  {isRequired && <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>{t('designer.required')}</span>}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {summaryCards.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Widgets Grid */}
      <div className={`grid grid-cols-1 ${dashboardLayout} gap-6`}>
        {visibleWidgets.has('recent_activity') && (
          <Widget
            title={t('dashboard.widget_recent_activity') || 'Recent Activity'}
            onRemove={() => toggleWidget('recent_activity')}
          >
            {notifications.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {t('dashboard.no_activity') || 'No recent activity'}
              </p>
            ) : (
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 text-sm">
                    <Activity size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium" style={{ color: 'var(--color-text)' }}>{n.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {new Date(n.created_at).toLocaleDateString()}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase"
                          style={{
                            backgroundColor: n.type === 'warning' ? 'rgba(245,158,11,0.12)' : n.type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                            color: n.type === 'warning' ? '#d97706' : n.type === 'error' ? '#dc2626' : '#3b82f6',
                          }}
                        >
                          {n.type}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        )}

        {visibleWidgets.has('budget_status') && (
          <Widget
            title={t('dashboard.widget_budget_status') || 'Budget Status'}
            onRemove={() => toggleWidget('budget_status')}
          >
            {!budgetData ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {t('dashboard.no_budget') || 'No budget data'}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {t('dashboard.total_budget') || 'Total Budget'}
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>${Number(budgetData.total_budget).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {t('dashboard.spent') || 'Spent'}
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>${Number(budgetData.spent).toLocaleString()}</span>
                </div>
                <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min((Number(budgetData.spent) / Number(budgetData.total_budget || 1)) * 100, 100)}%`,
                      backgroundColor: Number(budgetData.spent) > Number(budgetData.total_budget) ? '#dc2626' : '#22c55e',
                    }}
                  />
                </div>
                <p className="text-xs text-right" style={{ color: 'var(--color-text-muted)' }}>
                  {Math.round((Number(budgetData.spent) / Number(budgetData.total_budget || 1)) * 100)}% {t('dashboard.utilized') || 'utilized'}
                </p>
              </div>
            )}
          </Widget>
        )}

        {visibleWidgets.has('procurement_spend') && (
          <Widget
            title={t('dashboard.widget_procurement_spend') || 'Procurement Spend'}
            onRemove={() => toggleWidget('procurement_spend')}
          >
            {spendByCurrency.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {t('dashboard.no_spend') || 'No spend data'}
              </p>
            ) : (
              <div className="space-y-3">
                {spendByCurrency.map((s) => (
                  <div key={s.currency} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <DollarSign size={14} style={{ color: 'var(--color-text-muted)' }} />
                      <span className="font-medium" style={{ color: 'var(--color-text)' }}>{s.currency}</span>
                    </div>
                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                      ${Number(s.total).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Widget>
        )}

        {visibleWidgets.has('ai_insights') && (
          <Widget title={t('dashboard.widget_ai_insights') || 'AI Insights'} className="lg:col-span-2" onRemove={() => toggleWidget('ai_insights')}>
            {insightsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 mb-3 animate-pulse">
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'var(--color-skeleton)' }} />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded" style={{ backgroundColor: 'var(--color-skeleton)' }} />
                    <div className="h-2.5 w-1/2 rounded" style={{ backgroundColor: 'var(--color-skeleton)' }} />
                  </div>
                </div>
              ))
            ) : insights.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No insights available yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg text-sm transition-colors hover:opacity-90" style={{
                    backgroundColor: insight.severity === 'negative' ? 'color-mix(in srgb, var(--color-danger) 8%, transparent)' : insight.severity === 'positive' ? 'color-mix(in srgb, var(--color-success) 8%, transparent)' : 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
                  }}>
                    <Lightbulb size={16} className="mt-0.5 shrink-0" style={{
                      color: insight.severity === 'negative' ? 'var(--color-danger)' : insight.severity === 'positive' ? 'var(--color-success)' : 'var(--color-primary)',
                    }} />
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--color-text)' }}>{insight.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{insight.description}</p>
                      {insight.value && <p className="text-xs font-semibold mt-1">{insight.value}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Widget>
        )}

        {visibleWidgets.has('stock_movements') && (
          <Widget title="Stock Movements" onRemove={() => toggleWidget('stock_movements')}>
            {recentMovements.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No recent stock movements</p>
            ) : (
              <ul className="space-y-2">
                {recentMovements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-2">
                      <Package size={14} style={{ color: 'var(--color-text-muted)' }} />
                      <span style={{ color: 'var(--color-text)' }} className="capitalize">{m.reference_type?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs">{m.quantity} units</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        )}
        {visibleWidgets.has('upcoming_deadlines') && (
          <Widget title="Upcoming Deadlines" onRemove={() => toggleWidget('upcoming_deadlines')}>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No upcoming deadlines</p>
            ) : (
              <ul className="space-y-2">
                {upcomingDeadlines.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium" style={{ color: 'var(--color-text)' }}>{d.contract_no}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{d.contractor?.name_en || '—'}</p>
                    </div>
                    <span className="text-xs font-mono whitespace-nowrap ml-2" style={{ color: new Date(d.end_date) < new Date() ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                      {new Date(d.end_date).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        )}
        {visibleWidgets.has('quick_actions') && (
          <Widget
            title={t('dashboard.widget_quick_actions') || 'Quick Actions'}
            onRemove={() => toggleWidget('quick_actions')}
          >
            <div className="space-y-2">
              {hasPermission('procurement', 'create') && (
                <button
                  className="w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}
                  onClick={() => { navigate('/procurement?action=new_po'); toast.info(t('dashboard.navigating_po') || 'Navigating to New PO'); }}
                >
                  <PlusCircle size={18} /> {t('dashboard.btn_new_po') || 'New PO'} <ChevronRight size={16} className="ml-auto" />
                </button>
              )}
              {hasPermission('procurement', 'create') && (
                <button
                  className="w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}
                  onClick={() => { navigate('/procurement?action=new_pr'); toast.info(t('dashboard.navigating_pr') || 'Navigating to New PR'); }}
                >
                  <FileText size={18} /> {t('dashboard.btn_new_pr') || 'New PR'} <ChevronRight size={16} className="ml-auto" />
                </button>
              )}
              {hasPermission('projects', 'create') && (
                <button
                  className="w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}
                  onClick={() => { navigate('/projects'); toast.info(t('dashboard.navigating_project') || 'Navigate to Projects'); }}
                >
                  <FolderOpen size={18} /> {t('dashboard.btn_new_project') || 'New Project'} <ChevronRight size={16} className="ml-auto" />
                </button>
              )}
              {hasPermission('settings', 'view') && (
                <button
                  className="w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}
                  onClick={() => { navigate('/analytics'); toast.info(t('dashboard.navigating_reports') || 'Navigating to Reports'); }}
                >
                  <BarChart3 size={18} /> {t('dashboard.btn_view_reports') || 'View Reports'} <ChevronRight size={16} className="ml-auto" />
                </button>
              )}
            </div>
          </Widget>
        )}
      </div>
    </div>
  );
}
