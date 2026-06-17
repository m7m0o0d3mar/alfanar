import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/login?mode=reset');
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/login?mode=reset');
      else navigate('/login');
    });
    return () => subscription?.unsubscribe();
  }, [navigate]);

  return (
    <div className="h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div className="animate-spin rounded-full h-8 w-8" style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
    </div>
  );
}
