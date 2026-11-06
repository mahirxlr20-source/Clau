// Shapes of the planner data imported from the Tabula Campus HTML planners
// (see tools/import-planners.mjs). The data is large and varied, so only the
// parts the app reads are typed; the rest stays loose.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Course = { code: string; title: string; credits: number; credit_label: string; prereq: string };
export type Category = {
  key: string;
  title: string;
  required: number;
  rule: 'all' | 'choose' | 'blank';
  note?: string;
  groups: { title: string; courses: Course[] }[];
  slots: [string, number][];
  blank?: number;
};
export type Program = {
  key: string;
  degree: string;
  short: string;
  credits: number;
  status: 'complete' | 'partial' | 'fillin' | string;
  version_note: string;
  categories: Category[];
  sems_per_year?: number;
  n_semesters?: number;
  per_credit?: number;
  semester_fee?: number;
  admission_fee?: number;
  library_fee?: number;
  min_load?: number;
  max_load?: number;
  max_load_note?: string;
  roadmap?: { kind: string; note?: string; sems: [string, string[]][] } | null;
  compare?: { title: string; note?: string; left: string; right: string; rows: [string, string, string][] }[];
  facts: string[];
};

export type Block = { type: string; [k: string]: any };

export type SheetColumn = {
  h: string;
  w?: number;
  type: 'text' | 'list' | 'formula' | 'date' | 'num';
  options?: string[];
  allow_other?: boolean;
  f?: string;
  fmt?: string;
  flags?: [string, string, string][];
};
export type SheetSpec = {
  name: string;
  title?: string;
  blurb?: string;
  intro?: string;
  kind?: 'log' | 'calc';
  programs?: string[];
  columns: SheetColumn[];
  summary?: [string, string, string?][];
  example?: any[];
  scenarios?: string[];
  sections?: { title: string; rows: { label: string; key?: string; f?: string; fmt?: string; note?: string; bold?: boolean; example?: any[] }[] }[];
};

export type PlannerData = {
  product: { id: string; title: string; file: string; edition: string; built: string };
  uni: { key: string; name: string; short: string; domain: string; read: string; legal_full: string; legal_footer: string; banglish: string };
  dept: { key: string; name: string; short: string; accent: string; accent_light: string; [k: string]: any };
  rules: {
    grades: [string, number, number][];
    non_gpa: [string, string][];
    grades_source: string;
    lines: [string, number, number, string][];
    lines_source: string;
    standing: [number, string, string][];
    good_standing: [string, string];
    retake_note: string;
    retake_rule: 'latest' | 'best' | string;
    fees: { items: [string, string, string][]; note: string; installments: [number, number] | null; inst_note: string; ladder: string[]; ladder_note: string };
    [k: string]: any;
  };
  programs: Program[];
  book: Block[];
  sheets: SheetSpec[];
  art: { motif: string };
  trackers: string[];
  [k: string]: any;
};

/** Everything a student types into one planner. Same shape as the HTML planner's saved state,
 *  so backups move between the HTML files and the app. */
export type PlannerState = {
  v: number;
  profile: { name?: string; id?: string; program?: string; admitted?: string; target?: number | '' };
  courses: Record<string, Record<string, any>>;
  plan: Record<string, any>;
  extra: string[];
  tasks: any[];
  routine: any[];
  blocks: Record<string, any>;
  sheets: Record<string, { rows: Record<string, any>[] }>;
  calc: Record<string, any>;
  ladder: Record<string, string>;
  settings: Record<string, any>;
  semesters: string[] | null;
  current: string | null;
  instances: Record<string, any>;
  saved?: string;
};

export function blankState(): PlannerState {
  return {
    v: 1,
    profile: {},
    courses: {},
    plan: {},
    extra: [],
    tasks: [],
    routine: [],
    blocks: {},
    sheets: {},
    calc: {},
    ladder: {},
    settings: {},
    semesters: null,
    current: null,
    instances: {},
  };
}

/** Fills in any keys an older or partial state is missing. */
export function normalizeState(s: any): PlannerState {
  const b = blankState() as any;
  const out = s && typeof s === 'object' ? s : {};
  Object.keys(b).forEach((k) => {
    if (out[k] == null) out[k] = b[k];
  });
  return out as PlannerState;
}
