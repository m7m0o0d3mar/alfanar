import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { settingsApi } from '../services/api';
import type { SystemSettings } from '../types';

interface SettingsContextType {
  settings: SystemSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  updateSettings: (partial: Partial<SystemSettings>) => Promise<void>;
}

const defaults: SystemSettings = {
  company_name: 'شركة الإنشاءات',
  logo_url: '',
  primary_color: '#2563eb',
  secondary_color: '#f59e0b',
  success_color: '#16a34a',
  danger_color: '#dc2626',
  warning_color: '#f59e0b',
  info_color: '#0891b2',
  sidebar_bg: '#1e293b',
  sidebar_text: '#f8fafc',
  header_bg: '#ffffff',
  header_text: '#1e293b',
  card_bg: '#ffffff',
  default_language: 'ar',
  app_name: 'ERP',
  theme: 'light',
  font_family: 'Inter',
  custom_css: '',
  login_message: '',
  login_logo_url: '',
  favicon_url: '',
  timezone: '',
  date_format: '',
  dashboard_layout: '2',
  currency: 'SAR',
  currency_symbol: 'ر.س',
  max_upload_size_mb: 10,
  session_timeout_minutes: 60,
  maintenance_mode: false,
  enable_registration: false,
  privacy_policy_url: '',
  terms_url: '',
  email_from_name: '',
  email_from_address: '',
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_pass: '',
  notification_email: '',
  google_maps_api_key: '',
  sms_provider: '',
  webhook_url: '',
  rtl_enabled: false,
  date_format_display: 'YYYY-MM-DD',
  time_format: 'HH:mm',
  dashboard_widgets: '',
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaults, loading: true, refreshSettings: async () => {}, updateSettings: async () => {},
});

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max((num >> 16) - amount, 0);
  const g = Math.max(((num >> 8) & 0xff) - amount, 0);
  const b = Math.max((num & 0xff) - amount, 0);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const RADIUS_PRESETS: Record<string, { base: string; sm: string; lg: string; xl: string }> = {
  sharp: { base: '0.25rem', sm: '0.125rem', lg: '0.375rem', xl: '0.5rem' },
  default: { base: '0.75rem', sm: '0.5rem', lg: '1rem', xl: '1.25rem' },
  rounded: { base: '1rem', sm: '0.625rem', lg: '1.25rem', xl: '1.5rem' },
  pill: { base: '9999px', sm: '9999px', lg: '9999px', xl: '9999px' },
};

const SHADOW_PRESETS: Record<string, { sm: string; md: string; lg: string; xl: string }> = {
  flat: { sm: 'none', md: 'none', lg: 'none', xl: 'none' },
  subtle: { sm: '0 1px 2px rgba(0,0,0,0.04)', md: '0 2px 6px rgba(0,0,0,0.05)', lg: '0 4px 12px rgba(0,0,0,0.06)', xl: '0 8px 20px rgba(0,0,0,0.08)' },
  default: { sm: '0 1px 3px rgba(0,0,0,0.06)', md: '0 4px 12px rgba(0,0,0,0.08)', lg: '0 10px 25px rgba(0,0,0,0.1)', xl: '0 20px 35px rgba(0,0,0,0.12)' },
  prominent: { sm: '0 2px 4px rgba(0,0,0,0.08)', md: '0 6px 16px rgba(0,0,0,0.12)', lg: '0 14px 30px rgba(0,0,0,0.15)', xl: '0 24px 40px rgba(0,0,0,0.18)' },
};

function applyRadiusPreset(preset: string) {
  const p = RADIUS_PRESETS[preset] || RADIUS_PRESETS.default;
  const doc = document.documentElement;
  doc.style.setProperty('--radius', p.base);
  doc.style.setProperty('--radius-sm', p.sm);
  doc.style.setProperty('--radius-lg', p.lg);
  doc.style.setProperty('--radius-xl', p.xl);
}

function applyShadowPreset(preset: string) {
  const p = SHADOW_PRESETS[preset] || SHADOW_PRESETS.default;
  const doc = document.documentElement;
  doc.style.setProperty('--shadow-sm', p.sm);
  doc.style.setProperty('--shadow-md', p.md);
  doc.style.setProperty('--shadow-lg', p.lg);
  doc.style.setProperty('--shadow-xl', p.xl);
}

function applySettingsToDocument(settings: SystemSettings) {
  const doc = document.documentElement;
  doc.style.setProperty('--color-primary', settings.primary_color);
  doc.style.setProperty('--color-primary-dark', darkenColor(settings.primary_color, 25));
  doc.style.setProperty('--color-primary-light', `${settings.primary_color}1a`);
  doc.style.setProperty('--color-primary-gradient', `linear-gradient(135deg, ${settings.primary_color}, ${settings.secondary_color})`);
  doc.style.setProperty('--color-accent', settings.secondary_color);
  doc.style.setProperty('--color-success', settings.success_color);
  doc.style.setProperty('--color-danger', settings.danger_color);
  doc.style.setProperty('--color-warning', settings.warning_color);
  doc.style.setProperty('--color-info', settings.info_color);
  doc.style.setProperty('--color-sidebar', settings.sidebar_bg);
  doc.style.setProperty('--color-sidebar-text', settings.sidebar_text);
  doc.style.setProperty('--color-header-bg', settings.header_bg);
  doc.style.setProperty('--color-header-text', settings.header_text);
  if (settings.card_bg) doc.style.setProperty('--color-surface', settings.card_bg);
  else doc.style.removeProperty('--color-surface');
  if (settings.page_bg) doc.style.setProperty('--color-bg', settings.page_bg as string);
  else doc.style.removeProperty('--color-bg');
  if (settings.border_color) doc.style.setProperty('--color-border', settings.border_color as string);
  else doc.style.removeProperty('--color-border');
  doc.style.setProperty('--sidebar-width', settings.sidebar_width ? `${settings.sidebar_width as number}px` : '');
  doc.style.setProperty('--base-font-size', ((settings.base_font_size as string) || 'default') === 'small' ? '0.8125rem' : ((settings.base_font_size as string) || 'default') === 'large' ? '1rem' : '0.9375rem');
  doc.style.setProperty('--base-line-height', ((settings.line_height as string) || 'default') === 'tight' ? '1.3' : ((settings.line_height as string) || 'default') === 'relaxed' ? '1.7' : '1.5');
  doc.style.setProperty('--content-spacing', ((settings.content_spacing as string) || 'default') === 'compact' ? '0.5rem' : ((settings.content_spacing as string) || 'default') === 'comfortable' ? '1rem' : '0.75rem');
  doc.style.setProperty('--btn-radius', ((settings.button_style as string) || 'default') === 'pill' ? '9999px' : ((settings.button_style as string) || 'default') === 'square' ? '0.375rem' : '9999px');
  doc.style.setProperty('--font-sans', `'${settings.font_family}', system-ui, -apple-system, sans-serif`);
  doc.style.setProperty('--font-arabic', `'${settings.font_family}', system-ui, sans-serif`);
  doc.style.setProperty('--font-body', `'${settings.font_family}', system-ui, sans-serif`);
  doc.dir = settings.rtl_enabled ? 'rtl' : 'ltr';

  applyRadiusPreset((settings.border_radius as string) || 'default');
  applyShadowPreset((settings.shadow_intensity as string) || 'default');

  document.title = settings.app_name
    ? `${settings.app_name}${settings.company_name ? ` - ${settings.company_name}` : ''}`
    : 'ERP - Construction Management';

  let icon = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if (settings.favicon_url) {
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.href = settings.favicon_url;
  }

  const existingStyle = document.getElementById('erp-custom-css');
  if (settings.custom_css) {
    if (existingStyle) {
      existingStyle.textContent = settings.custom_css;
    } else {
      const style = document.createElement('style');
      style.id = 'erp-custom-css';
      style.textContent = settings.custom_css;
      document.head.appendChild(style);
    }
  } else {
    existingStyle?.remove();
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(defaults);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await settingsApi.getAll();
      if (s && Object.keys(s).length) {
        const merged = { ...defaults, ...s };
        setSettings(merged);
        applySettingsToDocument(merged);
      } else {
        applySettingsToDocument(defaults);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (partial: Partial<SystemSettings>) => {
    await settingsApi.setMany(partial as Record<string, unknown>);
    const next = { ...settings, ...partial };
    setSettings(next);
    applySettingsToDocument(next);
  }, [settings]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    applySettingsToDocument(settings);
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
