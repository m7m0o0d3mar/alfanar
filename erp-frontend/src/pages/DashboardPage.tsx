import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useUserProjects } from '../hooks/useData';
import { useT } from '../hooks/useTranslation';
import { exportCSV } from '../utils/csv';
import { supabase } from '../services/supabase';
import {
  Building2, HardHat, ShieldCheck, Users, ShoppingCart,
  DollarSign, Download, FileText, BarChart3, Activity,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CardSkeleton, TableSkeleton } from '../components/Skeleton';

const KPI_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  green: '#22c55e',
  purple: '#a855f7',
  teal: '#14b8a6',
};

interface KpiCardData {
  icon: LucideIcon;
  label: string;
  value: string;
  colorKey: string;
  loading: boolean;
  onClick?: () => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const statusColor: Record<string, string> = {
  planning: 'badge badge--gray',
  active: 'badge badge--green',
  in_progress: 'badge badge--green',
  execution: 'badge badge--green',
  completed: 'badge badge--blue',
  on_hold: 'badge badge--yellow',
  cancelled: 'badge badge--red',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { projects, loading: projectsLoading } = useUserProjects();
  const navigate = useNavigate();
  const [kpiData, setKpiData] = useState<KpiCardData[]>([]);

  useEffect(() => {
    loadKpiData();
  }, []);

  async function loadKpiData() {
    const defaultCards: KpiCardData[] = [
      { icon: Building2, label: 'Active Projects', value: '0', colorKey: 'blue', loading: true },
      { icon: HardHat, label: 'Open WIRs', value: '0', colorKey: 'amber', loading: true },
      { icon: ShieldCheck, label: 'NCRs', value: '0', colorKey: 'red', loading: true },
      { icon: Users, label: 'Total Workforce', value: '0', colorKey: 'green', loading: true },
      { icon: ShoppingCart, label: 'Pending POs', value: '0', colorKey: 'purple', loading: true },
      { icon: DollarSign, label: 'Monthly Payroll', value: 'SAR 0', colorKey: 'teal', loading: true },
    ];
    setKpiData(defaultCards);

    try {
      const [projectCount, wirCount, ncrCount, empCount, poCount] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }).in('status', ['planning', 'active', 'in_progress', 'execution']),
        supabase.from('work_requests').select('id', { count: 'exact', head: true }).in('status', ['draft', 'submitted']),
        supabase.from('work_requests').select('id', { count: 'exact', head: true }).eq('is_ncr', true),
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).in('status', ['Pending', 'pending', 'draft', 'submitted']),
      ]);

      const payrollRes = await supabase.from('payroll_runs').select('net_total, total_amount');
      const monthlyPayroll = (payrollRes.data || []).reduce((sum, r) => sum + Number(r.net_total || r.total_amount || 0), 0);

      setKpiData([
        { icon: Building2, label: 'Total Projects', value: String(projectCount.count ?? 0), colorKey: 'blue', loading: false, onClick: () => navigate('/projects') },
        { icon: HardHat, label: 'Open WIRs', value: String(wirCount.count ?? 0), colorKey: 'amber', loading: false, onClick: () => navigate('/execution') },
        { icon: ShieldCheck, label: 'NCRs', value: String(ncrCount.count ?? 0), colorKey: 'red', loading: false, onClick: () => navigate('/quality') },
        { icon: Users, label: 'Total Workforce', value: String(empCount.count ?? 0), colorKey: 'green', loading: false, onClick: () => navigate('/hr') },
        { icon: ShoppingCart, label: 'Pending POs', value: String(poCount.count ?? 0), colorKey: 'purple', loading: false, onClick: () => navigate('/procurement') },
        { icon: DollarSign, label: 'Monthly Payroll', value: `SAR ${monthlyPayroll.toLocaleString()}`, colorKey: 'teal', loading: false, onClick: () => navigate('/finance') },
      ]);
    } catch (err) {
      console.error('Failed to load KPI data:', err);
      setKpiData(defaultCards.map(c => ({ ...c, loading: false })));
    }
  }

  return (
    <div className="page-enter space-y-6">
      {/* Welcome Header — Reterra-inspired gradient */}
      <div className="welcome-gradient p-6 md:p-8">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white bg-white/20 ring-2 ring-white/30">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                getInitials(user?.full_name_en || 'U')
              )}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                {getGreeting()}, {user?.full_name_en?.split(' ')[0]}
              </h1>
              <p className="text-sm text-white/80">
                {settings.company_name} &middot; <span className="capitalize">{user?.role.replace(/_/g, ' ')}</span>
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
              {user?.role.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards — glass style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiData.length === 0
          ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          : kpiData.map((kpi) => {
              const Icon = kpi.icon;
              return kpi.loading ? (
                <CardSkeleton key={kpi.label} />
              ) : (
                <div key={kpi.label} className="stat-glass" style={{ cursor: kpi.onClick ? 'pointer' : 'default' }} onClick={kpi.onClick}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${KPI_COLORS[kpi.colorKey]}15`, color: KPI_COLORS[kpi.colorKey] }}
                    >
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{kpi.value}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{kpi.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {/* My Projects */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">My Projects</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              {projects.length}
            </span>
          </div>
          {projects.length > 0 && (
            <button className="btn-sm btn-secondary" onClick={() => exportCSV(projects as unknown as Record<string, unknown>[], `projects_${new Date().toISOString().slice(0, 10)}.csv`)}>
              <Download size={14} /> CSV
            </button>
          )}
        </div>
        {projectsLoading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No projects found</td></tr>
                ) : (
                  projects.map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => navigate(`/projects/${p.id}`)}>
                      <td className="font-mono text-xs">{p.project_code}</td>
                      <td className="font-medium">{p.name_en}</td>
                      <td>
                        <span className={`badge capitalize`}
                          style={{
                            backgroundColor: p.status === 'planning' ? '#f3f4f6' :
                              ['active', 'in_progress', 'execution'].includes(p.status) ? '#dcfce7' :
                              p.status === 'completed' ? '#dbeafe' :
                              p.status === 'on_hold' ? '#fef9c3' : '#fee2e2',
                            color: p.status === 'planning' ? '#374151' :
                              ['active', 'in_progress', 'execution'].includes(p.status) ? '#166534' :
                              p.status === 'completed' ? '#1e40af' :
                              p.status === 'on_hold' ? '#a16207' : '#991b1b',
                          }}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-24 progress-bar">
                            <div className="progress-bar-fill transition-all" style={{ width: `${p.progress_percent}%` }} />
                          </div>
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{p.progress_percent}%</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge text-xs"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 8%, transparent)', color: 'var(--color-text-secondary)' }}
                        >
                          {p.project_role?.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions — glass style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickActionCard
          icon={Activity} title="Recent WIRs" desc="View inspection requests"
          onClick={() => navigate('/execution')}
        />
        <QuickActionCard
          icon={BarChart3} title="Monthly KPIs" desc="View KPI dashboard"
          onClick={() => navigate('/settings')}
        />
        <QuickActionCard
          icon={FileText} title="Pending Approvals" desc="View pending approvals"
          onClick={() => navigate('/approvals')}
        />
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, title, desc, onClick }: {
  icon: LucideIcon; title: string; desc: string; onClick?: () => void;
}) {
  return (
    <div
      className="card hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 6%, transparent)', color: 'var(--color-text-secondary)' }}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{title}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
        </div>
      </div>
    </div>
  );
}
