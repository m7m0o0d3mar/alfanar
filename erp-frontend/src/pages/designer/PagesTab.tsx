import { useState, useEffect, useCallback } from 'react';
import { useT } from '../../hooks/useTranslation';
import { pageRegistryApi } from '../../services/api';
import type { PageRegistryEntry, PageRegistryConfig } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Plus, Save, Trash2, Copy, Eye, Code, Settings2, Globe, LayoutDashboard, Table2, EyeOff } from 'lucide-react';

const VIEW_OPTIONS = [
  { value: 'crud', label: 'CRUD', icon: Table2 },
  { value: 'table', label: 'Table', icon: LayoutDashboard },
  { value: 'custom', label: 'Custom', icon: Code },
];

const DEFAULT_FORM: PageRegistryEntry = {
  code: '', path: '/', icon: 'Globe', name_en: '', name_ar: '',
  section_key: '', section_label_en: '', section_label_ar: '',
  sort_order: 0, is_enabled: true, is_admin: false,
  config: { view: 'custom' },
};

export default function PagesTab() {
  const t = useT();
  const { hasPermission } = useAuth();
  const [pages, setPages] = useState<PageRegistryEntry[]>([]);
  const [editing, setEditing] = useState<PageRegistryEntry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [configJson, setConfigJson] = useState('');
  const [configError, setConfigError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await pageRegistryApi.list();
    setPages(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = [...pages].sort((a, b) => a.sort_order - b.sort_order);
  const filtered = sorted.filter(p => !search || p.code.toLowerCase().includes(search.toLowerCase()) || p.name_en.toLowerCase().includes(search.toLowerCase()));

  function startEdit(page: PageRegistryEntry) {
    setEditing({ ...page });
    setConfigJson(JSON.stringify(page.config || { view: 'custom' }, null, 2));
    setConfigError('');
    setIsNew(false);
  }

  function startNew() {
    setEditing({ ...DEFAULT_FORM, sort_order: sorted.length * 10 });
    setConfigJson(JSON.stringify(DEFAULT_FORM.config, null, 2));
    setConfigError('');
    setIsNew(true);
  }

  function toggleEnabled(id: string, current: boolean) {
    pageRegistryApi.upsert({ id, is_enabled: !current }).then(load).catch(() => { console.error('Toggle failed'); });
  }

  function updateConfig() {
    try {
      const parsed = JSON.parse(configJson);
      setEditing(prev => prev ? { ...prev, config: parsed } : prev);
      setConfigError('');
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  async function save() {
    if (!editing?.code || !editing?.path || !editing?.name_en) return;
    try {
      updateConfig();
      await pageRegistryApi.upsert(editing);
      setEditing(null); setIsNew(false); load();
    } catch { console.error('Save failed'); }
  }

  async function remove(id: string) {
    try { await pageRegistryApi.remove(id); load(); } catch { console.error('Remove failed'); }
  }

  async function duplicate(page: PageRegistryEntry) {
    const dup: PageRegistryEntry = { ...page, id: undefined, code: page.code + '_copy', name_en: page.name_en + ' (copy)' };
    try { await pageRegistryApi.upsert(dup); load(); } catch { console.error('Duplicate failed'); }
  }

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3 flex-1">
          <input className="input text-sm flex-1 max-w-xs" placeholder={t('common.search') + '...'}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-primary btn-sm" onClick={startNew}>
          <Plus size={14} /> {t('admin.add_page')}
        </button>
      </div>

      {editing && (
        <div className="border rounded-lg p-4 space-y-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Settings2 size={16} style={{ color: 'var(--color-primary)' }} />
            <span className="font-semibold text-sm">{isNew ? t('admin.new_page') : t('admin.edit_page')}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="label text-xs">{t('admin.page_code')} *</label>
              <input className="input text-sm" value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })} disabled={!isNew} /></div>
            <div><label className="label text-xs">{t('admin.page_path')} *</label>
              <input className="input text-sm" value={editing.path} onChange={e => setEditing({ ...editing, path: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.page_icon')}</label>
              <input className="input text-sm" value={editing.icon || ''} onChange={e => setEditing({ ...editing, icon: e.target.value })} placeholder="Lucide icon" /></div>
            <div><label className="label text-xs">{t('admin.page_name_en')} *</label>
              <input className="input text-sm" value={editing.name_en} onChange={e => setEditing({ ...editing, name_en: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.page_name_ar')}</label>
              <input className="input text-sm" value={editing.name_ar || ''} onChange={e => setEditing({ ...editing, name_ar: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.page_parent')}</label>
              <select className="input text-sm" value={editing.parent_code || ''} onChange={e => setEditing({ ...editing, parent_code: e.target.value || undefined })}>
                <option value="">{t('admin.page_no_parent')}</option>
                {sorted.map(p => <option key={p.code} value={p.code}>{p.code}</option>)}
              </select></div>
            <div><label className="label text-xs">{t('admin.page_section_key')}</label>
              <input className="input text-sm" value={editing.section_key || ''} onChange={e => setEditing({ ...editing, section_key: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.page_sort_order')}</label>
              <input type="number" className="input text-sm" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} /></div>
            <div><label className="label text-xs">{t('admin.page_require_module')}</label>
              <input className="input text-sm" value={editing.require_module || ''} onChange={e => setEditing({ ...editing, require_module: e.target.value })} /></div>
            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.is_enabled} onChange={e => setEditing({ ...editing, is_enabled: e.target.checked })} />
                {t('admin.page_enabled')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.is_admin} onChange={e => setEditing({ ...editing, is_admin: e.target.checked })} />
                {t('admin.page_admin')}
              </label>
            </div>
          </div>

          <div className="pt-2">
            <label className="label text-xs flex items-center gap-2">
              <Code size={14} /> {t('admin.page_config')}
            </label>
            <div className="flex gap-2 mb-2">
              {VIEW_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button key={opt.value} onClick={() => {
                    const cfg = { ...(editing.config || {}), view: opt.value as PageRegistryConfig['view'] };
                    setEditing({ ...editing, config: cfg });
                    setConfigJson(JSON.stringify(cfg, null, 2));
                    setConfigError('');
                  }}
                    className="text-xs px-3 py-1.5 rounded flex items-center gap-1.5"
                    style={{ backgroundColor: editing.config?.view === opt.value ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'var(--color-card)', color: editing.config?.view === opt.value ? 'var(--color-primary)' : 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                    <Icon size={12} /> {opt.label}
                  </button>
                );
              })}
            </div>
            <textarea className="input text-sm font-mono w-full" rows={6}
              style={{ minHeight: 120 }}
              value={configJson}
              onChange={e => { setConfigJson(e.target.value); setConfigError(''); }}
              onBlur={updateConfig}
              placeholder='{"view": "table", "entity_type": "table_name", "list_fields": ["id", "name"]}' />
            {configError && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{configError}</p>}
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {t('admin.page_config_hint')}
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button className="btn-secondary btn-sm" onClick={() => { setEditing(null); }}>{t('common.cancel')}</button>
            {hasPermission('settings', 'edit') && <button className="btn-primary btn-sm" onClick={save}><Save size={14} /> {t('common.save')}</button>}
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <th className="text-left py-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.page_code')}</th>
            <th className="text-left py-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.page_name_en')}</th>
            <th className="text-left py-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.page_path')}</th>
            <th className="text-left py-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.page_section_key')}</th>
            <th className="text-center py-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.page_view')}</th>
            <th className="text-center py-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.page_enabled')}</th>
            <th className="text-right py-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(p => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)' }}
              className="hover:opacity-80 transition-opacity">
              <td className="py-2 px-2 font-medium" style={{ color: 'var(--color-text)' }}>{p.code}</td>
              <td className="py-2 px-2" style={{ color: 'var(--color-text)' }}>{p.name_en}</td>
              <td className="py-2 px-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}><code>{p.path}</code></td>
              <td className="py-2 px-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{p.section_key || '-'}</td>
              <td className="py-2 px-2 text-center">
                <span className="text-xs px-2 py-0.5 rounded" style={{
                  backgroundColor: p.config?.view === 'table' ? 'color-mix(in srgb, #3b82f6 20%, transparent)' : 'color-mix(in srgb, #6b7280 15%, transparent)',
                  color: p.config?.view === 'table' ? '#3b82f6' : '#6b7280',
                }}>
                  {p.config?.view || 'custom'}
                </span>
              </td>
              <td className="py-2 px-2 text-center">
                <button onClick={() => p.id && toggleEnabled(p.id, p.is_enabled)}
                  className="p-1 rounded transition-colors"
                  style={{ color: p.is_enabled ? '#22c55e' : 'var(--color-text-secondary)' }}>
                  {p.is_enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </td>
              <td className="py-2 px-2 text-right">
                <div className="flex gap-1 justify-end">
                  <button className="btn-sm" onClick={() => startEdit(p)} title={t('common.edit')}>
                    <Settings2 size={14} />
                  </button>
                  {hasPermission('settings', 'create') && <button className="btn-sm" onClick={() => duplicate(p)} title="Duplicate">
                    <Copy size={14} />
                  </button>}
                  {hasPermission('settings', 'delete') && <button className="btn-sm" onClick={() => p.id && remove(p.id)} title={t('common.delete')}
                    style={{ color: 'var(--color-danger)' }}>
                    <Trash2 size={14} />
                  </button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <Globe size={32} style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }} />
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('common.no_results')}</p>
        </div>
      )}
    </div>
  );
}
