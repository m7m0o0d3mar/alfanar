import { useState, useEffect } from 'react';
import { modulesApi } from '../../services/api';
import type { Module } from '../../types';
import { useT } from '../../hooks/useTranslation';
import { useAuth } from '../../context/AuthContext';
import { Plus, ToggleLeft, ToggleRight, Edit3, Grid } from 'lucide-react';

export default function ModulesTab() {
  const t = useT();
  const { hasPermission } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<Partial<Module>>({});

  useEffect(() => { loadModules(); }, []);

  async function loadModules() {
    setLoading(true);
    const data = await modulesApi.list();
    setModules(data);
    setLoading(false);
  }

  async function toggle(m: Module) {
    try {
      await modulesApi.toggle(m.id, !m.is_enabled);
      await loadModules();
    } catch (err: unknown) { console.error('Failed to toggle module:', err); }
  }

  async function save() {
    try {
      await modulesApi.upsert(edit);
      setShowForm(false);
      setEdit({});
      await loadModules();
    } catch (err: unknown) { console.error('Failed to save module:', err); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('designer.modules')}</h3>
        {hasPermission('settings', 'create') && (
          <button className="btn-primary btn-sm" onClick={() => { setEdit({}); setShowForm(true); }}>
            <Plus size={16} /> {t('designer.add_module')}
          </button>
        )}
      </div>

      {showForm && (
        <div className="card border-2 border-primary/20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">{t('designer.code')}</label>
              <input className="input" value={edit.code || ''}
                onChange={(e) => setEdit({ ...edit, code: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('designer.name_en')}</label>
              <input className="input" value={edit.name_en || ''}
                onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('designer.name_ar')}</label>
              <input className="input text-right" dir="rtl" value={edit.name_ar || ''}
                onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('designer.icon')}</label>
              <input className="input" value={edit.icon || ''}
                onChange={(e) => setEdit({ ...edit, icon: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('designer.order')}</label>
              <input type="number" className="input" value={edit.order || 0}
                onChange={(e) => setEdit({ ...edit, order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            {hasPermission('settings', 'edit') && <button className="btn-primary btn-sm" onClick={save}>{t('common.save')}</button>}
            <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('designer.code')}</th>
              <th>{t('designer.name_en')}</th>
              <th>{t('designer.name_ar')}</th>
              <th>{t('designer.icon')}</th>
              <th>{t('designer.order')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</td></tr>
            ) : modules.map((m) => (
              <tr key={m.id}>
                <td className="font-mono text-xs">{m.code}</td>
                <td className="font-medium">{m.name_en}</td>
                <td>{m.name_ar}</td>
                <td><Grid size={16} style={{ color: 'var(--color-text-muted)' }} /></td>
                <td>{m.order}</td>
                <td>
                  <button onClick={() => toggle(m)} title="Toggle">
                    {m.is_enabled
                      ? <ToggleRight size={20} className="text-success" />
                      : <ToggleLeft size={20} className="text-gray-300" />}
                  </button>
                </td>
                <td>
                  <button className="btn-sm btn-secondary" onClick={() => { setEdit(m); setShowForm(true); }}>
                    <Edit3 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
