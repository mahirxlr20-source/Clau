import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { CATALOG, CatalogEntry, loadPlanner } from '../planners/catalog';
import { createModel, Model } from '../planners/model';
import { blankState, normalizeState, PlannerData, PlannerState } from '../planners/types';
import { useAuth } from './AuthContext';
import { useProgress } from './ProgressContext';

type PlannerCtx = {
  entry: CatalogEntry;
  D: PlannerData;
  st: PlannerState;
  G: Model;
  /** Apply a change to the planner state, then save and redraw. */
  commit(fn?: (st: PlannerState) => void): void;
  /** For typing: apply now, save and redraw shortly after the user pauses. */
  commitSoon(fn: (st: PlannerState) => void): void;
  /** Replace the whole planner state (backup import, reset). */
  replace(st: PlannerState): void;
};

const Ctx = createContext<PlannerCtx | null>(null);

/** Switches the active planner, creating its state the first time it is opened. */
export function useOpenPlanner() {
  const { update } = useProgress();
  const { user } = useAuth();
  return useCallback(
    (id: string) =>
      update((p) => {
        if (p.planners[id]) return { ...p, activePlanner: id };
        // A new planner starts with the account's name on it.
        const fresh = blankState();
        if (user?.name) fresh.profile.name = user.name;
        return { ...p, activePlanner: id, planners: { ...p.planners, [id]: fresh } };
      }),
    [update, user],
  );
}

export function PlannerProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { progress, update, flush } = useProgress();
  const id = progress.activePlanner;
  const entry = CATALOG.find((c) => c.id === id) ?? null;
  const D = useMemo(() => (entry ? loadPlanner(entry.id) : null), [entry]);

  const st = useMemo(() => (id ? normalizeState(progress.planners[id] ?? blankState()) : null), [id, progress.planners]);
  const stRef = useRef(st);
  stRef.current = st;
  const G = useMemo(() => (D ? createModel(D, () => stRef.current!) : null), [D]);

  const save = useCallback(() => {
    const cur = stRef.current;
    if (!id || !cur) return;
    update((p) => ({ ...p, planners: { ...p.planners, [id]: cur } }));
  }, [id, update]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNow = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      save();
    }
  }, [save]);

  // Never lose typing: save pending edits when the app is backgrounded or the planner closes.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        saveNow();
        void flush();
      }
    });
    return () => {
      sub.remove();
      saveNow();
    };
  }, [saveNow, flush]);

  const value = useMemo<PlannerCtx | null>(() => {
    if (!entry || !D || !st || !G) return null;
    return {
      entry,
      D,
      st,
      G,
      commit(fn) {
        fn?.(st);
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        save();
      },
      commitSoon(fn) {
        fn(st);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          save();
        }, 600);
      },
      replace(next) {
        if (!id) return;
        update((p) => ({ ...p, planners: { ...p.planners, [id]: normalizeState(next) } }));
      },
    };
    // progress.planners changes on every save, so the screens redraw with the new numbers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, D, st, G, save, update, id, progress.planners]);

  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlanner() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlanner must be used inside PlannerProvider');
  return c;
}
