// The tracker's department sheets in the app: log sheets (rows of typed columns plus
// formula columns with flags) and calculators (scenarios side by side). Values come
// from the same formula engine as the HTML planner and the Excel tracker.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePlanner } from '../context/PlannerContext';
import { MIME, shareText } from '../lib/files';
import { format } from '../planners/formula';
import { calcEvaluator, calcState, flagTone, sheetCSV, sheetEvaluator, sheetState } from '../planners/model';
import type { SheetSpec } from '../planners/types';
import { colors, fonts, toneColors } from '../theme';
import { DateField, Field, Input, Select, useFeedback } from './controls';
import { Btn, Btns, Empty, H3, Inline, Label, Small, Tag, t, useAccent } from './tabula';

export function confirmThen(message: string, onYes: () => void, yesLabel = 'Delete') {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onYes();
    return;
  }
  Alert.alert(message, undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: yesLabel, style: 'destructive', onPress: onYes },
  ]);
}

export function LogSheet({ spec }: { spec: SheetSpec }) {
  const { st, commit, D } = usePlanner();
  const { prompt } = useFeedback();
  const sheet = sheetState(st, spec);
  const rows = sheet.rows;
  const ev = sheetEvaluator(spec, rows);
  const set = (r: Record<string, any>, h: string, v: any) =>
    commit(() => {
      if (v === '' || v == null) delete r[h];
      else r[h] = v;
    });

  return (
    <View>
      {spec.intro ? <Inline text={spec.intro} style={[t.small, { marginBottom: 8 }]} /> : null}
      {spec.summary?.length ? (
        <View style={s.tsum}>
          {spec.summary.map((x, i) => (
            <Text key={i} style={s.tsumT}>
              <Text style={s.tsumB}>{format(ev.summary(x[1]), x[2])}</Text> {x[0]}
            </Text>
          ))}
        </View>
      ) : null}
      {!rows.length ? <Empty>Nothing logged yet.</Empty> : null}
      {rows.map((row, ri) => (
        <View key={ri} style={s.rowCard}>
          <View style={s.rowHead}>
            <Label>Row {ri + 1}</Label>
            <Btn small variant="ghost" title="Delete" onPress={() => confirmThen('Delete this row?', () => commit(() => rows.splice(ri, 1)))} />
          </View>
          <View style={s.fields}>
            {spec.columns.map((c) => {
              if (c.type === 'formula') {
                const v = ev.value(ri, c.h);
                const txt = format(v, c.fmt);
                const tone = flagTone(c.flags, v);
                return (
                  <View key={c.h} style={s.half}>
                    <Label>{c.h}</Label>
                    <View style={{ minHeight: 30, justifyContent: 'center' }}>
                      {txt === '' ? <Small>-</Small> : tone ? <Tag tone={tone}>{txt}</Tag> : <Text style={s.val}>{txt}</Text>}
                    </View>
                  </View>
                );
              }
              const wideField = c.type === 'text' && (c.w || 12) >= 24;
              return (
                <Field key={c.h} label={c.h} style={wideField ? s.full : s.half}>
                  {c.type === 'list' ? (
                    <Select
                      compact
                      label={c.h}
                      value={row[c.h] || ''}
                      tone={flagTone(c.flags, row[c.h]) ? toneColors[flagTone(c.flags, row[c.h]) as 'ok'] : null}
                      options={[...(c.options || []), ...(row[c.h] && !(c.options || []).includes(row[c.h]) ? [row[c.h]] : []), ...(c.allow_other ? [['__other', 'Other...'] as [string, string]] : [])]}
                      onChange={async (v) => {
                        if (v === '__other') v = (await prompt(c.h, 'Type a value')) || '';
                        set(row, c.h, v);
                      }}
                    />
                  ) : c.type === 'date' ? (
                    <DateField compact value={row[c.h] || ''} onChange={(v) => set(row, c.h, v)} />
                  ) : (
                    <Input
                      compact
                      value={row[c.h] ?? ''}
                      keyboardType={c.type === 'num' ? 'decimal-pad' : 'default'}
                      onCommit={(v) => set(row, c.h, c.type === 'num' ? (v === '' ? '' : Number(v)) : v)}
                    />
                  )}
                </Field>
              );
            })}
          </View>
        </View>
      ))}
      <Btns>
        <Btn small variant="secondary" title="+ Add row" onPress={() => commit(() => rows.push({}))} />
        <Btn small variant="ghost" title="Export CSV" onPress={() => shareText(`${D.product.file}_${spec.name.replace(/\s+/g, '-')}.csv`, sheetCSV(spec, rows), MIME.csv, 'public.comma-separated-values-text')} />
      </Btns>
    </View>
  );
}

export function CalcSheet({ spec }: { spec: SheetSpec }) {
  const { st, commit } = usePlanner();
  const { accent } = useAccent();
  const cs = calcState(st, spec);
  const ev = calcEvaluator(spec, cs);
  const scen = spec.scenarios || ['Value'];
  return (
    <View>
      {spec.intro ? <Inline text={spec.intro} style={[t.small, { marginBottom: 8 }]} /> : null}
      {(spec.sections || []).map((sec, si) => (
        <View key={si}>
          <H3>{sec.title}</H3>
          <View style={s.tw}>
            <ScrollView horizontal nestedScrollEnabled>
              <View>
                <View style={[s.tr, { backgroundColor: accent }]}>
                  <View style={s.labelCol} />
                  {scen.map((x) => (
                    <Text key={x} style={[s.th, s.scenCol]}>{x}</Text>
                  ))}
                </View>
                {sec.rows.map((r, ri) => (
                  <View key={ri} style={[s.tr, s.line]}>
                    <View style={[s.labelCol, s.td]}>
                      <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink }}>{r.label}</Text>
                      {r.note ? <Small>{r.note}</Small> : null}
                    </View>
                    {scen.map((_, k) => (
                      <View key={k} style={[s.scenCol, s.td, { justifyContent: 'center' }]}>
                        {r.f ? (
                          <Text style={[s.val, { textAlign: 'center' }, r.bold && { fontFamily: fonts.serif, fontSize: 16 }]}>{format(r.key ? ev.value(r.key, k) : ev.formula(r.f, k), r.fmt)}</Text>
                        ) : (
                          <Input
                            compact
                            keyboardType="decimal-pad"
                            value={cs[r.key + '|' + k] ?? ''}
                            style={{ textAlign: 'center' }}
                            onCommit={(v) =>
                              commit(() => {
                                if (v === '') delete cs[r.key + '|' + k];
                                else cs[r.key + '|' + k] = v;
                              })
                            }
                          />
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  tsum: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6, marginBottom: 10 },
  tsumT: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  tsumB: { fontFamily: fonts.serif, fontSize: 16 },
  rowCard: { borderWidth: 1, borderColor: colors.rule, borderRadius: 12, padding: 10, marginBottom: 10, backgroundColor: colors.editBg },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  half: { width: '50%', paddingHorizontal: 5, marginBottom: 8 },
  full: { width: '100%', paddingHorizontal: 5, marginBottom: 8 },
  val: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink },
  tw: { borderWidth: 1, borderColor: colors.rule, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.paper, marginBottom: 12 },
  tr: { flexDirection: 'row' },
  line: { borderTopWidth: 1, borderTopColor: colors.linen },
  th: { fontFamily: fonts.sansSemi, fontSize: 11.5, color: '#fff', paddingVertical: 8, textAlign: 'center' },
  td: { paddingVertical: 6, paddingHorizontal: 8 },
  labelCol: { width: 170 },
  scenCol: { width: 104 },
});
