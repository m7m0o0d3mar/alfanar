import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useT } from '../hooks/useTranslation';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const t = useT();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const checkStandalone = () => {
      if (window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true) {
        setShowPrompt(false);
      }
    };
    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const listener = () => checkStandalone();
    mediaQuery.addEventListener('change', listener);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as any).prompt();
    const result = await (deferredPrompt as any).userChoice;
    if (result.outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-4 md:left-auto md:right-4 md:w-96">
      <div
        className="rounded-xl shadow-xl p-4 flex items-center gap-3 border"
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: 'var(--color-border)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}
        >
          <Download className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{t('pwa.install_title') || 'تثبيت التطبيق'}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('pwa.install_desc') || 'ثبّت التطبيق على شاشتك الرئيسية للوصول السريع'}</p>
        </div>
        <button
          onClick={handleInstall}
          className="btn-sm btn-primary shrink-0"
        >
          {t('pwa.install') || 'تثبيت'}
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="p-1 rounded-lg hover:opacity-60 shrink-0"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}
