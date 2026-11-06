import { API_URL } from './config';
import { secureStorage } from './storage';

const REFRESH_KEY = 'clau.refreshToken';

export type User = { id: number; email: string; name: string; createdAt: string };
export type Subscription = { active: boolean; planId: string | null; currentPeriodEnd: string | null };
export type Plan = { id: string; name: string; amount: string; currency: string; durationDays: number };
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REVIEW';
export type Payment = {
  tranId: string;
  planId: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  failureReason: string | null;
};
export type SavedProgress<T> = { data: T | null; version: number; updatedAt: string | null };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: any,
  ) {
    super(message);
  }
}

// Access token lives in memory only; the refresh token is persisted securely.
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

export async function storeSession(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken;
  await secureStorage.set(REFRESH_KEY, tokens.refreshToken);
}

export async function clearSession() {
  accessToken = null;
  await secureStorage.remove(REFRESH_KEY);
}

export const hasStoredSession = async () => Boolean(await secureStorage.get(REFRESH_KEY));

/** Swaps the stored refresh token for a fresh token pair. De-duplicates concurrent calls. */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const refreshToken = await secureStorage.get(REFRESH_KEY);
      if (!refreshToken) return false;
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.status === 401) {
        await clearSession();
        return false;
      }
      if (!res.ok) throw new ApiError(res.status, 'Could not refresh session');
      await storeSession(await res.json());
      return true;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

type RequestOptions = { method?: string; body?: unknown; auth?: boolean };

export async function request<T>(path: string, { method = 'GET', body, auth = true }: RequestOptions = {}): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(auth && accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  if (auth && !accessToken) await refreshSession();
  let res = await send();
  if (auth && res.status === 401) {
    if (await refreshSession()) {
      res = await send();
    } else {
      onSessionExpired?.();
    }
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, json?.error || `Request failed (${res.status})`, json);
  return json as T;
}

type AuthResponse = { user: User; accessToken: string; refreshToken: string };

export const api = {
  async register(name: string, email: string, password: string) {
    const res = await request<AuthResponse>('/auth/register', { method: 'POST', body: { name, email, password }, auth: false });
    await storeSession(res);
    return res.user;
  },
  async login(email: string, password: string) {
    const res = await request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    await storeSession(res);
    return res.user;
  },
  async logout() {
    const refreshToken = await secureStorage.get(REFRESH_KEY);
    await clearSession();
    if (refreshToken) {
      await request('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(() => {});
    }
  },
  me: () => request<{ user: User; subscription: Subscription }>('/auth/me'),

  getProgress: <T>() => request<SavedProgress<T>>('/progress'),
  saveProgress: <T>(data: T, baseVersion: number) =>
    request<{ version: number; updatedAt: string }>('/progress', { method: 'PUT', body: { data, baseVersion } }),

  plans: () => request<{ plans: Plan[] }>('/subscriptions/plans', { auth: false }),
  subscription: () => request<{ subscription: Subscription }>('/subscriptions/me'),
  checkout: (planId: string, phone: string, appRedirectUrl: string) =>
    request<{ tranId: string; gatewayUrl: string }>('/subscriptions/checkout', {
      method: 'POST',
      body: { planId, phone, appRedirectUrl },
    }),
  payment: (tranId: string) =>
    request<{ payment: Payment; subscription: Subscription }>(`/subscriptions/payments/${encodeURIComponent(tranId)}`),
};
