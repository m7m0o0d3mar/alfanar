import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { settingsApi } from '../services/api';
import type { SystemSettings } from '../types';

interface SettingsContextType {
  settings: SystemSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const defaults: SystemSettings = {
  company_name: 'شركة الإنشاءات',
  logo_url: '',
  primary_color: '#2563eb',
  secondary_color: '#f59e0b',
  default_language: 'ar',
  app_name: 'ERP',
  theme: 'light',
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaults, loading: true, refreshSettings: async () => {},
});

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max((num >> 16) - amount, 0);
  const g = Math.max(((num >> 8) & 0xff) - amount, 0);
  const b = Math.max((num & 0xff) - amount, 0);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function applySettingsToDocument(settings: SystemSettings) {
  const doc = document.documentElement;
  doc.style.setProperty('--color-primary', settings.primary_color);
  doc.style.setProperty('--color-primary-dark', darkenColor(settings.primary_color, 25));
  doc.style.setProperty('--color-accent', settings.secondary_color);

  document.title = settings.app_name
    ? `${settings.app_name}${settings.company_name ? ` - ${settings.company_name}` : ''}`
    : 'ERP - Construction Management';

  if (settings.favicon_url) {
    let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = settings.favicon_url as string;
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

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    applySettingsToDocument(settings);
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
