import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../services/api';
import { supabase } from '../services/supabase';
import type { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  effectiveRole: UserRole | null;
  impersonatedRole: UserRole | null;
  setImpersonatedRole: (role: UserRole | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true,
  signIn: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  updatePassword: async () => {},
  effectiveRole: null,
  impersonatedRole: null,
  setImpersonatedRole: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedRole, setImpersonatedRole] = useState<UserRole | null>(null);
  const effectiveRole = impersonatedRole || user?.role || null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user.id);
      else { setUser(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(id: string) {
    const profile = await authApi.getProfile(id);
    setUser(profile);
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    await authApi.signIn(email, password);
  }

  async function signOut() {
    await authApi.signOut();
    setUser(null);
  }

  async function resetPassword(email: string) {
    const { error } = await authApi.resetPassword(email);
    if (error) throw error;
  }

  async function updatePassword(password: string) {
    const { error } = await authApi.updatePassword(password);
    if (error) throw error;
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, resetPassword, updatePassword, effectiveRole, impersonatedRole, setImpersonatedRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
