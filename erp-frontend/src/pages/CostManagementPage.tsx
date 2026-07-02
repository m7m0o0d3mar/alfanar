import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import {
  evmApi, evmBaselinesApi, projectCostItemsApi, costReportsApi,
  budgetForecastsApi, budgetItemsApi,
} from '../services/api';
import type { EVMMetric, EVMBaseline, ProjectCostItem, CostReport, BudgetForecast } from '../types';
import {
  Loader2, Plus, Edit3, Trash2, TrendingUp, Search,
  DollarSign, BarChart3, PieChart, FileText, Target,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import Pagination from '../components/Pagination';
import { useDebounce } from '../hooks/useDebounce';
import EmptyState from '../components/EmptyState';

interface BudgetItem {
  id: string;
  project_id: string;
  category: string;
  name_en: string;
  name_ar?: string;
  planned_amount: number;
  actual_amount: number;
  currency: string;
  notes?: string;
  created_at: string;
}

interface Project {
  id: string;
  name_en: string;
  name_ar?: string;
}

type Tab = 'evm' | 'costs' | 'budget' | 'forecasts' | 'baselines';
type ForecastSubTab = 'forecasts' | 'reports';

const CATEGORIES = ['labor', 'material', 'equipment', 'subcontractor', 'consultant', 'overhead', 'admin', 'contingency', 'other'] as const;

const FORECAST_TYPES = ['optimistic', 'pessimistic', 'most_likely'] as const;

const FORECAST_COLORS: Record<string, string> = {
  optimistic: '#10b981',
  pessimistic: '#ef4444',
  most_likely: '#3b82f6',
};

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cpiColor(v: number): string {
  if (v >= 1.05) return 'var(--color-success)';
  if (v >= 0.95) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function spiColor(v: number): string {
  if (v >= 1.05) return 'var(--color-success)';
  if (v >= 0.95) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function pctColor(p: number): string {
  if (p <= 100) return 'var(--color-success)';
  if (p <= 120) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

export default function CostManagementPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('evm');
  const [forecastSubTab, setForecastSubTab] = useState<ForecastSubTab>('forecasts');

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  const [evmMetrics, setEvmMetrics] = useState<EVMMetric[]>([]);
  const [evmMonthlyData, setEvmMonthlyData] = useState<Record<string, unknown>[]>([]);
  const [baselines, setBaselines] = useState<EVMBaseline[]>([]);

  const [costItems, setCostItems] = useState<ProjectCostItem[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);

  const [forecasts, setForecasts] = useState<BudgetForecast[]>([]);
  const [costReports, setCostReports] = useState<CostReport[]>([]);

  const [showEvmForm, setShowEvmForm] = useState(false);
  const [evmForm, setEvmForm] = useState({ period: '', planned_value: '', earned_value: '', actual_cost: '' });
  const [editingEvmId, setEditingEvmId] = useState<string | null>(null);

  const [showCostForm, setShowCostForm] = useState(false);
  const [costForm, setCostForm] = useState({ category: 'labor', name_en: '', planned_amount: '', actual_amount: '', committed_amount: '', currency: 'SAR', notes: '' });
  const [editingCostId, setEditingCostId] = useState<string | null>(null);

  const [budgetForm, setBudgetForm] = useState({ category: 'other', name_en: '', planned_amount: '', actual_amount: '', notes: '' });

  const [showForecastForm, setShowForecastForm] = useState(false);
  const [forecastForm, setForecastForm] = useState({ forecast_date: new Date().toISOString().slice(0, 10), forecast_type: 'most_likely', estimate_at_completion: '', estimate_to_complete: '', variance_at_completion: '', assumptions: '' });

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportForm, setReportForm] = useState({ report_date: new Date().toISOString().slice(0, 10), report_type: 'monthly', total_budget: '', total_committed: '', total_actual: '', total_forecast: '', budget_variance: '', cost_performance_index: '', schedule_performance_index: '', notes: '' });

  const [showBaselineForm, setShowBaselineForm] = useState(false);
  const [baselineForm, setBaselineForm] = useState({ baseline_date: new Date().toISOString().slice(0, 10), total_planned_value: '', budget_at_completion: '', estimate_at_completion: '', estimate_to_complete: '', variance_at_completion: '', cost_performance_index: '', schedule_performance_index: '' });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const [evmPage, setEvmPage] = useState(1);
  const [budgetPage, setBudgetPage] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const [baselinesPage, setBaselinesPage] = useState(1);
  const pageSize = 20;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadProjects(); }, []);

   
  useEffect(() => {
    if (activeTab !== 'forecasts' || !selectedProjectId) return;
    const load = async () => {
      if (forecastSubTab === 'forecasts') {
        setForecasts(await budgetForecastsApi.list(selectedProjectId));
      } else {
        setCostReports(await costReportsApi.list(selectedProjectId));
      }
    };
    load();
  }, [activeTab, forecastSubTab, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    setLoadingData(true);
    const load = async () => {
      try {
        if (activeTab === 'evm') {
          const [metricsRes, monthlyRes] = await Promise.all([evmApi.list(selectedProjectId), evmApi.calculate(selectedProjectId)]);
          setEvmMetrics(metricsRes); setEvmMonthlyData(monthlyRes);
        } else if (activeTab === 'costs') {
          setCostItems(await projectCostItemsApi.list(selectedProjectId));
        } else if (activeTab === 'budget') {
          setBudgetItems((await budgetItemsApi.list(selectedProjectId) || []) as BudgetItem[]);
        } else if (activeTab === 'forecasts') {
          if (forecastSubTab === 'forecasts') setForecasts(await budgetForecastsApi.list(selectedProjectId));
          else setCostReports(await costReportsApi.list(selectedProjectId));
        } else if (activeTab === 'baselines') {
          setBaselines(await evmBaselinesApi.list(selectedProjectId));
        }
      } catch (err) {
        console.error('Failed to load tab data:', err);
      } finally { setLoadingData(false); }
    };
    load();
  }, [activeTab, selectedProjectId, forecastSubTab]);

  useEffect(() => { setEvmPage(1); }, [activeTab]);
  useEffect(() => { setBudgetPage(1); }, [activeTab]);
  useEffect(() => { setReportsPage(1); }, [activeTab]);
  useEffect(() => { setBaselinesPage(1); }, [activeTab]);

  async function loadProjects() {
    try {
      const { data } = await supabase.from('projects').select('id, name_en, name_ar').order('name_en');
      setProjects((data || []) as Project[]);
      if (data && data.length > 0) setSelectedProjectId(data[0].id);
    } catch (err) {
      console.error('Failed to load projects:', err);
      toast.error('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadEvmData() {
    if (!selectedProjectId) return;
    const [metricsRes, monthlyRes] = await Promise.all([
      evmApi.list(selectedProjectId),
      evmApi.calculate(selectedProjectId),
    ]);
    setEvmMetrics(metricsRes);
    setEvmMonthlyData(monthlyRes);
  }

  async function loadCostItems() {
    if (!selectedProjectId) return;
    const items = await projectCostItemsApi.list(selectedProjectId);
    setCostItems(items);
  }

  async function loadBudgetItems() {
    if (!selectedProjectId) return;
    const data = await budgetItemsApi.list(selectedProjectId);
    setBudgetItems((data || []) as BudgetItem[]);
  }

  async function loadForecasts() {
    if (!selectedProjectId) return;
    const data = await budgetForecastsApi.list(selectedProjectId);
    setForecasts(data);
  }

  async function loadCostReports() {
    if (!selectedProjectId) return;
    const data = await costReportsApi.list(selectedProjectId);
    setCostReports(data);
  }

  async function loadBaselines() {
    if (!selectedProjectId) return;
    const data = await evmBaselinesApi.list(selectedProjectId);
    setBaselines(data);
  }

  const totalPV = evmMetrics.reduce((s, m) => s + m.planned_value, 0);
  const totalEV = evmMetrics.reduce((s, m) => s + m.earned_value, 0);
  const totalAC = evmMetrics.reduce((s, m) => s + m.actual_cost, 0);
  const cpiVal = totalAC > 0 ? totalEV / totalAC : 0;
  const spiVal = totalPV > 0 ? totalEV / totalPV : 0;
  const bac = baselines.length > 0 ? baselines[0].budget_at_completion : totalPV;
  const eacVal = cpiVal > 0 ? bac / cpiVal : bac;

  const totalPlannedBudget = budgetItems.reduce((s, b) => s + b.planned_amount, 0);
  const totalActualBudget = budgetItems.reduce((s, b) => s + (b.actual_amount || 0), 0);
  const budgetRemaining = totalPlannedBudget - totalActualBudget;
  const budgetUtilPct = totalPlannedBudget > 0 ? (totalActualBudget / totalPlannedBudget) * 100 : 0;

  const filteredEvmData = evmMonthlyData.filter(d => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    const pd = (d.period_date as string) || '';
    return pd.toLowerCase().includes(q) || String(d.planned_value).includes(q) || String(d.earned_value).includes(q) || String(d.actual_cost).includes(q);
  });

  const filteredCostItems = costItems.filter(i => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return i.name_en.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || (i.notes || '').toLowerCase().includes(q);
  });

  const filteredBudgetItems = budgetItems.filter(b => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return b.name_en.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
  });

  const filteredCostReports = costReports.filter(r => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return r.report_type.toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q);
  });

  const filteredBaselines = baselines.filter(b => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return b.baseline_date.toLowerCase().includes(q);
  });

  const paginatedEvm = filteredEvmData.slice((evmPage - 1) * pageSize, evmPage * pageSize);
  const paginatedBudget = filteredBudgetItems.slice((budgetPage - 1) * pageSize, budgetPage * pageSize);
  const paginatedReports = filteredCostReports.slice((reportsPage - 1) * pageSize, reportsPage * pageSize);
  const paginatedBaselines = filteredBaselines.slice((baselinesPage - 1) * pageSize, baselinesPage * pageSize);

  function openEvmForm(metric?: EVMMetric) {
    if (metric) {
      setEvmForm({ period: metric.period, planned_value: String(metric.planned_value), earned_value: String(metric.earned_value), actual_cost: String(metric.actual_cost) });
      setEditingEvmId(metric.id);
    } else {
      setEvmForm({ period: '', planned_value: '', earned_value: '', actual_cost: '' });
      setEditingEvmId(null);
    }
    setShowEvmForm(true);
  }

  async function saveEvmMetric() {
    if (!selectedProjectId || !evmForm.period) { toast.error('Period is required'); return; }
    setSaving(true);
    try {
      await evmApi.upsert({
        id: editingEvmId || undefined,
        project_id: selectedProjectId,
        period: evmForm.period,
        planned_value: parseFloat(evmForm.planned_value) || 0,
        earned_value: parseFloat(evmForm.earned_value) || 0,
        actual_cost: parseFloat(evmForm.actual_cost) || 0,
      });
      toast.success(editingEvmId ? 'EVM metric updated' : 'EVM metric created');
      setShowEvmForm(false);
      await loadEvmData();
    } catch (err) {
      console.error('Failed to save EVM metric:', err);
      toast.error('Failed to save EVM metric');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvmMetric(id: string) {
    try {
      await evmApi.remove(id);
      toast.success('EVM metric deleted');
      await loadEvmData();
    } catch (err) {
      console.error('Failed to delete EVM metric:', err);
      toast.error('Failed to delete EVM metric');
    }
  }

  function openCostForm(item?: ProjectCostItem) {
    if (item) {
      setCostForm({ category: item.category, name_en: item.name_en, planned_amount: String(item.planned_amount), actual_amount: String(item.actual_amount), committed_amount: String(item.committed_amount), currency: item.currency || 'SAR', notes: item.notes || '' });
      setEditingCostId(item.id);
    } else {
      setCostForm({ category: 'labor', name_en: '', planned_amount: '', actual_amount: '', committed_amount: '', currency: 'SAR', notes: '' });
      setEditingCostId(null);
    }
    setShowCostForm(true);
  }

  async function saveCostItem() {
    if (!selectedProjectId || !costForm.name_en) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await projectCostItemsApi.upsert({
        id: editingCostId || undefined,
        project_id: selectedProjectId,
        category: costForm.category as ProjectCostItem['category'],
        name_en: costForm.name_en,
        planned_amount: parseFloat(costForm.planned_amount) || 0,
        actual_amount: parseFloat(costForm.actual_amount) || 0,
        committed_amount: parseFloat(costForm.committed_amount) || 0,
        currency: costForm.currency,
        notes: costForm.notes || undefined,
      });
      toast.success(editingCostId ? 'Cost item updated' : 'Cost item created');
      setShowCostForm(false);
      await loadCostItems();
    } catch (err) {
      console.error('Failed to save cost item:', err);
      toast.error('Failed to save cost item');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCostItem(id: string) {
    try {
      await projectCostItemsApi.remove(id);
      toast.success('Cost item deleted');
      await loadCostItems();
    } catch (err) {
      console.error('Failed to delete cost item:', err);
      toast.error('Failed to delete cost item');
    }
  }

  async function addBudgetItem() {
    if (!selectedProjectId || !budgetForm.name_en) { toast.error('Name is required'); return; }
    try {
      await budgetItemsApi.upsert({
        project_id: selectedProjectId,
        category: budgetForm.category,
        name_en: budgetForm.name_en,
        planned_amount: parseFloat(budgetForm.planned_amount) || 0,
        actual_amount: parseFloat(budgetForm.actual_amount) || 0,
        notes: budgetForm.notes || undefined,
      });
      toast.success('Budget item added');
      setBudgetForm({ category: 'other', name_en: '', planned_amount: '', actual_amount: '', notes: '' });
      await loadBudgetItems();
    } catch (err) {
      console.error('Failed to add budget item:', err);
      toast.error('Failed to add budget item');
    }
  }

  async function deleteBudgetItem(id: string) {
    try {
      await supabase.from('project_budget_items').delete().eq('id', id);
      setBudgetItems(prev => prev.filter(b => b.id !== id));
      toast.success('Budget item deleted');
    } catch (err) {
      console.error('Failed to delete budget item:', err);
      toast.error('Failed to delete budget item');
    }
  }

  async function saveForecast() {
    if (!selectedProjectId) return;
    setSaving(true);
    try {
      await budgetForecastsApi.create({
        project_id: selectedProjectId,
        forecast_date: forecastForm.forecast_date,
        forecast_type: forecastForm.forecast_type as BudgetForecast['forecast_type'],
        estimate_at_completion: parseFloat(forecastForm.estimate_at_completion) || 0,
        estimate_to_complete: parseFloat(forecastForm.estimate_to_complete) || 0,
        variance_at_completion: parseFloat(forecastForm.variance_at_completion) || 0,
        assumptions: forecastForm.assumptions || undefined,
      });
      toast.success('Forecast created');
      setShowForecastForm(false);
      setForecastForm({ forecast_date: new Date().toISOString().slice(0, 10), forecast_type: 'most_likely', estimate_at_completion: '', estimate_to_complete: '', variance_at_completion: '', assumptions: '' });
      await loadForecasts();
    } catch (err) {
      console.error('Failed to save forecast:', err);
      toast.error('Failed to save forecast');
    } finally {
      setSaving(false);
    }
  }

  async function saveReport() {
    if (!selectedProjectId) return;
    setSaving(true);
    try {
      await costReportsApi.create({
        project_id: selectedProjectId,
        report_date: reportForm.report_date,
        report_type: reportForm.report_type as CostReport['report_type'],
        total_budget: parseFloat(reportForm.total_budget) || 0,
        total_committed: parseFloat(reportForm.total_committed) || 0,
        total_actual: parseFloat(reportForm.total_actual) || 0,
        total_forecast: parseFloat(reportForm.total_forecast) || 0,
        budget_variance: parseFloat(reportForm.budget_variance) || 0,
        cost_performance_index: parseFloat(reportForm.cost_performance_index) || 0,
        schedule_performance_index: parseFloat(reportForm.schedule_performance_index) || 0,
        notes: reportForm.notes || undefined,
      });
      toast.success('Cost report created');
      setShowReportForm(false);
      setReportForm({ report_date: new Date().toISOString().slice(0, 10), report_type: 'monthly', total_budget: '', total_committed: '', total_actual: '', total_forecast: '', budget_variance: '', cost_performance_index: '', schedule_performance_index: '', notes: '' });
      await loadCostReports();
    } catch (err) {
      console.error('Failed to save report:', err);
      toast.error('Failed to save report');
    } finally {
      setSaving(false);
    }
  }

  async function saveBaseline() {
    if (!selectedProjectId) return;
    setSaving(true);
    try {
      await evmBaselinesApi.create({
        project_id: selectedProjectId,
        baseline_date: baselineForm.baseline_date,
        total_planned_value: parseFloat(baselineForm.total_planned_value) || 0,
        budget_at_completion: parseFloat(baselineForm.budget_at_completion) || 0,
        estimate_at_completion: parseFloat(baselineForm.estimate_at_completion) || 0,
        estimate_to_complete: parseFloat(baselineForm.estimate_to_complete) || 0,
        variance_at_completion: parseFloat(baselineForm.variance_at_completion) || 0,
        cost_performance_index: parseFloat(baselineForm.cost_performance_index) || 0,
        schedule_performance_index: parseFloat(baselineForm.schedule_performance_index) || 0,
      });
      toast.success('Baseline created');
      setShowBaselineForm(false);
      setBaselineForm({ baseline_date: new Date().toISOString().slice(0, 10), total_planned_value: '', budget_at_completion: '', estimate_at_completion: '', estimate_to_complete: '', variance_at_completion: '', cost_performance_index: '', schedule_performance_index: '' });
      await loadBaselines();
    } catch (err) {
      console.error('Failed to save baseline:', err);
      toast.error('Failed to save baseline');
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(cat: string) {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setExpandedCategories(next);
  }

  function renderEVMChart() {
    const maxVal = Math.max(...evmMonthlyData.flatMap(d => [(d.planned_value as number) || 0, (d.earned_value as number) || 0, (d.actual_cost as number) || 0]), 1);
    const chartHeight = 200;

    return (
      <div className="card p-4">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><BarChart3 size={16} /> EVM Trend (PV vs EV vs AC)</h3>
        {evmMonthlyData.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>No EVM data available for chart.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-3 min-w-[400px]" style={{ height: chartHeight + 40 }}>
              {evmMonthlyData.map((d, i) => {
                const pv = (d.planned_value as number) || 0;
                const ev = (d.earned_value as number) || 0;
                const ac = (d.actual_cost as number) || 0;
                const pvH = (pv / maxVal) * chartHeight;
                const evH = (ev / maxVal) * chartHeight;
                const acH = (ac / maxVal) * chartHeight;
                const pd = d.period_date as string;
                const monthLabel = pd ? new Date(pd + 'T00:00:00').toLocaleString('default', { month: 'short', year: '2-digit' }) : `M${i + 1}`;
                return (
                  <div key={i} className="flex flex-col items-center flex-1">
                    <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: chartHeight }}>
                      <div title={`PV: ${fmt(pv)}`} className="w-3 rounded-t-sm transition-all" style={{ height: pvH, backgroundColor: '#3b82f6' }} />
                      <div title={`EV: ${fmt(ev)}`} className="w-3 rounded-t-sm transition-all" style={{ height: evH, backgroundColor: '#10b981' }} />
                      <div title={`AC: ${fmt(ac)}`} className="w-3 rounded-t-sm transition-all" style={{ height: acH, backgroundColor: '#f59e0b' }} />
                    </div>
                    <span className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{monthLabel}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#3b82f6' }} /> PV</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#10b981' }} /> EV</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f59e0b' }} /> AC</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderEvmFormModal() {
    if (!showEvmForm) return null;
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowEvmForm(false)}>
        <div className="rounded-xl p-6 w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-semibold mb-4">{editingEvmId ? 'Edit EVM Metric' : 'New EVM Metric'}</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Period *</label>
              <input type="date" className="input" value={evmForm.period} onChange={e => setEvmForm({ ...evmForm, period: e.target.value })} />
            </div>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Enter the EVM values for this period. PV, EV, and AC are used to calculate CPI, SPI, and other performance indicators.</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">PV (Planned Value)</label>
                <input type="number" className="input" value={evmForm.planned_value} onChange={e => setEvmForm({ ...evmForm, planned_value: e.target.value })} />
              </div>
              <div>
                <label className="label">EV (Earned Value)</label>
                <input type="number" className="input" value={evmForm.earned_value} onChange={e => setEvmForm({ ...evmForm, earned_value: e.target.value })} />
              </div>
              <div>
                <label className="label">AC (Actual Cost)</label>
                <input type="number" className="input" value={evmForm.actual_cost} onChange={e => setEvmForm({ ...evmForm, actual_cost: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <button className="btn-primary btn-sm" onClick={saveEvmMetric} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary btn-sm" onClick={() => setShowEvmForm(false)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  function renderEvmTab() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>PV (Planned Value)</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-primary)' }}>{fmt(totalPV)}</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Budgeted cost of work scheduled</p>
          </div>
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>EV (Earned Value)</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-success)' }}>{fmt(totalEV)}</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Budgeted cost of work performed</p>
          </div>
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>AC (Actual Cost)</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-warning)' }}>{fmt(totalAC)}</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Actual cost incurred to date</p>
          </div>
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>CPI (EV/AC)</p>
            <p className="text-lg font-bold mt-1" style={{ color: cpiColor(cpiVal) }}>{cpiVal.toFixed(2)}</p>
            <p className="text-[10px]" style={{ color: cpiVal >= 1 ? 'var(--color-success)' : 'var(--color-danger)' }}>{cpiVal >= 1 ? 'Under Budget' : 'Over Budget'}</p>
          </div>
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>SPI (EV/PV)</p>
            <p className="text-lg font-bold mt-1" style={{ color: spiColor(spiVal) }}>{spiVal.toFixed(2)}</p>
            <p className="text-[10px]" style={{ color: spiVal >= 1 ? 'var(--color-success)' : 'var(--color-danger)' }}>{spiVal >= 1 ? 'Ahead Schedule' : 'Behind Schedule'}</p>
          </div>
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>EAC (BAC/CPI)</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-info)' }}>{fmt(eacVal)}</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>BAC: {fmt(bac)} | ETC: {fmt(eacVal - totalAC)} | VAC: {fmt(bac - eacVal)}</p>
          </div>
        </div>

        {renderEVMChart()}

        <div className="card">
          <div className="flex items-center justify-between p-4 pb-0 flex-wrap gap-2">
            <h3 className="font-semibold text-sm">EVM Monthly Data</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute start-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input className="input ps-7 py-1 text-sm w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {hasPermission('cost_management', 'create') && (
                <button className="btn-primary btn-sm" onClick={() => openEvmForm()}><Plus size={14} /> Add Metric</button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>PV</th>
                  <th>EV</th>
                  <th>AC</th>
                  <th>Cum. PV</th>
                  <th>Cum. EV</th>
                  <th>Cum. AC</th>
                  <th>SPI</th>
                  <th>CPI</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr><td colSpan={10} className="text-center py-8"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>
                ) : filteredEvmData.length === 0 ? (
                  <tr><td colSpan={10}><EmptyState title="No EVM data" description="Add EVM metrics to see monthly performance breakdown." actionLabel="Add Metric" onAction={() => openEvmForm()} /></td></tr>
                ) : paginatedEvm.map((d, i) => {
                  const pd = d.period_date as string;
                  const sp = d.spi as number;
                  const cp = d.cpi as number;
                  return (
                    <tr key={i}>
                      <td className="text-sm">{pd ? new Date(pd + 'T00:00:00').toLocaleDateString() : `Period ${i + 1}`}</td>
                      <td className="font-mono text-xs">{fmt((d.planned_value as number) || 0)}</td>
                      <td className="font-mono text-xs">{fmt((d.earned_value as number) || 0)}</td>
                      <td className="font-mono text-xs">{fmt((d.actual_cost as number) || 0)}</td>
                      <td className="font-mono text-xs">{fmt((d.cumulative_pv as number) || 0)}</td>
                      <td className="font-mono text-xs">{fmt((d.cumulative_ev as number) || 0)}</td>
                      <td className="font-mono text-xs">{fmt((d.cumulative_ac as number) || 0)}</td>
                      <td><span className="font-mono text-xs font-semibold" style={{ color: spiColor(sp) }}>{sp.toFixed(2)}</span></td>
                      <td><span className="font-mono text-xs font-semibold" style={{ color: cpiColor(cp) }}>{cp.toFixed(2)}</span></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn-xs btn-secondary" title="Edit" onClick={() => {
                            const metric = evmMetrics.find(m => m.period === pd);
                            if (metric) openEvmForm(metric);
                          }}><Edit3 size={12} /></button>
                          <button className="btn-xs btn-secondary" title="Delete" onClick={() => {
                            const metric = evmMetrics.find(m => m.period === pd);
                            if (metric) deleteEvmMetric(metric.id);
                          }}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={evmPage} pageSize={pageSize} total={filteredEvmData.length} onChange={setEvmPage} />
        </div>

        {renderEvmFormModal()}
      </div>
    );
  }

  function renderCostFormModal() {
    if (!showCostForm) return null;
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCostForm(false)}>
        <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-semibold mb-4">{editingCostId ? 'Edit Cost Item' : 'New Cost Item'}</h3>
          {editingCostId && <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>Editing: {costForm.name_en}</p>}
          <div className="space-y-4">
            <div>
              <label className="label">Category</label>
              <select className="input" value={costForm.category} onChange={e => setCostForm({ ...costForm, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Name (English) *</label>
              <input className="input" value={costForm.name_en} onChange={e => setCostForm({ ...costForm, name_en: e.target.value })} />
            </div>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Enter cost amounts for this item. Planned is the budgeted amount, Actual is what has been spent, Committed is what is contractually obligated.</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Planned Amount</label>
                <input type="number" className="input" value={costForm.planned_amount} onChange={e => setCostForm({ ...costForm, planned_amount: e.target.value })} />
              </div>
              <div>
                <label className="label">Actual Amount</label>
                <input type="number" className="input" value={costForm.actual_amount} onChange={e => setCostForm({ ...costForm, actual_amount: e.target.value })} />
              </div>
              <div>
                <label className="label">Committed Amount</label>
                <input type="number" className="input" value={costForm.committed_amount} onChange={e => setCostForm({ ...costForm, committed_amount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Currency</label>
                <select className="input" value={costForm.currency} onChange={e => setCostForm({ ...costForm, currency: e.target.value })}>
                  {['SAR', 'USD', 'EUR', 'GBP'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={costForm.notes} onChange={e => setCostForm({ ...costForm, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary btn-sm" onClick={saveCostItem} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary btn-sm" onClick={() => setShowCostForm(false)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  function renderCostsTab() {
    const totalPlanned = costItems.reduce((s, i) => s + i.planned_amount, 0);
    const totalActual = costItems.reduce((s, i) => s + i.actual_amount, 0);
    const totalCommitted = costItems.reduce((s, i) => s + i.committed_amount, 0);
    const remaining = totalPlanned - totalActual;

    const filteredCategories = CATEGORIES.map(cat => {
      const items = filteredCostItems.filter(i => i.category === cat);
      const planned = items.reduce((s, i) => s + i.planned_amount, 0);
      const actual = items.reduce((s, i) => s + i.actual_amount, 0);
      const committed = items.reduce((s, i) => s + i.committed_amount, 0);
      return { category: cat, items, count: items.length, planned, actual, committed, variance: planned - actual };
    }).filter(c => c.count > 0);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total Planned</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-primary)' }}>{fmt(totalPlanned)}</p>
          </div>
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total Actual</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-warning)' }}>{fmt(totalActual)}</p>
          </div>
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total Committed</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-info)' }}>{fmt(totalCommitted)}</p>
          </div>
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Budget Remaining</p>
            <p className="text-lg font-bold mt-1" style={{ color: remaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmt(remaining)}</p>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between p-4 pb-0 flex-wrap gap-2">
            <h3 className="font-semibold text-sm">Cost by Category</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute start-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input className="input ps-7 py-1 text-sm w-48" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {hasPermission('cost_management', 'create') && (
                <button className="btn-primary btn-sm" onClick={() => openCostForm()}><Plus size={14} /> Add Item</button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Items</th>
                  <th>Planned</th>
                  <th>Actual</th>
                  <th>Committed</th>
                  <th>Variance</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr><td colSpan={7} className="text-center py-8"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>
                ) : filteredCategories.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No cost items found.</td></tr>
                ) : filteredCategories.map(cat => (
                  <tr key={cat.category}>
                    <td className="font-medium cursor-pointer flex items-center gap-2" onClick={() => toggleCategory(cat.category)}>
                      {expandedCategories.has(cat.category) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="capitalize">{cat.category}</span>
                    </td>
                    <td><span className="badge">{cat.count}</span></td>
                    <td className="font-mono text-xs">{fmt(cat.planned)}</td>
                    <td className="font-mono text-xs">{fmt(cat.actual)}</td>
                    <td className="font-mono text-xs">{fmt(cat.committed)}</td>
                    <td className={`font-mono text-xs ${cat.variance >= 0 ? 'text-green-500' : 'text-red-500'}`}>{fmt(cat.variance)}</td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredCategories.filter(c => expandedCategories.has(c.category)).map(cat => (
          <div key={cat.category} className="card">
            <h4 className="font-semibold text-sm mb-2 capitalize px-4 pt-4 flex items-center gap-2">
              <span className="capitalize">{cat.category}</span>
              <span className="badge text-xs">{cat.count} item{cat.count !== 1 ? 's' : ''}</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Planned</th>
                    <th>Actual</th>
                    <th>Committed</th>
                    <th>Variance</th>
                    <th>% Used</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cat.items.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-6" style={{ color: 'var(--color-text-muted)' }}>No items in this category.</td></tr>
                  ) : cat.items.map(item => {
                    const pctUsed = item.planned_amount > 0 ? (item.actual_amount / item.planned_amount) * 100 : 0;
                    return (
                      <tr key={item.id}>
                        <td className="text-sm">{item.name_en}</td>
                        <td className="font-mono text-xs">{fmt(item.planned_amount)}</td>
                        <td className="font-mono text-xs">{fmt(item.actual_amount)}</td>
                        <td className="font-mono text-xs">{fmt(item.committed_amount)}</td>
                        <td className={`font-mono text-xs ${(item.planned_amount - item.actual_amount) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{fmt(item.planned_amount - item.actual_amount)}</td>
                        <td className="font-mono text-xs">{pctUsed.toFixed(1)}%</td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn-xs btn-secondary" title="Edit" onClick={() => openCostForm(item)}><Edit3 size={12} /></button>
                            <button className="btn-xs btn-secondary" title="Delete" onClick={() => deleteCostItem(item.id)}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {renderCostFormModal()}
      </div>
    );
  }

  function renderBudgetTab() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total Planned</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-primary)' }}>{fmt(totalPlannedBudget)}</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{budgetItems.length} items</p>
          </div>
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total Actual</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-warning)' }}>{fmt(totalActualBudget)}</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{totalPlannedBudget > 0 ? ((totalActualBudget / totalPlannedBudget) * 100).toFixed(1) + '% utilization' : '0% utilization'}</p>
          </div>
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Remaining</p>
            <p className="text-lg font-bold mt-1" style={{ color: budgetRemaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmt(Math.abs(budgetRemaining))}</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{budgetRemaining >= 0 ? 'Under budget' : 'Over budget'}</p>
          </div>
          <div className="stat-glass p-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Utilization</p>
            <p className="text-lg font-bold mt-1">{budgetUtilPct.toFixed(1)}%</p>
            <div className="w-full h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 10%, transparent)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(budgetUtilPct, 100)}%`, backgroundColor: pctColor(budgetUtilPct) }} />
            </div>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><DollarSign size={14} /> Add Budget Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select className="input text-sm" value={budgetForm.category} onChange={e => setBudgetForm({ ...budgetForm, category: e.target.value })}>
              {['labor', 'materials', 'equipment', 'subcontractor', 'consultant', 'permits', 'admin', 'contingency', 'other'].map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <input className="input text-sm" placeholder="Item name" value={budgetForm.name_en} onChange={e => setBudgetForm({ ...budgetForm, name_en: e.target.value })} />
            <input type="number" className="input text-sm" placeholder="Planned amount (SAR)" value={budgetForm.planned_amount} onChange={e => setBudgetForm({ ...budgetForm, planned_amount: e.target.value })} />
            <input type="number" className="input text-sm" placeholder="Actual amount (SAR)" value={budgetForm.actual_amount} onChange={e => setBudgetForm({ ...budgetForm, actual_amount: e.target.value })} />
            <button className="btn-primary btn-sm" onClick={addBudgetItem}><Plus size={14} /> Add</button>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between p-4 pb-0">
            <h3 className="font-semibold text-sm">Budget Items</h3>
            <div className="relative">
              <Search size={14} className="absolute start-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input className="input ps-7 py-1 text-sm w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Item</th>
                  <th>Planned</th>
                  <th>Actual</th>
                  <th>Variance</th>
                  <th>% Used</th>
                  <th>Progress</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr><td colSpan={8} className="text-center py-8"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>
                ) : paginatedBudget.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No budget items. Add one above.</td></tr>
                ) : paginatedBudget.map(b => {
                  const variance = (b.actual_amount || 0) - b.planned_amount;
                  const pctUsed = b.planned_amount > 0 ? ((b.actual_amount || 0) / b.planned_amount) * 100 : 0;
                  return (
                    <tr key={b.id}>
                      <td><span className="badge text-xs capitalize">{b.category}</span></td>
                      <td className="font-medium">{b.name_en}</td>
                      <td className="font-mono text-xs">{fmt(b.planned_amount)}</td>
                      <td className="font-mono text-xs">{fmt(b.actual_amount || 0)}</td>
                      <td className={`font-mono text-xs ${variance > 0 ? 'text-red-500' : 'text-green-500'}`}>{variance > 0 ? '+' : ''}{fmt(variance)}</td>
                      <td className="font-mono text-xs">{pctUsed.toFixed(1)}%</td>
                      <td>
                        <div className="w-full max-w-[100px] h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 10%, transparent)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pctUsed, 100)}%`, backgroundColor: pctColor(pctUsed) }} />
                        </div>
                      </td>
                      <td>
                        <button className="btn-xs btn-secondary" title="Delete" onClick={() => deleteBudgetItem(b.id)}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={budgetPage} pageSize={pageSize} total={filteredBudgetItems.length} onChange={setBudgetPage} />
        </div>
      </div>
    );
  }

  function renderForecastsTab() {
    return (
      <div className="space-y-4">
        <div className="tabs overflow-x-auto">
          <button className={`tab ${forecastSubTab === 'forecasts' ? 'tab-active' : ''}`} onClick={() => setForecastSubTab('forecasts')}>Forecasts</button>
          <button className={`tab ${forecastSubTab === 'reports' ? 'tab-active' : ''}`} onClick={() => setForecastSubTab('reports')}>Cost Reports</button>
        </div>

        {forecastSubTab === 'forecasts' && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Budget Forecasts</h3>
              {hasPermission('cost_management', 'create') && (
                <button className="btn-primary btn-sm" onClick={() => setShowForecastForm(true)}><Plus size={14} /> New Forecast</button>
              )}
            </div>
            {loadingData ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin" /></div>
            ) : forecasts.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
                <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
                <p>No forecasts created yet.</p>
                <p className="text-xs mt-1">Create forecasts to predict project cost outcomes based on optimistic, pessimistic, or most likely scenarios.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {forecasts.map(f => {
                  const color = FORECAST_COLORS[f.forecast_type] || '#3b82f6';
                  return (
                    <div key={f.id} className="card p-4 border-l-4" style={{ borderLeftColor: color }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-sm font-semibold capitalize">{f.forecast_type.replace('_', ' ')}</span>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{new Date(f.forecast_date + 'T00:00:00').toLocaleDateString()}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                        <div className="p-2 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
                          <span className="text-gray-400 block mb-0.5">EAC</span>
                          <p className="font-mono font-semibold">{fmt(f.estimate_at_completion)}</p>
                        </div>
                        <div className="p-2 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
                          <span className="text-gray-400 block mb-0.5">ETC</span>
                          <p className="font-mono font-semibold">{fmt(f.estimate_to_complete)}</p>
                        </div>
                        <div className="p-2 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
                          <span className="text-gray-400 block mb-0.5">VAC</span>
                          <p className="font-mono font-semibold" style={{ color: f.variance_at_completion >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmt(f.variance_at_completion)}</p>
                        </div>
                      </div>
                      {f.assumptions && (
                        <div className="mt-3 pt-2 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                          <span className="font-medium">Assumptions: </span>
                          <span className="italic">{f.assumptions}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {showForecastForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForecastForm(false)}>
                <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold mb-4">New Forecast</h3>
                  <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Create a budget forecast to estimate future project costs. Choose a type and enter the expected EAC, ETC, and VAC values.</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Forecast Date</label>
                        <input type="date" className="input" value={forecastForm.forecast_date} onChange={e => setForecastForm({ ...forecastForm, forecast_date: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Type</label>
                        <select className="input" value={forecastForm.forecast_type} onChange={e => setForecastForm({ ...forecastForm, forecast_type: e.target.value })}>
                          {FORECAST_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="label">EAC (Est. at Completion)</label>
                        <input type="number" className="input" value={forecastForm.estimate_at_completion} onChange={e => setForecastForm({ ...forecastForm, estimate_at_completion: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">ETC (Est. to Complete)</label>
                        <input type="number" className="input" value={forecastForm.estimate_to_complete} onChange={e => setForecastForm({ ...forecastForm, estimate_to_complete: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">VAC (Variance at Comp.)</label>
                        <input type="number" className="input" value={forecastForm.variance_at_completion} onChange={e => setForecastForm({ ...forecastForm, variance_at_completion: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="label">Assumptions</label>
                      <textarea className="input" rows={3} placeholder="Enter assumptions that this forecast is based on..." value={forecastForm.assumptions} onChange={e => setForecastForm({ ...forecastForm, assumptions: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button className="btn-primary btn-sm" onClick={saveForecast} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="btn-secondary btn-sm" onClick={() => setShowForecastForm(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {forecastSubTab === 'reports' && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Cost Reports</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute start-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                  <input className="input ps-7 py-1 text-sm w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {hasPermission('cost_management', 'create') && (
                  <button className="btn-primary btn-sm" onClick={() => setShowReportForm(true)}><Plus size={14} /> New Report</button>
                )}
              </div>
            </div>
            <div className="card">
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Total Budget</th>
                      <th>Committed</th>
                      <th>Actual</th>
                      <th>Forecast</th>
                      <th>Budget Variance</th>
                      <th>CPI</th>
                      <th>SPI</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingData ? (
                      <tr><td colSpan={10} className="text-center py-8"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>
                    ) : paginatedReports.length === 0 ? (
                      <tr><td colSpan={10}><EmptyState title="No cost reports" description="Generate cost reports to track budget performance and variance over time." actionLabel="New Report" onAction={() => setShowReportForm(true)} /></td></tr>
                    ) : paginatedReports.map(r => (
                      <tr key={r.id}>
                        <td className="text-sm">{new Date(r.report_date + 'T00:00:00').toLocaleDateString()}</td>
                        <td><span className="badge capitalize text-xs">{r.report_type}</span></td>
                        <td className="font-mono text-xs">{fmt(r.total_budget)}</td>
                        <td className="font-mono text-xs">{fmt(r.total_committed)}</td>
                        <td className="font-mono text-xs">{fmt(r.total_actual)}</td>
                        <td className="font-mono text-xs">{fmt(r.total_forecast)}</td>
                        <td className={`font-mono text-xs ${r.budget_variance >= 0 ? 'text-green-500' : 'text-red-500'}`}>{fmt(r.budget_variance)}</td>
                        <td><span className="font-mono text-xs font-semibold" style={{ color: cpiColor(r.cost_performance_index) }}>{r.cost_performance_index.toFixed(2)}</span></td>
                        <td><span className="font-mono text-xs font-semibold" style={{ color: spiColor(r.schedule_performance_index) }}>{r.schedule_performance_index.toFixed(2)}</span></td>
                        <td className="text-xs max-w-[150px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={reportsPage} pageSize={pageSize} total={filteredCostReports.length} onChange={setReportsPage} />
            </div>

            {showReportForm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowReportForm(false)}>
                <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold mb-4">New Cost Report</h3>
                  <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Create a periodic cost report summarizing budget, committed costs, actuals, and performance indices.</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Report Date</label>
                        <input type="date" className="input" value={reportForm.report_date} onChange={e => setReportForm({ ...reportForm, report_date: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Type</label>
                        <select className="input" value={reportForm.report_type} onChange={e => setReportForm({ ...reportForm, report_type: e.target.value })}>
                          {['monthly', 'weekly', 'quarterly', 'custom'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Total Budget</label>
                        <input type="number" className="input" value={reportForm.total_budget} onChange={e => setReportForm({ ...reportForm, total_budget: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Total Committed</label>
                        <input type="number" className="input" value={reportForm.total_committed} onChange={e => setReportForm({ ...reportForm, total_committed: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Total Actual</label>
                        <input type="number" className="input" value={reportForm.total_actual} onChange={e => setReportForm({ ...reportForm, total_actual: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Total Forecast</label>
                        <input type="number" className="input" value={reportForm.total_forecast} onChange={e => setReportForm({ ...reportForm, total_forecast: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="label">Budget Variance</label>
                        <input type="number" className="input" value={reportForm.budget_variance} onChange={e => setReportForm({ ...reportForm, budget_variance: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">CPI</label>
                        <input type="number" step="0.01" className="input" value={reportForm.cost_performance_index} onChange={e => setReportForm({ ...reportForm, cost_performance_index: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">SPI</label>
                        <input type="number" step="0.01" className="input" value={reportForm.schedule_performance_index} onChange={e => setReportForm({ ...reportForm, schedule_performance_index: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="label">Notes</label>
                      <textarea className="input" rows={2} placeholder="Add notes or comments about this report..." value={reportForm.notes} onChange={e => setReportForm({ ...reportForm, notes: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button className="btn-primary btn-sm" onClick={saveReport} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="btn-secondary btn-sm" onClick={() => setShowReportForm(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function renderBaselinesTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">EVM Baselines</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute start-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input className="input ps-7 py-1 text-sm w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {hasPermission('cost_management', 'create') && (
              <button className="btn-primary btn-sm" onClick={() => setShowBaselineForm(true)}><Plus size={14} /> New Baseline</button>
            )}
          </div>
        </div>

        <div className="card">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total PV</th>
                  <th>BAC</th>
                  <th>EAC</th>
                  <th>ETC</th>
                  <th>VAC</th>
                  <th>CPI</th>
                  <th>SPI</th>
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr><td colSpan={8} className="text-center py-8"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>
                ) : paginatedBaselines.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState title="No baselines" description="Create baseline snapshots to capture EVM performance at key project milestones." actionLabel="New Baseline" onAction={() => setShowBaselineForm(true)} /></td></tr>
                ) : paginatedBaselines.map(b => (
                  <tr key={b.id}>
                    <td className="text-sm">{new Date(b.baseline_date + 'T00:00:00').toLocaleDateString()}</td>
                    <td className="font-mono text-xs">{fmt(b.total_planned_value)}</td>
                    <td className="font-mono text-xs">{fmt(b.budget_at_completion)}</td>
                    <td className="font-mono text-xs">{fmt(b.estimate_at_completion)}</td>
                    <td className="font-mono text-xs">{fmt(b.estimate_to_complete)}</td>
                    <td className={`font-mono text-xs ${b.variance_at_completion >= 0 ? 'text-green-500' : 'text-red-500'}`}>{fmt(b.variance_at_completion)}</td>
                    <td><span className="font-mono text-xs font-semibold" style={{ color: cpiColor(b.cost_performance_index) }}>{b.cost_performance_index.toFixed(2)}</span></td>
                    <td><span className="font-mono text-xs font-semibold" style={{ color: spiColor(b.schedule_performance_index) }}>{b.schedule_performance_index.toFixed(2)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={baselinesPage} pageSize={pageSize} total={filteredBaselines.length} onChange={setBaselinesPage} />
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><FileText size={14} /> EVM Formula Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
              <span className="font-semibold">PV</span> = Planned Value<br />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Budgeted cost of work scheduled</span>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
              <span className="font-semibold">EV</span> = Earned Value<br />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Budgeted cost of work performed</span>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
              <span className="font-semibold">AC</span> = Actual Cost<br />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Actual cost of work performed</span>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
              <span className="font-semibold">BAC</span> = Budget at Completion<br />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total planned budget for the project</span>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
              <span className="font-semibold">EAC</span> = BAC / CPI<br />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Estimate at Completion (projected total cost)</span>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
              <span className="font-semibold">ETC</span> = EAC - AC<br />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Estimate to Complete (remaining cost)</span>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
              <span className="font-semibold">VAC</span> = BAC - EAC<br />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Variance at Completion (positive = under budget)</span>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
              <span className="font-semibold">SPI</span> = EV / PV<br />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Schedule Performance Index (&gt;1 = ahead of schedule)</span>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
              <span className="font-semibold">CPI</span> = EV / AC<br />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cost Performance Index (&gt;1 = under budget)</span>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
              <span className="font-semibold">CV</span> = EV - AC<br />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cost Variance (positive = under budget)</span>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
              <span className="font-semibold">SV</span> = EV - PV<br />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Schedule Variance (positive = ahead of schedule)</span>
            </div>
          </div>
        </div>

        {showBaselineForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowBaselineForm(false)}>
            <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">New Baseline Snapshot</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Create a baseline snapshot to capture the EVM performance metrics at a point in time. This serves as a reference for future comparisons.</p>
              <div className="space-y-4">
                <div>
                  <label className="label">Baseline Date</label>
                  <input type="date" className="input" value={baselineForm.baseline_date} onChange={e => setBaselineForm({ ...baselineForm, baseline_date: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Total Planned Value (PV)</label>
                    <input type="number" className="input" value={baselineForm.total_planned_value} onChange={e => setBaselineForm({ ...baselineForm, total_planned_value: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">BAC</label>
                    <input type="number" className="input" value={baselineForm.budget_at_completion} onChange={e => setBaselineForm({ ...baselineForm, budget_at_completion: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">EAC</label>
                    <input type="number" className="input" value={baselineForm.estimate_at_completion} onChange={e => setBaselineForm({ ...baselineForm, estimate_at_completion: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">ETC</label>
                    <input type="number" className="input" value={baselineForm.estimate_to_complete} onChange={e => setBaselineForm({ ...baselineForm, estimate_to_complete: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">VAC</label>
                    <input type="number" className="input" value={baselineForm.variance_at_completion} onChange={e => setBaselineForm({ ...baselineForm, variance_at_completion: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">CPI</label>
                    <input type="number" step="0.01" className="input" value={baselineForm.cost_performance_index} onChange={e => setBaselineForm({ ...baselineForm, cost_performance_index: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">SPI</label>
                    <input type="number" step="0.01" className="input" value={baselineForm.schedule_performance_index} onChange={e => setBaselineForm({ ...baselineForm, schedule_performance_index: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button className="btn-primary btn-sm" onClick={saveBaseline} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="btn-secondary btn-sm" onClick={() => setShowBaselineForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loadingProjects) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-2 sm:p-4 md:p-6 space-y-4 page-enter">
        <div className="text-center py-20" style={{ color: 'var(--color-text-muted)' }}>
          <Target size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">No projects found. Create a project first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-4 page-enter">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Cost Management</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Earned Value Management &amp; Cost Control Dashboard</p>
        </div>
        <div className="w-full sm:w-64">
          <select className="input" value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name_en || p.name_ar}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="tabs overflow-x-auto">
        <button className={`tab ${activeTab === 'evm' ? 'tab-active' : ''}`} onClick={() => setActiveTab('evm')}><BarChart3 size={14} className="inline mr-1" /> EVM Dashboard</button>
        <button className={`tab ${activeTab === 'costs' ? 'tab-active' : ''}`} onClick={() => setActiveTab('costs')}><DollarSign size={14} className="inline mr-1" /> Cost Breakdown</button>
        <button className={`tab ${activeTab === 'budget' ? 'tab-active' : ''}`} onClick={() => setActiveTab('budget')}><PieChart size={14} className="inline mr-1" /> Budget vs Actual</button>
        <button className={`tab ${activeTab === 'forecasts' ? 'tab-active' : ''}`} onClick={() => setActiveTab('forecasts')}><TrendingUp size={14} className="inline mr-1" /> Forecasts &amp; Reports</button>
        <button className={`tab ${activeTab === 'baselines' ? 'tab-active' : ''}`} onClick={() => setActiveTab('baselines')}><Target size={14} className="inline mr-1" /> EVM Baselines</button>
      </div>

      {activeTab === 'evm' && renderEvmTab()}
      {activeTab === 'costs' && renderCostsTab()}
      {activeTab === 'budget' && renderBudgetTab()}
      {activeTab === 'forecasts' && renderForecastsTab()}
      {activeTab === 'baselines' && renderBaselinesTab()}
    </div>
  );
}
