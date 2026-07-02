import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useTranslation';
import { pageRegistryApi } from '../services/api';
import { loadPageRegistry } from '../hooks/usePageRegistry';
import type { PageRegistryEntry } from '../types';
import Avatar from './Avatar';
import { X, ChevronDown, LogOut, PanelLeftClose, PanelLeft, LayoutDashboard, Building2, Grid3X3, HardHat, ShieldCheck, Users, ShoppingCart, DollarSign, FileText, CheckSquare, FolderOpen, Settings, Wrench, TrendingUp, UserCog, Palette, Terminal, Warehouse, Contact, CalendarRange, Briefcase, Clock, Map, Cog, Globe, BarChart3, TicketCheck, MessageCircle, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, Building2, Grid3X3, HardHat, ShieldCheck, Users,
  ShoppingCart, DollarSign, FileText, CheckSquare, FolderOpen, Settings,
  Wrench, TrendingUp, UserCog, Palette, Terminal, Warehouse, Contact,
  CalendarRange, Briefcase, Clock, Map, Cog, Globe, BarChart3, TicketCheck, MessageCircle, Receipt,
};

function resolveIcon(iconName?: string): LucideIcon {
  if (!iconName) return LayoutDashboard;
  return iconMap[iconName] || LayoutDashboard;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const t = useT();
  const { user, signOut, effectiveRole, canAccessModule } = useAuth();
  const { settings } = useSettings();
  const { language } = useTheme();
  const navigate = useNavigate();
  const isAdmin = effectiveRole === 'admin';
  const [pages, setPages] = useState<PageRegistryEntry[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    loadPageRegistry();
    pageRegistryApi.list(true).then(setPages).catch(() => {/* page registry unavailable */});
  }, []);

  useEffect(() => {
    const sections = [...new Set(pages.map(p => p.section_key).filter(Boolean))];
    const initial: Record<string, boolean> = {};
    sections.forEach(s => { initial[s!] = true; });
    if (isAdmin) initial['admin'] = true;
    setOpenSections(prev => ({ ...initial, ...prev }));
  }, [pages, isAdmin]);

  const isExpanded = !collapsed || hovered;

  function toggleSection(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function pageTitle(page: PageRegistryEntry): string {
    const key = `nav.${page.code}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return language === 'ar' && page.name_ar ? page.name_ar : page.name_en || page.code;
  }

  function renderNavItem(page: PageRegistryEntry) {
    const Icon = resolveIcon(page.icon);
    const title = pageTitle(page);
    return (
      <NavLink
        key={page.code}
        to={page.path}
        end={page.path === '/'}
        onClick={onClose}
        className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
        title={isExpanded ? '' : title}
      >
        <span className="sidebar-icon"><Icon size={18} /></span>
        {isExpanded && <span className="truncate">{title}</span>}
      </NavLink>
    );
  }

  const mainPages = pages.filter(p => !p.is_admin && p.is_enabled && canAccessModule(p.require_module || p.code));
  const adminPages = pages.filter(p => p.is_admin && p.is_enabled && canAccessModule(p.require_module || p.code));
  const sections = [...new Set(mainPages.map(p => p.section_key).filter((s): s is string => !!s))];

  function renderSection(sectionKey: string | undefined) {
    if (!sectionKey) return null;
    const sectionPages = mainPages.filter(p => p.section_key === sectionKey);
    if (sectionPages.length === 0) return null;

    const first = sectionPages[0];
    const label = language === 'ar' && first.section_label_ar ? first.section_label_ar : first.section_label_en || '';
    const isOpen = openSections[sectionKey] ?? true;

    return (
      <div key={sectionKey} className="sidebar-section">
          {isExpanded && label && (
          <button
            onClick={() => toggleSection(sectionKey)}
            className="sidebar-section-btn flex items-center w-full gap-2 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-widest transition-colors"
            style={{ color: 'color-mix(in srgb, var(--color-sidebar-text, #f8fafc) 50%, transparent)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-sidebar-text, #f8fafc)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'color-mix(in srgb, var(--color-sidebar-text, #f8fafc) 50%, transparent)')}
          >
            <ChevronDown size={10} className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
            <span>{label}</span>
          </button>
        )}
        <div className={`overflow-hidden transition-all duration-200 ${!isExpanded || isOpen ? 'max-h-96' : 'max-h-0'}`}>
          <div className={isExpanded ? 'space-y-0.5' : 'flex flex-col items-center gap-1 py-1'}>
            {sectionPages.map(renderNavItem)}
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
        style={{ width: isExpanded ? 'var(--sidebar-width, 16rem)' : '4rem' }}
        className={`
          fixed md:sticky top-0 z-40 h-screen bg-sidebar text-white flex flex-col shrink-0
          transition-all duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${!isExpanded ? 'sidebar-collapsed' : ''}
        `}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b shrink-0" style={{borderColor: 'var(--color-sidebar-divider)'}}>
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden" style={{background: 'var(--color-primary-gradient)'}}>
              {settings.logo_url ? <img src={settings.logo_url} alt="" className="w-full h-full object-contain" /> : settings.app_name ? settings.app_name[0].toUpperCase() : 'E'}
            </div>
            {isExpanded && (
              <div className="min-w-0 sidebar-logo-text">
                <h2 className="text-sm font-semibold truncate tracking-tight">{settings.app_name || 'ERP'}</h2>
                <p className="text-[10px] truncate" style={{ color: 'color-mix(in srgb, var(--color-sidebar-text, #f8fafc) 30%, transparent)' }}>{settings.company_name || ''}</p>
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close sidebar" className="md:hidden p-1 hover:bg-white/5 rounded"><X size={16} /></button>
        </div>

        <button
          onClick={onToggleCollapse}
          aria-label="Toggle sidebar"
          className="hidden md:flex items-center justify-center w-full py-2 hover:bg-white/5 transition-colors shrink-0"
          style={{ color: 'color-mix(in srgb, var(--color-sidebar-text, #f8fafc) 50%, transparent)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-sidebar-text, #f8fafc)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'color-mix(in srgb, var(--color-sidebar-text, #f8fafc) 50%, transparent)')}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>

        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin space-y-0.5">
          {sections.map(renderSection)}

          {isAdmin && adminPages.length > 0 && (
            <div key="admin" className="sidebar-section pt-2" style={{borderTop: isExpanded ? '1px solid var(--color-sidebar-divider)' : 'none', marginTop: '0.25rem'}}>
              {isExpanded && (
                <button
                  onClick={() => toggleSection('admin')}
                  className="sidebar-section-btn flex items-center w-full gap-2 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-widest transition-colors"
                  style={{ color: 'color-mix(in srgb, var(--color-sidebar-text, #f8fafc) 50%, transparent)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-sidebar-text, #f8fafc)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'color-mix(in srgb, var(--color-sidebar-text, #f8fafc) 50%, transparent)')}
                >
                  <ChevronDown size={10} className={`transition-transform duration-200 ${(openSections['admin'] ?? true) ? 'rotate-0' : '-rotate-90'}`} />
                  <span>{t('nav.admin_section')}</span>
                </button>
              )}
              <div className={`overflow-hidden transition-all duration-200 ${!isExpanded || (openSections['admin'] ?? true) ? 'max-h-96' : 'max-h-0'}`}>
                <div className={isExpanded ? 'space-y-0.5' : 'flex flex-col items-center gap-1 py-1'}>
                  {adminPages.map(renderNavItem)}
                </div>
              </div>
            </div>
          )}
        </nav>

        <div className="border-t shrink-0 px-3 py-3 relative" style={{borderColor: 'var(--color-sidebar-divider)'}}>
          <div className="absolute top-0 left-4 right-4 h-px" style={{background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary) 20%, transparent), transparent)'}} />
          {user && (
            <div className="flex items-center gap-3">
              <button onClick={() => { navigate('/profile'); onClose(); }}
                className="shrink-0 sidebar-user-avatar hover:opacity-80 transition-opacity"
                title={t('nav.profile')}>
                <Avatar url={user?.avatar_url} name={user?.full_name_en} email={user?.email} size={32} />
              </button>
              {isExpanded && (
                <button onClick={() => { navigate('/profile'); onClose(); }}
                  className="flex-1 min-w-0 sidebar-user-text text-left hover:opacity-80 transition-opacity">
                  <p className="text-sm font-medium truncate">{user.full_name_en || user.email}</p>
                  <p className="text-[10px] truncate capitalize" style={{ color: 'color-mix(in srgb, var(--color-sidebar-text, #f8fafc) 30%, transparent)' }}>{effectiveRole?.replace(/_/g, ' ')}</p>
                </button>
              )}
              {isExpanded && (
                <button
                  onClick={() => { signOut(); navigate('/login'); }}
                  className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                  style={{ color: 'color-mix(in srgb, var(--color-sidebar-text, #f8fafc) 50%, transparent)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-sidebar-text, #f8fafc)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'color-mix(in srgb, var(--color-sidebar-text, #f8fafc) 50%, transparent)')}
                  title={t('auth.logout')}
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          )}
          {isExpanded && <div className="mt-2 text-[9px] text-center" style={{ color: 'color-mix(in srgb, var(--color-sidebar-text, #f8fafc) 25%, transparent)' }}>v2.0.0</div>}
        </div>
      </aside>
    </>
  );
}
