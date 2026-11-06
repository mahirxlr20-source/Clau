// The degree model of a Tabula Campus planner: semesters, course rows, grades,
// status, unlock checks, totals, CGPA lines, fees, and the book's parts.
// Ported from the HTML planner (its "G" and "UI.parts" modules) so the numbers match.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { fmtNum, format, isoToSerial, parseISO, run } from './formula';
import type { Block, Category, Course, PlannerData, PlannerState, Program, SheetSpec } from './types';

export const SEASONS: Record<number, string[]> = { 3: ['Spring', 'Summer', 'Fall'], 2: ['Spring', 'Fall'] };

export type RowView = {
  id: string;
  kind: 'fixed' | 'slot' | 'blank' | 'extra';
  cat: Category | null;
  label: string;
  cr?: number;
  code: string;
  title: string;
  credits: number;
  fixedCredits?: number;
  prereq: string;
  printedPrereq: string;
  sem: string;
  grade: string;
  note: string;
  prereqCodes: string[];
  gate: number | null;
  gp: number | null;
  earned: number;
  gpaCr: number;
  qp: number;
  status: string;
  unlock: string;
  missing: string[];
  unknown: string[];
};

export type Audit = ReturnType<Model['audit']>;
export type Model = ReturnType<typeof createModel>;

export const normCode = (s: any) => {
  s = String(s || '').trim().toUpperCase();
  const m = /^([A-Z]{2,4})\s?(\d{3,4}[A-Z]?)$/.exec(s);
  return m ? m[1] + ' ' + m[2] : s;
};
export const codesIn = (text: any) => {
  const out: string[] = [];
  const re = /\b([A-Z]{2,4})\s?(\d{3,4}[A-Z]?)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(text || '').toUpperCase()))) {
    const c = m[1] + ' ' + m[2];
    if (out.indexOf(c) < 0) out.push(c);
  }
  return out;
};
const gateIn = (text: any) => {
  const m = /(\d{2,3})\s*credit/i.exec(String(text || ''));
  return m ? +m[1] : null;
};
export function daysFromToday(iso?: string | null) {
  const d = parseISO(iso);
  if (!d) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}
export const money = (n: number) => 'Tk ' + Math.round(n || 0).toLocaleString('en-US');

// ---- the book, split into parts by H1 and sections by H2
export type Part = { title: string; blocks: Block[] };
export type Section = { title: string; blocks: Block[] };

// Which part of the book belongs to which tab. The 2026-27 build titles its parts
// "the Rules tab - ..." instead of "Part 2 - ...", which the HTML planner's lookup
// misses (its Rules tab comes up empty); both forms are recognised here.
const PART_TITLES: Record<number, RegExp> = {
  1: /^(Part 1\b|the Degree tab\b)/i,
  2: /^(Part 2\b|the Rules tab\b)/i,
  3: /^(Part 3\b|the Semester tab -)/i,
  4: /^(Part 4\b|the Toolkit tab\b)/i,
  5: /^(Part 5\b|the More tab\b)/i,
  6: /^(Part 6\b|the Semester tab's everyday)/i,
};

export function bookParts(D: PlannerData): Part[] {
  const parts: Part[] = [];
  let cur: Part | null = null;
  D.book.forEach((b) => {
    if (b.type === 'cover') return;
    if (b.type === 'h1') {
      cur = { title: b.text, blocks: [] };
      parts.push(cur);
      return;
    }
    if (cur) cur.blocks.push(b);
  });
  return parts;
}
export function part(D: PlannerData, n: number) {
  return bookParts(D).find((p) => PART_TITLES[n].test(p.title)) ?? null;
}
export function partByTitle(D: PlannerData, prefix: string) {
  return bookParts(D).find((p) => p.title.indexOf(prefix) === 0) ?? null;
}
export function sections(blocks: Block[]): Section[] {
  const out: Section[] = [];
  let cur: Section = { title: '', blocks: [] };
  blocks.forEach((b) => {
    if (b.type === 'h2') {
      if (cur.blocks.length || cur.title) out.push(cur);
      cur = { title: b.text, blocks: [] };
    } else cur.blocks.push(b);
  });
  if (cur.blocks.length || cur.title) out.push(cur);
  return out;
}
/** A part's display title without the "the Rules tab - " prefix. */
export const partHeading = (title: string) => title.replace(/^(Part \d+|the [\w' ]+ tab('s everyday pages)?)\s*-\s*/i, '');

export function createModel(D: PlannerData, getState: () => PlannerState) {
  const S = () => getState();
  const scale = D.rules.grades;
  const gp: Record<string, number> = {};
  scale.forEach((g) => (gp[g[0]] = g[1]));
  const nonGpa = D.rules.non_gpa.map((x) => x[0]);
  const letters = scale.map((g) => g[0]);
  const allGrades = letters.concat(nonGpa);
  const maxGp = Math.max(...scale.map((g) => g[1]));

  const prog = (key?: string): Program => D.programs.find((p) => p.key === key) || D.programs[0];
  const current = () => prog(S().profile.program);

  function semesters(): string[] {
    const st = S();
    if (st.semesters && st.semesters.length) return st.semesters;
    const p = current();
    const spy = p.sems_per_year || 3;
    const seasons = SEASONS[spy] || SEASONS[3];
    const m = /^(\w+)\s+(\d{4})$/.exec(st.profile.admitted || '');
    let year = m ? +m[2] : new Date().getFullYear();
    let si = m ? Math.max(0, seasons.indexOf(m[1])) : 0;
    const n = Math.max(p.n_semesters || 12, 12) + 4;
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      out.push(seasons[si] + ' ' + year);
      si++;
      if (si >= seasons.length) { si = 0; year++; }
    }
    st.semesters = out;
    return out;
  }
  function currentSem(): string {
    const c = S().current;
    const sems = semesters();
    if (c && sems.indexOf(c) >= 0) return c;
    const spy = current().sems_per_year || 3;
    const now = new Date();
    const mo = now.getMonth();
    const season = spy === 3 ? (mo < 4 ? 'Spring' : mo < 8 ? 'Summer' : 'Fall') : mo < 6 ? 'Spring' : 'Fall';
    const guess = season + ' ' + now.getFullYear();
    if (sems.indexOf(guess) >= 0) return guess;
    return sems.find((x) => x.indexOf(String(now.getFullYear())) >= 0) || sems[0];
  }

  type Row = { id: string; kind: RowView['kind']; cat: Category | null; course?: Course; label?: string; cr?: number };
  function rows(p = current()): Row[] {
    const out: Row[] = [];
    p.categories.forEach((c) => {
      if (c.rule === 'all') c.groups.forEach((g) => g.courses.forEach((x) => out.push({ id: c.key + '|' + x.code, kind: 'fixed', cat: c, course: x })));
      else if (c.rule === 'choose') c.slots.forEach((s, i) => out.push({ id: c.key + '|slot|' + i, kind: 'slot', cat: c, label: s[0], cr: s[1] }));
      else for (let i = 0; i < (c.blank || 0); i++) out.push({ id: c.key + '|blank|' + i, kind: 'blank', cat: c });
    });
    (S().extra || []).forEach((id) => out.push({ id, kind: 'extra', cat: null }));
    return out;
  }
  function lookup(code: string, p = current()): Course | null {
    code = normCode(code);
    for (const c of p.categories) for (const g of c.groups) for (const x of g.courses) if (x.code === code) return x;
    return null;
  }
  function view(row: Row): RowView {
    const st = S().courses[row.id] || {};
    const v: any = { id: row.id, kind: row.kind, cat: row.cat, label: row.label || '', cr: row.cr };
    if (row.kind === 'fixed' && row.course) {
      v.code = row.course.code;
      v.title = row.course.title;
      v.credits = st.credits != null && st.credits !== '' ? +st.credits : row.course.credits;
      v.fixedCredits = row.course.credits;
      v.prereq = st.prereq != null ? st.prereq : row.course.prereq;
      v.printedPrereq = row.course.prereq;
    } else {
      v.code = normCode(st.code || '');
      const known = v.code ? lookup(v.code) : null;
      v.title = st.title || (known ? known.title : '');
      v.credits = st.credits != null && st.credits !== '' ? +st.credits : known ? known.credits : row.kind === 'slot' ? row.cr : 0;
      v.prereq = st.prereq != null ? st.prereq : known ? known.prereq : '';
      v.printedPrereq = known ? known.prereq : '';
    }
    v.sem = st.sem || '';
    v.grade = st.grade || '';
    v.note = st.note || '';
    v.prereqCodes = codesIn(v.prereq).filter((c) => c !== v.code);
    v.gate = gateIn(v.prereq);
    v.gp = v.grade in gp ? gp[v.grade] : null;
    v.earned = v.grade === 'P' || v.grade === 'S' || (v.gp != null && v.gp > 0) ? v.credits || 0 : 0;
    v.gpaCr = v.gp != null ? v.credits || 0 : 0;
    v.qp = v.gp != null ? (v.credits || 0) * v.gp : 0;
    return v as RowView;
  }
  function set(id: string, patch: Record<string, any>) {
    const courses = S().courses;
    const c = courses[id] || {};
    Object.keys(patch).forEach((k) => {
      if (patch[k] === '' || patch[k] == null) delete c[k];
      else c[k] = patch[k];
    });
    if (Object.keys(c).length) courses[id] = c;
    else delete courses[id];
  }

  function audit(p = current()) {
    const rs = rows(p).map(view);
    const sems = semesters();
    const cur = sems.indexOf(currentSem());
    const t = { gpaCr: 0, qp: 0, earned: 0, inProgress: 0, planned: 0, required: p.credits || 0, cgpa: null as number | null, remaining: 0, pct: 0, cats: [] as any[] };
    const earnedBy: Record<string, number> = {};
    const present: Record<string, boolean> = {};
    rs.forEach((v) => {
      t.gpaCr += v.gpaCr;
      t.qp += v.qp;
      t.earned += v.earned;
      if (v.code) { present[v.code] = true; earnedBy[v.code] = (earnedBy[v.code] || 0) + v.earned; }
    });
    rs.forEach((v) => {
      const si = v.sem ? sems.indexOf(v.sem) : -1;
      if (!v.code) v.status = v.kind === 'slot' ? 'Choose course' : '';
      else if (v.grade) v.status = !v.credits ? 'Add credits' : v.earned > 0 ? 'Completed' : ({ F: 'Failed - retake', W: 'Withdrawn', I: 'Incomplete' } as any)[v.grade] || 'Recorded';
      else if (!v.sem) v.status = 'Not scheduled';
      else v.status = si < cur ? 'Add grade' : si === cur ? 'In progress' : 'Planned';
      if (v.status === 'In progress') t.inProgress += v.credits || 0;
      if (v.status === 'Planned') t.planned += v.credits || 0;
      if (!v.code) v.unlock = '';
      else if (v.earned > 0) v.unlock = 'Done';
      else if (!v.prereqCodes.length && v.gate == null) v.unlock = v.prereq ? 'See prereq' : 'Open';
      else {
        const res = v.prereqCodes.map((q) => (!present[q] ? 2 : earnedBy[q] > 0 ? 1 : 0));
        if ((res.length && Math.min(...res) === 0) || (v.gate != null && t.earned < v.gate)) v.unlock = 'Locked';
        else if (res.length && Math.max(...res) === 2) v.unlock = 'Check prereq';
        else v.unlock = 'Ready';
      }
      v.missing = v.prereqCodes.filter((q) => present[q] && !(earnedBy[q] > 0));
      v.unknown = v.prereqCodes.filter((q) => !present[q]);
    });
    t.cgpa = t.gpaCr ? t.qp / t.gpaCr : null;
    t.remaining = Math.max(0, t.required - t.earned);
    t.pct = t.required ? Math.min(1, t.earned / t.required) : 0;
    t.cats = p.categories.map((c) => {
      const mine = rs.filter((v) => v.cat && v.cat.key === c.key);
      let earned = 0, planned = 0, graded = 0;
      mine.forEach((v) => {
        earned += v.earned;
        if (v.status === 'In progress' || v.status === 'Planned') planned += v.credits || 0;
        if (v.grade) graded++;
      });
      return { key: c.key, title: c.title, required: c.required, earned, planned, rows: mine.length, graded, pct: c.required ? Math.min(1, earned / c.required) : 0 };
    });
    return { rows: rs, totals: t, earnedBy, present };
  }

  const lines = () => D.rules.lines.map((l) => ({ label: l[0], value: l[1], name: l[3] }));
  function standing(cgpa: number | null) {
    if (cgpa == null) return { label: 'No grades yet', msg: 'Add your first grades in the Degree map.', tone: 'soft' as const };
    const bands = D.rules.standing.slice().sort((a, b) => a[0] - b[0]);
    for (const b of bands) if (cgpa < b[0]) return { label: b[1], msg: b[2], tone: 'bad' as const };
    return { label: D.rules.good_standing[0], msg: D.rules.good_standing[1], tone: 'ok' as const };
  }
  function band(cgpa: number | null) {
    if (cgpa == null) return null;
    const ls = lines().slice().sort((a, b) => b.value - a.value);
    let at: (typeof ls)[0] | null = null, next: (typeof ls)[0] | null = null;
    for (let i = 0; i < ls.length; i++) if (cgpa >= ls[i].value) { at = ls[i]; next = i > 0 ? ls[i - 1] : null; break; }
    if (!at) next = ls[ls.length - 1] ?? null;
    return { at, next };
  }
  const needed = (cgpa: number, gpaCr: number, target: number, nextCr: number) => (nextCr ? (target * (gpaCr + nextCr) - (cgpa || 0) * gpaCr) / nextCr : null);

  function fee(p: Program, credits: number, waiverPct: number) {
    const tuition = (credits || 0) * (p.per_credit || 0);
    const waiver = (-tuition * (waiverPct || 0)) / 100;
    const sem = p.semester_fee || 0;
    return { tuition, waiver, semester: sem, total: tuition + waiver + sem };
  }

  function gateways(p = current()) {
    const idx: Record<string, Course> = {};
    const dep: Record<string, string[]> = {};
    p.categories.forEach((c) => c.groups.forEach((g) => g.courses.forEach((x) => (idx[x.code] = x))));
    Object.keys(idx).forEach((code) => codesIn(idx[code].prereq).forEach((q) => { if (q !== code && idx[q]) (dep[q] = dep[q] || []).push(code); }));
    const reach = (code: string, seen: Record<string, boolean> = {}) => {
      (dep[code] || []).forEach((d) => { if (!seen[d]) { seen[d] = true; reach(d, seen); } });
      return seen;
    };
    return Object.keys(dep)
      .map((q) => ({ code: q, title: idx[q].title, direct: dep[q], total: Object.keys(reach(q)).length }))
      .sort((a, b) => b.total - a.total || b.direct.length - a.direct.length);
  }

  return { D, scale, gp, letters, allGrades, nonGpa, maxGp, prog, current, semesters, currentSem, rows, lookup, view, set, audit, lines, standing, band, needed, fee, gateways };
}

// ---- log sheets: rows of typed columns plus formula columns
export function sheetState(st: PlannerState, spec: SheetSpec) {
  let s = st.sheets[spec.name];
  if (!s) {
    s = st.sheets[spec.name] = { rows: [] };
    if (spec.example) {
      const r: Record<string, any> = {};
      spec.columns.forEach((c, i) => {
        if (c.type === 'formula') return;
        const v = spec.example![i];
        if (v == null) return;
        r[c.h] = c.type === 'date' ? String(v) : v;
      });
      s.rows.push(r);
    }
  }
  return s;
}

/** Evaluates a sheet: returns a function giving the value of (row, column). */
export function sheetEvaluator(spec: SheetSpec, rows: Record<string, any>[]) {
  const memo: Record<string, any>[] = rows.map(() => ({}));
  const colOf = (h: string) => spec.columns.find((c) => c.h === h);
  const ctx = (ri: number) => ({
    ref: (name: string): any => (name.indexOf('col:') === 0 ? rows.map((_, j) => value(j, name.slice(4))) : value(ri, name)),
  });
  function value(ri: number, h: string): any {
    const col = colOf(h);
    if (!col) return { err: '#NAME?' };
    const row = rows[ri];
    if (!row) return '';
    if (col.type === 'formula') {
      const m = memo[ri];
      if (h in m) return m[h];
      m[h] = '';
      return (m[h] = run(col.f || '', ctx(ri)));
    }
    const raw = row[h];
    if (raw == null || raw === '') return '';
    if (col.type === 'date') return isoToSerial(raw);
    if (col.type === 'num') { const n = Number(raw); return isNaN(n) ? raw : n; }
    return raw;
  }
  const summary = (f: string) => run(f, ctx(0));
  return { value, summary };
}

export function flagTone(flags: [string, string, string][] | undefined, v: any): '' | 'ok' | 'bad' | 'warn' | 'info' {
  if (!flags) return '';
  for (const f of flags) {
    if (String(v) === f[0]) {
      const bg = String(f[1]).toUpperCase();
      if (['FAE9DC', 'FEE2E2', 'FECACA'].includes(bg)) return 'bad';
      if (['E6EFD8', 'DCFCE7', 'D1FAE5'].includes(bg)) return 'ok';
      if (['FBEFCB', 'FEF3C7'].includes(bg)) return 'warn';
      return 'info';
    }
  }
  return '';
}

export function sheetCSV(spec: SheetSpec, rows: Record<string, any>[]) {
  const ev = sheetEvaluator(spec, rows);
  const q = (s: any) => {
    s = s == null ? '' : String(s);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const out = [spec.columns.map((c) => q(c.h)).join(',')];
  rows.forEach((r, ri) => out.push(spec.columns.map((c) => q(c.type === 'formula' ? format(ev.value(ri, c.h), c.fmt) : r[c.h] ?? '')).join(',')));
  return out.join('\n');
}

// ---- calculators: scenarios as columns, keyed inputs and formula outputs
export function calcState(st: PlannerState, spec: SheetSpec) {
  const s = st.calc[spec.name] || (st.calc[spec.name] = {});
  if (!s.seeded) {
    s.seeded = true;
    (spec.sections || []).forEach((sec) => sec.rows.forEach((r) => { if (r.key && r.example) r.example.forEach((v, si) => { if (v != null && s[r.key + '|' + si] == null) s[r.key + '|' + si] = v; }); }));
  }
  return s;
}
export function calcEvaluator(spec: SheetSpec, s: Record<string, any>) {
  const outs: Record<string, { f?: string }> = {};
  (spec.sections || []).forEach((sec) => sec.rows.forEach((r) => { if (r.f && r.key) outs[r.key] = r; }));
  function value(key: string, si: number, seen: Record<string, boolean> = {}): any {
    if (seen[key]) return { err: '#REF!' };
    seen[key] = true;
    if (outs[key]) return run(outs[key].f!, { ref: (k) => value(k, si, { ...seen }) });
    const v = s[key + '|' + si];
    if (v == null || v === '') return '';
    const n = Number(v);
    return isNaN(n) ? v : n;
  }
  const formula = (f: string, si: number) => run(f, { ref: (k) => value(k, si) });
  return { value, formula };
}

// ---- calendar files
export function ics(events: { title: string; date: string }[]) {
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tabula//Campus planner//EN'];
  events.forEach((e) => {
    const d = parseISO(e.date);
    if (!d) return;
    const ds = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    out.push('BEGIN:VEVENT', 'UID:' + Math.random().toString(36).slice(2) + Date.now().toString(36) + '@tabula', 'DTSTAMP:' + ds + 'T000000Z', 'DTSTART;VALUE=DATE:' + ds, 'SUMMARY:' + String(e.title).replace(/[\n,;]/g, ' '), 'END:VEVENT');
  });
  out.push('END:VCALENDAR');
  return out.join('\r\n');
}

export { fmtNum };
