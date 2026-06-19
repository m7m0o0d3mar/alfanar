import { useState, useEffect } from 'react';
import { statusesApi, modulesApi } from '../../services/api';
import type { StatusDefinition, Module } from '../../types';
import { useT } from '../../hooks/useTranslation';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function StatusesTab() {
  const t = useT();
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<Partial<StatusDefinition>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    modulesApi.list().then(setModules);
  }, []);

  useEffect(() => {
    if (!selectedModule) return;
    statusesApi.list(selectedModule).then(setStatuses);
  }, [selectedModule]);

  async function save() {
    await statusesApi.upsert({ ...edit, module_code: selectedModule });
    setShowForm(false);
    setEdit({});
    const list = await statusesApi.list(selectedModule);
    setStatuses(list);
  }

  async function remove(id: string) {
    setDeleteId(id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('designer.statuses')}</h3>
        <div className="flex gap-2">
          <select className="input w-auto" value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}>
            <option value="">-- Select Module --</option>
            {modules.map((m) => (
              <option key={m.code} value={m.code}>{m.name_en} ({m.code})</option>
            ))}
          </select>
          {selectedModule && (
            <button className="btn-primary btn-sm" onClick={() => { setEdit({}); setShowForm(true); }}>
              <Plus size={16} /> {t('designer.add_status')}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="card border-2 border-primary/20">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="label">{t('designer.code')}</label>
              <input className="input" value={edit.status_code || ''}
                onChange={(e) => setEdit({ ...edit, status_code: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('designer.name_en')}</label>
              <input className="input" value={edit.label_en || ''}
                onChange={(e) => setEdit({ ...edit, label_en: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('designer.name_ar')}</label>
              <input className="input text-right" dir="rtl" value={edit.label_ar || ''}
                onChange={(e) => setEdit({ ...edit, label_ar: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('designer.color')}</label>
              <input type="color" className="input h-10 p-1" value={edit.color || '#6b7280'}
                onChange={(e) => setEdit({ ...edit, color: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('designer.order')}</label>
              <input type="number" className="input" value={edit.order || 0}
                onChange={(e) => setEdit({ ...edit, order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_default || false}
                onChange={(e) => setEdit({ ...edit, is_default: e.target.checked })} />
              {t('designer.is_default')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_final || false}
                onChange={(e) => setEdit({ ...edit, is_final: e.target.checked })} />
              {t('designer.is_final')}
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary btn-sm" onClick={save}>{t('common.save')}</button>
            <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>{t('designer.name_en')}</th>
              <th>{t('designer.name_ar')}</th>
              <th>{t('designer.color')}</th>
              <th>{t('designer.order')}</th>
              <th>{t('designer.is_default')}</th>
              <th>{t('designer.is_final')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!selectedModule ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Select a module above</td></tr>
            ) : statuses.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.status_code}</td>
                <td>{s.label_en}</td>
                <td>{s.label_ar}</td>
                <td>
                  <span className="inline-block w-5 h-5 rounded" style={{ backgroundColor: s.color }} />
                </td>
                <td>{s.order}</td>
                <td>{s.is_default ? '✓' : '-'}</td>
                <td>{s.is_final ? '✓' : '-'}</td>
                <td className="flex gap-1">
                  <button className="btn-sm btn-secondary" onClick={() => { setEdit(s); setShowForm(true); }}>
                    <Edit3 size={14} />
                  </button>
                  <button className="btn-sm btn-danger" onClick={() => remove(s.id)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {deleteId && (
        <ConfirmDialog
          title="Delete Status"
          message="Delete this status?"
          confirmLabel="Delete"
          variant="danger"
          onConfirm={async () => {
            await statusesApi.remove(deleteId);
            setStatuses((s) => s.filter((x) => x.id !== deleteId));
            setDeleteId(null);
          }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
