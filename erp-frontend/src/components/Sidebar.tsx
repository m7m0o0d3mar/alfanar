import { useState, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../hooks/useTranslation';
import { X, ChevronDown, LogOut, PanelLeftClose, PanelLeft, LayoutDashboard, Building2, Grid3X3, HardHat, ShieldCheck, Users, ShoppingCart, DollarSign, FileText, CheckSquare, FolderOpen, Settings, Wrench, TrendingUp, UserCog, Palette, Terminal, Warehouse, Contact, CalendarRange, Briefcase, Clock, Map, Cog } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, projects: Building2, units: Grid3X3,
  execution: HardHat, quality: ShieldCheck, hse: ShieldCheck,
  hr: Users, procurement: ShoppingCart, finance: DollarSign,
  sales: TrendingUp, technical: Wrench, documents: FolderOpen,
  approvals: CheckSquare, settings: Settings, admin_users: UserCog,
  admin_roles: ShieldCheck, admin_branding: Palette, admin_sql: Terminal,
  warehouse: Warehouse, crm: Contact, timelines: CalendarRange,
  resources: Briefcase, attendance: Clock, maps: Map,
  admin_settings: Cog,
};

const roleModuleMap: Record<string, string[]> = {
  admin: ['dashboard','projects','units','timelines','execution','quality','hse','hr','procurement','finance','sales','technical','documents','approvals','settings','warehouse','crm','resources','attendance','maps'],
  developer: ['dashboard','projects','units','timelines','execution','quality','hse','hr','procurement','finance','sales','technical','documents','approvals','warehouse','crm','resources'],
  project_manager: ['dashboard','projects','units','timelines','execution','quality','hse','hr','procurement','finance','technical','documents','approvals','warehouse','crm','resources'],
  main_contractor: ['dashboard','projects','units','timelines','execution','quality','hse','hr','procurement','documents','warehouse','resources'],
  subcontractor: ['dashboard','projects','execution','quality','hse','documents'],
  engineer: ['dashboard','projects','units','execution','quality','technical','documents'],
  quality: ['dashboard','projects','execution','quality','documents'],
  hse: ['dashboard','projects','hse','documents'],
  hr: ['dashboard','projects','hr','documents'],
  finance: ['dashboard','projects','finance','procurement','documents','resources'],
  sales: ['dashboard','projects','units','sales','documents','crm'],
  consultant: ['dashboard','projects','execution','quality','technical','documents'],
  client: ['dashboard','projects','units','documents'],
};

const navItems = [
  { key: 'dashboard', path: '/', icon: 'dashboard' },
  { key: 'projects', path: '/projects', icon: 'projects' },
  { key: 'units', path: '/units', icon: 'units' },
  { key: 'timelines', path: '/timelines', icon: 'timelines' },
  { key: 'resources', path: '/resources', icon: 'resources' },
  { key: 'execution', path: '/execution', icon: 'execution' },
  { key: 'quality', path: '/quality', icon: 'quality' },
  { key: 'hse', path: '/hse', icon: 'hse' },
  { key: 'hr', path: '/hr', icon: 'hr' },
  { key: 'procurement', path: '/procurement', icon: 'procurement' },
  { key: 'warehouse', path: '/warehouse', icon: 'warehouse' },
  { key: 'finance', path: '/finance', icon: 'finance' },
  { key: 'sales', path: '/sales', icon: 'sales' },
  { key: 'technical', path: '/technical', icon: 'technical' },
  { key: 'documents', path: '/documents', icon: 'documents' },
  { key: 'approvals', path: '/approvals', icon: 'approvals' },
  { key: 'crm', path: '/crm', icon: 'crm' },
  { key: 'attendance', path: '/attendance', icon: 'attendance' },
  { key: 'maps', path: '/maps', icon: 'maps' },
  { key: 'settings', path: '/settings', icon: 'settings' },
];

const adminNavItems = [
  { key: 'admin_users', path: '/admin/users', icon: 'admin_users' },
  { key: 'admin_roles', path: '/admin/roles', icon: 'admin_roles' },
  { key: 'admin_branding', path: '/admin/branding', icon: 'admin_branding' },
  { key: 'admin_settings', path: '/admin/settings', icon: 'admin_settings' },
  { key: 'admin_sql', path: '/admin/sql', icon: 'admin_sql' },
];

const navSections = [
  { key: 'main', label: '', items: ['dashboard'] },
  { key: 'projects', label: 'Projects', items: ['projects', 'units', 'timelines', 'maps'] },
  { key: 'operations', label: 'Operations', items: ['execution', 'quality', 'hse', 'warehouse'] },
  { key: 'resources', label: 'Resources', items: ['hr', 'attendance', 'procurement', 'finance', 'resources'] },
  { key: 'sales', label: 'Sales & CRM', items: ['sales', 'crm', 'technical'] },
  { key: 'docs', label: 'Documents', items: ['documents', 'approvals'] },
  { key: 'system', label: 'System', items: ['settings'] },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const t = useT();
  const { user, signOut, effectiveRole } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const primaryColor = settings.primary_color;
  const isAdmin = effectiveRole === 'admin';
  const allowedModules = roleModuleMap[effectiveRole || 'client'];
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navSections.forEach((s) => { initial[s.key] = true; });
    if (isAdmin) initial['admin'] = true;
    return initial;
  });
  const [hovered, setHovered] = useState(false);

  const isExpanded = !collapsed || hovered;

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function getItem(key: string) {
    return navItems.find((i) => i.key === key);
  }

  const userInitial = (user?.full_name_en || user?.email || 'U')[0].toUpperCase();

  function renderNavItem(item: { key: string; path: string; icon: string }) {
    const Icon = iconMap[item.icon] || LayoutDashboard;
    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
    return (
      <NavLink
        key={item.key}
        to={item.path}
        end={item.path === '/'}
        onClick={onClose}
        className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
        title={isExpanded ? '' : t(`nav.${item.key}`)}
      >
        <span className="sidebar-icon"><Icon size={18} /></span>
        {isExpanded && <span className="truncate">{t(`nav.${item.key}`)}</span>}
      </NavLink>
    );
  }

  function renderSection(section: { key: string; label: string; items: string[] }) {
    const visibleItems = section.items
      .map(getItem)
      .filter((item): item is (typeof navItems)[number] => item !== undefined && allowedModules?.includes(item.key));

    if (visibleItems.length === 0) return null;

    const isOpen = openSections[section.key] ?? true;

    return (
      <div key={section.key} className="sidebar-section">
        {isExpanded && section.label && (
          <button
            onClick={() => toggleSection(section.key)}
            className="sidebar-section-btn flex items-center w-full gap-2 px-3 py-1.5 text-[0.7rem] font-semibold text-gray-500 uppercase tracking-widest hover:text-gray-300 transition-colors"
          >
            <ChevronDown size={10} className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
            <span>{section.label}</span>
          </button>
        )}
        <div className={`overflow-hidden transition-all duration-200 ${!isExpanded || isOpen ? 'max-h-96' : 'max-h-0'}`}>
          <div className={isExpanded ? 'space-y-0.5' : 'flex flex-col items-center gap-1 py-1'}>
            {visibleItems.map(renderNavItem)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          fixed md:sticky top-0 z-40 h-screen bg-sidebar text-white flex flex-col shrink-0
          transition-all duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isExpanded ? 'w-64' : 'w-16'}
          ${!isExpanded ? 'sidebar-collapsed' : ''}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-4 border-b shrink-0" style={{borderColor: 'var(--color-sidebar-divider)'}}>
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{background: 'var(--color-primary-gradient)'}}>
              {settings.app_name ? settings.app_name[0].toUpperCase() : 'E'}
            </div>
            {isExpanded && (
              <div className="min-w-0 sidebar-logo-text">
                <h2 className="text-sm font-semibold truncate tracking-tight">{settings.app_name || 'ERP'}</h2>
                <p className="text-[10px] text-gray-500 truncate">{settings.company_name || ''}</p>
              </div>
            )}
          </div>
          <button onClick={onClose} className="md:hidden p-1 hover:bg-white/5 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Toggle collapse button */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex items-center justify-center w-full py-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors shrink-0"
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin space-y-0.5">
          {navSections.map(renderSection)}

          {isAdmin && (
            <div key="admin" className="sidebar-section pt-2" style={{borderTop: isExpanded ? '1px solid var(--color-sidebar-divider)' : 'none', marginTop: '0.25rem'}}>
              {isExpanded && (
                <button
                  onClick={() => toggleSection('admin')}
                  className="sidebar-section-btn flex items-center w-full gap-2 px-3 py-1.5 text-[0.7rem] font-semibold text-gray-500 uppercase tracking-widest hover:text-gray-300 transition-colors"
                >
                  <ChevronDown size={10} className={`transition-transform duration-200 ${(openSections['admin'] ?? true) ? 'rotate-0' : '-rotate-90'}`} />
                  <span>{t('nav.admin_section')}</span>
                </button>
              )}
              <div className={`overflow-hidden transition-all duration-200 ${!isExpanded || (openSections['admin'] ?? true) ? 'max-h-96' : 'max-h-0'}`}>
                <div className={isExpanded ? 'space-y-0.5' : 'flex flex-col items-center gap-1 py-1'}>
                  {adminNavItems.map(renderNavItem)}
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* User */}
        <div className="border-t shrink-0 px-3 py-3" style={{borderColor: 'var(--color-sidebar-divider)'}}>
          {user && (
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 sidebar-user-avatar`} style={{background: 'var(--color-primary-gradient)'}}>
                {userInitial}
              </div>
              {isExpanded && (
                <div className="flex-1 min-w-0 sidebar-user-text">
                  <p className="text-sm font-medium truncate">{user.full_name_en || user.email}</p>
                  <p className="text-[10px] text-gray-500 truncate capitalize">{effectiveRole?.replace(/_/g, ' ')}</p>
                </div>
              )}
              {isExpanded && (
                <button
                  onClick={() => { signOut(); navigate('/login'); }}
                  className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                  title={t('auth.logout')}
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          )}
          {isExpanded && <div className="mt-2 text-[9px] text-gray-600 text-center">v1.2.0</div>}
        </div>
      </aside>
    </>
  );
}
