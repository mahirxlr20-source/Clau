import { Text, View } from 'react-native';
import { Blocks } from '../../../components/blocks';
import { Field, Input, Select } from '../../../components/controls';
import { TabPage } from '../../../components/PlannerShell';
import { Card, DaysLeft, Details, Empty, Grid, H2, Hero, Kpi, Meter, Small, Tag, t } from '../../../components/tabula';
import { usePlanner } from '../../../context/PlannerContext';
import { fmtDate, fmtNum } from '../../../planners/formula';
import { daysFromToday, partByTitle, SEASONS } from '../../../planners/model';
import { colors, fonts } from '../../../theme';

export default function Home() {
  const { D, st, G, commit } = usePlanner();
  const p = st.profile;
  const prog = G.current();
  const a = G.audit(prog);
  const tot = a.totals;
  const seasons = SEASONS[prog.sems_per_year || 3] || SEASONS[3];
  const y0 = new Date().getFullYear();
  const admitted: string[] = [];
  for (let y = y0 - 7; y <= y0 + 1; y++) seasons.forEach((s) => admitted.push(`${s} ${y}`));
  const standing = G.standing(tot.cgpa);
  const band = G.band(tot.cgpa);

  const tasks = (st.tasks || [])
    .filter((x) => x.due && x.status !== 'Done')
    .map((x) => ({ title: x.title, due: x.due, course: x.course, d: daysFromToday(x.due)! }))
    .sort((x, y) => x.d - y.d)
    .slice(0, 4);
  const ladder = Object.keys(st.ladder || {})
    .map((k) => ({ title: k, due: st.ladder[k], course: '', d: daysFromToday(st.ladder[k]) }))
    .filter((x) => x.d != null && x.d >= -1)
    .sort((x, y) => x.d! - y.d!)
    .slice(0, 3);
  const nextUp = [...ladder, ...tasks];

  let bandText = '';
  if (band && tot.cgpa != null) {
    bandText = band.at ? `At or above the "${band.at.label}" line (${band.at.value.toFixed(2)}).` : 'Below every CGPA line.';
    if (band.next) bandText += ` Next line: ${band.next.label} at ${band.next.value.toFixed(2)} (${(band.next.value - tot.cgpa).toFixed(2)} away).`;
  }
  let targetText = '';
  if (p.target && tot.cgpa != null) {
    const cr = tot.inProgress || 12;
    const need = G.needed(tot.cgpa, tot.gpaCr, +p.target, cr);
    if (need != null)
      targetText = `To reach ${(+p.target).toFixed(2)} after this semester (${fmtNum(cr)} credits) you need a GPA of ${
        need > G.maxGp ? `more than ${G.maxGp.toFixed(1)} - not in one semester; open CGPA for the longer road` : need <= 0 ? '0.00 - you are there' : need.toFixed(2)
      }.`;
  }
  const readFirst = partByTitle(D, 'Read this first');

  return (
    <TabPage tab="home">
      <Hero kicker={`Unofficial student planner  |  ${D.product.edition} edition`} title={D.product.title} sub={`${D.dept.name}, ${D.uni.name}`} motif={D.art.motif} />

      <Card>
        <H2 style={{ marginTop: 0 }}>{p.name ? `Hello, ${p.name.split(' ')[0]}` : 'Start here'}</H2>
        <Grid cols={2}>
          <Field label="Your name">
            <Input value={p.name} placeholder="Name" autoComplete="name" onCommit={(v) => commit(() => (p.name = v))} />
          </Field>
          <Field label="Student ID">
            <Input value={p.id} placeholder="ID" onCommit={(v) => commit(() => (p.id = v))} />
          </Field>
          {D.programs.length > 1 ? (
            <Field label="Programme">
              <Select
                label="Programme"
                allowClear={false}
                options={D.programs.map((x) => [x.key, x.degree] as [string, string])}
                value={p.program || D.programs[0].key}
                onChange={(v) =>
                  commit(() => {
                    p.program = v;
                    st.semesters = null;
                  })
                }
              />
            </Field>
          ) : null}
          <Field label="Admitted in">
            <Select
              label="Admitted in"
              placeholder="Pick a semester"
              options={admitted}
              value={p.admitted}
              onChange={(v) =>
                commit(() => {
                  p.admitted = v;
                  st.semesters = null;
                  st.current = null;
                })
              }
            />
          </Field>
          <Field label="This semester">
            <Select label="This semester" options={G.semesters()} value={G.currentSem()} onChange={(v) => commit(() => (st.current = v))} />
          </Field>
          <Field label="Target CGPA">
            <Input value={p.target ?? ''} placeholder="e.g. 3.50" keyboardType="decimal-pad" onCommit={(v) => commit(() => (p.target = v ? +v : ''))} />
          </Field>
        </Grid>
      </Card>

      <Grid cols={2}>
        <Kpi label="CGPA" value={tot.cgpa == null ? '-' : tot.cgpa.toFixed(2)} sub={tot.gpaCr ? `${fmtNum(tot.gpaCr)} GPA credits` : 'no grades yet'} />
        <Kpi label="Credits earned" value={fmtNum(tot.earned)} sub={`of ${fmtNum(tot.required)} required`} />
        <Kpi label="In progress" value={fmtNum(tot.inProgress)} sub={tot.planned ? `${fmtNum(tot.planned)} more planned` : 'this semester'} />
        <Kpi label="To go" value={fmtNum(tot.remaining)} sub="credits" />
      </Grid>

      <Card>
        <Meter pct={tot.pct} />
        <Small>
          {Math.round(tot.pct * 100)}% of the degree earned | {fmtNum(tot.remaining)} credits to go
        </Small>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <Tag tone={standing.tone}>{standing.label}</Tag>
          <Small style={{ flex: 1 }}>{standing.msg}</Small>
        </View>
        {bandText ? <Small style={{ marginTop: 8 }}>{bandText}</Small> : null}
        {targetText ? <Small style={{ marginTop: 6 }}>{targetText}</Small> : null}
      </Card>

      <Card>
        <H2 style={{ marginTop: 0 }}>Next up</H2>
        {!nextUp.length ? <Empty>No deadlines yet. Add tasks in Semester and the fee and drop dates in Money.</Empty> : null}
        {nextUp.map((x, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: i < nextUp.length - 1 ? 1 : 0, borderBottomColor: colors.linen }}>
            <View style={{ flex: 1 }}>
              <Text style={[t.body, { marginBottom: 0 }]}>{x.title}</Text>
              <Small>
                {fmtDate(x.due)}
                {x.course ? `  |  ${x.course}` : ''}
              </Small>
            </View>
            <DaysLeft d={x.d} />
          </View>
        ))}
      </Card>

      <Card tone="linen">
        <H2 style={{ marginTop: 0 }}>Three things to do first</H2>
        <Text style={t.body}>
          <Text style={{ fontFamily: fonts.sansBold }}>1. Degree</Text>: tick the courses you have passed - pick the semester and the grade. The CGPA, the credit meter and every
          &quot;Ready / Locked&quot; check come from that.
        </Text>
        <Text style={t.body}>
          <Text style={{ fontFamily: fonts.sansBold }}>2. Money</Text>: type this semester&apos;s fee and drop dates from the Registrar&apos;s calendar; they count down here.
        </Text>
        <Text style={t.body}>
          <Text style={{ fontFamily: fonts.sansBold }}>3. Semester</Text>: put your sections into the routine and your deadlines into the task list. Then open the{' '}
          <Text style={{ fontFamily: fonts.sansBold }}>Toolkit</Text> when the work starts.
        </Text>
        <Small>Everything you type is saved to your tabula account as you go, and comes back on any phone you sign in on.</Small>
      </Card>

      {readFirst ? <Details title="How this planner works - read this first">{() => <Blocks blocks={readFirst.blocks} scope="rf" />}</Details> : null}

      <Small style={{ marginTop: 6, textAlign: 'center' }}>
        {D.uni.legal_footer}. Pre-filled from {D.uni.domain} as read on {D.uni.read}.
      </Small>
    </TabPage>
  );
}
