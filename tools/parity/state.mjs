// A deterministic filled-in state for a planner: grades on ~40% of rows, semesters on more, extra rows, sheet rows.
export function makeState(D) {
  const st = { v: 1, profile: { name: 'Test', admitted: 'Fall 2024', target: 3.6 }, courses: {}, plan: {}, extra: ['extra|x1'], tasks: [], routine: [], blocks: {}, sheets: {}, calc: {}, ladder: {}, settings: {}, semesters: null, current: 'Fall 2026', instances: {} };
  const prog = D.programs[0]; const letters = D.rules.grades.map(g => g[0]); let i = 0;
  const sems = ['Fall 2024', 'Spring 2025', 'Summer 2025', 'Fall 2025', 'Spring 2026', 'Fall 2026', 'Spring 2027'];
  for (const c of prog.categories) {
    if (c.rule === 'all') for (const g of c.groups) for (const x of g.courses) {
      const id = c.key + '|' + x.code; i++;
      if (i % 5 < 2) st.courses[id] = { sem: sems[i % 4], grade: letters[i % letters.length] };
      else if (i % 5 === 2) st.courses[id] = { sem: 'Fall 2026' };
      else if (i % 7 === 3) st.courses[id] = { sem: 'Spring 2027' };
    }
    if (c.rule === 'choose') c.slots.forEach((s, k) => { const opts = c.groups.flatMap(g => g.courses); if (opts[k]) st.courses[c.key + '|slot|' + k] = { code: opts[k].code, sem: 'Spring 2025', grade: k % 2 ? 'F' : 'B+' }; });
  }
  st.courses['extra|x1'] = { code: 'ABC 101', title: 'Other', credits: 3, grade: 'A', sem: 'Fall 2025' };
  for (const sp of D.sheets) if (sp.kind !== 'calc') {
    const r = {}; sp.columns.forEach((col, k) => { if (col.type === 'formula') return; r[col.h] = col.type === 'date' ? '2026-11-' + String(10 + k).padStart(2, '0') : col.type === 'num' ? k * 3 + 1 : col.type === 'list' ? (col.options || [''])[k % Math.max(1, (col.options || []).length)] : 'x' + k; });
    st.sheets[sp.name] = { rows: [r, {}] };
  }
  return st;
}
