import { useState } from 'react';
import { useT } from '../../hooks/useTranslation';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Save, Columns2, Columns3, Eye, EyeOff, GripVertical } from 'lucide-react';

const ALL_WIDGETS = [
  { id: 'recent_activity', titleKey: 'dashboard.widget_recent_activity', default: 'Recent Activity' },
  { id: 'budget_status', titleKey: 'dashboard.widget_budget_status', default: 'Budget Status' },
  { id: 'procurement_spend', titleKey: 'dashboard.widget_procurement_spend', default: 'Procurement Spend' },
  { id: 'ai_insights', titleKey: 'dashboard.widget_ai_insights', default: 'AI Insights' },
  { id: 'quick_actions', titleKey: 'dashboard.widget_quick_actions', default: 'Quick Actions' },
];

export default function DashboardConfigTab() {
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { settings, updateSettings } = useSettings();

  const parseConfig = () => {
    let enabled = ALL_WIDGETS.map(w => w.id);
    let required: string[] = [];
    let layout = settings.dashboard_layout || '2';
    try {
      if (settings.dashboard_widgets) {
        const parsed = JSON.parse(settings.dashboard_widgets);
        if (Array.isArray(parsed)) {
          enabled = parsed;
        } else if (typeof parsed === 'object') {
          if (Array.isArray(parsed.enabled)) enabled = parsed.enabled;
          if (Array.isArray(parsed.required)) required = parsed.required;
          if (parsed.layout) layout = String(parsed.layout);
        }
      }
    } catch { /* ignore parse errors */ }
    return { enabled, required, layout };
  };

  const [config, setConfig] = useState(parseConfig);

  function toggleEnabled(id: string) {
    setConfig(prev => ({
      ...prev,
      enabled: prev.enabled.includes(id)
        ? prev.enabled.filter(e => e !== id)
        : [...prev.enabled, id],
    }));
  }

  function toggleRequired(id: string) {
    setConfig(prev => ({
      ...prev,
      required: prev.required.includes(id)
        ? prev.required.filter(r => r !== id)
        : [...prev.required, id],
    }));
  }

  function moveUp(id: string) {
    setConfig(prev => {
      const idx = prev.enabled.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev.enabled];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return { ...prev, enabled: next };
    });
  }

  function moveDown(id: string) {
    setConfig(prev => {
      const idx = prev.enabled.indexOf(id);
      if (idx < 0 || idx >= prev.enabled.length - 1) return prev;
      const next = [...prev.enabled];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return { ...prev, enabled: next };
    });
  }

  async function save() {
    try {
      const payload = JSON.stringify({ enabled: config.enabled, required: config.required, layout: config.layout });
      await updateSettings({ dashboard_widgets: payload, dashboard_layout: config.layout });
      toast.success(t('common.saved'));
    } catch { toast.error(t('common.save_failed')); }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{t('designer.dashboard_config')}</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('designer.dashboard_config_desc')}</p>
        </div>
        {hasPermission('settings', 'edit') && <button className="btn-primary btn-sm" onClick={save}><Save size={14} /> {t('common.save')}</button>}
      </div>

      <div>
        <label className="label text-sm">{t('designer.dashboard_layout')}</label>
        <div className="flex gap-3 mt-1">
          {['2', '3'].map(cols => (
            <button key={cols} onClick={() => setConfig(prev => ({ ...prev, layout: cols }))}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: config.layout === cols ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'var(--color-card)',
                color: config.layout === cols ? 'var(--color-primary)' : 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}>
              {cols === '2' ? <Columns2 size={16} /> : <Columns3 size={16} />}
              {cols} {t('designer.columns')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="label text-sm">{t('designer.dashboard_widget_order')}</label>
        {config.enabled.map((id, i) => {
          const w = ALL_WIDGETS.find(w => w.id === id);
          if (!w) return null;
          const isRequired = config.required.includes(id);
          return (
            <div key={id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)', border: '1px solid var(--color-border)' }}>
              <GripVertical size={16} style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }} />
              <span className="flex-1 text-sm" style={{ color: 'var(--color-text)' }}>
                {t(w.titleKey) || w.default}
              </span>
              <button onClick={() => moveUp(id)} disabled={i === 0}
                className="btn-sm px-1.5" style={{ opacity: i === 0 ? 0.3 : 1 }}>↑</button>
              <button onClick={() => moveDown(id)} disabled={i >= config.enabled.length - 1}
                className="btn-sm px-1.5" style={{ opacity: i >= config.enabled.length - 1 ? 0.3 : 1 }}>↓</button>
              <button onClick={() => toggleRequired(id)}
                className="btn-sm text-xs"
                style={{ color: isRequired ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                {isRequired ? t('designer.required') : t('designer.optional')}
              </button>
              <button onClick={() => toggleEnabled(id)}
                className="btn-sm p-1"
                style={{ color: 'var(--color-text-secondary)' }}>
                {config.enabled.includes(id) ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          );
        })}
      </div>

      {ALL_WIDGETS.filter(w => !config.enabled.includes(w.id)).length > 0 && (
        <div>
          <label className="label text-sm">{t('designer.disabled_widgets')}</label>
          <div className="flex flex-wrap gap-2">
            {ALL_WIDGETS.filter(w => !config.enabled.includes(w.id)).map(w => (
              <button key={w.id} onClick={() => toggleEnabled(w.id)}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                + {t(w.titleKey) || w.default}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
