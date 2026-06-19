import { useState, useCallback } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import Breadcrumbs from './Breadcrumbs';

export default function AppLayout() {
  const { user, loading, impersonatedRole, setImpersonatedRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  }, []);

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
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setSidebarOpen(false)} style={{backgroundColor: 'color-mix(in srgb, var(--color-text) 40%, transparent)'}} />
      )}
    </div>
  );
}
