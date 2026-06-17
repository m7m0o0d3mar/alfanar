import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useSettings } from './SettingsContext';
import { setLanguage as setI18nLang } from '../i18n';

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  language: 'ar' | 'en';
  setLanguage: (lang: 'ar' | 'en') => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  language: 'en',
  setLanguage: () => {},
});

function hasUserToggled(): boolean {
  return localStorage.getItem('erp_lang_toggled') === 'true';
}

function getSavedLang(): 'ar' | 'en' | null {
  return localStorage.getItem('erp_lang') as 'ar' | 'en' | null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [language, setLang] = useState<'ar' | 'en'>(() => {
    return getSavedLang() || 'en';
  });

  useEffect(() => {
    setI18nLang(language);
  }, [language]);

  useEffect(() => {
    const savedLang = getSavedLang();
    if (!hasUserToggled()) {
      const lang = (settings.default_language as 'ar' | 'en') || 'en';
      if (lang !== language) {
        setLang(lang);
      }
    } else if (savedLang && savedLang !== language) {
      setLang(savedLang);
    }
    if (settings.theme && !localStorage.getItem('theme')) {
      setTheme((settings.theme as 'light' | 'dark') || 'light');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.default_language, settings.theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [theme, language]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', next === 'dark');
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  const setLanguage = useCallback((lang: 'ar' | 'en') => {
    setLang(lang);
    setI18nLang(lang);
    localStorage.setItem('erp_lang', lang);
    localStorage.setItem('erp_lang_toggled', 'true');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, language, setLanguage }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
