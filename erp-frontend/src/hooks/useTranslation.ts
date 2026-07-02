import { useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { translationApi } from '../services/api';
import { en, ar, type TranslationKeys } from '../i18n';

function loadOverrides(locale: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`translation_overrides_${locale}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveOverridesToCache(locale: string, overrides: Record<string, string>): void {
  try {
    localStorage.setItem(`translation_overrides_${locale}`, JSON.stringify(overrides));
  } catch { console.error('localStorage write failed'); }
}

export async function syncTranslationOverrides(userId: string): Promise<void> {
  try {
    const [enOverrides, arOverrides] = await Promise.all([
      translationApi.list(userId, 'en'),
      translationApi.list(userId, 'ar'),
    ]);
    saveOverridesToCache('en', enOverrides);
    saveOverridesToCache('ar', arOverrides);
  } catch { console.error('Failed to sync translation overrides from DB'); }
}

export function useT() {
  const { language } = useTheme();

  return useCallback((path: string): string => {
    const overrides = loadOverrides(language);
    if (overrides[path]) return overrides[path];

    const translations: TranslationKeys = language === 'ar' ? ar : en;
    const keys = path.split('.');
    let obj: unknown = translations;
    for (const key of keys) {
      if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
        obj = (obj as Record<string, unknown>)[key];
      } else {
        return path;
      }
    }
    return typeof obj === 'string' ? obj : path;
  }, [language]);
}
