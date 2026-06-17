import { useState, useEffect } from 'react';
import { useT } from '../../hooks/useTranslation';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { settingsApi, modulesApi } from '../../services/api';
import { Save, Image, Palette, Globe, Shield, Mail, Puzzle, Cog, Languages, RefreshCw } from 'lucide-react';

type Tab = 'general' | 'branding' | 'security' | 'email' | 'integrations' | 'features' | 'localization';

const TABS: { key: Tab; label: string; icon: typeof Cog }[] = [
  { key: 'general', label: 'General', icon: Cog },
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'integrations', label: 'Integrations', icon: Puzzle },
  { key: 'features', label: 'Features', icon: Globe },
  { key: 'localization', label: 'Localization', icon: Languages },
];

export default function AdminSettingsPage() {
  const t = useT();
  const toast = useToast();
  const { settings, refreshSettings } = useSettings();
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
  }, [settings]);

  useEffect(() => {
    modulesApi.list().then(setModules);
  }, []);

  async function saveSettings(group: string, data: Record<string, unknown>) {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(data)) {
        const settingKey = `${group}.${key}`;
        await settingsApi.set(settingKey, value);
      }
      await refreshSettings();
      toast.success('Settings saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleModule(id: string, is_enabled: boolean) {
    await modulesApi.toggle(id, is_enabled);
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, is_enabled } : m)));
    toast.success(`Module ${is_enabled ? 'enabled' : 'disabled'}`);
  }

  function renderSection(children: React.ReactNode, saveData: Record<string, unknown>) {
    return (
      <div className="space-y-6">
        {children}
        <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button className="btn-primary" onClick={() => saveSettings(activeTab, saveData)} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>System Settings</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>Configure all system settings from one place</p>
      </div>

      <div className="tabs overflow-x-auto flex-nowrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`tab whitespace-nowrap ${activeTab === key ? 'tab-active' : ''}`} onClick={() => setActiveTab(key)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="card">
        {/* ===== GENERAL ===== */}
        {activeTab === 'general' && renderSection(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Application Name</label><input className="input" value={general.app_name} onChange={(e) => setGeneral({ ...general, app_name: e.target.value })} /></div>
            <div><label className="label">Company Name</label><input className="input" value={general.company_name} onChange={(e) => setGeneral({ ...general, company_name: e.target.value })} /></div>
            <div><label className="label">Timezone</label>
              <select className="input" value={general.timezone} onChange={(e) => setGeneral({ ...general, timezone: e.target.value })}>
                {['Asia/Riyadh','Asia/Dubai','Asia/Kuwait','Asia/Qatar','Asia/Bahrain','Asia/Muscat','Asia/Amman','Africa/Cairo','Asia/Beirut','UTC'].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div><label className="label">Date Format</label>
              <select className="input" value={general.date_format} onChange={(e) => setGeneral({ ...general, date_format: e.target.value })}>
                {['YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY','DD.MM.YYYY'].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div><label className="label">Currency</label>
              <select className="input" value={general.currency} onChange={(e) => setGeneral({ ...general, currency: e.target.value })}>
                {['SAR','USD','EUR','GBP','AED','KWD','QAR','BHD','OMR','EGP'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Currency Symbol</label><input className="input" value={general.currency_symbol} onChange={(e) => setGeneral({ ...general, currency_symbol: e.target.value })} /></div>
            <div><label className="label">Favicon URL</label><input className="input" value={general.favicon_url} onChange={(e) => setGeneral({ ...general, favicon_url: e.target.value })} placeholder="https://example.com/favicon.ico" /></div>
            <div><label className="label">Max Upload Size (MB)</label><input type="number" className="input" value={general.max_upload_size_mb} onChange={(e) => setGeneral({ ...general, max_upload_size_mb: parseInt(e.target.value) || 10 })} /></div>
          </div>,
          general
        )}

        {/* ===== BRANDING ===== */}
        {activeTab === 'branding' && renderSection(
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Logo URL</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={branding.logo_url} onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })} />
                  {branding.logo_url && <img src={branding.logo_url} alt="" className="h-10 w-10 rounded object-cover" />}
                </div>
              </div>
              <div><label className="label">Login Page Logo URL</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={branding.login_logo_url} onChange={(e) => setBranding({ ...branding, login_logo_url: e.target.value })} />
                  {branding.login_logo_url && <img src={branding.login_logo_url} alt="" className="h-10 w-10 rounded object-cover" />}
                </div>
              </div>
              <div><label className="label">Primary Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" className="h-10 w-16 rounded border cursor-pointer" value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} />
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{branding.primary_color}</span>
                  <span className="w-5 h-5 rounded-full border" style={{ backgroundColor: branding.primary_color }} />
                </div>
              </div>
              <div><label className="label">Secondary / Accent Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" className="h-10 w-16 rounded border cursor-pointer" value={branding.secondary_color} onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })} />
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{branding.secondary_color}</span>
                  <span className="w-5 h-5 rounded-full border" style={{ backgroundColor: branding.secondary_color }} />
                </div>
              </div>
              <div><label className="label">Default Theme</label>
                <select className="input" value={branding.theme} onChange={(e) => setBranding({ ...branding, theme: e.target.value as 'light' | 'dark' })}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
              <div><label className="label">Default Language</label>
                <select className="input" value={branding.default_language} onChange={(e) => setBranding({ ...branding, default_language: e.target.value as 'ar' | 'en' })}>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="md:col-span-2"><label className="label">Login Page Message</label>
                <textarea className="input" rows={2} value={branding.login_message} onChange={(e) => setBranding({ ...branding, login_message: e.target.value })} placeholder="Welcome message shown on login page" />
              </div>
              <div className="md:col-span-2"><label className="label">Custom CSS</label>
                <textarea className="input font-mono text-xs" rows={4} value={branding.custom_css} onChange={(e) => setBranding({ ...branding, custom_css: e.target.value })} placeholder="/* Inject custom CSS here */" />
              </div>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Preview</h4>
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

        {/* ===== SECURITY ===== */}
        {activeTab === 'security' && renderSection(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="label">Session Timeout (minutes)</label><input type="number" className="input" value={security.session_timeout_minutes} onChange={(e) => setSecurity({ ...security, session_timeout_minutes: parseInt(e.target.value) || 60 })} /></div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" className="w-4 h-4 rounded" checked={security.maintenance_mode} onChange={(e) => setSecurity({ ...security, maintenance_mode: e.target.checked })} id="mm" />
              <label htmlFor="mm" className="text-sm">Maintenance Mode (block non-admin access)</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" className="w-4 h-4 rounded" checked={security.enable_registration} onChange={(e) => setSecurity({ ...security, enable_registration: e.target.checked })} id="reg" />
              <label htmlFor="reg" className="text-sm">Enable Self-Registration</label>
            </div>
            <div><label className="label">Privacy Policy URL</label><input className="input" value={security.privacy_policy_url} onChange={(e) => setSecurity({ ...security, privacy_policy_url: e.target.value })} /></div>
            <div><label className="label">Terms & Conditions URL</label><input className="input" value={security.terms_url} onChange={(e) => setSecurity({ ...security, terms_url: e.target.value })} /></div>
          </div>,
          security
        )}

        {/* ===== EMAIL ===== */}
        {activeTab === 'email' && renderSection(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">From Name</label><input className="input" value={email.from_name} onChange={(e) => setEmail({ ...email, from_name: e.target.value })} placeholder="ERP System" /></div>
            <div><label className="label">From Address</label><input type="email" className="input" value={email.from_address} onChange={(e) => setEmail({ ...email, from_address: e.target.value })} placeholder="noreply@example.com" /></div>
            <div><label className="label">SMTP Host</label><input className="input" value={email.smtp_host} onChange={(e) => setEmail({ ...email, smtp_host: e.target.value })} placeholder="smtp.example.com" /></div>
            <div><label className="label">SMTP Port</label><input type="number" className="input" value={email.smtp_port} onChange={(e) => setEmail({ ...email, smtp_port: parseInt(e.target.value) || 587 })} /></div>
            <div><label className="label">SMTP Username</label><input className="input" value={email.smtp_user} onChange={(e) => setEmail({ ...email, smtp_user: e.target.value })} /></div>
            <div><label className="label">SMTP Password</label><input type="password" className="input" value={email.smtp_pass} onChange={(e) => setEmail({ ...email, smtp_pass: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="label">Notification Email</label><input type="email" className="input" value={email.notification_email} onChange={(e) => setEmail({ ...email, notification_email: e.target.value })} placeholder="notifications@example.com" /></div>
          </div>,
          email
        )}

        {/* ===== INTEGRATIONS ===== */}
        {activeTab === 'integrations' && renderSection(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="label">Google Maps API Key</label>
              <input className="input font-mono text-xs" value={integrations.google_maps_api_key} onChange={(e) => setIntegrations({ ...integrations, google_maps_api_key: e.target.value })} placeholder="AIzaSy..." />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Required for interactive maps on the Maps page</p>
            </div>
            <div><label className="label">SMS Provider</label>
              <select className="input" value={integrations.sms_provider} onChange={(e) => setIntegrations({ ...integrations, sms_provider: e.target.value })}>
                <option value="">None</option>
                <option value="twilio">Twilio</option>
                <option value="nexmo">Vonage (Nexmo)</option>
                <option value="msg91">MSG91</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div><label className="label">Webhook URL</label><input className="input font-mono text-xs" value={integrations.webhook_url} onChange={(e) => setIntegrations({ ...integrations, webhook_url: e.target.value })} placeholder="https://hooks.example.com/notify" /></div>
          </div>,
          integrations
        )}

        {/* ===== FEATURES ===== */}
        {activeTab === 'features' && (
          <div className="space-y-6">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Enable or disable system modules globally</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {modules.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                  <input type="checkbox" className="w-4 h-4 rounded" checked={m.is_enabled} onChange={() => toggleModule(m.id, !m.is_enabled)} id={`mod-${m.id}`} />
                  <label htmlFor={`mod-${m.id}`} className="text-sm font-medium cursor-pointer flex-1">{m.name_en || m.code}</label>
                  <span className={`badge text-xs ${m.is_enabled ? 'badge-success' : 'badge-neutral'}`}>{m.is_enabled ? 'ON' : 'OFF'}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button className="btn-sm btn-secondary" onClick={() => { refreshSettings(); toast.success('Modules refreshed'); }}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>
        )}

        {/* ===== LOCALIZATION ===== */}
        {activeTab === 'localization' && renderSection(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Font Family</label>
              <select className="input" value={localization.font_family} onChange={(e) => setLocalization({ ...localization, font_family: e.target.value })}>
                <option value="Inter">Inter (English)</option>
                <option value="Cairo">Cairo (Arabic)</option>
                <option value="Noto Sans Arabic">Noto Sans Arabic</option>
                <option value="Tajawal">Tajawal</option>
                <option value="system-ui">System UI</option>
                <option value="Roboto">Roboto</option>
              </select>
            </div>
            <div><label className="label">Date Display Format</label>
              <select className="input" value={localization.date_format_display} onChange={(e) => setLocalization({ ...localization, date_format_display: e.target.value })}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD.MM.YYYY">DD.MM.YYYY</option>
              </select>
            </div>
            <div><label className="label">Time Format</label>
              <select className="input" value={localization.time_format} onChange={(e) => setLocalization({ ...localization, time_format: e.target.value })}>
                <option value="24h">24-hour (14:30)</option>
                <option value="12h">12-hour (2:30 PM)</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" className="w-4 h-4 rounded" checked={localization.rtl_enabled} onChange={(e) => setLocalization({ ...localization, rtl_enabled: e.target.checked })} id="rtl" />
              <label htmlFor="rtl" className="text-sm">Enable RTL (Arabic) Layout Support</label>
            </div>
          </div>,
          localization
        )}
      </div>
    </div>
  );
}
