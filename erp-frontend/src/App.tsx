import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { pageRegistryApi } from './services/api';
import AppLayout from './components/AppLayout';
import { useT, syncTranslationOverrides } from './hooks/useTranslation';
import { useSettings } from './context/SettingsContext';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';

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
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
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
const StatusTemplatesPage = lazy(() => import('./pages/StatusTemplatesPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ProjectAnalyticsPage = lazy(() => import('./pages/ProjectAnalyticsPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const PortalPage = lazy(() => import('./pages/PortalPage'));
const FieldServicePage = lazy(() => import('./pages/FieldServicePage'));
const WhatsAppPage = lazy(() => import('./pages/WhatsAppPage'));
const ZatcaPage = lazy(() => import('./pages/ZatcaPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const SystemHealthPage = lazy(() => import('./pages/SystemHealthPage'));
const BackupExportPage = lazy(() => import('./pages/BackupExportPage'));
const TableBrowserPage = lazy(() => import('./pages/TableBrowserPage'));
const FlowDiagramPage = lazy(() => import('./pages/FlowDiagramPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const NotificationPage = lazy(() => import('./pages/NotificationPage'));
const MeetingPage = lazy(() => import('./pages/MeetingPage'));
const DailyReportsPage = lazy(() => import('./pages/DailyReportsPage'));
const EmailPage = lazy(() => import('./pages/EmailPage'));
const CommunicationPage = lazy(() => import('./pages/CommunicationPage'));
const CostManagementPage = lazy(() => import('./pages/CostManagementPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ContractsPage = lazy(() => import('./pages/ContractsPage'));
const SupplyChainPage = lazy(() => import('./pages/SupplyChainPage'));
const DynamicPage = lazy(() => import('./pages/DynamicPage'));
const FormPage = lazy(() => import('./pages/FormPage'));
const PublicPropertiesPage = lazy(() => import('./pages/PublicPropertiesPage'));
const PublicPropertyDetailPage = lazy(() => import('./pages/PublicPropertyDetailPage'));

function LazyPage({ Component }: { Component: React.LazyExoticComponent<React.ComponentType> }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8" style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} /></div>}>
      <Component />
    </Suspense>
  );
}

function RequirePageAccess() {
  const { canAccessModule, effectiveRole } = useAuth();
  const location = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    pageRegistryApi.list(true).then(pages => {
      const page = pages.find(p => {
        const pathPattern = p.path.replace(/:\w+/g, '[^/]+');
        return location.pathname.match(new RegExp(`^${pathPattern}$`));
      });
      if (!page) {
        setAllowed(true);
        return;
      }
      if (page.is_admin && effectiveRole !== 'admin') {
        setAllowed(false);
        return;
      }
      if (page.require_module) {
        setAllowed(canAccessModule(page.require_module));
        return;
      }
      setAllowed(true);
    }).catch(() => setAllowed(true));
  }, [location.pathname, effectiveRole, canAccessModule]);

  if (allowed === null) {
    return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8" style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} /></div>;
  }

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default function App() {
  const { user, loading, effectiveRole } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();
  const t = useT();

  useEffect(() => {
    if (user?.id) syncTranslationOverrides(user.id);
  }, [user?.id]);

  if (loading || settingsLoading) {
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
        <Route path="/public-properties" element={<LazyPage Component={PublicPropertiesPage} />} />
        <Route path="/public-properties/:id" element={<LazyPage Component={PublicPropertyDetailPage} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (settings.maintenance_mode && effectiveRole !== 'admin') {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center px-4" style={{ background: 'var(--color-bg)' }}>
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6" style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning) 20%, transparent)' }}>
          <svg className="w-10 h-10" style={{ color: 'var(--color-warning)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>{settings.app_name || 'ERP'}</h1>
        <p className="text-lg mb-1" style={{ color: 'var(--color-text)' }}>{t('common.maintenance_title')}</p>
        <p className="text-sm max-w-md" style={{ color: 'var(--color-text-secondary)' }}>{t('common.maintenance_message')}</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppLayout />}>
        <Route element={<RequirePageAccess />}>
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
        <Route path="/contracts" element={<LazyPage Component={ContractsPage} />} />
        <Route path="/supply-chain" element={<LazyPage Component={SupplyChainPage} />} />
        <Route path="/approvals" element={<LazyPage Component={ApprovalsPage} />} />
        <Route path="/crm" element={<LazyPage Component={CRMPage} />} />
        <Route path="/analytics" element={<LazyPage Component={AnalyticsPage} />} />
        <Route path="/project-analytics" element={<LazyPage Component={ProjectAnalyticsPage} />} />
        <Route path="/support" element={<LazyPage Component={SupportPage} />} />
        <Route path="/portal" element={<LazyPage Component={PortalPage} />} />
        <Route path="/field-service" element={<LazyPage Component={FieldServicePage} />} />
        <Route path="/daily-reports" element={<LazyPage Component={DailyReportsPage} />} />
          <Route path="/communication" element={<LazyPage Component={CommunicationPage} />} />
          <Route path="/chat" element={<LazyPage Component={ChatPage} />} />
          <Route path="/notifications" element={<LazyPage Component={NotificationPage} />} />
          <Route path="/meetings" element={<LazyPage Component={MeetingPage} />} />
          <Route path="/email" element={<LazyPage Component={EmailPage} />} />
          <Route path="/whatsapp" element={<LazyPage Component={WhatsAppPage} />} />
          <Route path="/cost" element={<LazyPage Component={CostManagementPage} />} />
          <Route path="/reports" element={<LazyPage Component={ReportsPage} />} />
        <Route path="/zatca" element={<LazyPage Component={ZatcaPage} />} />
        <Route path="/timelines" element={<LazyPage Component={TimelinePage} />} />
        <Route path="/resources" element={<LazyPage Component={ResourcesPage} />} />
        <Route path="/attendance" element={<LazyPage Component={AttendancePage} />} />
        <Route path="/maps" element={<LazyPage Component={MapsPage} />} />
        <Route path="/status-templates" element={<LazyPage Component={StatusTemplatesPage} />} />
        <Route path="/settings" element={<LazyPage Component={SystemDesignerPage} />} />
        <Route path="/profile" element={<LazyPage Component={ProfilePage} />} />
        <Route path="/admin" element={<LazyPage Component={AdminDashboardPage} />} />
        <Route path="/admin/users" element={<LazyPage Component={UsersPage} />} />
        <Route path="/admin/roles" element={<LazyPage Component={RolesPage} />} />
        <Route path="/admin/branding" element={<LazyPage Component={BrandingPage} />} />
        <Route path="/admin/settings" element={<LazyPage Component={AdminSettingsPage} />} />
        <Route path="/admin/sql" element={<LazyPage Component={SqlEditorPage} />} />
        <Route path="/admin/audit-log" element={<LazyPage Component={AuditLogPage} />} />
        <Route path="/admin/health" element={<LazyPage Component={SystemHealthPage} />} />
        <Route path="/admin/backup-export" element={<LazyPage Component={BackupExportPage} />} />
        <Route path="/admin/table-browser" element={<LazyPage Component={TableBrowserPage} />} />
        <Route path="/admin/flow-diagram" element={<LazyPage Component={FlowDiagramPage} />} />
        <Route path="/admin/docs" element={<LazyPage Component={DocsPage} />} />
        <Route path="/public-properties" element={<LazyPage Component={PublicPropertiesPage} />} />
        <Route path="/public-properties/:id" element={<LazyPage Component={PublicPropertyDetailPage} />} />
        <Route path="*" element={<LazyPage Component={DynamicPage} />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
