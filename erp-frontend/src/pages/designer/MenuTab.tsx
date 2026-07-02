import { useState, useEffect, useCallback } from 'react';
import { useT } from '../../hooks/useTranslation';
import { pageRegistryApi } from '../../services/api';
import type { PageRegistryEntry } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ChevronUp, ChevronDown, Eye, EyeOff, Save } from 'lucide-react';

const ICON_OPTIONS = [
  'LayoutDashboard', 'Building2', 'Grid3X3', 'HardHat', 'ShieldCheck', 'Users',
  'ShoppingCart', 'DollarSign', 'FileText', 'CheckSquare', 'FolderOpen',
  'Wrench', 'TrendingUp', 'UserCog', 'Palette', 'Terminal', 'Warehouse', 'Contact',
  'CalendarRange', 'Briefcase', 'Clock', 'Map', 'BarChart3', 'TicketCheck',
  'MessageCircle', 'Receipt', 'Activity', 'History', 'Cog', 'Globe', 'Settings',
  'PenSquare', 'GitBranch', 'CircleDot', 'Grid', 'Table2', 'Code', 'Menu',
];

export default function MenuTab() {
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [pages, setPages] = useState<PageRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await pageRegistryApi.list();
    setPages(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = [...pages].sort((a, b) => a.sort_order - b.sort_order);
  const sections = [...new Set(sorted.map(p => p.section_key).filter((s): s is string => !!s))];

  function moveItem(idx: number, dir: -1 | 1) {
    const s = sorted[idx];
    const target = sorted[idx + dir];
    if (!s || !target) return;
    const tmp = s.sort_order;
    s.sort_order = target.sort_order;
    target.sort_order = tmp;
    setPages([...pages]);
  }

  function toggleEnabled(p: PageRegistryEntry) {
    p.is_enabled = !p.is_enabled;
    setPages([...pages]);
  }

  function updateField(p: PageRegistryEntry, field: string, value: string | number | boolean) {
    (p as any)[field] = value;
    setPages([...pages]);
  }

  async function saveAll() {
    setSaving(true);
    try {
      await Promise.all(pages.map(p => pageRegistryApi.upsert(p)));
      toast.success(t('common.saved'));
    } catch { toast.error(t('common.save_failed')); }
    setSaving(false);
  }

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('designer.menu_desc')}</p>
        {hasPermission('settings', 'edit') && <button className="btn-primary btn-sm" onClick={saveAll} disabled={saving}>
          <Save size={14} /> {saving ? t('common.saving') : t('common.save_all')}
        </button>}
      </div>

      {sections.map(sectionKey => {
        const sectionPages = sorted.filter(p => p.section_key === sectionKey);
        if (sectionPages.length === 0) return null;
        const first = sectionPages[0];
        return (
          <div key={sectionKey}>
            <div className="flex items-center gap-2 py-1.5 px-1 mb-1" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                {t('designer.section')}:
              </span>
              <input className="input text-xs font-medium flex-1 max-w-[160px]" value={first.section_label_en || sectionKey}
                onChange={e => sectionPages.forEach(p => p.section_label_en = e.target.value)} />
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>/</span>
              <input className="input text-xs flex-1 max-w-[160px] rtl-input" value={first.section_label_ar || sectionKey}
                onChange={e => sectionPages.forEach(p => p.section_label_ar = e.target.value)} />
              <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>{sectionKey}</span>
            </div>

            {sectionPages.map((p) => {
              const globalIdx = sorted.indexOf(p);
              const isFirst = globalIdx === 0;
              const isLast = globalIdx === sorted.length - 1;
              return (
                <div key={p.id || p.code}
                  className="flex items-center gap-2 py-2 px-3 rounded-lg transition-colors hover:opacity-90"
                  style={{ backgroundColor: p.is_enabled ? 'color-mix(in srgb, var(--color-card) 50%, transparent)' : 'transparent', borderBottom: '1px solid var(--color-border)', opacity: p.is_enabled ? 1 : 0.6 }}>
                  <div className="flex flex-col gap-0.5">
                    <button className="p-0.5 rounded hover:opacity-70 disabled:opacity-20" disabled={isFirst}
                      onClick={() => moveItem(globalIdx, -1)}><ChevronUp size={12} /></button>
                    <button className="p-0.5 rounded hover:opacity-70 disabled:opacity-20" disabled={isLast}
                      onClick={() => moveItem(globalIdx, 1)}><ChevronDown size={12} /></button>
                  </div>
                  <select className="input text-xs w-[130px]" value={p.icon || 'Globe'}
                    onChange={e => updateField(p, 'icon', e.target.value)}>
                    {ICON_OPTIONS.map(ico => <option key={ico} value={ico}>{ico}</option>)}
                  </select>
                  <input className="input text-xs flex-1 min-w-[80px]" value={p.code}
                    onChange={e => updateField(p, 'code', e.target.value)} />
                  <input className="input text-xs flex-1 min-w-[100px]" value={p.name_en}
                    onChange={e => updateField(p, 'name_en', e.target.value)} placeholder="EN" />
                  <input className="input text-xs flex-1 min-w-[100px] rtl-input" value={p.name_ar || ''}
                    onChange={e => updateField(p, 'name_ar', e.target.value)} placeholder="AR" />
                  <input type="number" className="input text-xs w-16 text-center" value={p.sort_order}
                    onChange={e => updateField(p, 'sort_order', parseInt(e.target.value) || 0)} />
                  <button onClick={() => toggleEnabled(p)}
                    className="p-1 rounded transition-colors flex-shrink-0"
                    style={{ color: p.is_enabled ? '#22c55e' : 'var(--color-text-secondary)' }}>
                    {p.is_enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
