const { chromium } = require('playwright');
(async () => {
  const [file, stateJs] = process.argv.slice(2);
  const { makeState } = await import(stateJs);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + file);
  const D = await p.evaluate(() => window.__tabula.D);
  const st = makeState(D);
  const out = await p.evaluate((st) => {
    const { S, G, UI, F } = window.__tabula; S.data = st; const a = G.audit();
    const sheets = {};
    window.__tabula.D.sheets.forEach(sp => {
      if (sp.kind === 'calc') { const host = document.createElement('div'); host.appendChild(UI.calc(sp)); const cs = S.data.calc[sp.name]; const outs = {}; sp.sections.forEach(sec => sec.rows.forEach(r => { if (r.f && r.key) outs[r.key] = r; }));
        // re-evaluate exactly as UI.calc does
        function value(key, si, seen) { seen = seen || {}; if (seen[key]) return F.ERR('#REF!'); seen[key] = true; if (outs[key]) return F.run(outs[key].f, { ref: function (k) { return value(k, si, Object.assign({}, seen)); } }); var v = cs[key + '|' + si]; if (v == null || v === '') return ''; var n = Number(v); return isNaN(n) ? v : n; }
        sheets[sp.name] = sp.sections.flatMap(sec => sec.rows.map(r => (sp.scenarios || ['Value']).map((_, si) => r.f ? F.format(r.key ? value(r.key, si) : F.run(r.f, { ref: k => value(k, si) }), r.fmt) : (cs[r.key + '|' + si] ?? ''))));
        return; }
      const rows = S.data.sheets[sp.name].rows; rows.forEach(r => delete r.__m);
      sheets[sp.name] = { cells: rows.map((_, ri) => sp.columns.filter(c => c.type === 'formula').map(c => F.format(UI.sheetValue(sp, rows, ri, c.h), c.fmt))), sum: (sp.summary || []).map(s => F.format(F.run(s[1], UI.sheetCtx(sp, rows, 0)), s[2])) };
    });
    return { totals: { ...a.totals, cats: a.totals.cats.map(c => [c.key, c.earned, c.planned]) }, rows: a.rows.map(v => [v.id, v.status, v.unlock, v.earned, v.missing.join()]), standing: G.standing(a.totals.cgpa), band: G.band(a.totals.cgpa), gw: G.gateways().slice(0, 5).map(g => [g.code, g.total]), sems: G.semesters().slice(0, 5), sheets };
  }, st);
  console.log(JSON.stringify(out)); await b.close();
})();
