import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, clearSession, hasStoredSession, setSessionExpiredHandler, Subscription, User } from '../lib/api';
import { cacheStorage } from '../lib/storage';

const USER_CACHE_KEY = 'clau.user';
const NO_SUBSCRIPTION: Subscription = { active: false, planId: null, currentPeriodEnd: null };

type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  subscription: Subscription;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refreshAccount(): Promise<void>;
  setSubscription(s: Subscription): void;
};

const AuthContext = createContext<AuthState | null>(null);

type Cached = { user: User; subscription: Subscription };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription>(NO_SUBSCRIPTION);

  const applyAccount = useCallback(async (next: Cached) => {
    setUser(next.user);
    setSubscription(next.subscription);
    setStatus('signedIn');
    await cacheStorage.set(USER_CACHE_KEY, next);
  }, []);

  const resetLocal = useCallback(async () => {
    await cacheStorage.remove(USER_CACHE_KEY);
    setUser(null);
    setSubscription(NO_SUBSCRIPTION);
    setStatus('signedOut');
  }, []);

  // On launch: restore the session from the stored refresh token. If the device is
  // offline, fall back to the cached account so the user can keep working locally.
  useEffect(() => {
    (async () => {
      if (!(await hasStoredSession())) return setStatus('signedOut');
      try {
        await applyAccount(await api.me());
      } catch (err) {
        const cached = await cacheStorage.get<Cached>(USER_CACHE_KEY);
        if (err instanceof ApiError && err.status === 401) {
          await clearSession();
          await resetLocal();
        } else if (cached) {
          setUser(cached.user);
          setSubscription(cached.subscription);
          setStatus('signedIn');
        } else {
          setStatus('signedOut');
        }
      }
    })();
  }, [applyAccount, resetLocal]);

  useEffect(() => {
    setSessionExpiredHandler(() => void resetLocal());
    return () => setSessionExpiredHandler(null);
  }, [resetLocal]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      subscription,
      async signIn(email, password) {
        await api.login(email, password);
        await applyAccount(await api.me());
      },
      async signUp(name, email, password) {
        await api.register(name, email, password);
        await applyAccount(await api.me());
      },
      async signOut() {
        await api.logout();
        await resetLocal();
      },
      async refreshAccount() {
        await applyAccount(await api.me());
      },
      setSubscription(s) {
        setSubscription(s);
        if (user) void cacheStorage.set(USER_CACHE_KEY, { user, subscription: s });
      },
    }),
    [status, user, subscription, applyAccount, resetLocal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
