import { readFileSync } from 'node:fs';
import { createModel, sheetEvaluator, calcEvaluator, calcState, part } from '../../mobile/src/planners/model.ts';
import { format } from '../../mobile/src/planners/formula.ts';
import { makeState } from './state.mjs';
const id = process.argv[2];
const D = JSON.parse(readFileSync(new URL(`../../mobile/src/planners/data/${id}.json`, import.meta.url), 'utf8'));
const st: any = makeState(D);
const G = createModel(D, () => st);
const a = G.audit();
const sheets: any = {};
for (const sp of D.sheets) {
  if (sp.kind === 'calc') { const cs = calcState(st, sp); const ev = calcEvaluator(sp, cs); sheets[sp.name] = (sp.sections || []).flatMap((sec: any) => sec.rows.map((r: any) => (sp.scenarios || ['Value']).map((_: any, si: number) => r.f ? format(r.key ? ev.value(r.key, si) : ev.formula(r.f, si), r.fmt) : cs[r.key + '|' + si] ?? ''))); continue; }
  const rows = st.sheets[sp.name].rows; const ev = sheetEvaluator(sp, rows);
  sheets[sp.name] = { cells: rows.map((_: any, ri: number) => sp.columns.filter((c: any) => c.type === 'formula').map((c: any) => format(ev.value(ri, c.h), c.fmt))), sum: (sp.summary || []).map((s: any) => format(ev.summary(s[1]), s[2])) };
}
const out = { totals: { ...a.totals, cats: a.totals.cats.map((c: any) => [c.key, c.earned, c.planned]) }, rows: a.rows.map((v: any) => [v.id, v.status, v.unlock, v.earned, v.missing.join()]), standing: G.standing(a.totals.cgpa), band: G.band(a.totals.cgpa), gw: G.gateways().slice(0, 5).map((g: any) => [g.code, g.total]), sems: G.semesters().slice(0, 5), sheets, parts: [1,2,3,4,5,6].map(n => !!part(D, n)) };
console.log(JSON.stringify(out));
