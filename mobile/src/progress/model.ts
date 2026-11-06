// The shape of a user's saved progress. The server stores it as an opaque JSON
// object, so you can change this to fit your app (levels, lessons, settings...).
// Keep new fields optional or give them defaults below so older saves still load.

export type Task = { id: string; title: string; done: boolean };

export type AppProgress = {
  /** Screen the user was on, so the app can reopen it after the next login. */
  lastRoute: string;
  tasks: Task[];
  notes: string;
};

export const DEFAULT_PROGRESS: AppProgress = {
  lastRoute: '/',
  tasks: [],
  notes: '',
};

/** Fills in defaults for fields missing from older saves. */
export function normalizeProgress(data: Partial<AppProgress> | null | undefined): AppProgress {
  return { ...DEFAULT_PROGRESS, ...(data ?? {}) };
}

/** Free accounts are limited to this many tasks; Premium is unlimited. */
export const FREE_TASK_LIMIT = 5;
