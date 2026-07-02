import { useState, useCallback, useEffect, useRef } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import Breadcrumbs from './Breadcrumbs';
import MobileNav from './MobileNav';
import MobileMoreMenu from './MobileMoreMenu';
import InstallPrompt from './InstallPrompt';
import PageTransition from './PageTransition';
import { useTheme } from '../context/ThemeContext';

export default function AppLayout() {
  const { user, loading, impersonatedRole, setImpersonatedRole } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const effectiveRole = impersonatedRole || user?.role || null;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; }
    catch { return false; }
  });
  const prevPath = useRef(location.pathname);

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('sidebar_collapsed', String(next)); } catch { /* localStorage blocked */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const meta = document.getElementById('theme-color-meta');
    if (meta) {
      const bgColor = theme === 'dark' ? '#0f172a' : 'var(--color-primary)';
      meta.setAttribute('content', bgColor);
    }
  }, [theme]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{backgroundColor: 'var(--color-bg)'}}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{borderColor: 'var(--color-primary)'}} />
          <p className="mt-4" style={{color: 'var(--color-text-secondary)'}}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const isAdminRoute = location.pathname.startsWith('/admin/');
  if (isAdminRoute && effectiveRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen" style={{backgroundColor: 'var(--color-bg)'}}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-200">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        {impersonatedRole && (
          <div
            className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
            style={{ backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#d97706', borderBottom: '1px solid rgba(251, 191, 36, 0.25)' }}
          >
            <span>👁 Viewing as {impersonatedRole.replace(/_/g, ' ')}</span>
            <button
              onClick={() => setImpersonatedRole(null)}
              className="underline hover:no-underline ml-1"
            >
              Exit
            </button>
          </div>
        )}
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
          <Breadcrumbs />
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setSidebarOpen(false)} style={{backgroundColor: 'color-mix(in srgb, var(--color-text) 40%, transparent)'}} />
      )}
      <MobileNav onMoreOpen={() => setMobileMoreOpen(prev => !prev)} isMoreOpen={mobileMoreOpen} />
      <MobileMoreMenu open={mobileMoreOpen} onClose={() => setMobileMoreOpen(false)} />
      <InstallPrompt />
    </div>
  );
}
