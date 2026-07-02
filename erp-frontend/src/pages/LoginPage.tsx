import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../hooks/useTranslation';
import { LogIn, Loader2, Mail, ArrowLeft, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const t = useT();
  const { signIn, resetPassword, updatePassword } = useAuth();
  const { language } = useTheme();
  const { settings } = useSettings();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(
    searchParams.get('mode') === 'reset' ? 'reset' : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await resetPassword(email);
      setSuccess(language === 'ar' ? 'تحقق من بريدك الإلكتروني للحصول على رابط إعادة التعيين' : 'Check your email for the reset link');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (newPassword !== confirmNewPassword) {
      setError(language === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(newPassword);
      setSuccess(language === 'ar' ? 'تم تحديث كلمة المرور بنجاح' : 'Password updated successfully');
      setTimeout(() => setMode('login'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackToLogin() {
    setMode('login');
    setError('');
    setSuccess('');
  }

  const container = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a0a2e 0%, #0f172a 100%)',
  };

  const card = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-card)',
    padding: '2rem',
  };

  const errorStyle = {
    backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
    color: 'var(--color-danger)',
  };

  const successStyle = {
    backgroundColor: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
    color: 'var(--color-success)',
  };

  return (
    <div style={container} className="flex items-center justify-center p-4">
      <div className="w-full max-w-md" style={card}>
        <div className="text-center mb-8">
          {mode === 'forgot' && (
            <button onClick={handleBackToLogin} className="float-left btn-ghost p-1">
              <ArrowLeft size={20} />
            </button>
          )}
          {settings.login_logo_url && (
            <img src={settings.login_logo_url} alt="" className="h-16 mx-auto mb-3 object-contain" />
          )}
          <h1 className="text-2xl font-bold">
            {mode === 'forgot' ? t('auth.forgot_password') : mode === 'reset' ? t('auth.reset_password') : settings.app_name || t('app.title')}
          </h1>
          <p style={{color: 'var(--color-text-secondary)'}} className="mt-1">
            {mode === 'forgot' ? '' : settings.login_message || t('app.subtitle')}
          </p>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">{t('auth.email')}</label>
              <input type="email" className="input" dir="ltr"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com" required
              />
            </div>
            <div>
              <label className="label">{t('auth.password')}</label>
              <input type="password" className="input" dir="ltr"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required
              />
            </div>

            {error && <div className="text-sm p-3 rounded-lg" style={errorStyle}>{error}</div>}

            <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {submitting ? (language === 'ar' ? 'جاري تسجيل الدخول...' : 'Signing in...') : t('auth.sign_in')}
            </button>

            <button type="button" onClick={() => { setMode('forgot'); setError(''); }}
              className="w-full text-sm text-center" style={{color: 'var(--color-primary)'}}>
              {t('auth.forgot_password')}
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="label">{t('auth.email')}</label>
              <input type="email" className="input" dir="ltr"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com" required
              />
            </div>

            {error && <div className="text-sm p-3 rounded-lg" style={errorStyle}>{error}</div>}
            {success && <div className="text-sm p-3 rounded-lg" style={successStyle}>{success}</div>}

            <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
              {submitting ? (language === 'ar' ? 'جارٍ الإرسال...' : 'Sending...') : t('auth.send_reset_link')}
            </button>

            <button type="button" onClick={handleBackToLogin}
              className="w-full text-sm text-center" style={{color: 'var(--color-text-muted)'}}>
              {t('auth.back_to_login')}
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="label">{t('auth.new_password')}</label>
              <input type="password" className="input" dir="ltr"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••" required minLength={6}
              />
            </div>
            <div>
              <label className="label">{t('auth.confirm_password')}</label>
              <input type="password" className="input" dir="ltr"
                value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="••••••••" required minLength={6}
              />
            </div>

            {error && <div className="text-sm p-3 rounded-lg" style={errorStyle}>{error}</div>}
            {success && <div className="text-sm p-3 rounded-lg" style={successStyle}>{success}</div>}

            <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
              {submitting ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : t('auth.reset_password')}
            </button>
          </form>
        )}

        <div className="flex items-center justify-center gap-4 mt-4">
          <a href="/public-properties" className="text-xs" style={{color: 'var(--color-primary)'}}>
            {t('public_portal.title')}
          </a>
        </div>
        <p className="text-center text-sm mt-4" style={{color: 'var(--color-text-muted)'}}>
          {language === 'ar' ? 'نظام إدارة مشاريع الإنشاءات' : 'Construction Project Management System'}
        </p>
      </div>
    </div>
  );
}
