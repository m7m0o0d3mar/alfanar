import { en, type TranslationKeys } from './en';
import { ar } from './ar';

export type { TranslationKeys };
export { en, ar };

const translations: Record<string, TranslationKeys> = { en, ar };

let currentLang = 'en';

export function setLanguage(lang: 'ar' | 'en') {
  currentLang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export function getLanguage() {
  return currentLang as 'ar' | 'en';
}

export function t(path: string): string {
  const keys = path.split('.');
  let obj: unknown = translations[currentLang] || translations['en'];
  for (const key of keys) {
    if (obj && typeof obj === 'object' && key in obj) {
      obj = (obj as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof obj === 'string' ? obj : path;
}

export function translate(keys: TranslationKeys, path: string): string {
  const parts = path.split('.');
  let obj: unknown = keys;
  for (const p of parts) {
    if (obj && typeof obj === 'object' && p in (obj as Record<string, unknown>)) {
      obj = (obj as Record<string, unknown>)[p];
    } else return path;
  }
  return typeof obj === 'string' ? obj : path;
}
