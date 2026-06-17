import { useTheme } from '../context/ThemeContext';
import { en, ar, type TranslationKeys } from '../i18n';

export function useT() {
  const { language } = useTheme();

  return (path: string): string => {
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
  };
}
