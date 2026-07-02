import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import {
  Users, Shield, Settings, Palette, Terminal, Building2,
  UserPlus, Activity, Database, Globe,
  BarChart3, Layout, BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CardSkeleton } from '../components/Skeleton';

interface StatCardData {
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
  onClick?: () => void;
}

interface QuickAction {
  icon: LucideIcon;
  title: string;
  desc: string;
  path: string;
  color: string;
}

export default function AdminDashboardPage() {
  const t = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatCardData[]>([]);
  const [recentUsers, setRecentUsers] = useState<{ id: string; email: string; role: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const QUICK_ACTIONS: QuickAction[] = useMemo(() => [
    { icon: Users, title: t('admin.action_manage_users'), desc: t('admin.action_manage_users_desc'), path: '/admin/users', color: '#3b82f6' },
    { icon: Shield, title: t('admin.action_manage_roles'), desc: t('admin.action_manage_roles_desc'), path: '/admin/roles', color: '#8b5cf6' },
    { icon: Settings, title: t('admin.action_system_settings'), desc: t('admin.action_system_settings_desc'), path: '/admin/settings', color: '#f59e0b' },
    { icon: Palette, title: t('admin.branding'), desc: t('admin.action_branding_desc'), path: '/admin/branding', color: '#ec4899' },
    { icon: Terminal, title: t('admin.sql_editor'), desc: t('admin.action_sql_editor_desc'), path: '/admin/sql', color: '#14b8a6' },
    { icon: Globe, title: t('admin.action_page_registry'), desc: t('admin.action_page_registry_desc'), path: '/admin/settings?tab=pages', color: '#06b6d4' },
    { icon: Database, title: t('admin.table_browser'), desc: t('admin.table_browser_desc'), path: '/admin/table-browser', color: '#0ea5e9' },
    { icon: Layout, title: t('admin.flow_diagram'), desc: t('admin.flow_diagram_desc'), path: '/admin/flow-diagram', color: '#8b5cf6' },
    { icon: BookOpen, title: t('admin.system_documentation'), desc: t('admin.docs_desc'), path: '/admin/docs', color: '#22c55e' },
  ], [t]);

  useEffect(() => {
    loadAdminStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAdminStats() {
    try {
      const [userCount, projectCount, roleCount, moduleCount] = await Promise.all([
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }).in('status', ['planning', 'active', 'in_progress', 'execution']),
        supabase.from('roles').select('id', { count: 'exact', head: true }),
        supabase.from('system_modules').select('id', { count: 'exact', head: true }).eq('is_enabled', true),
      ]);

      const { data: recentData } = await supabase
        .from('user_profiles')
        .select('id, email, role, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentUsers(recentData || []);

      setStats([
        { icon: Users, label: t('admin.total_users'), value: String(userCount.count ?? 0), color: '#3b82f6', onClick: () => navigate('/admin/users') },
        { icon: Building2, label: t('admin.active_projects'), value: String(projectCount.count ?? 0), color: '#22c55e', onClick: () => navigate('/projects') },
        { icon: Shield, label: t('admin.system_roles'), value: String(roleCount.count ?? 0), color: '#8b5cf6', onClick: () => navigate('/admin/roles') },
        { icon: Database, label: t('admin.enabled_modules'), value: String(moduleCount.count ?? 0), color: '#14b8a6', onClick: () => navigate('/admin/settings?tab=features') },
      ]);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-enter space-y-6">
      <div className="welcome-gradient p-6 md:p-8">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
              <Shield size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">{t('admin.admin_dashboard')}</h1>
              <p className="text-sm text-white/80">{t('admin.admin_dashboard_desc')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          : stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="stat-glass cursor-pointer" onClick={stat.onClick}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{stat.value}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      <div className="glass-card p-5">
        <h2 className="text-lg font-semibold mb-4">{t('admin.quick_management')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.title}
                className="card hover:shadow-md transition-shadow cursor-pointer p-4"
                onClick={() => navigate(action.path)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${action.color}15` }}>
                    <Icon size={20} style={{ color: action.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{action.title}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{action.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={16} style={{ color: 'var(--color-text-secondary)' }} />
            <h2 className="text-lg font-semibold">{t('admin.recent_users')}</h2>
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>{t('admin.no_users_found')}</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('auth.email')}</th>
                    <th>{t('admin.role')}</th>
                    <th>{t('audit.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((u) => (
                    <tr key={u.id} className="clickable" onClick={() => navigate('/admin/users')}>
                      <td className="font-medium">{u.email}</td>
                      <td><span className="badge capitalize">{u.role.replace(/_/g, ' ')}</span></td>
                      <td className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} style={{ color: 'var(--color-text-secondary)' }} />
            <h2 className="text-lg font-semibold">{t('admin.system_overview')}</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
              <div className="flex items-center gap-2">
                <BarChart3 size={16} style={{ color: 'var(--color-text-secondary)' }} />
                <span className="text-sm">{t('admin.admin_panel')}</span>
              </div>
              <span className="badge badge--green">{t('admin.active')}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
              <div className="flex items-center gap-2">
                <Users size={16} style={{ color: 'var(--color-text-secondary)' }} />
                <span className="text-sm">{t('admin.authenticated_as')}</span>
              </div>
              <span className="text-sm font-medium">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
              <div className="flex items-center gap-2">
                <Shield size={16} style={{ color: 'var(--color-text-secondary)' }} />
                <span className="text-sm">{t('admin.role')}</span>
              </div>
              <span className="badge capitalize">{user?.role?.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
