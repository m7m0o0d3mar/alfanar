import { useState, useEffect } from 'react';
import { customFieldsApi, modulesApi } from '../../services/api';
import type { CustomField, Module } from '../../types';
import { useT } from '../../hooks/useTranslation';
import { useAuth } from '../../context/AuthContext';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';

const FIELD_TYPES = ['text', 'number', 'date', 'enum', 'lookup', 'boolean', 'textarea', 'json'];

export default function CustomFieldsTab() {
  const t = useT();
  const { hasPermission } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [fields, setFields] = useState<CustomField[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<Partial<CustomField>>({ field_type: 'text' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { modulesApi.list().then(setModules); }, []);

  useEffect(() => {
    if (!selectedModule) return;
    customFieldsApi.list(selectedModule).then(setFields);
  }, [selectedModule]);

  async function save() {
    try {
      await customFieldsApi.upsert({ ...edit, module_code: selectedModule });
      setShowForm(false);
      setEdit({ field_type: 'text' });
      setFields(await customFieldsApi.list(selectedModule));
    } catch (err: unknown) { console.error('Failed to save custom field:', err); }
  }

  async function remove(id: string) {
    setDeleteId(id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('designer.custom_fields')}</h3>
        <div className="flex gap-2">
          <select className="input w-auto" value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}>
            <option value="">{t('designer.select_module')}</option>
            {modules.map((m) => (
              <option key={m.code} value={m.code}>{m.name_en}</option>
            ))}
          </select>
          {selectedModule && hasPermission('settings', 'create') && (
            <button className="btn-primary btn-sm" onClick={() => { setEdit({ field_type: 'text' }); setShowForm(true); }}>
              <Plus size={16} /> {t('designer.add_field')}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="card border-2 border-primary/20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">{t('designer.code')}</label>
              <input className="input" value={edit.name || ''}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
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
              <label className="label">{t('designer.field_type')}</label>
              <select className="input" value={edit.field_type}
                onChange={(e) => setEdit({ ...edit, field_type: e.target.value as CustomField['field_type'] })}>
                {FIELD_TYPES.map((ft) => (
                  <option key={ft} value={ft}>{ft}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('designer.order')}</label>
              <input type="number" className="input" value={edit.order || 0}
                onChange={(e) => setEdit({ ...edit, order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_required || false}
                onChange={(e) => setEdit({ ...edit, is_required: e.target.checked })} />
              {t('designer.is_required')}
            </label>
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
              <th>{t('designer.field_type')}</th>
              <th>{t('designer.is_required')}</th>
              <th>{t('designer.order')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!selectedModule ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('designer.select_module')}</td></tr>
            ) : fields.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('common.no_data')}</td></tr>
            ) : fields.map((f) => (
              <tr key={f.id}>
                <td className="font-mono text-xs">{f.name}</td>
                <td>{f.label_en}</td>
                <td>{f.label_ar}</td>
                <td><span className="badge" style={{ backgroundColor: 'color-mix(in srgb, #8b5cf6 15%, transparent)', color: '#8b5cf6' }}>{f.field_type}</span></td>
                <td>{f.is_required ? '✓' : '-'}</td>
                <td>{f.order}</td>
                <td className="flex gap-1">
                  <button className="btn-sm btn-secondary" onClick={() => { setEdit(f); setShowForm(true); }}>
                    <Edit3 size={14} />
                  </button>
                  {hasPermission('settings', 'delete') && (
                  <button className="btn-sm btn-danger" onClick={() => remove(f.id)}>
                    <Trash2 size={14} />
                  </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {deleteId && (
        <ConfirmDialog
          title={t('designer.delete_field')}
          message={t('designer.delete_field_msg')}
          confirmLabel={t('common.delete')}
          variant="danger"
          onConfirm={async () => {
            await customFieldsApi.remove(deleteId);
            setFields((f) => f.filter((x) => x.id !== deleteId));
            setDeleteId(null);
          }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
