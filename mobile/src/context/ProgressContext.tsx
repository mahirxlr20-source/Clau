import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, ApiError, SavedProgress } from '../lib/api';
import { cacheStorage } from '../lib/storage';
import { AppProgress, DEFAULT_PROGRESS, normalizeProgress } from '../progress/model';
import { useAuth } from './AuthContext';

const SAVE_DELAY_MS = 1200;
const RETRY_MS = 15_000;

export type SyncStatus = 'loading' | 'saved' | 'saving' | 'offline' | 'conflict';

type LocalCopy = { data: AppProgress; version: number; dirty: boolean };

type ProgressState = {
  progress: AppProgress;
  ready: boolean;
  syncStatus: SyncStatus;
  /** Update progress. Saved locally at once and to the server shortly after. */
  update(updater: (prev: AppProgress) => AppProgress): void;
  /** Save now (e.g. before an important transition). */
  flush(): Promise<void>;
};

const ProgressContext = createContext<ProgressState | null>(null);

/**
 * Keeps the signed-in user's progress in sync:
 *  - every change is written to an on-device cache immediately (works offline),
 *  - then pushed to the server (debounced) with the version it was based on,
 *  - on login the server copy is loaded, so another device picks up where you left off,
 *  - if another device saved first, the server's newer copy wins (no silent overwrite).
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const userId = status === 'signedIn' ? user?.id : undefined;

  const [progress, setProgress] = useState<AppProgress>(DEFAULT_PROGRESS);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');

  const local = useRef<LocalCopy>({ data: DEFAULT_PROGRESS, version: 0, dirty: false });
  const saving = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheKey = userId ? `clau.progress.${userId}` : null;

  const persistLocal = useCallback(() => {
    if (cacheKey) void cacheStorage.set(cacheKey, local.current);
  }, [cacheKey]);

  const adopt = useCallback(
    (server: SavedProgress<AppProgress>) => {
      local.current = { data: normalizeProgress(server.data), version: server.version, dirty: false };
      setProgress(local.current.data);
      persistLocal();
    },
    [persistLocal],
  );

  const push = useCallback(async (): Promise<void> => {
    if (!userId) return;
    if (saving.current) {
      await saving.current;
      if (!local.current.dirty) return;
    }
    if (!local.current.dirty) return;

    const snapshot = local.current;
    let changedMeanwhile = false;
    setSyncStatus('saving');
    saving.current = (async () => {
      try {
        const res = await api.saveProgress(snapshot.data, snapshot.version);
        // Stay dirty if the user changed something while this request was in flight.
        changedMeanwhile = local.current.data !== snapshot.data;
        local.current = { ...local.current, version: res.version, dirty: changedMeanwhile };
        persistLocal();
        if (!changedMeanwhile) setSyncStatus('saved');
      } catch (err) {
        if (err instanceof ApiError && err.status === 409 && err.body) {
          // Another device saved newer progress: take it.
          adopt(err.body as SavedProgress<AppProgress>);
          setSyncStatus('conflict');
        } else {
          setSyncStatus('offline'); // stays dirty; retried later
        }
      } finally {
        saving.current = null;
      }
    })();
    await saving.current;
    // Upload edits made during the request (only after a successful save, so offline doesn't loop).
    if (changedMeanwhile) await push();
  }, [userId, adopt, persistLocal]);

  const schedulePush = useCallback(
    (delay = SAVE_DELAY_MS) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void push(), delay);
    },
    [push],
  );

  // Load on sign-in: show the on-device copy instantly, then reconcile with the server.
  useEffect(() => {
    setReady(false);
    if (!userId || !cacheKey) {
      local.current = { data: DEFAULT_PROGRESS, version: 0, dirty: false };
      setProgress(DEFAULT_PROGRESS);
      setSyncStatus('loading');
      return;
    }
    let cancelled = false;
    (async () => {
      const cached = await cacheStorage.get<LocalCopy>(cacheKey);
      if (cancelled) return;
      if (cached) {
        local.current = { ...cached, data: normalizeProgress(cached.data) };
        setProgress(local.current.data);
      }
      try {
        const server = await api.getProgress<AppProgress>();
        if (cancelled) return;
        const mine = local.current;
        if (mine.dirty && mine.version === server.version) {
          // Offline edits made on top of the latest server copy: upload them.
          setReady(true);
          await push();
        } else if (server.version > 0 || !mine.dirty) {
          adopt(server);
          setSyncStatus('saved');
          setReady(true);
        } else {
          setReady(true);
          await push();
        }
      } catch {
        if (cancelled) return;
        setSyncStatus('offline'); // keep working from the on-device copy
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, cacheKey, adopt, push]);

  // Save when the app goes to the background; retry when it comes back or periodically.
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive' || state === 'active') void push();
    });
    const interval = setInterval(() => {
      if (local.current.dirty) void push();
    }, RETRY_MS);
    return () => {
      sub.remove();
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [userId, push]);

  const update = useCallback<ProgressState['update']>(
    (updater) => {
      const next = updater(local.current.data);
      if (next === local.current.data) return;
      local.current = { ...local.current, data: next, dirty: true };
      setProgress(next);
      persistLocal();
      schedulePush();
    },
    [persistLocal, schedulePush],
  );

  const value = useMemo<ProgressState>(
    () => ({ progress, ready, syncStatus, update, flush: push }),
    [progress, ready, syncStatus, update, push],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  return ctx;
}
