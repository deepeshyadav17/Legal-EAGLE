import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as authService from '../services/authService';

/**
 * Demo session context. Role values here drive UI only — they are not
 * authorization. Real checks belong on the backend.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getSessionUser());

  const login = useCallback(async (email, password) => {
    const u = await authService.login(email, password);
    setUser(u);
    return u;
  }, []);

  const demoLogin = useCallback(async (role) => {
    const u = await authService.demoLogin(role);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (role, data) => {
    const u = await authService.register(role, data);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const updateAccount = useCallback(async (patch) => {
    const u = await authService.updateAccount(user.id, patch);
    setUser(u);
    return u;
  }, [user]);

  const refreshUser = useCallback(() => setUser(authService.getSessionUser()), []);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, login, demoLogin, register, logout, updateAccount, refreshUser }),
    [user, login, demoLogin, register, logout, updateAccount, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
