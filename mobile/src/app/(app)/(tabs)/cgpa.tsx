import { StyleSheet, Text, View } from 'react-native';
import { Field, Input, Select } from '../../../components/controls';
import { TabPage } from '../../../components/PlannerShell';
import { Btn, Btns, Card, Empty, Grid, H1, H2, Kpi, Lead, Small, Tag, t, useAccent } from '../../../components/tabula';
import { usePlanner } from '../../../context/PlannerContext';
import { fmtNum } from '../../../planners/formula';
import { money } from '../../../planners/model';
import { colors, fonts } from '../../../theme';

function Bold({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: fonts.sansBold }}>{children}</Text>;
}

export default function Cgpa() {
  const { D, st, G, commit } = usePlanner();
  const { accent } = useAccent();
  const prog = G.current();
  const a = G.audit(prog);
  const tot = a.totals;
  const p = st.profile;

  // quick semester GPA
  const quick = st.calc.__quick || (st.calc.__quick = { rows: [{}, {}, {}, {}] });
  let qCr = 0, qQp = 0;
  quick.rows.forEach((r: { cr?: string; g?: string }) => {
    if (r.cr && r.g) {
      qCr += +r.cr;
      qQp += +r.cr * G.gp[r.g];
    }
  });

  const target = p.target || 3.5;
  const next = st.settings.nextCr || tot.inProgress || 12;
  const rs = st.settings.retake || {};
  const graded = a.rows.filter((v) => v.code && v.grade && v.gp != null);
  const rv = graded.find((x) => x.id === rs.id);

  let targetLines: React.ReactNode = null;
  if (tot.cgpa != null) {
    const need = G.needed(tot.cgpa, tot.gpaCr, +target, +next)!;
    const remaining = Math.max(0, tot.required - tot.gpaCr);
    const needAll = remaining > 0 ? G.needed(tot.cgpa, tot.gpaCr, +target, remaining)! : null;
    const best = (tot.qp + remaining * G.maxGp) / (tot.gpaCr + remaining);
    targetLines = (
      <View>
        <Text style={t.body}>
          Next semester you need a GPA of{' '}
          <Bold>{need <= 0 ? '0.00 (you are already there)' : need > G.maxGp ? `more than the scale allows (${need.toFixed(2)})` : need.toFixed(2)}</Bold> on {fmtNum(next)} credits.
        </Text>
        {needAll != null ? (
          <Text style={t.body}>
            Over all your remaining {fmtNum(remaining)} GPA credits: an average of{' '}
            <Bold>{needAll <= 0 ? '0.00' : needAll > G.maxGp ? `more than ${G.maxGp.toFixed(1)} - out of reach by graduation` : needAll.toFixed(2)}</Bold>.
          </Text>
        ) : null}
        <Text style={t.body}>
          The best CGPA still possible at graduation if every remaining grade is the top letter: <Bold>{best.toFixed(2)}</Bold>.
        </Text>
      </View>
    );
  }

  let retake: React.ReactNode = null;
  if (rv && rs.g) {
    const newGp = G.gp[rs.g];
    const best = D.rules.retake_rule === 'best';
    const counts = best ? Math.max(newGp, rv.gp!) : newGp;
    const newQp = tot.qp - rv.qp + rv.credits * counts;
    const newC = newQp / tot.gpaCr;
    const diff = newC - tot.cgpa!;
    retake = (
      <Text style={t.body}>
        If the new grade is <Bold>{rs.g}</Bold> the grade that counts is <Bold>{best ? (counts === newGp ? rs.g : rv.grade) : rs.g}</Bold> ({D.uni.short} counts the {best ? 'best' : 'latest'} grade), and your
        CGPA moves from <Bold>{tot.cgpa!.toFixed(2)}</Bold> to <Bold>{newC.toFixed(2)}</Bold>
        {diff === 0 ? ' - no change' : ` (${diff > 0 ? '+' : ''}${diff.toFixed(2)})`}. The retake costs tuition for {fmtNum(rv.credits)} credits again: {money(rv.credits * (prog.per_credit || 0))}.
      </Text>
    );
  }

  return (
    <TabPage tab="cgpa">
      <H1>CGPA, on {D.uni.short}&apos;s own scale</H1>
      <Lead>Everything here uses the grade points {D.uni.name} publishes. Your CGPA on the Degree map is the one that counts; these are the what-ifs around it.</Lead>
      <Grid cols={3} gap={8}>
        <Kpi label="CGPA" value={tot.cgpa == null ? '-' : tot.cgpa.toFixed(2)} />
        <Kpi label="GPA credits" value={fmtNum(tot.gpaCr)} />
        <Kpi label="Quality pts" value={fmtNum(tot.qp)} />
      </Grid>

      <Card>
        <H2 style={{ marginTop: 0 }}>The grading scale</H2>
        <View style={s.tw}>
          <View style={[s.tr, { backgroundColor: accent }]}>
            {['Letter', 'Marks from', 'Grade point'].map((h) => (
              <Text key={h} style={[s.th, { flex: 1 }]}>{h}</Text>
            ))}
          </View>
          {G.scale.map((g, i) => (
            <View key={g[0]} style={[s.tr, s.line, i % 2 ? { backgroundColor: colors.zebra } : null]}>
              <Text style={[s.td, { flex: 1, fontFamily: fonts.sansBold }]}>{g[0]}</Text>
              <Text style={[s.td, { flex: 1 }]}>{g[2] ? `${g[2]}%` : `below ${G.scale[G.scale.length - 2][2]}%`}</Text>
              <Text style={[s.td, { flex: 1 }]}>{g[1].toFixed(1)}</Text>
            </View>
          ))}
          {D.rules.non_gpa.map((x) => (
            <View key={x[0]} style={[s.tr, s.line]}>
              <Text style={[s.td, { flex: 1, fontFamily: fonts.sansBold }]}>{x[0]}</Text>
              <Text style={[s.td, { flex: 2, color: colors.clay, fontSize: 12.5 }]}>{x[1]}</Text>
            </View>
          ))}
        </View>
        <Small>{D.rules.grades_source}</Small>
      </Card>

      <Card>
        <H2 style={{ marginTop: 0 }}>Semester GPA, quick</H2>
        <Small style={{ marginBottom: 8 }}>For a semester you have not put on the map yet - or for a friend. Credits and letters only.</Small>
        {quick.rows.map((r: { cr?: string; g?: string }, i: number) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <Input compact style={{ width: 100 }} value={r.cr ?? ''} placeholder="credits" keyboardType="decimal-pad" onCommit={(v) => commit(() => (r.cr = v))} />
            <View style={{ width: 110 }}>
              <Select compact label="Grade" placeholder="grade" options={G.letters} value={r.g} onChange={(v) => commit(() => (r.g = v))} />
            </View>
          </View>
        ))}
        <Btns>
          <Btn small variant="secondary" title="+ Row" onPress={() => commit(() => quick.rows.push({}))} />
          <Btn small variant="ghost" title="Clear" onPress={() => commit(() => (quick.rows = [{}, {}, {}, {}]))} />
        </Btns>
        {qCr ? (
          <Text style={t.body}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 22 }}>{(qQp / qCr).toFixed(2)}</Text> GPA on {fmtNum(qCr)} credits ({fmtNum(qQp)} quality points)
            {tot.gpaCr ? (
              <>
                . Added to your record: CGPA <Bold>{((tot.qp + qQp) / (tot.gpaCr + qCr)).toFixed(2)}</Bold>.
              </>
            ) : null}
          </Text>
        ) : (
          <Small>Type credits and grades.</Small>
        )}
      </Card>

      <Card>
        <H2 style={{ marginTop: 0 }}>What it takes to reach a target</H2>
        <Grid cols={2}>
          <Field label="Target CGPA">
            <Input value={target} keyboardType="decimal-pad" onCommit={(v) => commit(() => (p.target = +v))} />
          </Field>
          <Field label="Credits next semester">
            <Input value={next} keyboardType="decimal-pad" onCommit={(v) => commit(() => (st.settings.nextCr = +v))} />
          </Field>
        </Grid>
        {tot.cgpa == null ? <Empty>Add grades on the Degree map first.</Empty> : targetLines}
      </Card>

      <Card>
        <H2 style={{ marginTop: 0 }}>Retake what-if</H2>
        <Small style={{ marginBottom: 8 }}>{D.rules.retake_note}</Small>
        {!graded.length ? (
          <Empty>No graded courses yet.</Empty>
        ) : (
          <>
            <Grid cols={2}>
              <Field label="Course">
                <Select
                  label="Course"
                  placeholder="Pick a course"
                  options={graded.map((v) => [v.id, `${v.code} (${v.grade}, ${fmtNum(v.credits)} cr)`] as [string, string])}
                  value={rs.id}
                  onChange={(v) => commit(() => (st.settings.retake = { ...rs, id: v }))}
                />
              </Field>
              <Field label="New grade">
                <Select label="New grade" placeholder="New grade" options={G.letters} value={rs.g} onChange={(v) => commit(() => (st.settings.retake = { ...rs, g: v }))} />
              </Field>
            </Grid>
            {retake}
          </>
        )}
      </Card>

      <Card>
        <H2 style={{ marginTop: 0 }}>CGPA lines that matter</H2>
        {G.lines()
          .slice()
          .sort((x, y) => y.value - x.value)
          .map((l, i) => (
            <View key={i} style={s.lineRow}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 15, width: 46, color: colors.ink }}>{l.value.toFixed(2)}</Text>
              <Text style={[t.body, { flex: 1, marginBottom: 0, fontSize: 13.5 }]}>{l.label}</Text>
              <Tag tone={tot.cgpa == null ? 'soft' : tot.cgpa >= l.value ? 'ok' : 'warn'}>
                {tot.cgpa == null ? '-' : tot.cgpa >= l.value ? `above by ${(tot.cgpa - l.value).toFixed(2)}` : `below by ${(l.value - tot.cgpa).toFixed(2)}`}
              </Tag>
            </View>
          ))}
        <Small style={{ marginTop: 8 }}>{D.rules.lines_source}</Small>
      </Card>
    </TabPage>
  );
}

const s = StyleSheet.create({
  tw: { borderWidth: 1, borderColor: colors.rule, borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  tr: { flexDirection: 'row' },
  line: { borderTopWidth: 1, borderTopColor: colors.linen },
  th: { fontFamily: fonts.sansSemi, fontSize: 11.5, color: '#fff', paddingVertical: 7, paddingHorizontal: 9 },
  td: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, paddingVertical: 6, paddingHorizontal: 9 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.linen },
});
