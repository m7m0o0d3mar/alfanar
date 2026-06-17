import { useState, useEffect } from 'react';
import { kpiApi, modulesApi } from '../../services/api';
import type { KpiDefinition, Module } from '../../types';
import { useT } from '../../hooks/useTranslation';
import { Plus, Edit3, Trash2, BarChart3 } from 'lucide-react';

const FORMULA_TYPES = ['count', 'sum', 'ratio', 'avg_duration', 'custom'];

export default function KpisTab() {
  const t = useT();
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<Partial<KpiDefinition>>({});

  useEffect(() => { modulesApi.list().then(setModules); }, []);

  useEffect(() => {
    if (!selectedModule) return;
    kpiApi.list(selectedModule).then(setKpis);
  }, [selectedModule]);

  async function save() {
    await kpiApi.upsert({ ...edit, module_code: selectedModule });
    setShowForm(false);
    setEdit({});
    setKpis(await kpiApi.list(selectedModule));
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this KPI?')) return;
    await kpiApi.remove(id);
    setKpis((k) => k.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('designer.kpis')}</h3>
        <div className="flex gap-2">
          <select className="input w-auto" value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}>
            <option value="">-- Select Module --</option>
            {modules.map((m) => (
              <option key={m.code} value={m.code}>{m.name_en}</option>
            ))}
          </select>
          {selectedModule && (
            <button className="btn-primary btn-sm" onClick={() => { setEdit({}); setShowForm(true); }}>
              <Plus size={16} /> {t('designer.add_kpi')}
            </button>
          )}
        </div>
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
              <label className="label">{t('designer.formula_type')}</label>
              <select className="input" value={edit.formula_type}
                onChange={(e) => setEdit({ ...edit, formula_type: e.target.value as KpiDefinition['formula_type'] })}>
                {FORMULA_TYPES.map((ft) => (
                  <option key={ft} value={ft}>{ft}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('designer.unit')}</label>
              <input className="input" value={edit.unit || ''}
                onChange={(e) => setEdit({ ...edit, unit: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('designer.target_value')}</label>
              <input type="number" className="input" value={edit.target_value || ''}
                onChange={(e) => setEdit({ ...edit, target_value: parseFloat(e.target.value as string) || undefined })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary btn-sm" onClick={save}>{t('common.save')}</button>
            <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      <div className="grid-page">
        {!selectedModule ? (
          <p className="text-sm text-gray-400 col-span-full text-center py-8">Select a module above</p>
        ) : kpis.length === 0 ? (
          <p className="text-sm text-gray-400 col-span-full text-center py-8">{t('common.no_data')}</p>
        ) : kpis.map((k) => (
          <div key={k.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={20} className="text-primary" />
                <div>
                  <p className="font-medium text-gray-900">{k.name_en}</p>
                  <p className="text-xs text-gray-500">{k.name_ar}</p>
                </div>
              </div>
              <button className="btn-sm btn-danger" onClick={() => remove(k.id)}>
                <Trash2 size={12} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="badge bg-gray-100 text-gray-600">{k.formula_type}</span>
              <span className="badge bg-blue-100 text-blue-700">{k.unit}</span>
              {k.target_value != null && (
                <span className="badge bg-green-100 text-green-700">Target: {k.target_value}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
