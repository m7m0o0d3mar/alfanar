import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { authApi, rolePermissionsApi } from '../services/api';
import { supabase } from '../services/supabase';
import type { UserProfile, UserRole, RolePermission, PermissionScope } from '../types';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

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
  refreshProfile: () => Promise<void>;
  hasPermission: (permKey: string, action?: PermissionAction, scopeType?: PermissionScope, scopeId?: string) => boolean;
  canAccessModule: (moduleCode: string) => boolean;
  isAdmin: boolean;
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
  refreshProfile: async () => {},
  hasPermission: () => false,
  canAccessModule: () => false,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedRole, setImpersonatedRole] = useState<UserRole | null>(null);
  const [permCache, setPermCache] = useState<RolePermission[]>([]);

  const effectiveRole = impersonatedRole || user?.role || null;
  const isAdmin = effectiveRole === 'admin';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user.id);
      else { setUser(null); setPermCache([]); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.role) return;
    const channel = supabase.channel(`perms-${user.role}`);
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'role_permissions',
      filter: `role=eq.${user.role}`,
    }, () => {
      rolePermissionsApi.list(user.role).then(setPermCache).catch(console.error);
    }).subscribe();
    return () => { channel.unsubscribe(); };
  }, [user?.role]);

  async function loadProfile(id: string) {
    try {
      const profile = await authApi.getProfile(id);
      setUser(profile);
      if (profile) {
        const perms = await rolePermissionsApi.list(profile.role);
        setPermCache(perms);
      }
    } catch {
      setUser(null);
      setPermCache([]);
    }
    setLoading(false);
  }

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await loadProfile(user.id);
    }
  }, [user?.id]);

  const hasPermission = useCallback((permKey: string, action?: PermissionAction, scopeType: PermissionScope = 'global', scopeId?: string): boolean => {
    if (isAdmin) return true;

    function checkPerms(perms: Record<string, unknown>): boolean {
      if (perms.all_modules === true) return true;
      const val = perms[permKey];
      if (val === true) return true;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const obj = val as Record<string, unknown>;
        if (obj.all_modules === true) return true;
        if (!action) return obj.view === true || obj.create === true || obj.edit === true || obj.delete === true;
        return obj[action] === true;
      }
      if (Array.isArray(perms.all_modules) && (perms.all_modules as string[]).includes(permKey)) return true;
      return false;
    }

    const globalPerm = permCache.find(p => p.scope_type === 'global');
    if (globalPerm && checkPerms(globalPerm.permissions)) return true;

    if (scopeType !== 'global' && scopeId) {
      const scopedPerm = permCache.find(p => p.scope_type === scopeType && p.scope_id === scopeId);
      if (scopedPerm && checkPerms(scopedPerm.permissions)) return true;
    }

    return false;
  }, [isAdmin, permCache]);

  const canAccessModule = useCallback((moduleCode: string): boolean => {
    if (isAdmin) return true;
    if (!permCache.length) return false;
    const p = permCache.find(p => p.scope_type === 'global');
    if (!p) return false;
    const perms = p.permissions;
    if (perms.all_modules === true) return true;
    if (perms[moduleCode] === true) return true;
    if (perms[moduleCode] && typeof perms[moduleCode] === 'object') return true;
    return false;
  }, [isAdmin, permCache]);

  async function signIn(email: string, password: string) {
    await authApi.signIn(email, password);
  }

  async function signOut() {
    await authApi.signOut();
    setUser(null);
    setPermCache([]);
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
    <AuthContext.Provider value={{
      user, loading, signIn, signOut, resetPassword, updatePassword,
      effectiveRole, impersonatedRole, setImpersonatedRole,
      refreshProfile, hasPermission, canAccessModule, isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
