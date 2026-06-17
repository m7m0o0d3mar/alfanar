import { useState } from 'react';
import { useT } from '../hooks/useTranslation';
import ModulesTab from './designer/ModulesTab';
import StatusesTab from './designer/StatusesTab';
import WorkflowsTab from './designer/WorkflowsTab';
import CustomFieldsTab from './designer/CustomFieldsTab';
import KpisTab from './designer/KpisTab';
import { Grid, CircleDot, GitBranch, PenSquare, BarChart3 } from 'lucide-react';

const TABS = [
  { key: 'modules', icon: Grid, comp: ModulesTab },
  { key: 'statuses', icon: CircleDot, comp: StatusesTab },
  { key: 'workflows', icon: GitBranch, comp: WorkflowsTab },
  { key: 'custom_fields', icon: PenSquare, comp: CustomFieldsTab },
  { key: 'kpis', icon: BarChart3, comp: KpisTab },
];

export default function SystemDesignerPage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState('modules');

  const active = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('designer.title')}</h1>
        <p className="text-gray-500 mt-1">{t('designer.description')}</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={16} />
              {t(`designer.${tab.key}` as any)}
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
