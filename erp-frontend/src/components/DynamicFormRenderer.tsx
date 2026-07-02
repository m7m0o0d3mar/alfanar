import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import type { FormDefinition, FormFieldConfig } from '../types';
import { Loader2 } from 'lucide-react';

interface DynamicFormRendererProps {
  formCode: string;
  entityType?: string;
  initialData?: Record<string, any>;
  projectId?: string;
  onSuccess?: (data: Record<string, any>) => void;
  onCancel?: () => void;
}

export default function DynamicFormRenderer({ formCode, initialData, projectId, onSuccess, onCancel }: DynamicFormRendererProps) {
  const t = useT();
  const toast = useToast();
  const [formDef, setFormDef] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('form_definitions').select('*').eq('code', formCode).single();
      if (data) {
        const def = data as FormDefinition;
        setFormDef(def);
        const defaults: Record<string, any> = {};
        def.config.fields.forEach(f => {
          defaults[f.key] = initialData?.[f.key] ?? f.default_value ?? '';
        });
        setValues(defaults);
      }
      setLoading(false);
    })();
  }, [formCode]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!formDef) return false;
    for (const f of formDef.config.fields) {
      if (f.required && !values[f.key]) {
        errs[f.key] = `${f.label_en} is required`;
      }
      if (values[f.key] && f.validation) {
        if (f.type === 'text' || f.type === 'textarea') {
          if (f.validation.min_length && String(values[f.key]).length < f.validation.min_length)
            errs[f.key] = `Minimum ${f.validation.min_length} characters`;
          if (f.validation.max_length && String(values[f.key]).length > f.validation.max_length)
            errs[f.key] = `Maximum ${f.validation.max_length} characters`;
          if (f.validation.pattern && !new RegExp(f.validation.pattern).test(String(values[f.key])))
            errs[f.key] = 'Invalid format';
        }
        if (f.type === 'number') {
          const num = Number(values[f.key]);
          if (f.validation.min !== undefined && num < f.validation.min)
            errs[f.key] = `Minimum value is ${f.validation.min}`;
          if (f.validation.max !== undefined && num > f.validation.max)
            errs[f.key] = `Maximum value is ${f.validation.max}`;
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formDef || !validate()) return;
    setSaving(true);
    try {
      const payload = { ...values };
      if (projectId) payload.project_id = projectId;
      if (formDef.entity_type) {
        const { error } = await supabase.from(formDef.entity_type).insert(payload);
        if (error) throw error;
      }
      toast.success('Form saved');
      onSuccess?.(payload);
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    }
    setSaving(false);
  }

  function renderField(f: FormFieldConfig) {
    const val = values[f.key] ?? '';
    const err = errors[f.key];
    const inputStyle = {
      width: '100%', padding: '6px 10px', border: `1px solid ${err ? '#ef4444' : 'var(--color-border)'}`,
      borderRadius: 6, fontSize: 13, background: 'var(--color-bg)', color: 'var(--color-text)'
    };

    const onChange = (v: any) => {
      setValues(prev => ({ ...prev, [f.key]: v }));
      if (errors[f.key]) setErrors(prev => { const { [f.key]: _, ...rest } = prev; return rest; });
    };

    switch (f.type) {
      case 'textarea':
        return <textarea rows={3} style={inputStyle} placeholder={f.placeholder_en} value={val} onChange={e => onChange(e.target.value)} />;
      case 'select':
        return (
          <select style={{ ...inputStyle, appearance: 'auto' }} value={val} onChange={e => onChange(e.target.value)}>
            <option value="">-- Select --</option>
            {f.options?.map((o, i) => <option key={i} value={o.value}>{o.label_en}</option>)}
          </select>
        );
      case 'checkbox':
        return (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text)' }}>
            <input type="checkbox" checked={!!val} onChange={e => onChange(e.target.checked)} />
            {f.label_en}
          </label>
        );
      case 'toggle':
        return (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text)' }}>
            <input type="checkbox" role="switch" checked={!!val} onChange={e => onChange(e.target.checked)} />
            {f.label_en}
          </label>
        );
      case 'date':
        return <input type="date" style={inputStyle} value={val} onChange={e => onChange(e.target.value)} />;
      default:
        return <input type={f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : 'text'} style={inputStyle} placeholder={f.placeholder_en} value={val} onChange={e => onChange(e.target.value)} />;
    }
  }

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin" /></div>;
  if (!formDef) return <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>Form "{formCode}" not found</div>;

  const cols = formDef.config.layout === 'two_column' ? 2 : formDef.config.layout === 'three_column' ? 3 : 1;
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--color-text)' };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
        {formDef.config.fields.sort((a, b) => a.order - b.order).map(f => (
          <div key={f.key} style={{ gridColumn: f.width === 'half' && cols > 1 ? 'span 1' : `span ${cols}` }}>
            {f.type !== 'checkbox' && f.type !== 'toggle' && (
              <label style={labelStyle}>{f.label_en}{f.required ? ' *' : ''}</label>
            )}
            {renderField(f)}
            {errors[f.key] && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{errors[f.key]}</p>}
          </div>
        ))}
        <div style={{ gridColumn: `span ${cols}`, display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="submit" className="btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving...' : (formDef.config.submit_label_en || 'Save')}
          </button>
          {onCancel && <button type="button" className="btn-secondary btn-sm" onClick={onCancel}>Cancel</button>}
        </div>
      </div>
    </form>
  );
}
