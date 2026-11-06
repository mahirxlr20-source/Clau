import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Blocks } from '../../../components/blocks';
import { Input, Select, useFeedback } from '../../../components/controls';
import { TabPage } from '../../../components/PlannerShell';
import { confirmThen } from '../../../components/sheets';
import { Btn, Btns, Callout, Card, Details, Empty, Grid, H1, H3, Inline, Kpi, Label, Lead, Meter, Pill, Small, Tag, t } from '../../../components/tabula';
import { usePlanner } from '../../../context/PlannerContext';
import { fmtNum } from '../../../planners/formula';
import { Audit, codesIn, Model, normCode, part, RowView } from '../../../planners/model';
import type { Category, PlannerData, PlannerState, Program } from '../../../planners/types';
import { colors, fonts, Tone } from '../../../theme';

const STATUS_TONE: Record<string, Tone> = { Completed: 'ok', 'Failed - retake': 'bad', Withdrawn: 'warn', Incomplete: 'warn', 'Add grade': 'warn', 'In progress': 'info', 'Add credits': 'bad' };
const UNLOCK_TONE: Record<string, Tone> = { Done: 'ok', Ready: 'ok', Open: 'ok', Locked: 'bad', 'Check prereq': 'warn', 'See prereq': 'warn' };
export const statusTone = (s: string): Tone => STATUS_TONE[s] || 'soft';

const FILTERS: [string, string][] = [
  ['all', 'All'],
  ['sem', 'This semester'],
  ['ready', 'Ready to take'],
  ['locked', 'Locked'],
  ['done', 'Done'],
  ['todo', 'Not taken'],
];

function CourseRow({ v, c, sems }: { v: RowView; c: Category | null; sems: string[] }) {
  const { G, st, commit } = usePlanner();
  const { prompt } = useFeedback();
  const opts = c && c.rule === 'choose' ? c.groups.flatMap((g) => g.courses) : [];
  const set = (patch: Record<string, unknown>) => commit(() => G.set(v.id, patch));
  return (
    <View style={[s.course]}>
      {v.kind === 'fixed' ? (
        <View>
          <Text style={[t.body, { marginBottom: 0 }, v.earned > 0 && { color: colors.clay }]}>
            <Text style={{ fontFamily: fonts.sansBold }}>{v.code}</Text> {v.title}
          </Text>
          <Small>
            {fmtNum(v.credits)} cr{v.prereq ? `  |  prereq: ${v.prereq}` : '  |  no prerequisite printed'}
          </Small>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {v.kind === 'slot' && v.label ? <Label>{v.label + (v.cr ? ` (${fmtNum(v.cr)} cr)` : '')}</Label> : null}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ flex: 1 }}>
              {opts.length ? (
                <Select
                  compact
                  label="Pick a course"
                  placeholder="Code"
                  value={v.code}
                  options={[...opts.map((x) => [x.code, `${x.code}  ${x.title}`] as [string, string]), ['__type', 'Type another code...']]}
                  onChange={async (val) => {
                    let code = val;
                    if (val === '__type') code = (await prompt('Course code', 'e.g. CSE 340')) || '';
                    code = normCode(code);
                    const known = code ? G.lookup(code) : null;
                    const cur = st.courses[v.id] || {};
                    set({ code, title: known ? '' : cur.title, credits: known ? '' : cur.credits });
                  }}
                />
              ) : (
                <Input
                  compact
                  value={v.code}
                  placeholder="Code"
                  autoCapitalize="characters"
                  onCommit={(val) => {
                    const code = normCode(val);
                    const known = code ? G.lookup(code) : null;
                    const cur = st.courses[v.id] || {};
                    set({ code, title: known ? '' : cur.title, credits: known ? '' : cur.credits });
                  }}
                />
              )}
            </View>
            <Input compact style={{ width: 64, textAlign: 'center' }} value={v.credits || ''} placeholder="cr" keyboardType="decimal-pad" onCommit={(val) => set({ credits: val })} />
          </View>
          <Input compact value={v.title} placeholder="Title (fills itself for a listed code)" onCommit={(val) => set({ title: val })} />
          <Input compact value={v.prereq} placeholder="Prerequisite codes, e.g. CSE 103, MAT 101" autoCapitalize="characters" onCommit={(val) => set({ prereq: val })} />
        </View>
      )}
      <View style={s.ctl}>
        <View style={{ flex: 1 }}>
          <Select compact label="Semester" placeholder="Semester" options={sems} value={v.sem} onChange={(val) => set({ sem: val })} />
        </View>
        <View style={{ width: 96 }}>
          <Select compact label="Grade" placeholder="Grade" options={G.allGrades} value={v.grade} onChange={(val) => set({ grade: val })} />
        </View>
        {v.kind === 'extra' ? (
          <Btn
            small
            variant="ghost"
            title="×"
            onPress={() =>
              confirmThen('Remove this row?', () =>
                commit((x) => {
                  x.extra = x.extra.filter((id) => id !== v.id);
                  delete x.courses[v.id];
                }),
              )
            }
          />
        ) : null}
      </View>
      <View style={s.st}>
        {v.status ? <Tag tone={statusTone(v.status)}>{v.status}</Tag> : null}
        {v.unlock && v.unlock !== 'Done' ? <Tag tone={UNLOCK_TONE[v.unlock] || 'soft'}>{v.unlock}</Tag> : null}
        {v.unlock && v.unlock !== 'Done' && v.missing.length ? <Small>needs {v.missing.join(', ')}</Small> : null}
        {v.unlock === 'Locked' && v.gate != null ? <Small>and {v.gate} credits</Small> : null}
        {v.unknown.length && v.unlock === 'Check prereq' ? <Small>not on this map: {v.unknown.join(', ')}</Small> : null}
      </View>
    </View>
  );
}

function Plan({ a, prog, G }: { a: Audit; prog: Program; G: Model }) {
  const sems = G.semesters();
  const bySem: Record<string, RowView[]> = {};
  a.rows.forEach((v) => {
    if (v.sem) (bySem[v.sem] = bySem[v.sem] || []).push(v);
  });
  const used = sems.filter((x) => bySem[x]);
  const mn = prog.min_load, mx = prog.max_load;
  const semIdx: Record<string, number> = {};
  a.rows.forEach((v) => {
    if (v.code && v.sem) semIdx[v.code] = Math.min(semIdx[v.code] ?? 99, sems.indexOf(v.sem));
  });
  return (
    <View>
      <Small style={{ marginBottom: 10 }}>
        Built from the semester you picked for each course.{' '}
        {mx
          ? `The published load is ${mn ? fmtNum(mn) + ' to ' : 'up to '}${fmtNum(mx)} credits a semester${prog.max_load_note ? ` (${prog.max_load_note})` : ''}.`
          : 'No per-semester credit limit is printed for this programme; the Rules tab has the university rule.'}{' '}
        A course listed before the semester of its prerequisite is flagged.
      </Small>
      {!used.length ? <Empty>Pick a semester for a course on the map and it appears here.</Empty> : null}
      {used.map((sem) => {
        const rows = bySem[sem];
        const cr = rows.reduce((n, v) => n + (v.credits || 0), 0);
        const cls = mx && cr > mx ? 'over' : mn && cr < mn && cr > 0 ? 'under' : '';
        return (
          <View key={sem} style={s.sem}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 15, color: colors.ink }}>{sem}</Text>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: cls === 'over' ? colors.bad : cls === 'under' ? colors.warnText : colors.clay }}>
                {fmtNum(cr)} cr{cls === 'over' ? ' - over the limit' : cls === 'under' ? ' - under the minimum' : ''}
              </Text>
            </View>
            {rows.map((v) => {
              const late = v.prereqCodes.filter((q) => semIdx[q] != null && semIdx[q] >= sems.indexOf(sem));
              return (
                <View key={v.id} style={s.semLi}>
                  <Text style={[{ fontFamily: fonts.sans, fontSize: 13.5, flex: 1 }, { color: late.length ? colors.bad : colors.ink }]}>
                    {(v.code || v.label || '?') + (v.grade ? '  ' + v.grade : '') + (late.length ? `  (before ${late.join(', ')})` : '')}
                  </Text>
                  <Small>{fmtNum(v.credits)}</Small>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function Gateways({ prog, a, G, D }: { prog: Program; a: Audit; G: Model; D: PlannerData }) {
  const gw = G.gateways(prog).slice(0, 12);
  if (!gw.length)
    return <Empty>{D.uni.short} prints no prerequisites for this programme, so there are no chains to draw. Type the prerequisites from your advising sheet into the rows above and this page fills in.</Empty>;
  return (
    <View>
      <Small style={{ marginBottom: 8 }}>Courses that hold the most doors shut, from the prerequisites {D.uni.short} prints. Pass these early and on time.</Small>
      {gw.map((g) => {
        const v = a.rows.find((x) => x.code === g.code);
        return (
          <View key={g.code} style={s.gw}>
            <View style={{ flex: 1 }}>
              <Text style={[t.body, { marginBottom: 0 }]}>
                <Text style={{ fontFamily: fonts.sansBold }}>{g.code}</Text> {g.title}
              </Text>
              <Small>
                Unlocks {g.direct.length} directly, {g.total} in all: {g.direct.join(', ')}
              </Small>
            </View>
            <Tag tone={v ? statusTone(v.status) : 'soft'}>{v ? v.status || 'Not scheduled' : '-'}</Tag>
          </View>
        );
      })}
    </View>
  );
}

function Roadmap({ prog, a, G, commit, toast }: { prog: Program; a: Audit; G: Model; commit: (fn: (st: PlannerState) => void) => void; toast: (m: string) => void }) {
  const r = prog.roadmap!;
  const done: Record<string, boolean> = {};
  a.rows.forEach((v) => {
    if (v.code && v.earned > 0) done[v.code] = true;
  });
  return (
    <View>
      {r.note ? <Inline text={r.note} style={[t.small, { marginBottom: 8 }]} /> : null}
      {r.sems.map((sm, i) => (
        <View key={i} style={s.rs}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 13.5, width: 74, color: colors.ink }}>{sm[0]}</Text>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {sm[1].map((it, j) => {
              const code = codesIn(it)[0];
              return (
                <Tag key={j} tone={code && done[code] ? 'ok' : 'soft'}>
                  {it}
                </Tag>
              );
            })}
          </View>
        </View>
      ))}
      <Btns>
        <Btn
          small
          variant="secondary"
          title="Use this plan for my unscheduled courses"
          onPress={() =>
            confirmThen(
              'Fill the semester of every unscheduled course on this map from this plan? Nothing you already set is changed.',
              () => {
                const sems = G.semesters();
                let n = 0;
                commit(() => {
                  const views = G.rows(prog).map(G.view);
                  r.sems.forEach((sm, si) => {
                    const label = sems[si];
                    if (!label) return;
                    sm[1].forEach((it) => {
                      const code = codesIn(it)[0];
                      if (!code) return;
                      views.forEach((v) => {
                        if (v.code === code && !v.sem) {
                          G.set(v.id, { sem: label });
                          n++;
                        }
                      });
                    });
                  });
                });
                toast(`${n} courses scheduled`);
              },
              'Fill',
            )
          }
        />
      </Btns>
    </View>
  );
}

export default function Degree() {
  const { D, st, G, commit } = usePlanner();
  const { toast } = useFeedback();
  const prog = G.current();
  const a = G.audit(prog);
  const tot = a.totals;
  const sems = G.semesters();
  const f: string = st.settings.degFilter || 'all';
  const [q, setQ] = useState<string>(st.settings.degSearch || '');
  const cur = G.currentSem();
  const keep = (v: RowView) => {
    if (q && (v.code + ' ' + v.title).toLowerCase().indexOf(q.toLowerCase()) < 0) return false;
    if (f === 'sem') return v.sem === cur;
    if (f === 'ready') return v.unlock === 'Ready' || v.unlock === 'Open';
    if (f === 'locked') return v.unlock === 'Locked' || v.unlock === 'Check prereq';
    if (f === 'done') return v.earned > 0;
    if (f === 'todo') return !(v.earned > 0) && v.status !== 'In progress';
    return true;
  };
  const p1 = part(D, 1);
  const extra = a.rows.filter((v) => v.kind === 'extra' && keep(v));

  return (
    <TabPage tab="degree">
      <H1>Your degree on one map</H1>
      <Lead>
        Every published course of the {prog.degree} ({fmtNum(prog.credits)} credits). Pick a semester and a grade for each course you have taken; the rest follows.
      </Lead>
      {prog.status !== 'complete' ? (
        <Callout tone="gold" title={prog.status === 'fillin' ? 'This map is a template' : 'Partly pre-filled'}>
          <Text style={[t.body, { marginBottom: 0 }]}>{prog.version_note}</Text>
        </Callout>
      ) : null}
      <Grid cols={3} gap={8}>
        <Kpi label="CGPA" value={tot.cgpa == null ? '-' : tot.cgpa.toFixed(2)} />
        <Kpi label="Earned" value={`${fmtNum(tot.earned)}/${fmtNum(tot.required)}`} />
        <Kpi label="In progress" value={fmtNum(tot.inProgress)} />
      </Grid>

      <Card>
        <H3 style={{ marginTop: 0 }}>Credit map</H3>
        {tot.cats.map((c) =>
          !c.required && !c.rows ? null : (
            <View key={c.key} style={{ marginTop: 6, marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.ink, flex: 1 }}>{c.title}</Text>
                <Small>
                  {fmtNum(c.earned)}
                  {c.required ? ` / ${fmtNum(c.required)}` : ''}
                  {c.planned ? `  (+${fmtNum(c.planned)} planned)` : ''}
                </Small>
              </View>
              {c.required ? <Meter pct={c.pct} /> : null}
            </View>
          ),
        )}
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {FILTERS.map(([k, label]) => (
          <Pill key={k} on={f === k} onPress={() => commit(() => (st.settings.degFilter = k))}>
            {label}
          </Pill>
        ))}
      </View>
      <Input
        value={q}
        placeholder="Search a code or title"
        accessibilityLabel="Search a code or title"
        onLive={(v) => setQ(v)}
        onCommit={(v) => commit(() => (st.settings.degSearch = v))}
        style={{ marginBottom: 12 }}
      />

      {prog.categories.map((c) => {
        const rows = a.rows.filter((v) => v.cat && v.cat.key === c.key && keep(v));
        if (!rows.length && f !== 'all') return null;
        const optionCount = c.groups.reduce((n, g) => n + g.courses.length, 0);
        return (
          <Card key={c.key}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <H3 style={{ marginTop: 0, marginBottom: 0, flexShrink: 1 }}>{c.title}</H3>
              <Small style={{ fontFamily: fonts.sansSemi }}>
                {c.required ? `${fmtNum(c.required)} credits` : ''}
                {c.rule === 'choose' ? '  |  choose' : c.rule === 'blank' ? '  |  from your advising sheet' : ''}
              </Small>
            </View>
            {c.note ? <Inline text={c.note} style={[t.small, { marginTop: 4, marginBottom: 4 }]} /> : null}
            {c.rule === 'choose' && c.groups.length ? (
              <Details sub title={`The options ${D.uni.short} prints (${optionCount})`}>
                {() => (
                  <View>
                    {c.groups.map((g, gi) => (
                      <View key={gi}>
                        {g.title ? <Label style={{ marginTop: 8, marginBottom: 4 }}>{g.title}</Label> : null}
                        {g.courses.map((x) => (
                          <Small key={x.code}>
                            <Text style={{ fontFamily: fonts.sansBold, color: colors.ink }}>{x.code}</Text> {x.title} ({x.credit_label}){x.prereq ? ` - prereq: ${x.prereq}` : ''}
                          </Small>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </Details>
            ) : null}
            {rows.map((v) => (
              <CourseRow key={v.id} v={v} c={c} sems={sems} />
            ))}
            {!rows.length ? <Empty>Nothing here matches the filter.</Empty> : null}
          </Card>
        );
      })}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <H3 style={{ marginTop: 0, marginBottom: 0 }}>Other courses I took</H3>
          <Small>anything not on the map</Small>
        </View>
        {extra.map((v) => (
          <CourseRow key={v.id} v={v} c={null} sems={sems} />
        ))}
        <Btns>
          <Btn small variant="secondary" title="+ Add a course" onPress={() => commit((x) => x.extra.push('extra|' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)))} />
        </Btns>
      </Card>

      <Details title="My plan, semester by semester">{() => <Plan a={a} prog={prog} G={G} />}</Details>
      <Details title="What unlocks what">{() => <Gateways prog={prog} a={a} G={G} D={D} />}</Details>
      {prog.roadmap ? (
        <Details title={prog.roadmap.kind === 'official' ? 'The published semester plan' : 'The suggested semester plan'}>
          {() => <Roadmap prog={prog} a={a} G={G} commit={commit} toast={toast} />}
        </Details>
      ) : null}
      {prog.compare?.length ? (
        <Details title={`Where ${D.uni.short}'s own pages disagree`}>
          {() => (
            <View>
              {prog.compare!.map((cmp, i) => (
                <View key={i} style={{ marginBottom: 10 }}>
                  <H3>{cmp.title}</H3>
                  {cmp.note ? <Inline text={cmp.note} style={[t.small, { marginBottom: 6 }]} /> : null}
                  {cmp.rows.map((r, j) => (
                    <View key={j} style={s.cmp}>
                      <Text style={{ fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.ink }}>{r[0]}</Text>
                      <Small>
                        {cmp.left}: {r[1]}
                      </Small>
                      <Small>
                        {cmp.right}: {r[2]}
                      </Small>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </Details>
      ) : null}
      {p1 ? (
        <Details title="About this map (sources, what is pre-filled, what is not)">
          {() => (
            <Blocks
              blocks={p1.blocks.filter((b) => ['p', 'callout', 'bullets', 'numbered', 'h2', 'h3'].indexOf(b.type) >= 0 && !(b.type === 'h2' && /roadmap|checklist|unlock/i.test(b.text)))}
              scope="p1"
              skipTables
            />
          )}
        </Details>
      ) : null}
      <Details title={`Programme facts ${D.uni.short} prints`}>
        {() => (
          <View>
            {prog.facts.map((x, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 5 }}>
                <Text style={{ color: colors.gold, fontFamily: fonts.sansBold }}>•</Text>
                <Inline text={x} style={[t.body, { flex: 1, marginBottom: 0 }]} />
              </View>
            ))}
          </View>
        )}
      </Details>
    </TabPage>
  );
}

const s = StyleSheet.create({
  course: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.linen, gap: 6 },
  ctl: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  st: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  sem: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.rule, borderRadius: 12, padding: 10, marginBottom: 10 },
  semLi: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.linen, borderStyle: 'dashed' },
  gw: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.linen },
  rs: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.linen },
  cmp: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.linen },
});
