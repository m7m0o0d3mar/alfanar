import { useState } from 'react';
import { useT } from '../hooks/useTranslation';
import ModulesTab from './designer/ModulesTab';
import StatusesTab from './designer/StatusesTab';
import WorkflowsTab from './designer/WorkflowsTab';
import CustomFieldsTab from './designer/CustomFieldsTab';
import KpisTab from './designer/KpisTab';
import PagesTab from './designer/PagesTab';
import DashboardConfigTab from './designer/DashboardConfigTab';
import MenuTab from './designer/MenuTab';
import FormDefinitionsTab from './designer/FormDefinitionsTab';
import { Grid, CircleDot, GitBranch, PenSquare, BarChart3, Globe, LayoutDashboard, Menu, FileInput } from 'lucide-react';

const TABS = [
  { key: 'modules', icon: Grid, comp: ModulesTab },
  { key: 'statuses', icon: CircleDot, comp: StatusesTab },
  { key: 'workflows', icon: GitBranch, comp: WorkflowsTab },
  { key: 'custom_fields', icon: PenSquare, comp: CustomFieldsTab },
  { key: 'kpis', icon: BarChart3, comp: KpisTab },
  { key: 'pages', icon: Globe, comp: PagesTab },
  { key: 'menu', icon: Menu, comp: MenuTab },
  { key: 'dashboard', icon: LayoutDashboard, comp: DashboardConfigTab },
  { key: 'form_builder', icon: FileInput, comp: FormDefinitionsTab },
];

export default function SystemDesignerPage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState('modules');

  const active = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('designer.title')}</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{t('designer.description')}</p>
      </div>

      <div className="flex gap-2 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: activeTab === tab.key ? 'var(--color-surface)' : 'transparent',
                color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              }}
            >
              <Icon size={16} />
              {t(`designer.${tab.key}`)}
            </button>
          );
        })}
      </div>

      <div className="card">
        <active.comp />
      </div>
    </div>
  );
}
