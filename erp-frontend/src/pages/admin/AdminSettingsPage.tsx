import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { useT } from '../../hooks/useTranslation';
import { useAuth } from '../../context/AuthContext';
import { settingsApi, modulesApi, pageRegistryApi, translationApi, emailTemplatesApi } from '../../services/api';
import type { PageRegistryEntry, EmailTemplate } from '../../types';
import { Save, Palette, Globe, Shield, Mail, Puzzle, Cog, Languages, RefreshCw, Plus, X, Edit3, Trash2, Layout, LayoutDashboard, BookOpen, FileText, Eye } from 'lucide-react';

type Tab = 'general' | 'branding' | 'security' | 'email' | 'integrations' | 'features' | 'localization' | 'pages' | 'dashboard' | 'translations' | 'email_templates';

const ALL_WIDGETS = ['recent_activity', 'budget_status', 'procurement_spend', 'quick_actions', 'ai_insights'];

const TAB_KEYS: Record<Tab, string> = {
  general: 'admin.general',
  branding: 'admin.branding_tab',
  security: 'admin.security',
  email: 'admin.email',
  integrations: 'admin.integrations',
  features: 'admin.features',
  localization: 'admin.localization',
  pages: 'admin.pages',
  dashboard: 'admin.dashboard_tab',
  translations: 'admin.translation_editor',
  email_templates: 'email_templates.title',
};

export default function AdminSettingsPage() {
  const t = useT();
  const toast = useToast();
  const { settings, refreshSettings } = useSettings();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<{ id: string; code: string; name_en: string; is_enabled: boolean }[]>([]);

  // General
  const [general, setGeneral] = useState({
    app_name: '', company_name: '', timezone: 'Asia/Riyadh',
    date_format: 'YYYY-MM-DD', currency: 'SAR', currency_symbol: 'SAR',
    favicon_url: '', max_upload_size_mb: 10,
  });

  // Branding
  const [branding, setBranding] = useState({
    logo_url: '', primary_color: '#a855f7', secondary_color: '#06b6d4',
    theme: 'dark' as 'light' | 'dark', default_language: 'ar' as 'ar' | 'en',
    login_message: '', login_logo_url: '', custom_css: '',
  });

  // Security
  const [security, setSecurity] = useState({
    session_timeout_minutes: 60, maintenance_mode: false,
    enable_registration: false, privacy_policy_url: '', terms_url: '',
  });

  // Email
  const [email, setEmail] = useState({
    from_address: '', from_name: '', smtp_host: '', smtp_port: 587,
    smtp_user: '', smtp_pass: '', notification_email: '',
  });

  // Integrations
  const [integrations, setIntegrations] = useState({
    google_maps_api_key: '', sms_provider: '', webhook_url: '',
  });

  // Dashboard
  const [dashboardWidgets, setDashboardWidgets] = useState<string[]>(ALL_WIDGETS);

  // Localization
  const [localization, setLocalization] = useState({
    font_family: 'Inter', rtl_enabled: true,
    date_format_display: 'DD/MM/YYYY', time_format: '24h',
  });

  useEffect(() => {
    if (!settings) return;
    setGeneral({
      app_name: (settings.app_name as string) || '',
      company_name: (settings.company_name as string) || '',
      timezone: (settings.timezone as string) || 'Asia/Riyadh',
      date_format: (settings.date_format as string) || 'YYYY-MM-DD',
      currency: (settings.currency as string) || 'SAR',
      currency_symbol: (settings.currency_symbol as string) || 'SAR',
      favicon_url: (settings.favicon_url as string) || '',
      max_upload_size_mb: Number(settings.max_upload_size_mb) || 10,
    });
    setBranding({
      logo_url: (settings.logo_url as string) || '',
      primary_color: (settings.primary_color as string) || '#a855f7',
      secondary_color: (settings.secondary_color as string) || '#06b6d4',
      theme: (settings.theme as 'light' | 'dark') || 'dark',
      default_language: (settings.default_language as 'ar' | 'en') || 'ar',
      login_message: (settings.login_message as string) || '',
      login_logo_url: (settings.login_logo_url as string) || '',
      custom_css: (settings.custom_css as string) || '',
    });
    setSecurity({
      session_timeout_minutes: Number(settings.session_timeout_minutes) || 60,
      maintenance_mode: Boolean(settings.maintenance_mode),
      enable_registration: Boolean(settings.enable_registration),
      privacy_policy_url: (settings.privacy_policy_url as string) || '',
      terms_url: (settings.terms_url as string) || '',
    });
    setEmail({
      from_address: (settings.email_from_address as string) || '',
      from_name: (settings.email_from_name as string) || '',
      smtp_host: (settings.smtp_host as string) || '',
      smtp_port: Number(settings.smtp_port) || 587,
      smtp_user: (settings.smtp_user as string) || '',
      smtp_pass: (settings.smtp_pass as string) || '',
      notification_email: (settings.notification_email as string) || '',
    });
    setIntegrations({
      google_maps_api_key: (settings.google_maps_api_key as string) || '',
      sms_provider: (settings.sms_provider as string) || '',
      webhook_url: (settings.webhook_url as string) || '',
    });
    setLocalization({
      font_family: (settings.font_family as string) || 'Inter',
      rtl_enabled: settings.rtl_enabled !== false,
      date_format_display: (settings.date_format_display as string) || 'DD/MM/YYYY',
      time_format: (settings.time_format as string) || '24h',
    });
    try {
      const stored = settings.dashboard_widgets;
      if (typeof stored === 'string') {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setDashboardWidgets(parsed);
      } else if (Array.isArray(stored)) {
        setDashboardWidgets(stored);
      }
    } catch { /* ignore invalid JSON */ }
  }, [settings]);

  useEffect(() => {
    modulesApi.list().then(setModules);
  }, []);

  async function saveSettings(_group: string, data: Record<string, unknown>) {
    setSaving(true);
    try {
      await settingsApi.setMany(data);
      await refreshSettings();
      toast.success(t('admin.settings_saved'));
    } catch {
      toast.error(t('admin.save_failed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleModule(id: string, is_enabled: boolean) {
    await modulesApi.toggle(id, is_enabled);
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, is_enabled } : m)));
    toast.success(`${is_enabled ? t('admin.module_on') : t('admin.module_off')}`);
  }

  function renderSection(children: React.ReactNode, saveData: Record<string, unknown>) {
    return (
      <div className="space-y-6">
        {children}
        <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {hasPermission('settings', 'edit') && (
            <button className="btn-primary" onClick={() => saveSettings(activeTab, saveData)} disabled={saving}>
              <Save size={16} /> {saving ? t('admin.saving') : t('admin.save_changes')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('admin.settings_title')}</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.settings_desc')}</p>
      </div>

      <div className="tabs overflow-x-auto flex-nowrap">
        {(Object.keys(TAB_KEYS) as Tab[]).map((key) => {
          const iconMap: Record<string, typeof Cog> = { general: Cog, branding: Palette, security: Shield, email: Mail, integrations: Puzzle, features: Globe, localization: Languages, pages: Layout, dashboard: LayoutDashboard, translations: BookOpen, email_templates: FileText };
          const Icon = iconMap[key];
          return (
            <button key={key} className={`tab whitespace-nowrap ${activeTab === key ? 'tab-active' : ''}`} onClick={() => setActiveTab(key)}>
              <Icon size={14} /> {t(TAB_KEYS[key])}
            </button>
          );
        })}
      </div>

      <div className="card">
        {activeTab === 'general' && renderSection(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">{t('admin.app_name')}</label><input className="input" value={general.app_name} onChange={(e) => setGeneral({ ...general, app_name: e.target.value })} /></div>
            <div><label className="label">{t('admin.company_name')}</label><input className="input" value={general.company_name} onChange={(e) => setGeneral({ ...general, company_name: e.target.value })} /></div>
            <div><label className="label">{t('admin.timezone')}</label>
              <select className="input" value={general.timezone} onChange={(e) => setGeneral({ ...general, timezone: e.target.value })}>
                {['Asia/Riyadh','Asia/Dubai','Asia/Kuwait','Asia/Qatar','Asia/Bahrain','Asia/Muscat','Asia/Amman','Africa/Cairo','Asia/Beirut','UTC'].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div><label className="label">{t('admin.date_format')}</label>
              <select className="input" value={general.date_format} onChange={(e) => setGeneral({ ...general, date_format: e.target.value })}>
                {['YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY','DD.MM.YYYY'].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div><label className="label">{t('admin.currency')}</label>
              <select className="input" value={general.currency} onChange={(e) => setGeneral({ ...general, currency: e.target.value })}>
                {['SAR','USD','EUR','GBP','AED','KWD','QAR','BHD','OMR','EGP'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">{t('admin.currency_symbol')}</label><input className="input" value={general.currency_symbol} onChange={(e) => setGeneral({ ...general, currency_symbol: e.target.value })} /></div>
            <div><label className="label">{t('admin.favicon_url')}</label><input className="input" value={general.favicon_url} onChange={(e) => setGeneral({ ...general, favicon_url: e.target.value })} placeholder="https://example.com/favicon.ico" /></div>
            <div><label className="label">{t('admin.max_upload_size')}</label><input type="number" className="input" value={general.max_upload_size_mb} onChange={(e) => setGeneral({ ...general, max_upload_size_mb: parseInt(e.target.value) || 10 })} /></div>
          </div>,
          general
        )}

        {activeTab === 'branding' && renderSection(
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">{t('admin.logo_url')}</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={branding.logo_url} onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })} />
                  {branding.logo_url && <img src={branding.logo_url} alt="" className="h-10 w-10 rounded object-cover" />}
                </div>
              </div>
              <div><label className="label">{t('admin.login_logo_url2')}</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={branding.login_logo_url} onChange={(e) => setBranding({ ...branding, login_logo_url: e.target.value })} />
                  {branding.login_logo_url && <img src={branding.login_logo_url} alt="" className="h-10 w-10 rounded object-cover" />}
                </div>
              </div>
              <div><label className="label">{t('admin.primary_color')}</label>
                <div className="flex gap-2 items-center">
                  <input type="color" className="h-10 w-16 rounded border cursor-pointer" value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} />
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{branding.primary_color}</span>
                  <span className="w-5 h-5 rounded-full border" style={{ backgroundColor: branding.primary_color }} />
                </div>
              </div>
              <div><label className="label">{t('admin.secondary_accent2')}</label>
                <div className="flex gap-2 items-center">
                  <input type="color" className="h-10 w-16 rounded border cursor-pointer" value={branding.secondary_color} onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })} />
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{branding.secondary_color}</span>
                  <span className="w-5 h-5 rounded-full border" style={{ backgroundColor: branding.secondary_color }} />
                </div>
              </div>
              <div><label className="label">{t('admin.default_theme')}</label>
                <select className="input" value={branding.theme} onChange={(e) => setBranding({ ...branding, theme: e.target.value as 'light' | 'dark' })}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
              <div><label className="label">{t('admin.default_language')}</label>
                <select className="input" value={branding.default_language} onChange={(e) => setBranding({ ...branding, default_language: e.target.value as 'ar' | 'en' })}>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="md:col-span-2"><label className="label">{t('admin.login_message')}</label>
                <textarea className="input" rows={2} value={branding.login_message} onChange={(e) => setBranding({ ...branding, login_message: e.target.value })} placeholder="Welcome message shown on login page" />
              </div>
              <div className="md:col-span-2"><label className="label">{t('admin.custom_css')}</label>
                <textarea className="input font-mono text-xs" rows={4} value={branding.custom_css} onChange={(e) => setBranding({ ...branding, custom_css: e.target.value })} placeholder="/* Inject custom CSS here */" />
              </div>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>{t('admin.preview')}</h4>
              <div className="flex gap-3 items-center">
                {branding.logo_url && <img src={branding.logo_url} alt="" className="h-10 w-10 rounded" />}
                <div>
                  <p className="text-lg font-bold" style={{ color: branding.primary_color }}>{general.app_name || 'ERP'}</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{general.company_name || 'Company'}</p>
                </div>
                <div className="flex gap-1 ms-auto">
                  <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: branding.primary_color }} />
                  <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: branding.secondary_color }} />
                </div>
              </div>
            </div>
          </div>,
          branding
        )}

        {activeTab === 'security' && renderSection(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="label">{t('admin.session_timeout')}</label><input type="number" className="input" value={security.session_timeout_minutes} onChange={(e) => setSecurity({ ...security, session_timeout_minutes: parseInt(e.target.value) || 60 })} /></div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" className="w-4 h-4 rounded" checked={security.maintenance_mode} onChange={(e) => setSecurity({ ...security, maintenance_mode: e.target.checked })} id="mm" />
              <label htmlFor="mm" className="text-sm">{t('admin.maintenance_mode')}</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" className="w-4 h-4 rounded" checked={security.enable_registration} onChange={(e) => setSecurity({ ...security, enable_registration: e.target.checked })} id="reg" />
              <label htmlFor="reg" className="text-sm">{t('admin.enable_registration')}</label>
            </div>
            <div><label className="label">{t('admin.privacy_policy_url')}</label><input className="input" value={security.privacy_policy_url} onChange={(e) => setSecurity({ ...security, privacy_policy_url: e.target.value })} /></div>
            <div><label className="label">{t('admin.terms_url')}</label><input className="input" value={security.terms_url} onChange={(e) => setSecurity({ ...security, terms_url: e.target.value })} /></div>
          </div>,
          security
        )}

        {activeTab === 'email' && renderSection(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">{t('admin.from_name')}</label><input className="input" value={email.from_name} onChange={(e) => setEmail({ ...email, from_name: e.target.value })} placeholder="ERP System" /></div>
            <div><label className="label">{t('admin.from_address')}</label><input type="email" className="input" value={email.from_address} onChange={(e) => setEmail({ ...email, from_address: e.target.value })} placeholder="noreply@example.com" /></div>
            <div><label className="label">{t('admin.smtp_host')}</label><input className="input" value={email.smtp_host} onChange={(e) => setEmail({ ...email, smtp_host: e.target.value })} placeholder="smtp.example.com" /></div>
            <div><label className="label">{t('admin.smtp_port')}</label><input type="number" className="input" value={email.smtp_port} onChange={(e) => setEmail({ ...email, smtp_port: parseInt(e.target.value) || 587 })} /></div>
            <div><label className="label">{t('admin.smtp_user')}</label><input className="input" value={email.smtp_user} onChange={(e) => setEmail({ ...email, smtp_user: e.target.value })} /></div>
            <div><label className="label">{t('admin.smtp_pass')}</label><input type="password" className="input" value={email.smtp_pass} onChange={(e) => setEmail({ ...email, smtp_pass: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="label">{t('admin.notification_email')}</label><input type="email" className="input" value={email.notification_email} onChange={(e) => setEmail({ ...email, notification_email: e.target.value })} placeholder="notifications@example.com" /></div>
          </div>,
          email
        )}

        {activeTab === 'integrations' && renderSection(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="label">{t('admin.google_maps_key')}</label>
              <input className="input font-mono text-xs" value={integrations.google_maps_api_key} onChange={(e) => setIntegrations({ ...integrations, google_maps_api_key: e.target.value })} placeholder="AIzaSy..." />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Required for interactive maps on the Maps page</p>
            </div>
            <div><label className="label">{t('admin.sms_provider')}</label>
              <select className="input" value={integrations.sms_provider} onChange={(e) => setIntegrations({ ...integrations, sms_provider: e.target.value })}>
                <option value="">None</option>
                <option value="twilio">Twilio</option>
                <option value="nexmo">Vonage (Nexmo)</option>
                <option value="msg91">MSG91</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div><label className="label">{t('admin.webhook_url')}</label><input className="input font-mono text-xs" value={integrations.webhook_url} onChange={(e) => setIntegrations({ ...integrations, webhook_url: e.target.value })} placeholder="https://hooks.example.com/notify" /></div>
          </div>,
          integrations
        )}

        {activeTab === 'features' && (
          <div className="space-y-6">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.features_desc')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {modules.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                  <input type="checkbox" className="w-4 h-4 rounded" checked={m.is_enabled} onChange={() => toggleModule(m.id, !m.is_enabled)} id={`mod-${m.id}`} />
                  <label htmlFor={`mod-${m.id}`} className="text-sm font-medium cursor-pointer flex-1">{m.name_en || m.code}</label>
                  <span className={`badge text-xs ${m.is_enabled ? 'badge-success' : 'badge-neutral'}`}>{m.is_enabled ? t('admin.module_on') : t('admin.module_off')}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button className="btn-sm btn-secondary" onClick={() => { refreshSettings(); toast.success(t('admin.modules_refreshed')); }}>
                <RefreshCw size={14} /> {t('admin.refresh')}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'localization' && renderSection(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">{t('admin.font_family')}</label>
              <select className="input" value={localization.font_family} onChange={(e) => setLocalization({ ...localization, font_family: e.target.value })}>
                <option value="Inter">Inter (English)</option>
                <option value="Cairo">Cairo (Arabic)</option>
                <option value="Noto Sans Arabic">Noto Sans Arabic</option>
                <option value="Tajawal">Tajawal</option>
                <option value="system-ui">System UI</option>
                <option value="Roboto">Roboto</option>
              </select>
            </div>
            <div><label className="label">{t('admin.date_display_format')}</label>
              <select className="input" value={localization.date_format_display} onChange={(e) => setLocalization({ ...localization, date_format_display: e.target.value })}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD.MM.YYYY">DD.MM.YYYY</option>
              </select>
            </div>
            <div><label className="label">{t('admin.time_format')}</label>
              <select className="input" value={localization.time_format} onChange={(e) => setLocalization({ ...localization, time_format: e.target.value })}>
                <option value="24h">24-hour (14:30)</option>
                <option value="12h">12-hour (2:30 PM)</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" className="w-4 h-4 rounded" checked={localization.rtl_enabled} onChange={(e) => setLocalization({ ...localization, rtl_enabled: e.target.checked })} id="rtl" />
              <label htmlFor="rtl" className="text-sm">{t('admin.enable_rtl')}</label>
            </div>
          </div>,
          localization
        )}

        {activeTab === 'pages' && <PagesTab />}
        {activeTab === 'translations' && <TranslationsEditor />}
        {activeTab === 'email_templates' && <EmailTemplatesEditor />}
        {activeTab === 'dashboard' && renderSection(
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.dashboard_desc')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_WIDGETS.map((w) => (
                <label key={w} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--color-border)' }}>
                  <input type="checkbox" className="w-4 h-4 rounded"
                    checked={dashboardWidgets.includes(w)}
                    onChange={() => {
                      setDashboardWidgets(prev =>
                        prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]
                      );
                    }}
                  />
                  <span className="text-sm">{t(`dashboard.widget_${w}`) || w}</span>
                </label>
              ))}
            </div>
          </div>,
          { dashboard_widgets: JSON.stringify(dashboardWidgets) }
        )}
      </div>
    </div>
  );
}

function TranslationsEditor() {
  const t = useT();
  const toast = useToast();
  const { hasPermission, user } = useAuth();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [locale, setLocale] = useState<'en' | 'ar'>('en');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      if (user?.id) {
        try {
          const dbOverrides = await translationApi.list(user.id, locale);
          setOverrides(dbOverrides);
          try { localStorage.setItem(`translation_overrides_${locale}`, JSON.stringify(dbOverrides)); } catch { /* ignore */ }
        } catch {
          try {
            const raw = localStorage.getItem(`translation_overrides_${locale}`);
            setOverrides(raw ? JSON.parse(raw) : {});
          } catch { setOverrides({}); }
        }
      } else {
        try {
          const raw = localStorage.getItem(`translation_overrides_${locale}`);
          setOverrides(raw ? JSON.parse(raw) : {});
        } catch { setOverrides({}); }
      }
      setLoading(false);
    })();
  }, [locale, user?.id]);

  async function save(key: string, value: string) {
    const next = { ...overrides, [key]: value };
    setOverrides(next);
    try { localStorage.setItem(`translation_overrides_${locale}`, JSON.stringify(next)); } catch { console.error('localStorage write failed'); }
    if (user?.id) {
      try { await translationApi.upsert(user.id, locale, key, value); } catch { console.error('DB save failed'); }
    }
    toast.success(t('admin.settings_saved'));
  }

  async function removeKey(key: string) {
    const next = { ...overrides };
    delete next[key];
    setOverrides(next);
    try { localStorage.setItem(`translation_overrides_${locale}`, JSON.stringify(next)); } catch { console.error('localStorage write failed'); }
    if (user?.id) {
      try { await translationApi.remove(user.id, locale, key); } catch { console.error('DB remove failed'); }
    }
    toast.success(t('admin.translation_removed'));
  }

  async function addNew() {
    if (!newKey.trim() || !newValue.trim()) return;
    await save(newKey.trim(), newValue.trim());
    setNewKey('');
    setNewValue('');
  }

  const filtered = searchTerm
    ? Object.entries(overrides).filter(([k, v]) => k.includes(searchTerm) || v.includes(searchTerm))
    : Object.entries(overrides);

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <select className="input text-sm w-24" value={locale} onChange={e => setLocale(e.target.value as 'en' | 'ar')}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
          <input className="input text-sm flex-1 min-w-[200px]" placeholder={t('admin.filter_modules')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        {hasPermission('settings', 'create') && (
          <button className="btn-primary btn-sm" onClick={addNew} disabled={!newKey.trim() || !newValue.trim()}>
            <Plus size={14} /> {t('admin.translation_add')}
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <input className="input text-sm flex-1" placeholder={t('admin.translation_key')} value={newKey} onChange={e => setNewKey(e.target.value)} />
        <input className="input text-sm flex-[2]" placeholder={t('admin.translation_value')} value={newValue} onChange={e => setNewValue(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('admin.translation_no_overrides')}</div>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {filtered.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 p-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)' }}>
              <code className="text-xs font-mono w-1/3 shrink-0 truncate" style={{ color: 'var(--color-text-secondary)' }}>{key}</code>
              <input className="input text-xs flex-1" value={value} onChange={e => { setOverrides({ ...overrides, [key]: e.target.value }); }} />
              <button className="btn-xs btn-ghost" onClick={() => save(key, overrides[key])}><Save size={12} /></button>
              {hasPermission('settings', 'delete') && <button className="btn-xs btn-ghost text-red-500" onClick={() => removeKey(key)}><Trash2 size={12} /></button>}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{Object.keys(overrides).length} override(s)</p>
    </div>
  );
}

function EmailTemplatesEditor() {
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<EmailTemplate> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [previewLocale, setPreviewLocale] = useState<'en' | 'ar'>('en');
  const [previewData, setPreviewData] = useState<string>('{}');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const data = await emailTemplatesApi.list();
      setTemplates(data);
    } catch { toast.error('Failed to load templates'); }
    setLoading(false);
  }

  async function save() {
    if (!editing?.code || !editing?.name_en || !editing?.subject_en || !editing?.body_en) {
      toast.error('Code, name, subject, and body are required');
      return;
    }
    setSaving(true);
    try {
      await emailTemplatesApi.upsert(editing as EmailTemplate);
      toast.success(t('email_templates.saved'));
      setShowForm(false);
      setEditing(null);
      await load();
    } catch { toast.error('Save failed'); }
    setSaving(false);
  }

  async function remove(id: string) {
    try {
      await emailTemplatesApi.remove(id);
      toast.success(t('email_templates.deleted'));
      await load();
    } catch { toast.error('Delete failed'); }
  }

  function openNew() {
    setEditing({ code: '', name_en: '', name_ar: '', subject_en: '', subject_ar: '', body_en: '', body_ar: '', variables: [], is_active: true });
    setShowForm(true);
  }

  function openEdit(tpl: EmailTemplate) {
    setEditing({ ...tpl });
    setShowForm(true);
  }

  function insertVar(v: string) {
    if (!editing) return;
    const ta = document.activeElement as HTMLTextAreaElement;
    if (ta && ta.name?.startsWith('body_')) {
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? 0;
      const val = ta.value;
      ta.value = val.slice(0, start) + `{{${v}}}` + val.slice(end);
      ta.selectionStart = ta.selectionEnd = start + v.length + 4;
      setEditing({ ...editing, [ta.name]: ta.value });
    }
  }

  function renderPreview(tpl: Partial<EmailTemplate>) {
    try {
      const vars = JSON.parse(previewData) as Record<string, string>;
      const raw = previewLocale === 'ar' ? tpl.body_ar : tpl.body_en;
      if (!raw) return '<p style="color:red">No body content for this locale</p>';
      let html = raw;
      Object.entries(vars).forEach(([k, val]) => {
        html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), val);
      });
      return html;
    } catch {
      return '<p style="color:red">Invalid JSON in preview variables</p>';
    }
  }

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('email_templates.description')}</p>
        {hasPermission('settings', 'create') && (
          <button className="btn-primary btn-sm" onClick={openNew}><Plus size={14} /> {t('email_templates.add')}</button>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('email_templates.no_templates')}</div>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <FileText size={16} className="shrink-0" style={{ color: 'var(--color-primary)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{tpl.name_en} / {tpl.name_ar}</p>
                  <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{tpl.code}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${tpl.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {tpl.is_active ? t('email_templates.active') : t('email_templates.inactive')}
                </span>
              </div>
              <div className="flex gap-1">
                <button className="btn-xs btn-ghost" onClick={() => { setPreviewData(JSON.stringify(Object.fromEntries((tpl.variables || []).map(v => [v, `sample_${v}`])), null, 2)); setShowPreview(true); setEditing(tpl); }}><Eye size={12} /></button>
                {hasPermission('settings', 'edit') && <button className="btn-xs btn-ghost" onClick={() => openEdit(tpl)}><Edit3 size={12} /></button>}
                {hasPermission('settings', 'delete') && <button className="btn-xs btn-ghost text-red-500" onClick={() => remove(tpl.id)}><Trash2 size={12} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{editing.id ? t('email_templates.edit') : t('email_templates.add')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">{t('email_templates.code')}</label><input className="input" value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })} /></div>
              <div><label className="label">{t('email_templates.name_en')}</label><input className="input" value={editing.name_en} onChange={e => setEditing({ ...editing, name_en: e.target.value })} /></div>
              <div><label className="label">{t('email_templates.name_ar')}</label><input className="input" value={editing.name_ar} onChange={e => setEditing({ ...editing, name_ar: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <label className="label mb-0">{t('email_templates.active')}</label>
                <input type="checkbox" checked={!!editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />
              </div>
              <div className="col-span-2"><label className="label">{t('email_templates.subject_en')}</label><input className="input" value={editing.subject_en} onChange={e => setEditing({ ...editing, subject_en: e.target.value })} /></div>
              <div className="col-span-2"><label className="label">{t('email_templates.subject_ar')}</label><input className="input" value={editing.subject_ar} onChange={e => setEditing({ ...editing, subject_ar: e.target.value })} /></div>
              <div className="col-span-2">
                <label className="label">{t('email_templates.body_en')}</label>
                <div className="flex gap-1 mb-1 flex-wrap">
                  {(editing.variables || []).map(v => (
                    <button key={v} className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200" onClick={() => insertVar(v)}>{`{{${v}}}`}</button>
                  ))}
                </div>
                <textarea className="input font-mono text-xs w-full" name="body_en" rows={6} value={editing.body_en} onChange={e => setEditing({ ...editing, body_en: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">{t('email_templates.body_ar')}</label>
                <div className="flex gap-1 mb-1 flex-wrap">
                  {(editing.variables || []).map(v => (
                    <button key={v} className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200" onClick={() => insertVar(v)}>{`{{${v}}}`}</button>
                  ))}
                </div>
                <textarea className="input font-mono text-xs w-full" name="body_ar" rows={6} value={editing.body_ar} onChange={e => setEditing({ ...editing, body_ar: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">{t('email_templates.variables')}</label>
                <input className="input text-sm" placeholder="var1, var2, var3" value={(editing.variables || []).join(', ')} onChange={e => setEditing({ ...editing, variables: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
              </div>
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
          <div className="rounded-xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{t('email_templates.preview')}</h3>
            <div className="flex items-center gap-3 mb-3">
              <select className="input text-sm w-24" value={previewLocale} onChange={e => setPreviewLocale(e.target.value as 'en' | 'ar')}>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Subject: {previewLocale === 'ar' ? editing.subject_ar : editing.subject_en}</span>
            </div>
            <div className="mb-3">
              <label className="label">Sample Variables (JSON)</label>
              <textarea className="input font-mono text-xs w-full" rows={3} value={previewData} onChange={e => setPreviewData(e.target.value)} />
            </div>
            <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)', background: 'white' }}>
              <iframe srcDoc={renderPreview(editing)} title="Preview" className="w-full" style={{ minHeight: 300, border: 'none' }} />
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-secondary btn-sm" onClick={() => setShowPreview(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PagesTab() {
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [pages, setPages] = useState<PageRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PageRegistryEntry> | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await pageRegistryApi.list();
      setPages(data);
    } catch { setPages([]); }
    setLoading(false);
  }

  async function save() {
    if (!editing?.code || !editing?.path || !editing?.name_en) return;
    try {
      await pageRegistryApi.upsert(editing);
      toast.success(t('admin.page_saved'));
      setEditing(null); setIsNew(false); load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('admin.save_failed'));
    }
  }

  async function remove(id: string) {
    try { await pageRegistryApi.remove(id); toast.success(t('admin.page_removed')); load(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : t('admin.save_failed')); }
  }

  async function toggleEnabled(id: string, current: boolean) {
    try { await pageRegistryApi.upsert({ id, is_enabled: !current }); load(); }
    catch { toast.error(t('admin.page_toggle_failed')); }
  }

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>;

  const sorted = [...pages].sort((a, b) => a.sort_order - b.sort_order);
  const parentCodes = sorted.map(p => p.code);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{t('admin.page_registry')}</h3>
        {hasPermission('settings', 'create') && (
          <button className="btn-primary btn-sm" onClick={() => {
            setEditing({ code: '', path: '/', name_en: '', name_ar: '', icon: 'Globe', sort_order: sorted.length * 10, is_enabled: true, is_admin: false });
            setIsNew(true);
          }}>
            <Plus size={14} /> {t('admin.add_page')}
          </button>
        )}
      </div>

      {editing && (
        <div className="border rounded-lg p-4 space-y-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className="label text-xs">{t('admin.page_code')} *</label><input className="input text-sm" value={editing.code || ''} onChange={e => setEditing({ ...editing, code: e.target.value })} disabled={!isNew} /></div>
            <div><label className="label text-xs">{t('admin.page_path')} *</label><input className="input text-sm" value={editing.path || ''} onChange={e => setEditing({ ...editing, path: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.page_icon')}</label><input className="input text-sm" value={editing.icon || ''} onChange={e => setEditing({ ...editing, icon: e.target.value })} placeholder="Lucide icon name" /></div>
            <div><label className="label text-xs">{t('admin.page_name_en')} *</label><input className="input text-sm" value={editing.name_en || ''} onChange={e => setEditing({ ...editing, name_en: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.page_name_ar')}</label><input className="input text-sm" value={editing.name_ar || ''} onChange={e => setEditing({ ...editing, name_ar: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.page_parent')}</label>
              <select className="input text-sm" value={editing.parent_code || ''} onChange={e => setEditing({ ...editing, parent_code: e.target.value || undefined })}>
                <option value="">{t('admin.page_no_parent')}</option>
                {parentCodes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label text-xs">{t('admin.page_section_key')}</label><input className="input text-sm" value={editing.section_key || ''} onChange={e => setEditing({ ...editing, section_key: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.page_section_label_en')}</label><input className="input text-sm" value={editing.section_label_en || ''} onChange={e => setEditing({ ...editing, section_label_en: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.page_section_label_ar')}</label><input className="input text-sm" value={editing.section_label_ar || ''} onChange={e => setEditing({ ...editing, section_label_ar: e.target.value })} /></div>
            <div><label className="label text-xs">{t('admin.page_sort_order')}</label><input type="number" className="input text-sm" value={editing.sort_order || 0} onChange={e => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} /></div>
            <div><label className="label text-xs">{t('admin.page_require_module')}</label><input className="input text-sm" value={editing.require_module || ''} onChange={e => setEditing({ ...editing, require_module: e.target.value })} placeholder="e.g. project_module" /></div>
            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.is_enabled ?? true} onChange={e => setEditing({ ...editing, is_enabled: e.target.checked })} />
                {t('admin.page_enabled')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.is_admin ?? false} onChange={e => setEditing({ ...editing, is_admin: e.target.checked })} />
                {t('admin.page_admin')}
              </label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-sm btn-secondary" onClick={() => { setEditing(null); setIsNew(false); }}><X size={14} /> {t('common.cancel')}</button>
            {hasPermission('settings', 'edit') && <button className="btn-sm btn-primary" onClick={save}><Save size={14} /> {t('common.save')}</button>}
          </div>
        </div>
      )}

      <div className="space-y-1">
        {sorted.map(page => (
          <div key={page.id} className="flex items-center justify-between p-2.5 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: page.is_enabled ? 'var(--color-success, #22c55e)' : 'color-mix(in srgb, var(--color-text) 40%, transparent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{page.name_en}</span>
              <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>({page.code})</span>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{page.path}</span>
              {page.is_admin && <span className="badge badge-neutral text-[10px]">ADMIN</span>}
              {page.section_key && <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{t('admin.section')}: {page.section_key}</span>}
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{t('admin.order')}: {page.sort_order}</span>
            </div>
            <div className="flex gap-1 shrink-0">
              <button className="btn-xs btn-ghost" onClick={() => page.id && toggleEnabled(page.id, page.is_enabled)} title={t('admin.toggle_enabled')}>
                {page.is_enabled ? t('admin.module_on') : t('admin.module_off')}
              </button>
              <button className="btn-xs btn-ghost" onClick={() => { setEditing(page); setIsNew(false); }}><Edit3 size={12} /></button>
              {hasPermission('settings', 'delete') && <button className="btn-xs btn-ghost text-red-500" onClick={() => page.id && remove(page.id)}><Trash2 size={12} /></button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
