import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useTranslation';
import { usePageTitle } from '../hooks/usePageRegistry';
import Avatar from './Avatar';
import { Search, Globe, LogOut, Sparkles, Settings, Menu, Eye, EyeOff, ArrowLeft, SunMoon } from 'lucide-react';
import NotificationBell from './NotificationBell';
import AiAssistant from './AiAssistant';
import type { UserRole } from '../types';

const ALL_ROLES: { value: UserRole; label: string }[] = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'quality', label: 'Quality' },
  { value: 'hse', label: 'HSE' },
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' },
  { value: 'sales', label: 'Sales' },
  { value: 'client', label: 'Client' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'developer', label: 'Developer' },
  { value: 'main_contractor', label: 'Main Contractor' },
  { value: 'subcontractor', label: 'Subcontractor' },
];

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const t = useT();
  const { user, signOut, impersonatedRole, setImpersonatedRole } = useAuth();
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const { language, setLanguage, theme, toggleTheme, accent, setAccent } = useTheme();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [viewAsOpen, setViewAsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const viewAsRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (viewAsRef.current && !viewAsRef.current.contains(e.target as Node)) {
        setViewAsOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const pageTitle = usePageTitle();
  const location = useLocation();
  const hasBack = location.key !== 'default';

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    const routes: Record<string, string> = {
      dashboard: '/', projects: '/projects', units: '/units', timelines: '/timelines',
      resources: '/resources', execution: '/execution', quality: '/quality', hse: '/hse',
      hr: '/hr', procurement: '/procurement', warehouse: '/warehouse', finance: '/finance',
      sales: '/sales', technical: '/technical', documents: '/documents', approvals: '/approvals',
      crm: '/crm', settings: '/settings',
    };
    const match = Object.entries(routes).find(([key]) =>
      key.includes(q) || (t(`nav.${key}`) || key).toLowerCase().includes(q)
    );
    if (match) {
      navigate(match[1]);
      setSearchQuery('');
      setSearchOpen(false);
    }
  }

  return (
    <header className="h-14 flex items-center justify-between px-3 md:px-5 sticky top-0 z-40 border-b" style={{ backgroundColor: 'var(--color-header-bg, var(--color-surface))', color: 'var(--color-header-text, var(--color-text))', borderColor: 'var(--color-border)', boxShadow: '0 1px 0 color-mix(in srgb, var(--color-primary) 4%, transparent)' }}>
      <div className="flex items-center gap-2">
        <button onClick={onMenuClick} className="md:hidden p-2 rounded-lg hover:bg-white/5" style={{color: 'var(--color-text-secondary)'}}>
          <Menu size={18} />
        </button>
        {hasBack && (
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/5" style={{color: 'var(--color-text-secondary)'}} title="Back">
            <ArrowLeft size={16} />
          </button>
        )}
        {pageTitle && (
          <span className="hidden md:block text-sm font-semibold ml-2 truncate max-w-[200px]" style={{color: 'var(--color-text)'}}>
            {pageTitle}
          </span>
        )}
        <form onSubmit={handleSearch} className="relative hidden sm:block group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-primary" style={{color: 'var(--color-text-muted)'}} />
          <input
            type="text"
            placeholder={t('common.search') + '...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="transition-all duration-200"
            style={{ width: '240px', paddingLeft: '2.25rem', paddingTop: '0.375rem', paddingBottom: '0.375rem', fontSize: '0.8125rem', borderRadius: '9999px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', outline: 'none' }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px var(--color-primary-light)'; e.target.style.width = '300px'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; e.target.style.width = '240px'; }}
          />
        </form>
        <button onClick={() => setSearchOpen(!searchOpen)} className="sm:hidden p-2 rounded-lg hover:bg-white/5" style={{color: 'var(--color-text-secondary)'}}>
          <Search size={16} />
        </button>
      </div>

      {searchOpen && (
        <div className="absolute top-14 left-0 right-0 p-3 z-50 sm:hidden" style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
          <form onSubmit={handleSearch}>
            <input
              type="text"
              placeholder={t('common.search') + '...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '0.5rem 1rem', borderRadius: '9999px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', outline: 'none', fontSize: '0.875rem' }}
            />
          </form>
        </div>
      )}

      <div className="flex items-center gap-1">
        <button
          className="p-2 rounded-full hover:bg-white/5 transition-colors relative"
          style={{color: 'var(--color-text-secondary)'}}
          title="AI Assistant"
          onClick={() => setShowAiAssistant(true)}
        >
          <Sparkles size={16} style={{color: 'var(--color-primary)'}} />
        </button>

        <NotificationBell />

        <button
          onClick={() => {
            setLanguage(language === 'ar' ? 'en' : 'ar');
            const btn = document.getElementById('lang-toggle');
            if (btn) { btn.style.transform = 'rotate(360deg)'; setTimeout(() => { btn.style.transform = ''; }, 300); }
          }}
          id="lang-toggle"
          className="p-2 rounded-full hover:bg-white/5 transition-all duration-300 text-xs font-semibold"
          style={{color: 'var(--color-text-secondary)'}}
          title={language === 'ar' ? 'English' : 'العربية'}
        >
          <Globe size={14} className="transition-transform duration-300" />
          <span className="ml-1 hidden md:inline">{language === 'ar' ? 'EN' : 'AR'}</span>
        </button>

        <div className="relative" ref={themeRef}>
          <button
            onClick={() => setThemeOpen(!themeOpen)}
            className="p-2 rounded-full hover:bg-white/5 transition-all duration-200"
            style={{
              color: 'var(--color-text-secondary)',
              backgroundColor: themeOpen ? 'var(--color-primary-light)' : 'transparent',
            }}
            title="Theme & Accent"
          >
            <SunMoon size={15} />
          </button>

          {themeOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-52 rounded-xl shadow-lg border py-2 z-50"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="px-3 pb-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                  {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
                </span>
                <button
                  onClick={toggleTheme}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: '2.2rem', height: '1.25rem', borderRadius: '9999px', position: 'relative',
                    backgroundColor: theme === 'dark' ? 'var(--color-primary)' : 'var(--color-border)',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  <span style={{
                    width: '0.875rem', height: '0.875rem', borderRadius: '50%', backgroundColor: '#fff',
                    position: 'absolute', top: '0.1875rem', transition: 'left 0.2s',
                    left: theme === 'dark' ? 'calc(100% - 1.0625rem)' : '0.1875rem',
                  }} />
                </button>
              </div>
              <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Accent Color
              </p>
              <div className="flex items-center gap-2.5 px-3 pb-1">
                {(['purple', 'blue', 'emerald', 'amber', 'rose'] as const).map(a => (
                  <button
                    key={a}
                    onClick={() => { setAccent(a); setThemeOpen(false); }}
                    className="rounded-full transition-all duration-200 flex items-center justify-center"
                    style={{
                      width: '1.75rem', height: '1.75rem',
                      backgroundColor: a === 'purple' ? '#a855f7' : a === 'blue' ? '#3b82f6' : a === 'emerald' ? '#10b981' : a === 'amber' ? '#f59e0b' : '#f43f5e',
                      boxShadow: accent === a ? '0 0 0 2px var(--color-surface), 0 0 0 3.5px ' + (a === 'purple' ? '#a855f7' : a === 'blue' ? '#3b82f6' : a === 'emerald' ? '#10b981' : a === 'amber' ? '#f59e0b' : '#f43f5e') : 'none',
                      transform: accent === a ? 'scale(1.15)' : 'scale(1)',
                    }}
                    title={a.charAt(0).toUpperCase() + a.slice(1)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {user?.role === 'admin' && (
          <div className="relative" ref={viewAsRef}>
            <button
              onClick={() => setViewAsOpen(!viewAsOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: impersonatedRole ? 'var(--color-warning-bg, rgba(251, 191, 36, 0.15))' : 'transparent',
                color: impersonatedRole ? 'var(--color-warning, #f59e0b)' : 'var(--color-text-secondary)',
                border: '1px solid',
                borderColor: impersonatedRole ? 'var(--color-warning, #f59e0b)' : 'var(--color-border)',
              }}
            >
              {impersonatedRole ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{impersonatedRole ? impersonatedRole.replace(/_/g, ' ') : 'View As'}</span>
            </button>

            {viewAsOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-48 rounded-xl shadow-lg border py-1 z-50 max-h-72 overflow-y-auto"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              >
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{color: 'var(--color-text-muted)'}}>
                  View As
                </div>
                {ALL_ROLES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => { setImpersonatedRole(r.value); setViewAsOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/5 transition-colors"
                    style={{
                      color: impersonatedRole === r.value ? 'var(--color-primary)' : 'var(--color-text)',
                      fontWeight: impersonatedRole === r.value ? 600 : 400,
                    }}
                  >
                    {r.label}
                  </button>
                ))}
                {impersonatedRole && (
                  <>
                    <div className="my-1 border-t" style={{ borderColor: 'var(--color-border)' }} />
                    <button
                      onClick={() => { setImpersonatedRole(null); setViewAsOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium hover:bg-white/5 transition-colors"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      <EyeOff size={14} />
                      Exit View As
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 ml-1 p-1 rounded-full hover:bg-white/5 transition-colors"
          >
            <Avatar url={user?.avatar_url} name={user?.full_name_en} email={user?.email} size={28} />
            <span className="text-sm font-medium hidden md:block" style={{color: 'var(--color-text)'}}>
              {user?.full_name_en || user?.email}
            </span>
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-52 rounded-xl shadow-lg border py-1 z-50"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-sm font-medium" style={{color: 'var(--color-text)'}}>
                  {user?.full_name_en || user?.email}
                </p>
                <p className="text-xs" style={{color: 'var(--color-text-secondary)'}}>{user?.role?.replace(/_/g, ' ')}</p>
              </div>
              <button
                onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                style={{color: 'var(--color-text-secondary)'}}
              >
                <Settings size={14} />
                {t('nav.profile')}
              </button>
              <button
                onClick={async () => { setDropdownOpen(false); await signOut(); navigate('/login'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                style={{color: 'var(--color-danger)'}}
              >
                <LogOut size={14} />
                {t('auth.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
      <AiAssistant open={showAiAssistant} onClose={() => setShowAiAssistant(false)} />
    </header>
  );
}
