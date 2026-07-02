import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, type AccentColor } from '../context/ThemeContext';
import { useT } from '../hooks/useTranslation';
import { authApi, notificationPreferencesApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import Avatar from '../components/Avatar';
import type { NotificationPreferences } from '../types';
import { User, Save, Lock, Globe, Mail, Phone, Briefcase, Bell, Camera, Loader2, SunMoon, Palette } from 'lucide-react';

const ACCENTS: { key: AccentColor; label: string; color: string }[] = [
  { key: 'purple', label: 'Purple', color: '#a855f7' },
  { key: 'blue', label: 'Blue', color: '#3b82f6' },
  { key: 'emerald', label: 'Emerald', color: '#10b981' },
  { key: 'amber', label: 'Amber', color: '#f59e0b' },
  { key: 'rose', label: 'Rose', color: '#f43f5e' },
];

const toggleStyle = (on: boolean) => ({
  width: '2.5rem', height: '1.375rem', borderRadius: '9999px', position: 'relative' as const,
  cursor: 'pointer', border: 'none', transition: 'background 0.2s',
  backgroundColor: on ? 'var(--color-primary)' : 'var(--color-border)',
});

const thumbStyle = (on: boolean) => ({
  width: '1rem', height: '1rem', borderRadius: '50%', backgroundColor: '#fff',
  position: 'absolute' as const, top: '0.1875rem', transition: 'left 0.2s',
  left: on ? 'calc(100% - 1.1875rem)' : '0.1875rem',
});

export default function ProfilePage() {
  const t = useT();
  const { user, refreshProfile } = useAuth();
  const { theme, toggleTheme, accent, setAccent } = useTheme();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [form, setForm] = useState({
    full_name_en: user?.full_name_en || '',
    full_name_ar: user?.full_name_ar || '',
    phone: user?.phone || '',
    default_language: user?.default_language || 'en',
  });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwOpen, setPwOpen] = useState(false);
  const [notif, setNotif] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    notificationPreferencesApi.get(user.id).then(data => setNotif(data)).catch(() => {});
  }, [user?.id]);

  function toggleNotif(key: keyof NotificationPreferences) {
    if (!notif || !user) return;
    const updated = { ...notif, [key]: !notif[key] };
    setNotif(updated);
    notificationPreferencesApi.upsert(updated).catch(() => {
      setNotif(notif);
    });
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `avatars/${user.id}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = publicUrl;
      await authApi.updateProfile(user.id, { avatar_url: avatarUrl });
      await refreshProfile();
      toast.success('Avatar updated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await authApi.updateProfile(user.id, form);
      await refreshProfile();
      toast.success(t('common.saved'));
    } catch {
      toast.error(t('common.error'));
    }
    setSaving(false);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) { toast.error(t('profile.passwords_mismatch')); return; }
    if (pwForm.newPw.length < 6) { toast.error(t('profile.password_too_short')); return; }
    try {
      await authApi.updatePassword(pwForm.newPw);
      toast.success(t('profile.password_updated'));
      setPwForm({ current: '', newPw: '', confirm: '' });
      setPwOpen(false);
    } catch { toast.error(t('common.error')); }
  }

  if (!user) return null;

  const inputStyle = {
    width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
    border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)', fontSize: '0.875rem', outline: 'none',
  };

  const labelStyle = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem', color: 'var(--color-text-secondary)' };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative group">
          <Avatar url={user.avatar_url} name={user.full_name_en} email={user.email} size={48} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            disabled={avatarUploading}
          >
            {avatarUploading ? <Loader2 size={16} className="animate-spin text-white" /> : <Camera size={16} className="text-white" />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{t('profile.title')}</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{user.email} — {user.role?.replace(/_/g, ' ')}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <User size={16} /> {t('profile.personal_info')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>{t('profile.name_en')}</label>
              <input style={inputStyle} value={form.full_name_en}
                onChange={e => setForm(f => ({ ...f, full_name_en: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>{t('profile.name_ar')}</label>
              <input style={inputStyle} value={form.full_name_ar ?? ''}
                onChange={e => setForm(f => ({ ...f, full_name_ar: e.target.value }))} dir="rtl" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}><Mail size={12} className="inline mr-1" />{t('profile.email')}</label>
              <input style={{ ...inputStyle, opacity: 0.6 }} value={user.email || ''} disabled />
            </div>
            <div>
              <label style={labelStyle}><Phone size={12} className="inline mr-1" />{t('profile.phone')}</label>
              <input style={inputStyle} value={form.phone ?? ''}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={labelStyle}><Globe size={12} className="inline mr-1" />{t('profile.language')}</label>
            <select style={inputStyle} value={form.default_language}
              onChange={e => setForm(f => ({ ...f, default_language: e.target.value as 'ar' | 'en' }))}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}><Briefcase size={12} className="inline mr-1" />{t('profile.role')}</label>
            <input style={{ ...inputStyle, opacity: 0.6 }} value={user.role?.replace(/_/g, ' ') || ''} disabled />
          </div>
          <button type="submit" disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm">
            <Save size={14} /> {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>

      <div className="rounded-xl border p-5 mt-4 space-y-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <button onClick={() => setPwOpen(!pwOpen)}
          className="flex items-center gap-2 text-sm font-semibold w-full text-left"
          style={{ color: 'var(--color-text)' }}>
          <Lock size={16} /> {t('profile.change_password')}
        </button>
        {pwOpen && (
          <form onSubmit={handlePassword} className="space-y-3 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label style={labelStyle}>{t('profile.new_password')}</label>
                <input type="password" style={inputStyle} value={pwForm.newPw}
                  onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>{t('profile.confirm_password')}</label>
                <input type="password" style={inputStyle} value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
              </div>
              <div className="flex items-end">
                <button type="submit" className="btn-primary text-sm py-2 px-4 w-full">{t('common.save')}</button>
              </div>
            </div>
          </form>
        )}
      </div>

      <div className="rounded-xl border p-5 mt-4 space-y-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <SunMoon size={16} /> {t('profile.appearance') || 'Appearance'}
        </h2>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm" style={{ color: 'var(--color-text)' }}>Dark Mode</span>
          <button onClick={toggleTheme} style={{
            width: '2.5rem', height: '1.375rem', borderRadius: '9999px', position: 'relative',
            cursor: 'pointer', border: 'none', transition: 'background 0.3s',
            backgroundColor: theme === 'dark' ? 'var(--color-primary)' : 'var(--color-border)',
          }}>
            <span style={{
              width: '1rem', height: '1rem', borderRadius: '50%', backgroundColor: '#fff',
              position: 'absolute', top: '0.1875rem', transition: 'left 0.3s, transform 0.3s',
              left: theme === 'dark' ? 'calc(100% - 1.1875rem)' : '0.1875rem',
              transform: theme === 'dark' ? 'scale(1.1)' : 'scale(1)',
            }} />
          </button>
        </div>
        <div>
          <label className="text-sm flex items-center gap-2 mb-3" style={{ color: 'var(--color-text)' }}>
            <Palette size={14} /> Accent Color
          </label>
          <div className="flex items-center gap-3">
            {ACCENTS.map(a => (
              <button
                key={a.key}
                onClick={() => setAccent(a.key)}
                className="rounded-full transition-all duration-200 flex items-center justify-center"
                style={{
                  width: '2.5rem', height: '2.5rem', backgroundColor: a.color,
                  boxShadow: accent === a.key ? '0 0 0 3px var(--color-surface), 0 0 0 5px ' + a.color : 'none',
                  transform: accent === a.key ? 'scale(1.15)' : 'scale(1)',
                  border: '2px solid transparent',
                  borderColor: accent === a.key ? a.color : 'transparent',
                }}
                title={a.label}
              >
                {accent === a.key && (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-5 mt-4 space-y-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Bell size={16} /> {t('profile.notification_prefs')}
        </h2>
        {notif ? (
          <div className="space-y-3">
            {([
              ['email_notifications', 'profile.email_notif'],
              ['in_app_notifications', 'profile.in_app_notif'],
              ['notify_on_approval', 'profile.notify_approval'],
              ['notify_on_rejection', 'profile.notify_rejection'],
              ['notify_on_status_change', 'profile.notify_status'],
              ['notify_on_new_assignment', 'profile.notify_assignment'],
              ['notify_on_comments', 'profile.notify_comments'],
              ['notify_on_deadline', 'profile.notify_deadline'],
              ['daily_digest', 'profile.daily_digest'],
            ] as [keyof NotificationPreferences, string][]).map(([key, labelKey]) => (
              <div key={key} className="flex items-center justify-between py-1.5">
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{t(labelKey)}</span>
                <button onClick={() => toggleNotif(key)} style={toggleStyle(!!notif[key])} className="flex-shrink-0">
                  <span style={thumbStyle(!!notif[key])} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
        )}
      </div>
    </div>
  );
}
