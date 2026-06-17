import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';

import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';

const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'));
const SystemDesignerPage = lazy(() => import('./pages/SystemDesignerPage'));
const QualityPage = lazy(() => import('./pages/QualityPage'));
const HSEPage = lazy(() => import('./pages/HSEPage'));
const HRPage = lazy(() => import('./pages/HRPage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const TechnicalPage = lazy(() => import('./pages/TechnicalPage'));
const TechnicalTicketDetailPage = lazy(() => import('./pages/TechnicalTicketDetailPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const BrandingPage = lazy(() => import('./pages/BrandingPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const SqlEditorPage = lazy(() => import('./pages/SqlEditorPage'));
const UnitsPage = lazy(() => import('./pages/UnitsPage'));
const UnitDetailPage = lazy(() => import('./pages/UnitDetailPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const WIRDetailPage = lazy(() => import('./pages/WIRDetailPage'));
const TaskDetailPage = lazy(() => import('./pages/TaskDetailPage'));
const EmployeeDetailPage = lazy(() => import('./pages/EmployeeDetailPage'));
const ExecutionPage = lazy(() => import('./pages/ExecutionPage'));
const ProcurementPage = lazy(() => import('./pages/ProcurementPage'));
const WarehousePage = lazy(() => import('./pages/WarehousePage'));
const CRMPage = lazy(() => import('./pages/CRMPage'));
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const MapsPage = lazy(() => import('./pages/MapsPage'));

function LazyPage({ Component }: { Component: React.LazyExoticComponent<React.ComponentType> }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8" style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} /></div>}>
      <Component />
    </Suspense>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="animate-spin rounded-full h-10 w-10" style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<LazyPage Component={ProjectDetailPage} />} />
        <Route path="/units" element={<LazyPage Component={UnitsPage} />} />
        <Route path="/units/:id" element={<LazyPage Component={UnitDetailPage} />} />
        <Route path="/execution" element={<LazyPage Component={ExecutionPage} />} />
        <Route path="/execution/wir/:id" element={<LazyPage Component={WIRDetailPage} />} />
        <Route path="/execution/tasks/:id" element={<LazyPage Component={TaskDetailPage} />} />
        <Route path="/quality" element={<LazyPage Component={QualityPage} />} />
        <Route path="/hse" element={<LazyPage Component={HSEPage} />} />
        <Route path="/hr" element={<LazyPage Component={HRPage} />} />
        <Route path="/hr/employees/:id" element={<LazyPage Component={EmployeeDetailPage} />} />
        <Route path="/procurement" element={<LazyPage Component={ProcurementPage} />} />
        <Route path="/finance" element={<LazyPage Component={FinancePage} />} />
        <Route path="/sales" element={<LazyPage Component={SalesPage} />} />
        <Route path="/technical" element={<LazyPage Component={TechnicalPage} />} />
        <Route path="/technical/tickets/:id" element={<LazyPage Component={TechnicalTicketDetailPage} />} />
        <Route path="/documents" element={<LazyPage Component={DocumentsPage} />} />
        <Route path="/warehouse" element={<LazyPage Component={WarehousePage} />} />
        <Route path="/approvals" element={<LazyPage Component={ApprovalsPage} />} />
        <Route path="/crm" element={<LazyPage Component={CRMPage} />} />
        <Route path="/timelines" element={<LazyPage Component={TimelinePage} />} />
        <Route path="/resources" element={<LazyPage Component={ResourcesPage} />} />
        <Route path="/attendance" element={<LazyPage Component={AttendancePage} />} />
        <Route path="/maps" element={<LazyPage Component={MapsPage} />} />
        <Route path="/settings" element={<LazyPage Component={SystemDesignerPage} />} />
        <Route path="/admin/users" element={<LazyPage Component={UsersPage} />} />
        <Route path="/admin/roles" element={<LazyPage Component={RolesPage} />} />
        <Route path="/admin/branding" element={<LazyPage Component={BrandingPage} />} />
        <Route path="/admin/settings" element={<LazyPage Component={AdminSettingsPage} />} />
        <Route path="/admin/sql" element={<LazyPage Component={SqlEditorPage} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
