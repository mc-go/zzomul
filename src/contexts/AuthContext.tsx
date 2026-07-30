import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearSession, login as doLogin, readSession, type Session } from '../lib/auth';

type AuthValue = {
  session: Session | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<Session>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setReady(true);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const s = await doLogin(username, password);
    setSession(s);
    return s;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const value = useMemo<AuthValue>(() => ({ session, ready, login, logout }), [session, ready, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
