import { StyleSheet, Text, View } from 'react-native';
import { Blocks } from '../../../components/blocks';
import { DateField, Field, Input, useFeedback } from '../../../components/controls';
import { TabPage } from '../../../components/PlannerShell';
import { confirmThen } from '../../../components/sheets';
import { Btn, Btns, Card, DaysLeft, Details, Grid, H1, H2, Lead, Small, t } from '../../../components/tabula';
import { usePlanner } from '../../../context/PlannerContext';
import { MIME, shareText } from '../../../lib/files';
import { fmtNum } from '../../../planners/formula';
import { daysFromToday, ics, money, part, sections } from '../../../planners/model';
import { colors, fonts } from '../../../theme';

export default function Money() {
  const { D, st, G, commit } = usePlanner();
  const { toast } = useFeedback();
  const prog = G.current();
  const tot = G.audit(prog).totals;
  const fs = st.settings.fees || (st.settings.fees = {});
  const cr = fs.credits != null ? fs.credits : tot.inProgress || 12;
  const wv = fs.waiver || 0;
  const other = fs.other || 0;
  const fee = G.fee(prog, cr, wv);
  const rows: [string, string][] = [[`Tuition: ${fmtNum(cr)} credits x ${money(prog.per_credit || 0)}`, money(fee.tuition)]];
  if (wv) rows.push([`Waiver ${wv}%`, '- ' + money(-fee.waiver)]);
  if (fee.semester) rows.push([D.rules.fees.items[0]?.[0] || 'Semester fee', money(fee.semester)]);
  if (other) rows.push(['Other charges', money(other)]);
  const inst = D.rules.fees.installments;

  const nsem = prog.n_semesters || 12;
  const tu = (prog.credits || 0) * (prog.per_credit || 0);
  const sf = (prog.semester_fee || 0) * nsem;
  const once = (prog.admission_fee || 0) + (prog.library_fee || 0);

  const L = st.ladder;
  const p2 = part(D, 2);
  const moneySecs = p2 ? sections(p2.blocks).filter((x) => /scholarship|waiver|fees|money|refund/i.test(x.title)) : [];

  return (
    <TabPage tab="money">
      <H1>Money</H1>
      <Lead>The semester bill at {D.uni.short}&apos;s published rates, and the dates that cost money - with a countdown.</Lead>

      <Card>
        <H2 style={{ marginTop: 0 }}>This semester&apos;s bill</H2>
        <Grid cols={3} gap={8}>
          <Field label="Credits">
            <Input value={cr} keyboardType="decimal-pad" onCommit={(v) => commit(() => (fs.credits = +v))} />
          </Field>
          <Field label="Waiver %">
            <Input value={wv} keyboardType="number-pad" onCommit={(v) => commit(() => (fs.waiver = +v))} />
          </Field>
          <Field label="Other (Tk)">
            <Input value={other} keyboardType="number-pad" onCommit={(v) => commit(() => (fs.other = +v))} />
          </Field>
        </Grid>
        <View style={s.tw}>
          {rows.map((r, i) => (
            <View key={i} style={[s.tr, i > 0 && s.line]}>
              <Text style={[s.td, { flex: 1 }]}>{r[0]}</Text>
              <Text style={[s.td, s.num]}>{r[1]}</Text>
            </View>
          ))}
          <View style={[s.tr, s.line, { backgroundColor: colors.linen }]}>
            <Text style={[s.td, { flex: 1, fontFamily: fonts.sansBold }]}>Total</Text>
            <Text style={[s.td, s.num, { fontFamily: fonts.serif, fontSize: 18 }]}>{money(fee.total + other)}</Text>
          </View>
        </View>
        {inst ? (
          <Small style={{ marginBottom: 6 }}>
            1st installment {Math.round(inst[0] * 100)}% of tuition: {money((fee.tuition + fee.waiver) * inst[0])}; 2nd {Math.round(inst[1] * 100)}%: {money((fee.tuition + fee.waiver) * inst[1])}. {D.rules.fees.inst_note}
          </Small>
        ) : (
          <Small style={{ marginBottom: 6 }}>{D.rules.fees.inst_note}</Small>
        )}
        <Small>{D.rules.fees.note}</Small>
      </Card>

      <Card tone="linen">
        <H2 style={{ marginTop: 0 }}>The whole degree, roughly</H2>
        <Text style={t.body}>
          {fmtNum(prog.credits)} credits x {money(prog.per_credit || 0)} = <Text style={{ fontFamily: fonts.sansBold }}>{money(tu)}</Text> in tuition; {nsem} semesters x {money(prog.semester_fee || 0)} ={' '}
          <Text style={{ fontFamily: fonts.sansBold }}>{money(sf)}</Text> in semester fees; {money(once)} paid once. About{' '}
          <Text style={{ fontFamily: fonts.sansBold }}>{money(tu + sf + once)}</Text> before any waiver, retake or late fee - at the rates printed for new students.
        </Text>
      </Card>

      <Card>
        <H2 style={{ marginTop: 0 }}>Dates that cost money</H2>
        <Small style={{ marginBottom: 8 }}>{D.rules.fees.ladder_note}</Small>
        {D.rules.fees.ladder.map((step, i) => {
          const d = daysFromToday(L[step]);
          return (
            <View key={step} style={[s.step, i > 0 && s.line]}>
              <Text style={[t.body, { marginBottom: 4 }]}>{step}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <DateField
                    compact
                    value={L[step] || ''}
                    onChange={(v) =>
                      commit(() => {
                        if (v) L[step] = v;
                        else delete L[step];
                      })
                    }
                  />
                </View>
                <View style={{ width: 64, alignItems: 'flex-end' }}>{d == null ? <Small>-</Small> : d < 0 ? <Small style={{ color: colors.bad }}>passed</Small> : <DaysLeft d={d} />}</View>
              </View>
            </View>
          );
        })}
        <Btns>
          <Btn
            small
            variant="secondary"
            title="Add these to my calendar (.ics)"
            onPress={() => {
              const ev = Object.keys(L).map((k) => ({ title: `${k} (${D.uni.short})`, date: L[k] }));
              if (!ev.length) return toast('Type some dates first');
              void shareText(`${D.product.file}_dates.ics`, ics(ev), MIME.ics, 'public.calendar-event');
            }}
          />
          <Btn small variant="ghost" title="Clear" onPress={() => confirmThen('Clear all the dates?', () => commit(() => (st.ladder = {})), 'Clear')} />
        </Btns>
      </Card>

      {moneySecs.map((sec, i) => (
        <Details key={i} title={sec.title}>
          {() => <Blocks blocks={sec.blocks} scope={`p2money/${i}`} />}
        </Details>
      ))}
    </TabPage>
  );
}

const s = StyleSheet.create({
  tw: { borderWidth: 1, borderColor: colors.rule, borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  tr: { flexDirection: 'row', alignItems: 'center' },
  line: { borderTopWidth: 1, borderTopColor: colors.linen },
  td: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, paddingVertical: 7, paddingHorizontal: 10 },
  num: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  step: { paddingVertical: 8 },
});
