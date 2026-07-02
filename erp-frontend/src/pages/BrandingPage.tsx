import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { Save, Palette, RotateCcw, Upload, X } from 'lucide-react';

const COLOR_PRESETS = [
  { label: 'Blue/Amber', primary: '#2563eb', secondary: '#f59e0b', success: '#16a34a', danger: '#dc2626', warning: '#f59e0b', info: '#0891b2' },
  { label: 'Purple/Teal', primary: '#7c3aed', secondary: '#0d9488', success: '#16a34a', danger: '#dc2626', warning: '#eab308', info: '#06b6d4' },
  { label: 'Emerald/Cyan', primary: '#059669', secondary: '#06b6d4', success: '#22c55e', danger: '#ef4444', warning: '#eab308', info: '#3b82f6' },
  { label: 'Rose/Orange', primary: '#e11d48', secondary: '#ea580c', success: '#16a34a', danger: '#dc2626', warning: '#f59e0b', info: '#0891b2' },
  { label: 'Indigo/Pink', primary: '#4f46e5', secondary: '#ec4899', success: '#22c55e', danger: '#ef4444', warning: '#eab308', info: '#6366f1' },
  { label: 'Slate/Stone', primary: '#475569', secondary: '#78716c', success: '#16a34a', danger: '#dc2626', warning: '#f59e0b', info: '#0891b2' },
];

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter (English)' },
  { value: 'Cairo', label: 'Cairo (عربي)' },
  { value: 'Tajawal', label: 'Tajawal (عربي)' },
  { value: 'Noto Sans Arabic', label: 'Noto Sans Arabic (عربي)' },
  { value: 'Almarai', label: 'Almarai (عربي)' },
  { value: 'Readex Pro', label: 'Readex Pro (عربي)' },
  { value: 'system-ui', label: 'System UI' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { value: 'IBM Plex Sans Arabic', label: 'IBM Plex Sans Arabic (عربي)' },
];

export default function BrandingPage() {
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    app_name: '', company_name: '', logo_url: '',
    primary_color: '#2563eb', secondary_color: '#f59e0b',
    success_color: '#16a34a', danger_color: '#dc2626', warning_color: '#f59e0b', info_color: '#0891b2',
    sidebar_bg: '#1e293b', sidebar_text: '#f8fafc', header_bg: '#ffffff', header_text: '#1e293b', card_bg: '#ffffff',
    font_family: 'Inter', custom_css: '', default_language: 'ar' as 'ar' | 'en', theme: 'light' as 'light' | 'dark',
    favicon_url: '', login_logo_url: '', login_message: '', rtl_enabled: false,
    page_bg: '', border_color: '', border_radius: 'default', shadow_intensity: 'default', sidebar_width: 260,
    base_font_size: 'default', line_height: 'default', content_spacing: 'default', button_style: 'default',
  });

  useEffect(() => {
    if (!settings) return;
    setForm({
      app_name: settings.app_name || '',
      company_name: settings.company_name || '',
      logo_url: settings.logo_url || '',
      primary_color: (settings.primary_color as string) || '#2563eb',
      secondary_color: (settings.secondary_color as string) || '#f59e0b',
      success_color: (settings.success_color as string) || '#16a34a',
      danger_color: (settings.danger_color as string) || '#dc2626',
      warning_color: (settings.warning_color as string) || '#f59e0b',
      info_color: (settings.info_color as string) || '#0891b2',
      sidebar_bg: (settings.sidebar_bg as string) || '#1e293b',
      sidebar_text: (settings.sidebar_text as string) || '#f8fafc',
      header_bg: (settings.header_bg as string) || '#ffffff',
      header_text: (settings.header_text as string) || '#1e293b',
      card_bg: (settings.card_bg as string) || '#ffffff',
      font_family: (settings.font_family as string) || 'Inter',
      custom_css: (settings.custom_css as string) || '',
      default_language: (settings.default_language as 'ar' | 'en') || 'ar',
      theme: (settings.theme as 'light' | 'dark') || 'light',
      favicon_url: (settings.favicon_url as string) || '',
      login_logo_url: (settings.login_logo_url as string) || '',
      login_message: (settings.login_message as string) || '',
      rtl_enabled: settings.rtl_enabled === true,
      page_bg: (settings.page_bg as string) || '',
      border_color: (settings.border_color as string) || '',
      border_radius: (settings.border_radius as string) || 'default',
      shadow_intensity: (settings.shadow_intensity as string) || 'default',
      sidebar_width: (settings.sidebar_width as number) || 260,
      base_font_size: (settings.base_font_size as string) || 'default',
      line_height: (settings.line_height as string) || 'default',
      content_spacing: (settings.content_spacing as string) || 'default',
      button_style: (settings.button_style as string) || 'default',
    });
  }, [settings]);

  async function uploadLogo(field: 'logo_url' | 'favicon_url' | 'login_logo_url') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/svg+xml,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const ext = file.name.split('.').pop();
        const path = `branding/${field}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
        setForm(prev => ({ ...prev, [field]: publicUrl }));
        toast.success('Logo uploaded');
      } catch (err: any) {
        toast.error(err.message || 'Upload failed');
      }
    };
    input.click();
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings(form);
      toast.success(t('common.saved'));
    } catch {
      toast.error(t('admin.save_failed'));
    } finally { setSaving(false); }
  }

  function applyPreset(preset: typeof COLOR_PRESETS[number]) {
    setForm(prev => ({
      ...prev,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
      success_color: preset.success,
      danger_color: preset.danger,
      warning_color: preset.warning,
      info_color: preset.info,
    }));
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('admin.branding')}</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.branding_desc')}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Palette size={18} /> {t('admin.branding_tab')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('admin.app_name')}</label>
                <input className="input" value={form.app_name} onChange={e => setForm({ ...form, app_name: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.company_name')}</label>
                <input className="input" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.logo_url')}</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} />
                  <button type="button" className="btn-secondary btn-sm" onClick={() => uploadLogo('logo_url')}><Upload size={14} /></button>
                  {form.logo_url && <button type="button" className="btn-sm text-red-400" onClick={() => setForm({ ...form, logo_url: '' })}><X size={14} /></button>}
                  {form.logo_url && <img src={form.logo_url} alt="" className="w-8 h-8 rounded object-cover" />}
                </div>
              </div>
              <div>
                <label className="label">{t('admin.favicon_url')}</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={form.favicon_url} onChange={e => setForm({ ...form, favicon_url: e.target.value })} />
                  <button type="button" className="btn-secondary btn-sm" onClick={() => uploadLogo('favicon_url')}><Upload size={14} /></button>
                </div>
              </div>
              <div>
                <label className="label">{t('admin.login_logo_url2')}</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={form.login_logo_url} onChange={e => setForm({ ...form, login_logo_url: e.target.value })} />
                  <button type="button" className="btn-secondary btn-sm" onClick={() => uploadLogo('login_logo_url')}><Upload size={14} /></button>
                  {form.login_logo_url && <img src={form.login_logo_url} alt="" className="w-8 h-8 rounded object-cover" />}
                </div>
              </div>
              <div>
                <label className="label">{t('admin.font_family')}</label>
                <select className="input" value={form.font_family} onChange={e => setForm({ ...form, font_family: e.target.value })}>
                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t('admin.default_theme')}</label>
                <select className="input" value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value as 'light' | 'dark' })}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div>
                <label className="label">{t('admin.default_language')}</label>
                <select className="input" value={form.default_language} onChange={e => setForm({ ...form, default_language: e.target.value as 'ar' | 'en' })}>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input type="checkbox" id="rtl" className="w-4 h-4 rounded" checked={form.rtl_enabled} onChange={e => setForm({ ...form, rtl_enabled: e.target.checked })} />
                <label htmlFor="rtl" className="text-sm">{t('admin.enable_rtl')}</label>
              </div>
            </div>

            <div className="mt-6 border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>{t('admin.color_presets')}</h3>
              <div className="flex flex-wrap gap-2 mb-6">
                {COLOR_PRESETS.map(p => (
                  <button key={p.label} type="button" className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs hover:opacity-80 transition-opacity"
                    style={{ borderColor: 'var(--color-border)' }}
                    onClick={() => applyPreset(p)}
                    title={p.label}>
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: p.primary }} />
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: p.secondary }} />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ColorField label={t('admin.primary_color')} value={form.primary_color} onChange={v => setForm({ ...form, primary_color: v })} />
              <ColorField label={t('admin.secondary_accent2')} value={form.secondary_color} onChange={v => setForm({ ...form, secondary_color: v })} />
              <ColorField label={t('admin.success_color')} value={form.success_color} onChange={v => setForm({ ...form, success_color: v })} />
              <ColorField label={t('admin.danger_color')} value={form.danger_color} onChange={v => setForm({ ...form, danger_color: v })} />
              <ColorField label={t('admin.warning_color')} value={form.warning_color} onChange={v => setForm({ ...form, warning_color: v })} />
              <ColorField label={t('admin.info_color')} value={form.info_color} onChange={v => setForm({ ...form, info_color: v })} />
            </div>

            <div className="mt-6 border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>{t('admin.layout_colors')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ColorField label={t('admin.sidebar_bg')} value={form.sidebar_bg} onChange={v => setForm({ ...form, sidebar_bg: v })} />
                <ColorField label={t('admin.sidebar_text')} value={form.sidebar_text} onChange={v => setForm({ ...form, sidebar_text: v })} />
                <ColorField label={t('admin.header_bg')} value={form.header_bg} onChange={v => setForm({ ...form, header_bg: v })} />
                <ColorField label={t('admin.header_text')} value={form.header_text} onChange={v => setForm({ ...form, header_text: v })} />
                <ColorField label={t('admin.card_bg')} value={form.card_bg} onChange={v => setForm({ ...form, card_bg: v })} />
              </div>
            </div>

            <div className="mt-6 border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Appearance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Page Background</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" className="h-10 w-16 border rounded cursor-pointer" value={form.page_bg || '#f0f2f5'} onChange={e => setForm({ ...form, page_bg: e.target.value })} />
                    <span className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{form.page_bg || 'Auto'}</span>
                    {form.page_bg && <button className="text-xs text-red-400" onClick={() => setForm({ ...form, page_bg: '' })}>Reset</button>}
                  </div>
                </div>
                <div>
                  <label className="label">Border Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" className="h-10 w-16 border rounded cursor-pointer" value={form.border_color || '#e2e5ea'} onChange={e => setForm({ ...form, border_color: e.target.value })} />
                    <span className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{form.border_color || 'Auto'}</span>
                    {form.border_color && <button className="text-xs text-red-400" onClick={() => setForm({ ...form, border_color: '' })}>Reset</button>}
                  </div>
                </div>
                <div>
                  <label className="label">Border Radius</label>
                  <select className="input" value={form.border_radius} onChange={e => setForm({ ...form, border_radius: e.target.value })}>
                    <option value="sharp">Sharp</option>
                    <option value="default">Default</option>
                    <option value="rounded">Rounded</option>
                    <option value="pill">Pill</option>
                  </select>
                </div>
                <div>
                  <label className="label">Shadow Intensity</label>
                  <select className="input" value={form.shadow_intensity} onChange={e => setForm({ ...form, shadow_intensity: e.target.value })}>
                    <option value="flat">Flat (no shadows)</option>
                    <option value="subtle">Subtle</option>
                    <option value="default">Default</option>
                    <option value="prominent">Prominent</option>
                  </select>
                </div>
                <div>
                  <label className="label">Sidebar Width (px)</label>
                  <input type="number" className="input" min={180} max={320} value={form.sidebar_width} onChange={e => setForm({ ...form, sidebar_width: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Base Font Size</label>
                  <select className="input" value={form.base_font_size} onChange={e => setForm({ ...form, base_font_size: e.target.value })}>
                    <option value="small">Small (13px)</option>
                    <option value="default">Default (15px)</option>
                    <option value="large">Large (16px)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Line Height</label>
                  <select className="input" value={form.line_height} onChange={e => setForm({ ...form, line_height: e.target.value })}>
                    <option value="tight">Tight (1.3)</option>
                    <option value="default">Normal (1.5)</option>
                    <option value="relaxed">Relaxed (1.7)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Content Spacing</label>
                  <select className="input" value={form.content_spacing} onChange={e => setForm({ ...form, content_spacing: e.target.value })}>
                    <option value="compact">Compact</option>
                    <option value="default">Default</option>
                    <option value="comfortable">Comfortable</option>
                  </select>
                </div>
                <div>
                  <label className="label">Button Style</label>
                  <select className="input" value={form.button_style} onChange={e => setForm({ ...form, button_style: e.target.value })}>
                    <option value="pill">Pill (rounded)</option>
                    <option value="rounded">Rounded</option>
                    <option value="square">Square</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
              <label className="label">{t('admin.login_message')}</label>
              <textarea className="input" rows={2} value={form.login_message} onChange={e => setForm({ ...form, login_message: e.target.value })} />
              <label className="label mt-4">{t('admin.custom_css')}</label>
              <textarea className="input font-mono text-xs" rows={4} value={form.custom_css} onChange={e => setForm({ ...form, custom_css: e.target.value })} />
            </div>

            <div className="flex justify-end pt-4 border-t mt-6" style={{ borderColor: 'var(--color-border)' }}>
              {hasPermission('settings', 'edit') && (
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  <Save size={16} /> {saving ? t('common.saving') : t('common.save_all')}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="card sticky top-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <RotateCcw size={14} /> {t('admin.preview')}
            </h3>
            <LivePreview form={form} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label text-xs">{label}</label>
      <div className="flex gap-2 items-center">
        <input type="color" className="h-10 w-16 rounded border cursor-pointer" value={value} onChange={e => onChange(e.target.value)} />
        <span className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{value}</span>
        <span className="w-5 h-5 rounded-full border shrink-0" style={{ backgroundColor: value }} />
      </div>
    </div>
  );
}

interface BrandingForm {
  app_name: string; company_name: string; logo_url: string;
  primary_color: string; secondary_color: string;
  success_color: string; danger_color: string; warning_color: string; info_color: string;
  sidebar_bg: string; sidebar_text: string; header_bg: string; header_text: string; card_bg: string;
  font_family: string; custom_css: string; default_language: 'ar' | 'en'; theme: 'light' | 'dark';
  favicon_url: string; login_logo_url: string; login_message: string; rtl_enabled: boolean;
  page_bg: string; border_color: string; border_radius: string; shadow_intensity: string; sidebar_width: number;
  base_font_size: string; line_height: string; content_spacing: string; button_style: string;
}

function LivePreview({ form }: { form: BrandingForm }) {
  const isDark = form.theme === 'dark';
  const bg = form.page_bg || (isDark ? '#0f172a' : '#f1f5f9');
  const borderC = form.border_color || (isDark ? 'rgba(255,255,255,0.08)' : '#e2e5ea');
  const radii = { sharp: '4px', default: '6px', rounded: '8px', pill: '999px' }[form.border_radius] || '6px';
  const btnR = { pill: '999px', rounded: '8px', square: '4px' }[form.button_style] || '999px';
  const fSize = { small: '11px', default: '12px', large: '13px' }[form.base_font_size] || '12px';

  return (
    <div className="overflow-hidden border text-xs" style={{ borderColor: borderC, fontFamily: form.font_family, borderRadius: radii }}>
      <div style={{ backgroundColor: form.header_bg, color: form.header_text, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        {form.logo_url && <img src={form.logo_url} alt="" className="w-5 h-5 rounded object-cover" />}
        <span style={{ fontWeight: 700 }}>{form.app_name || 'ERP'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10 }}>John Doe</span>
      </div>
      <div style={{ display: 'flex', minHeight: 120 }}>
        <div style={{ width: 80, backgroundColor: form.sidebar_bg, color: form.sidebar_text, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ opacity: 0.8 }}>Dashboard</div>
          <div style={{ opacity: 0.6 }}>Projects</div>
          <div style={{ opacity: 0.6 }}>Reports</div>
          <div style={{ opacity: 0.6 }}>Settings</div>
        </div>
        <div style={{ flex: 1, backgroundColor: bg, padding: form.content_spacing === 'compact' ? 8 : form.content_spacing === 'comfortable' ? 16 : 12 }}>
          <div style={{ display: 'flex', gap: form.content_spacing === 'compact' ? 4 : form.content_spacing === 'comfortable' ? 12 : 8, marginBottom: form.content_spacing === 'compact' ? 6 : form.content_spacing === 'comfortable' ? 16 : 12 }}>
            <div style={{ flex: 1, backgroundColor: form.card_bg, borderRadius: radii, padding: form.content_spacing === 'compact' ? '6px 8px' : form.content_spacing === 'comfortable' ? '10px 12px' : '8px 10px', border: `1px solid ${borderC}`, fontSize: fSize }}>
              <div style={{ color: form.primary_color, fontWeight: 700, fontSize: fSize === '13px' ? 17 : fSize === '12px' ? 16 : 14 }}>$12.4k</div>
              <div style={{ opacity: 0.6, marginTop: 2 }}>Revenue</div>
            </div>
            <div style={{ flex: 1, backgroundColor: form.card_bg, borderRadius: radii, padding: form.content_spacing === 'compact' ? '6px 8px' : form.content_spacing === 'comfortable' ? '10px 12px' : '8px 10px', border: `1px solid ${borderC}`, fontSize: fSize }}>
              <div style={{ color: form.success_color, fontWeight: 700, fontSize: fSize === '13px' ? 17 : fSize === '12px' ? 16 : 14 }}>89%</div>
              <div style={{ opacity: 0.6, marginTop: 2 }}>Approval</div>
            </div>
          </div>
          <div style={{ backgroundColor: form.card_bg, borderRadius: radii, padding: form.content_spacing === 'compact' ? 8 : form.content_spacing === 'comfortable' ? 14 : 10, border: `1px solid ${borderC}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: fSize }}>Recent Activity</span>
              <span style={{ color: form.primary_color, borderRadius: btnR, padding: '1px 6px', border: `1px solid ${form.primary_color}40`, fontSize: fSize }}>View all</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: form.warning_color }} />
              <span style={{ opacity: 0.7 }}>PO-1023 pending approval</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: form.info_color }} />
              <span style={{ opacity: 0.7 }}>WIR-45 inspection passed</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: form.danger_color }} />
              <span style={{ opacity: 0.7 }}>NCR-12 overdue</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
