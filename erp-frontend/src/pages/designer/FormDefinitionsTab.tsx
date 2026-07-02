import { useState, useEffect } from 'react';
import { formDefinitionsApi } from '../../services/api';
import type { FormDefinition, FormDefinitionConfig, FormFieldConfig } from '../../types';
import { useT } from '../../hooks/useTranslation';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Plus, Edit3, Trash2, Eye, ChevronUp, ChevronDown, X } from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';

const FIELD_TYPES: { value: FormFieldConfig['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'toggle', label: 'Toggle' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'user_lookup', label: 'User Lookup' },
  { value: 'entity_lookup', label: 'Entity Lookup' },
];

function emptyField(order: number): FormFieldConfig {
  return { key: '', type: 'text', label_en: '', label_ar: '', required: false, order, width: 'full' };
}

function emptyConfig(): FormDefinitionConfig {
  return { fields: [], layout: 'single', submit_label_en: 'Save', submit_label_ar: 'حفظ' };
}

export default function FormDefinitionsTab() {
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<FormDefinition> & { config: FormDefinitionConfig } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try { setForms(await formDefinitionsApi.list()); }
    catch { toast.error('Failed to load forms'); }
    setLoading(false);
  }

  async function save() {
    if (!editing?.code || !editing?.name_en) { toast.error('Code and name are required'); return; }
    setSaving(true);
    try {
      await formDefinitionsApi.upsert(editing as FormDefinition);
      toast.success(t('form_builder.saved'));
      setShowForm(false); setEditing(null); await load();
    } catch { toast.error('Save failed'); }
    setSaving(false);
  }

  async function remove(id: string) {
    try { await formDefinitionsApi.remove(id); toast.success(t('form_builder.deleted')); await load(); }
    catch { toast.error('Delete failed'); }
    setDeleteId(null);
  }

  function openNew() {
    setEditing({ code: '', name_en: '', name_ar: '', entity_type: '', config: emptyConfig(), is_active: true });
    setShowForm(true);
  }

  function openEdit(f: FormDefinition) {
    setEditing({ ...f, config: f.config || emptyConfig() });
    setShowForm(true);
  }

  function addField() {
    if (!editing) return;
    const fields = [...(editing.config?.fields || [])];
    fields.push(emptyField(fields.length));
    setEditing({ ...editing, config: { ...editing.config, fields } });
  }

  function removeField(idx: number) {
    if (!editing) return;
    const fields = editing.config.fields.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i }));
    setEditing({ ...editing, config: { ...editing.config, fields } });
  }

  function moveField(idx: number, dir: -1 | 1) {
    if (!editing) return;
    const fields = [...editing.config.fields];
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    [fields[idx], fields[target]] = [fields[target], fields[idx]];
    setEditing({ ...editing, config: { ...editing.config, fields: fields.map((f, i) => ({ ...f, order: i })) } });
  }

  function updateField(idx: number, patch: Partial<FormFieldConfig>) {
    if (!editing) return;
    const fields = editing.config.fields.map((f, i) => i === idx ? { ...f, ...patch } : f);
    setEditing({ ...editing, config: { ...editing.config, fields } });
  }

  function updateOption(fieldIdx: number, optIdx: number, patch: Record<string, string>) {
    if (!editing) return;
    const fields = [...editing.config.fields];
    const field = { ...fields[fieldIdx] };
    const options = [...(field.options || [])];
    options[optIdx] = { ...options[optIdx], ...patch };
    field.options = options;
    fields[fieldIdx] = field;
    setEditing({ ...editing, config: { ...editing.config, fields } });
  }

  function addOption(fieldIdx: number) {
    if (!editing) return;
    const fields = [...editing.config.fields];
    const field = { ...fields[fieldIdx] };
    field.options = [...(field.options || []), { value: '', label_en: '', label_ar: '' }];
    fields[fieldIdx] = field;
    setEditing({ ...editing, config: { ...editing.config, fields } });
  }

  function removeOption(fieldIdx: number, optIdx: number) {
    if (!editing) return;
    const fields = [...editing.config.fields];
    const field = { ...fields[fieldIdx] };
    field.options = (field.options || []).filter((_, i) => i !== optIdx);
    fields[fieldIdx] = field;
    setEditing({ ...editing, config: { ...editing.config, fields } });
  }

  function renderFormPreview(config: FormDefinitionConfig) {
    const cols = config.layout === 'two_column' ? 2 : config.layout === 'three_column' ? 3 : 1;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
        {config.fields.sort((a, b) => a.order - b.order).map((f) => (
          <div key={f.key + f.order} style={{ gridColumn: f.width === 'half' && cols > 1 ? 'span 1' : 'span ' + cols }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#374151' }}>
              {f.label_en}{f.required ? ' *' : ''}
            </label>
            {f.type === 'textarea' ? (
              <textarea rows={3} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }} placeholder={f.placeholder_en} />
            ) : f.type === 'select' ? (
              <select style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: 'white' }}>
                {f.options?.map((o, i) => <option key={i} value={o.value}>{o.label_en}</option>)}
              </select>
            ) : f.type === 'checkbox' ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" /> {f.label_en}</label>
            ) : f.type === 'toggle' ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" role="switch" /> {f.label_en}</label>
            ) : (
              <input type={f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : 'text'} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }} placeholder={f.placeholder_en} />
            )}
          </div>
        ))}
        <div style={{ gridColumn: 'span ' + cols, marginTop: 8 }}>
          <button style={{ padding: '8px 20px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
            {config.submit_label_en || 'Save'}
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('form_builder.description')}</p>
        {hasPermission('settings', 'create') && (
          <button className="btn-primary btn-sm" onClick={openNew}><Plus size={14} /> {t('form_builder.add')}</button>
        )}
      </div>

      {forms.length === 0 ? (
        <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('form_builder.no_forms')}</div>
      ) : (
        <div className="space-y-2">
          {forms.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{f.name_en} / {f.name_ar}</p>
                  <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{f.code}{f.entity_type ? ` — ${f.entity_type}` : ''}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${f.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {f.is_active ? t('form_builder.active') : t('form_builder.inactive')}
                </span>
              </div>
              <div className="flex gap-1">
                {hasPermission('settings', 'edit') && <button className="btn-xs btn-ghost" onClick={() => openEdit(f)}><Edit3 size={12} /></button>}
                {hasPermission('settings', 'delete') && <button className="btn-xs btn-ghost text-red-500" onClick={() => setDeleteId(f.id)}><Trash2 size={12} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-4xl shadow-2xl max-h-[95vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing.id ? t('form_builder.edit') : t('form_builder.add')}</h3>
              <button className="btn-sm btn-secondary" onClick={() => setShowPreview(true)}><Eye size={14} /> {t('form_builder.preview')}</button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="label">{t('form_builder.code')}</label><input className="input" value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })} /></div>
              <div><label className="label">{t('form_builder.name_en')}</label><input className="input" value={editing.name_en || ''} onChange={e => setEditing({ ...editing, name_en: e.target.value })} /></div>
              <div><label className="label">{t('form_builder.name_ar')}</label><input className="input" value={editing.name_ar || ''} onChange={e => setEditing({ ...editing, name_ar: e.target.value })} /></div>
              <div><label className="label">{t('form_builder.entity_type')}</label><input className="input" value={editing.entity_type || ''} onChange={e => setEditing({ ...editing, entity_type: e.target.value })} /></div>
              <div><label className="label">{t('form_builder.layout')}</label>
                <select className="input" value={editing.config.layout || 'single'} onChange={e => setEditing({ ...editing, config: { ...editing.config, layout: e.target.value as 'single' | 'two_column' | 'three_column' } })}>
                  <option value="single">{t('form_builder.full')}</option>
                  <option value="two_column">2 Columns</option>
                  <option value="three_column">3 Columns</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="label mb-0">{t('form_builder.active')}</label>
                <input type="checkbox" checked={!!editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />
              </div>
              <div><label className="label">{t('form_builder.submit_label_en')}</label><input className="input" value={editing.config.submit_label_en || ''} onChange={e => setEditing({ ...editing, config: { ...editing.config, submit_label_en: e.target.value } })} /></div>
              <div><label className="label">{t('form_builder.submit_label_ar')}</label><input className="input" value={editing.config.submit_label_ar || ''} onChange={e => setEditing({ ...editing, config: { ...editing.config, submit_label_ar: e.target.value } })} /></div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm">{t('form_builder.fields')} ({editing.config.fields.length})</h4>
                <button className="btn-sm btn-primary" onClick={addField}><Plus size={14} /> {t('form_builder.add_field')}</button>
              </div>
              {editing.config.fields.length === 0 ? (
                <div className="text-center py-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('form_builder.no_fields')}</div>
              ) : (
                <div className="space-y-3">
                  {editing.config.fields.sort((a, b) => a.order - b.order).map((f, idx) => (
                    <div key={idx} className="border rounded-lg p-3" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>#{idx + 1} {f.key || '(no key)'}</span>
                        <div className="flex gap-1">
                          <button className="btn-xs btn-ghost" onClick={() => moveField(idx, -1)} disabled={idx === 0}><ChevronUp size={14} /></button>
                          <button className="btn-xs btn-ghost" onClick={() => moveField(idx, 1)} disabled={idx === editing.config.fields.length - 1}><ChevronDown size={14} /></button>
                          <button className="btn-xs btn-ghost text-red-500" onClick={() => removeField(idx)}><X size={14} /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div><label className="label text-[10px]">{t('form_builder.field_key')}</label><input className="input text-xs" value={f.key} onChange={e => updateField(idx, { key: e.target.value })} /></div>
                        <div><label className="label text-[10px]">{t('form_builder.field_type')}</label>
                          <select className="input text-xs" value={f.type} onChange={e => updateField(idx, { type: e.target.value as FormFieldConfig['type'] })}>
                            {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                          </select>
                        </div>
                        <div><label className="label text-[10px]">{t('form_builder.width')}</label>
                          <select className="input text-xs" value={f.width || 'full'} onChange={e => updateField(idx, { width: e.target.value as 'full' | 'half' })}>
                            <option value="full">{t('form_builder.full')}</option>
                            <option value="half">{t('form_builder.half')}</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 pt-5">
                          <input type="checkbox" id={`req-${idx}`} checked={!!f.required} onChange={e => updateField(idx, { required: e.target.checked })} />
                          <label htmlFor={`req-${idx}`} className="text-xs">{t('form_builder.required')}</label>
                        </div>
                        <div><label className="label text-[10px]">{t('form_builder.label_en')}</label><input className="input text-xs" value={f.label_en} onChange={e => updateField(idx, { label_en: e.target.value })} /></div>
                        <div><label className="label text-[10px]">{t('form_builder.label_ar')}</label><input className="input text-xs" value={f.label_ar} onChange={e => updateField(idx, { label_ar: e.target.value })} /></div>
                        <div><label className="label text-[10px]">{t('form_builder.placeholder_en')}</label><input className="input text-xs" value={f.placeholder_en || ''} onChange={e => updateField(idx, { placeholder_en: e.target.value })} /></div>
                        <div><label className="label text-[10px]">{t('form_builder.placeholder_ar')}</label><input className="input text-xs" value={f.placeholder_ar || ''} onChange={e => updateField(idx, { placeholder_ar: e.target.value })} /></div>
                        <div><label className="label text-[10px]">{t('form_builder.default_value')}</label><input className="input text-xs" value={f.default_value || ''} onChange={e => updateField(idx, { default_value: e.target.value })} /></div>
                      </div>
                      {(f.type === 'select') && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">{t('form_builder.options')}</span>
                            <button className="text-xs text-primary" onClick={() => addOption(idx)}>+ {t('form_builder.add_option')}</button>
                          </div>
                          {(f.options || []).map((o, oi) => (
                            <div key={oi} className="flex items-center gap-2 mt-1">
                              <input className="input text-xs flex-1" placeholder={t('form_builder.option_value')} value={o.value} onChange={e => updateOption(idx, oi, { value: e.target.value })} />
                              <input className="input text-xs flex-1" placeholder={t('form_builder.option_label_en')} value={o.label_en} onChange={e => updateOption(idx, oi, { label_en: e.target.value })} />
                              <input className="input text-xs flex-1" placeholder={t('form_builder.option_label_ar')} value={o.label_ar} onChange={e => updateOption(idx, oi, { label_ar: e.target.value })} />
                              <button className="btn-xs btn-ghost text-red-500" onClick={() => removeOption(idx, oi)}><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        <div><label className="label text-[10px]">{t('form_builder.validation')}: {t('form_builder.min')}</label><input type="number" className="input text-xs" value={f.validation?.min ?? ''} onChange={e => updateField(idx, { validation: { ...f.validation, min: e.target.value ? +e.target.value : undefined } })} /></div>
                        <div><label className="label text-[10px]">{t('form_builder.validation')}: {t('form_builder.max')}</label><input type="number" className="input text-xs" value={f.validation?.max ?? ''} onChange={e => updateField(idx, { validation: { ...f.validation, max: e.target.value ? +e.target.value : undefined } })} /></div>
                        <div><label className="label text-[10px]">{t('form_builder.min_length')}</label><input type="number" className="input text-xs" value={f.validation?.min_length ?? ''} onChange={e => updateField(idx, { validation: { ...f.validation, min_length: e.target.value ? +e.target.value : undefined } })} /></div>
                        <div><label className="label text-[10px]">{t('form_builder.max_length')}</label><input type="number" className="input text-xs" value={f.validation?.max_length ?? ''} onChange={e => updateField(idx, { validation: { ...f.validation, max_length: e.target.value ? +e.target.value : undefined } })} /></div>
                        <div className="col-span-4"><label className="label text-[10px]">{t('form_builder.pattern')}</label><input className="input text-xs font-mono" value={f.validation?.pattern || ''} onChange={e => updateField(idx, { validation: { ...f.validation, pattern: e.target.value } })} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPreview && editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowPreview(false)}>
          <div className="rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{t('form_builder.preview')} — {editing.name_en}</h3>
            <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)', background: 'white' }}>
              {renderFormPreview(editing.config)}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-secondary btn-sm" onClick={() => setShowPreview(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete Form"
          message="Are you sure you want to delete this form definition?"
          onConfirm={() => { remove(deleteId); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
