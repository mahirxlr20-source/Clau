// The formula engine the Tabula trackers use: the subset of Excel the log sheets and
// calculators need. Ported from the Tabula Campus HTML planner so sheets compute the
// same numbers as the HTML file and the Excel tracker.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Err = { err: string };
export type Val = number | string | boolean | '' | Err | Val[];
export type Ctx = { ref(name: string): any; name?(name: string): any };

export const ERR = (code = '#VALUE!'): Err => ({ err: code });
export const isErr = (v: any): v is Err => !!v && typeof v === 'object' && !Array.isArray(v) && !!v.err;

// ---- dates as Excel serials (the sheets' formulas work in days)
const EPOCH = Date.UTC(1899, 11, 30);
export function parseISO(s?: string | null) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
export function isoToSerial(iso: string): number | '' {
  const d = parseISO(iso);
  if (!d) return '';
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86400000);
}
export function serialToISO(n: any) {
  if (n === '' || n == null || isNaN(n)) return '';
  const d = new Date(EPOCH + Math.round(n) * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export function todaySerial() {
  const d = new Date();
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86400000);
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso?: string | null) {
  const d = parseISO(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}
export function fmtNum(x: any, dp?: number) {
  if (x == null || x === '' || isNaN(x)) return '';
  const n = Number(x);
  if (dp == null) return Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : String(Math.round(n * 100) / 100);
  return n.toFixed(dp);
}

// ---- parser
type Tok = { t: 'ref' | 'str' | 'num' | 'fn' | 'bool' | 'name' | 'op'; v: any };
function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\n' || c === '\t') { i++; continue; }
    if (c === '{') { const j = s.indexOf('}', i); out.push({ t: 'ref', v: s.slice(i + 1, j) }); i = j + 1; continue; }
    if (c === '"') {
      let j = i + 1, buf = '';
      while (j < s.length) { if (s[j] === '"') { if (s[j + 1] === '"') { buf += '"'; j += 2; continue; } break; } buf += s[j]; j++; }
      out.push({ t: 'str', v: buf }); i = j + 1; continue;
    }
    if (/[0-9.]/.test(c)) { const m = /^[0-9]*\.?[0-9]+(e[-+]?[0-9]+)?|^[0-9]+/i.exec(s.slice(i))!; out.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(s.slice(i))!;
      const name = m[0].toUpperCase(); i += m[0].length;
      if (s[i] === '(') { out.push({ t: 'fn', v: name }); i++; }
      else if (name === 'TRUE' || name === 'FALSE') out.push({ t: 'bool', v: name === 'TRUE' });
      else out.push({ t: 'name', v: name });
      continue;
    }
    const two = s.substr(i, 2);
    if (two === '<>' || two === '<=' || two === '>=') { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/^&=<>(),%'.indexOf(c) >= 0) { out.push({ t: 'op', v: c }); i++; continue; }
    throw new Error('bad char ' + c);
  }
  return out;
}

function parse(src: string): any {
  const toks = tokenize(src.charAt(0) === '=' ? src.slice(1) : src);
  let p = 0;
  const peek = () => toks[p];
  const take = () => toks[p++];
  const isOp = (v: string) => { const t = peek(); return !!t && t.t === 'op' && t.v === v; };
  const expr = (): any => cmp();
  const cmp = (): any => { let a = concat(); while (peek() && peek().t === 'op' && ['=', '<>', '<', '<=', '>', '>='].indexOf(peek().v) >= 0) { const op = take().v; const b = concat(); a = { op, a, b }; } return a; };
  const concat = (): any => { let a = add(); while (isOp('&')) { take(); const b = add(); a = { op: '&', a, b }; } return a; };
  const add = (): any => { let a = mul(); while (isOp('+') || isOp('-')) { const op = take().v; const b = mul(); a = { op, a, b }; } return a; };
  const mul = (): any => { let a = pow(); while (isOp('*') || isOp('/')) { const op = take().v; const b = pow(); a = { op, a, b }; } return a; };
  const pow = (): any => { let a = unary(); while (isOp('^')) { take(); const b = unary(); a = { op: '^', a, b }; } return a; };
  const unary = (): any => { if (isOp('-')) { take(); return { op: 'neg', a: unary() }; } if (isOp('+')) { take(); return unary(); } return postfix(); };
  const postfix = (): any => { let a = atom(); while (isOp('%')) { take(); a = { op: 'pct', a }; } return a; };
  const atom = (): any => {
    const t = take();
    if (!t) throw new Error('unexpected end');
    if (t.t === 'num' || t.t === 'str' || t.t === 'bool') return { lit: t.v };
    if (t.t === 'ref') return { ref: t.v };
    if (t.t === 'name') return { name: t.v };
    if (t.t === 'fn') {
      const args: any[] = [];
      if (!isOp(')')) { args.push(expr()); while (isOp(',')) { take(); args.push(expr()); } }
      if (!isOp(')')) throw new Error('expected )');
      take();
      return { fn: t.v, args };
    }
    if (t.t === 'op' && t.v === '(') { const e = expr(); if (!isOp(')')) throw new Error('expected )'); take(); return e; }
    throw new Error('unexpected ' + t.v);
  };
  const tree = expr();
  if (p < toks.length) throw new Error('trailing tokens');
  return tree;
}

const cache: Record<string, any> = {};
const compile = (src: string) => (cache[src] ??= parse(src));

function num(v: any): any {
  if (isErr(v)) return v;
  if (v === '' || v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') { const n = Number(v); return isNaN(n) || v.trim() === '' ? ERR() : n; }
  return ERR();
}
function cmpVals(a: any, b: any) {
  if (a === '' || a == null) a = typeof b === 'number' ? 0 : typeof b === 'boolean' ? false : '';
  if (b === '' || b == null) b = typeof a === 'number' ? 0 : typeof a === 'boolean' ? false : '';
  const ta = typeof a, tb = typeof b;
  if (ta === tb) { if (ta === 'string') { a = a.toLowerCase(); b = b.toLowerCase(); } return a < b ? -1 : a > b ? 1 : 0; }
  const rank: Record<string, number> = { number: 0, string: 1, boolean: 2 };
  return rank[ta] < rank[tb] ? -1 : 1;
}
function criteria(crit: any) {
  const s = crit == null ? '' : String(crit);
  const m = /^(<>|<=|>=|=|<|>)(.*)$/.exec(s);
  let op = '=', rhs = s;
  if (m) { op = m[1]; rhs = m[2]; }
  const rn = rhs.trim() === '' ? null : Number(rhs);
  const n = rn != null && !isNaN(rn) ? rn : null;
  return (v: any) => {
    if (v === '' || v == null) { if (op === '=') return rhs === ''; if (op === '<>') return rhs !== ''; return false; }
    if (n != null) {
      const vn = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : null;
      if (vn == null) return op === '<>';
      return op === '=' ? vn === n : op === '<>' ? vn !== n : op === '<' ? vn < n : op === '<=' ? vn <= n : op === '>' ? vn > n : vn >= n;
    }
    if (typeof v !== 'string') v = String(v);
    const c = cmpVals(v, rhs);
    return op === '=' ? c === 0 : op === '<>' ? c !== 0 : op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0;
  };
}
const flat = (v: any): any[] => (Array.isArray(v) ? v : [v]);

const FNS: Record<string, (a: any[]) => any> = {
  IF: (a) => { const c = a[0]; if (isErr(c)) return c; const t = c === '' || c == null ? false : typeof c === 'string' ? c.trim() !== '' : !!c; return t ? (a.length > 1 ? a[1] : true) : a.length > 2 ? a[2] : false; },
  OR: (a) => { let r = false; for (const v of a) { if (isErr(v)) return v; if (v === '' || v == null) continue; if (typeof v === 'string') { if (v.toUpperCase() === 'TRUE') r = true; continue; } if (v) r = true; } return r; },
  AND: (a) => { let r = true; for (const v of a) { if (isErr(v)) return v; if (v === '' || v == null) continue; if (typeof v === 'string') { if (v.toUpperCase() === 'FALSE') r = false; continue; } if (!v) r = false; } return r; },
  NOT: (a) => !a[0],
  N: (a) => { const v = a[0]; if (isErr(v)) return v; if (typeof v === 'number') return v; if (typeof v === 'boolean') return v ? 1 : 0; return 0; },
  COUNTA: (a) => a.reduce((n, x) => n + flat(x).filter((v) => v !== '' && v != null).length, 0),
  COUNT: (a) => a.reduce((n, x) => n + flat(x).filter((v) => typeof v === 'number').length, 0),
  COUNTBLANK: (a) => a.reduce((n, x) => n + flat(x).filter((v) => v === '' || v == null).length, 0),
  COUNTIF: (a) => { const p = criteria(a[1]); return flat(a[0]).filter(p).length; },
  COUNTIFS: (a) => {
    let n = 0; const len = flat(a[0]).length, preds: any[] = [], ranges: any[][] = [];
    for (let i = 0; i < a.length; i += 2) { ranges.push(flat(a[i])); preds.push(criteria(a[i + 1])); }
    for (let r = 0; r < len; r++) if (preds.every((p, k) => p(ranges[k][r]))) n++;
    return n;
  },
  SUM: (a) => { let s = 0; for (const x of a) for (const v of flat(x)) { if (isErr(v)) return v; if (typeof v === 'number') s += v; else if (typeof v === 'boolean' && !Array.isArray(x)) s += v ? 1 : 0; } return s; },
  SUMIF: (a) => { const p = criteria(a[1]), rng = flat(a[0]), sr = a.length > 2 ? flat(a[2]) : rng; let s = 0; rng.forEach((v, i) => { if (p(v) && typeof sr[i] === 'number') s += sr[i]; }); return s; },
  AVERAGE: (a) => { let s = 0, n = 0; a.forEach((x) => flat(x).forEach((v) => { if (typeof v === 'number') { s += v; n++; } })); return n ? s / n : ERR('#DIV/0!'); },
  MIN: (a) => { let m: number | null = null; a.forEach((x) => flat(x).forEach((v) => { if (typeof v === 'number' && (m == null || v < m)) m = v; })); return m ?? 0; },
  MAX: (a) => { let m: number | null = null; a.forEach((x) => flat(x).forEach((v) => { if (typeof v === 'number' && (m == null || v > m)) m = v; })); return m ?? 0; },
  TODAY: () => todaySerial(),
  ABS: (a) => { const v = num(a[0]); return isErr(v) ? v : Math.abs(v); },
  ROUND: (a) => { const v = num(a[0]), d = num(a[1] == null ? 0 : a[1]); if (isErr(v)) return v; const m = Math.pow(10, d); return Math.round(v * m) / m; },
  INT: (a) => { const v = num(a[0]); return isErr(v) ? v : Math.floor(v); },
  LOG10: (a) => { const v = num(a[0]); if (isErr(v)) return v; return v > 0 ? Math.log(v) / Math.LN10 : ERR('#NUM!'); },
  LN: (a) => { const v = num(a[0]); if (isErr(v)) return v; return v > 0 ? Math.log(v) : ERR('#NUM!'); },
  SQRT: (a) => { const v = num(a[0]); if (isErr(v)) return v; return v >= 0 ? Math.sqrt(v) : ERR('#NUM!'); },
  POWER: (a) => { const x = num(a[0]), y = num(a[1]); if (isErr(x)) return x; if (isErr(y)) return y; return Math.pow(x, y); },
  LEN: (a) => String(a[0] == null ? '' : a[0]).length,
  TEXT: (a) => format(a[0], String(a[1] || '')),
  ISNUMBER: (a) => typeof a[0] === 'number',
  ISBLANK: (a) => a[0] === '' || a[0] == null,
  IFERROR: (a) => (isErr(a[0]) ? a[1] : a[0]),
  TRIM: (a) => String(a[0] == null ? '' : a[0]).trim(),
  UPPER: (a) => String(a[0] == null ? '' : a[0]).toUpperCase(),
  LOWER: (a) => String(a[0] == null ? '' : a[0]).toLowerCase(),
};
const ERR_TOLERANT = ['COUNTA', 'COUNT', 'COUNTIF', 'COUNTIFS', 'OR', 'AND', 'ISNUMBER', 'ISBLANK', 'N'];

function evaluate(node: any, ctx: Ctx): any {
  if (node.lit != null) return node.lit;
  if (node.ref != null) { const v = ctx.ref(node.ref); return v === undefined ? '' : v; }
  if (node.name != null) { const nv = ctx.name ? ctx.name(node.name) : undefined; return nv === undefined ? ERR('#NAME?') : nv; }
  if (node.fn) {
    const fn = FNS[node.fn];
    if (!fn) return ERR('#NAME?');
    const args = node.args.map((x: any) => evaluate(x, ctx));
    if (node.fn !== 'IF' && node.fn !== 'IFERROR' && ERR_TOLERANT.indexOf(node.fn) < 0) for (const a of args) if (isErr(a)) return a;
    return fn(args);
  }
  if (node.op) {
    if (node.op === 'neg') { const x = num(evaluate(node.a, ctx)); return isErr(x) ? x : -x; }
    if (node.op === 'pct') { const y = num(evaluate(node.a, ctx)); return isErr(y) ? y : y / 100; }
    const a = evaluate(node.a, ctx), b = evaluate(node.b, ctx);
    if (isErr(a)) return a;
    if (isErr(b)) return b;
    switch (node.op) {
      case '&': return (a === '' || a == null ? '' : typeof a === 'number' ? fmtNum(a) : String(a)) + (b === '' || b == null ? '' : typeof b === 'number' ? fmtNum(b) : String(b));
      case '=': return cmpVals(a, b) === 0;
      case '<>': return cmpVals(a, b) !== 0;
      case '<': return cmpVals(a, b) < 0;
      case '<=': return cmpVals(a, b) <= 0;
      case '>': return cmpVals(a, b) > 0;
      case '>=': return cmpVals(a, b) >= 0;
    }
    const na = num(a), nb = num(b);
    if (isErr(na)) return na;
    if (isErr(nb)) return nb;
    switch (node.op) {
      case '+': return na + nb;
      case '-': return na - nb;
      case '*': return na * nb;
      case '/': return nb === 0 ? ERR('#DIV/0!') : na / nb;
      case '^': return Math.pow(na, nb);
    }
  }
  return ERR();
}

export function run(src: string, ctx: Ctx): any {
  try {
    return evaluate(compile(src), ctx);
  } catch {
    return ERR('#ERR');
  }
}

export function format(v: any, fmt?: string): string {
  if (isErr(v)) return v.err;
  if (v === '' || v == null) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v !== 'number') return String(v);
  if (!fmt) return fmtNum(v);
  if (/^D{1,2}-MMM-YY/i.test(fmt) || /^DD-MMM/i.test(fmt) || /YY/.test(fmt)) return fmtDate(serialToISO(v));
  const pct = fmt.indexOf('%') >= 0;
  const n = pct ? v * 100 : v;
  const m = /0(?:\.(0+))?/.exec(fmt);
  const dp = m && m[1] ? m[1].length : 0;
  let s = Math.abs(n).toFixed(dp);
  if (fmt.indexOf(',') >= 0) { const parts = s.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = parts.join('.'); }
  return (n < 0 ? '-' : '') + s + (pct ? '%' : '');
}
