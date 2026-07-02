import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useSettings } from './SettingsContext';
import { setLanguage as setI18nLang } from '../i18n';

export type AccentColor = 'purple' | 'blue' | 'emerald' | 'amber' | 'rose';

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  language: 'ar' | 'en';
  setLanguage: (lang: 'ar' | 'en') => void;
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  language: 'en',
  setLanguage: () => {},
  accent: 'purple',
  setAccent: () => {},
});

const ACCENT_MAP: Record<AccentColor, { primary: string; dark: string; light: string; gradient: string }> = {
  purple: { primary: '#a855f7', dark: '#7c3aed', light: 'rgba(168,85,247,0.12)', gradient: 'linear-gradient(135deg, #a855f7, #6366f1)' },
  blue: { primary: '#3b82f6', dark: '#2563eb', light: 'rgba(59,130,246,0.12)', gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)' },
  emerald: { primary: '#10b981', dark: '#059669', light: 'rgba(16,185,129,0.12)', gradient: 'linear-gradient(135deg, #10b981, #34d399)' },
  amber: { primary: '#f59e0b', dark: '#d97706', light: 'rgba(245,158,11,0.12)', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
  rose: { primary: '#f43f5e', dark: '#e11d48', light: 'rgba(244,63,94,0.12)', gradient: 'linear-gradient(135deg, #f43f5e, #fb7185)' },
};

function hasUserToggled(): boolean {
  try { return localStorage.getItem('erp_lang_toggled') === 'true'; }
  catch { return false; }
}

function getSavedLang(): 'ar' | 'en' | null {
  try { return localStorage.getItem('erp_lang') as 'ar' | 'en' | null; }
  catch { return null; }
}

function getSavedAccent(): AccentColor | null {
  try {
    const saved = localStorage.getItem('erp_accent');
    if (saved && saved in ACCENT_MAP) return saved as AccentColor;
  } catch { /* localStorage blocked */ }
  return null;
}

function hasSavedAccent(): boolean {
  try { return localStorage.getItem('erp_accent') !== null; }
  catch { return false; }
}

function applyAccent(accent: AccentColor) {
  const c = ACCENT_MAP[accent];
  const root = document.documentElement;
  root.style.setProperty('--color-primary', c.primary);
  root.style.setProperty('--color-primary-dark', c.dark);
  root.style.setProperty('--color-primary-light', c.light);
  root.style.setProperty('--color-primary-gradient', c.gradient);
}

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch { /* localStorage blocked */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [accent, setAccentState] = useState<AccentColor>(() => getSavedAccent() ?? 'purple');

  const initialLang = getSavedLang() || 'en';
  const [language, setLang] = useState<'ar' | 'en'>(() => {
    setI18nLang(initialLang);
    return initialLang;
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    setI18nLang(language);
  }, [language]);

  useEffect(() => {
    if (hasSavedAccent()) applyAccent(accent);
  }, [settings, accent]);

  useEffect(() => {
    const savedLang = getSavedLang();
    if (!hasUserToggled()) {
      const lang = (settings.default_language as 'ar' | 'en') || 'en';
      if (lang !== language) setLang(lang);
    } else if (savedLang && savedLang !== language) {
      setLang(savedLang);
    }
    const hasSavedTheme = (() => { try { return !!localStorage.getItem('theme'); } catch { return false; } })();
    if (settings.theme && !hasSavedTheme) {
      setTheme((settings.theme as 'light' | 'dark') || 'light');
    }
  }, [settings.default_language, settings.theme]);

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try { localStorage.setItem('theme', next); } catch { /* localStorage blocked */ }
      return next;
    });
  }, []);

  const setLanguage = useCallback((lang: 'ar' | 'en') => {
    setLang(lang);
    setI18nLang(lang);
    try { localStorage.setItem('erp_lang', lang); } catch { /* localStorage blocked */ }
    try { localStorage.setItem('erp_lang_toggled', 'true'); } catch { /* localStorage blocked */ }
  }, []);

  const setAccent = useCallback((a: AccentColor) => {
    setAccentState(a);
    applyAccent(a);
    try { localStorage.setItem('erp_accent', a); } catch { /* localStorage blocked */ }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, language, setLanguage, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
