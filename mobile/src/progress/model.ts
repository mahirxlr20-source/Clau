// What is saved to the user's account: every Tabula planner they have opened, with
// everything typed into it, plus which planner and which tab they were on.
import type { PlannerState } from '../planners/types';

export type AppProgress = {
  /** The tab the user was on, so the app reopens it after the next login. */
  lastRoute: string;
  /** The planner (e.g. "bracu-cse") the user is working in. */
  activePlanner: string | null;
  /** One saved state per planner, in the same shape as the HTML planner's own backup. */
  planners: Record<string, PlannerState>;
};

export const DEFAULT_PROGRESS: AppProgress = {
  lastRoute: '/home',
  activePlanner: null,
  planners: {},
};

/** Fills in defaults for fields missing from older saves. */
export function normalizeProgress(data: Partial<AppProgress> | null | undefined): AppProgress {
  const d = data ?? {};
  return {
    lastRoute: typeof d.lastRoute === 'string' ? d.lastRoute : DEFAULT_PROGRESS.lastRoute,
    activePlanner: d.activePlanner ?? null,
    planners: d.planners && typeof d.planners === 'object' ? d.planners : {},
  };
}
