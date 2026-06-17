import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { settingsApi } from '../services/api';
import { Save, Image, Palette } from 'lucide-react';

export default function BrandingPage() {
  const t = useT();
  const toast = useToast();
  const { settings, loading: ctxLoading, refreshSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    app_name: '',
    company_name: '',
    logo_url: '',
    primary_color: '#2563eb',
    secondary_color: '#f59e0b',
    default_language: 'ar' as 'ar' | 'en',
    theme: 'light' as 'light' | 'dark',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        app_name: settings.app_name || '',
        company_name: settings.company_name || '',
        logo_url: settings.logo_url || '',
        primary_color: settings.primary_color || '#2563eb',
        secondary_color: settings.secondary_color || '#f59e0b',
        default_language: (settings.default_language as 'ar' | 'en') || 'ar',
        theme: (settings.theme as 'light' | 'dark') || 'light',
      });
    }
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        await settingsApi.set(key, value);
      }
      await refreshSettings();
      toast.success(t('common.saved'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('admin.branding')}</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.branding_desc')}</p>
      </div>

      <div className="card">
        <div className="space-y-6 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('admin.app_name')}</label>
              <input className="input" value={form.app_name}
                onChange={(e) => setForm({ ...form, app_name: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('admin.company_name')}</label>
              <input className="input" value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-2">
              <Image size={16} /> {t('admin.logo_url')}
            </label>
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <input className="input" value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
              </div>
              {form.logo_url && (
                <img src={form.logo_url} alt="logo preview" className="h-12 w-12 rounded object-cover border" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-2">
                <Palette size={16} /> {t('admin.primary_color')}
              </label>
              <div className="flex gap-2 items-center">
                <input type="color" className="h-10 w-16 rounded border cursor-pointer"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{form.primary_color}</span>
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <Palette size={16} /> {t('admin.secondary_color')}
              </label>
              <div className="flex gap-2 items-center">
                <input type="color" className="h-10 w-16 rounded border cursor-pointer"
                  value={form.secondary_color}
                  onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{form.secondary_color}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('admin.default_language')}</label>
              <select className="input" value={form.default_language}
                onChange={(e) => setForm({ ...form, default_language: e.target.value as 'ar' | 'en' })}>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="label">{t('admin.default_theme')}</label>
              <select className="input" value={form.theme}
                onChange={(e) => setForm({ ...form, theme: e.target.value as 'light' | 'dark' })}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t">
            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>{t('admin.preview')}</h4>
            <div className="flex gap-4 items-center p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
              {form.logo_url && <img src={form.logo_url} alt="" className="h-10 w-10 rounded" />}
              <div>
                <p className="text-lg font-bold" style={{ color: form.primary_color }}>{form.app_name || 'ERP'}</p>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{form.company_name || 'Company Name'}</p>
              </div>
              <div className="flex gap-1 ms-auto">
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: form.primary_color }} />
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: form.secondary_color }} />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={16} /> {saving ? t('common.saving') : t('common.save_all')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
