import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';
import { BarChart3, Building2, CheckCircle, Clock, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';

interface ProjectSummary {
  id: string; project_code: string; name_en: string; status: string;
  total_budget: number; used_amount: number; remaining: number; pct_used: number;
}

export default function ProjectAnalyticsPage() {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [stats, setStats] = useState<{ label: string; value: string; color: string; icon: any }[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: pData } = await supabase
        .from('projects')
        .select('id, project_code, name_en, status')
        .order('project_code');

      const { data: bData } = await supabase
        .from('budget')
        .select('project_id, total_budget, used_amount');

      const allProjects = (pData || []) as { id: string; project_code: string; name_en: string; status: string }[];
      const budgetMap: Record<string, { total: number; used: number }> = {};
      (bData || []).forEach((b: any) => {
        if (!budgetMap[b.project_id]) budgetMap[b.project_id] = { total: 0, used: 0 };
        budgetMap[b.project_id].total += Number(b.total_budget || 0);
        budgetMap[b.project_id].used += Number(b.used_amount || 0);
      });

      const summary: ProjectSummary[] = allProjects.map(p => {
        const b = budgetMap[p.id] || { total: 0, used: 0 };
        return {
          ...p,
          total_budget: b.total,
          used_amount: b.used,
          remaining: b.total - b.used,
          pct_used: b.total > 0 ? (b.used / b.total) * 100 : 0,
        };
      });
      setProjects(summary);

      const totalBudget = summary.reduce((s, p) => s + p.total_budget, 0);
      const totalSpent = summary.reduce((s, p) => s + p.used_amount, 0);
      const active = summary.filter(p => p.status === 'active');
      const completed = summary.filter(p => p.status === 'completed');

      setStats([
        { label: 'Total Projects', value: String(summary.length), color: '#3b82f6', icon: Building2 },
        { label: 'Active', value: String(active.length), color: '#22c55e', icon: Clock },
        { label: 'Completed', value: String(completed.length), color: '#8b5cf6', icon: CheckCircle },
        { label: 'Total Budget', value: `${totalBudget.toLocaleString()} SAR`, color: '#f59e0b', icon: DollarSign },
        { label: 'Total Spent', value: `${totalSpent.toLocaleString()} SAR`, color: '#ef4444', icon: TrendingDown },
        { label: 'Remaining', value: `${(totalBudget - totalSpent).toLocaleString()} SAR`, color: '#14b8a6', icon: TrendingUp },
      ]);
    } catch (err) {
      console.error('Failed to load project analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
          <BarChart3 size={20} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Project Analytics</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Overview of project budgets and status</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4 animate-pulse"><div className="h-12 bg-gray-200 rounded" /></div>
        )) : stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${s.color}15` }}>
                <Icon size={20} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Budget</th>
                <th>Spent</th>
                <th>Remaining</th>
                <th>% Used</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No project data available</td></tr>
              ) : projects.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">
                    <span className="font-mono text-xs mr-1">{p.project_code}</span>
                    {p.name_en}
                  </td>
                  <td><span className={`badge text-xs ${p.status === 'active' ? 'badge-success' : p.status === 'completed' ? 'badge-info' : p.status === 'on_hold' ? 'badge-warning' : 'badge-neutral'}`}>{p.status}</span></td>
                  <td className="font-mono text-xs">{p.total_budget.toLocaleString()} SAR</td>
                  <td className="font-mono text-xs">{p.used_amount.toLocaleString()} SAR</td>
                  <td className={`font-mono text-xs ${p.remaining < 0 ? 'text-red-600 font-bold' : ''}`}>{p.remaining.toLocaleString()} SAR</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 10%, transparent)' }}>
                        <div className="h-full rounded-full" style={{
                          width: `${Math.min(p.pct_used, 100)}%`,
                          backgroundColor: p.pct_used > 90 ? 'var(--color-danger)' : p.pct_used > 70 ? 'var(--color-warning)' : 'var(--color-success)'
                        }} />
                      </div>
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{p.pct_used.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
