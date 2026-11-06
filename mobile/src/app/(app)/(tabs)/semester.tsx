import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SectionsAsDetails } from '../../../components/blocks';
import { DateField, Field, Input, Select, useFeedback } from '../../../components/controls';
import { TabPage } from '../../../components/PlannerShell';
import { confirmThen } from '../../../components/sheets';
import { Btn, Btns, Card, CheckBox, DaysLeft, Empty, Grid, H1, H2, Pill, Small, t, useAccent } from '../../../components/tabula';
import { usePlanner } from '../../../context/PlannerContext';
import { MIME, shareText } from '../../../lib/files';
import { fmtDate } from '../../../planners/formula';
import { daysFromToday, ics, part } from '../../../planners/model';
import { colors, fonts } from '../../../theme';

const TYPES = ['Assignment', 'Quiz', 'Lab', 'Mid-term', 'Final', 'Presentation', 'Project milestone', 'Reading', 'Other'];
const DAYS = ['S', 'M', 'T', 'W', 'R', 'A', 'F'];
const DAYNAMES: Record<string, string> = { S: 'Sun', M: 'Mon', T: 'Tue', W: 'Wed', R: 'Thu', A: 'Sat', F: 'Fri' };
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const mins = (x?: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(x || '');
  return m ? +m[1] * 60 + +m[2] : null;
};

function Tasks({ sem }: { sem: string }) {
  const { D, st, commit } = usePlanner();
  const { toast } = useFeedback();
  const [nt, setNt] = useState({ title: '', course: '', type: '', due: '' });
  const tasks = st.tasks
    .filter((x) => (x.sem || sem) === sem)
    .map((x) => ({ x, d: daysFromToday(x.due) }))
    .sort((a, b) => {
      if ((a.x.status === 'Done') !== (b.x.status === 'Done')) return a.x.status === 'Done' ? 1 : -1;
      return (a.d ?? 9999) - (b.d ?? 9999);
    });
  return (
    <Card>
      <H2 style={{ marginTop: 0 }}>Deadlines and tasks</H2>
      {!tasks.length ? <Empty>Nothing yet. Add quizzes, assignments, labs, mid-terms, project milestones.</Empty> : null}
      {tasks.map(({ x, d }) => {
        const done = x.status === 'Done';
        return (
          <View key={x.id || x.title} style={s.task}>
            <CheckBox checked={done} label={x.title} onPress={() => commit(() => (x.status = done ? 'Open' : 'Done'))} />
            <View style={{ flex: 1 }}>
              <Text style={[t.body, { marginBottom: 0 }, done && { color: colors.clay, textDecorationLine: 'line-through' }]}>{x.title}</Text>
              <Small>{[x.course, x.type, x.due ? fmtDate(x.due) : ''].filter(Boolean).join('  |  ')}</Small>
            </View>
            <DaysLeft d={d} done={done} late="late" />
            <Btn small variant="ghost" title="×" onPress={() => confirmThen('Delete this task?', () => commit((y) => (y.tasks = y.tasks.filter((z) => z !== x))))} />
          </View>
        );
      })}
      <Card tone="linen" style={{ marginTop: 10, marginBottom: 0 }}>
        <Grid cols={2}>
          <Field label="Task">
            <Input value={nt.title} placeholder="What is due" onLive={(v) => setNt({ ...nt, title: v })} />
          </Field>
          <Field label="Course">
            <Input value={nt.course} placeholder="Course" autoCapitalize="characters" onLive={(v) => setNt({ ...nt, course: v })} />
          </Field>
          <Field label="Type">
            <Select label="Type" placeholder="Type" options={TYPES} value={nt.type} onChange={(v) => setNt({ ...nt, type: v })} />
          </Field>
          <Field label="Due">
            <DateField value={nt.due} onChange={(v) => setNt({ ...nt, due: v })} />
          </Field>
        </Grid>
        <Btns>
          <Btn
            small
            title="+ Add task"
            onPress={() => {
              if (!nt.title.trim()) return toast('Give it a name');
              commit((y) => y.tasks.push({ ...nt, title: nt.title.trim(), sem, status: 'Open', id: uid() }));
              setNt({ title: '', course: '', type: '', due: '' });
            }}
          />
          <Btn
            small
            variant="secondary"
            title="Export to calendar (.ics)"
            onPress={() => {
              const ev = st.tasks.filter((x) => x.due && x.status !== 'Done').map((x) => ({ title: x.title + (x.course ? ' - ' + x.course : ''), date: x.due }));
              if (!ev.length) return toast('No dated tasks');
              void shareText(`${D.product.file}_tasks.ics`, ics(ev), MIME.ics, 'public.calendar-event');
            }}
          />
        </Btns>
      </Card>
    </Card>
  );
}

function Routine({ sem }: { sem: string }) {
  const { st, commit } = usePlanner();
  const { toast } = useFeedback();
  const { accent } = useAccent();
  const blank = { course: '', section: '', start: '', end: '', room: '', teacher: '', days: '' };
  const [n, setN] = useState(blank);
  const secs = st.routine.filter((x) => (x.sem || sem) === sem);
  const hours: number[] = [];
  for (let hh = 8; hh < 21; hh++) hours.push(hh);
  return (
    <Card>
      <H2 style={{ marginTop: 0 }}>My routine</H2>
      <Small style={{ marginBottom: 8 }}>
        Type each section once; the grid draws itself and flags a clash. Day codes follow the university timetable (S Sun, M Mon, T Tue, W Wed, R Thu, A Sat, F Fri).
      </Small>
      <ScrollView horizontal nestedScrollEnabled>
        <View style={{ minWidth: 360 }}>
          <View style={s.gridRow}>
            <View style={s.hourCol} />
            {DAYS.map((d) => (
              <Text key={d} style={[s.dayHead]}>{DAYNAMES[d]}</Text>
            ))}
          </View>
          {hours.map((hr) => (
            <View key={hr} style={s.gridRow}>
              <Text style={s.hourCol}>{(hr > 12 ? hr - 12 : hr) + (hr >= 12 ? 'pm' : 'am')}</Text>
              {DAYS.map((d) => {
                const here = secs.filter((x) => {
                  const a = mins(x.start), b = mins(x.end);
                  return x.days && x.days.indexOf(d) >= 0 && a != null && b != null && a < (hr + 1) * 60 && b > hr * 60;
                });
                let clash = false;
                for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) if (mins(here[i].start)! < mins(here[j].end)! && mins(here[j].start)! < mins(here[i].end)!) clash = true;
                return (
                  <View key={d} style={[s.slot, here.length ? { backgroundColor: clash ? colors.bad : accent } : null]}>
                    {here.map((x, i) => (
                      <Text key={i} style={s.slotT} numberOfLines={2}>
                        <Text style={{ fontFamily: fonts.sansBold }}>{x.course}{x.section ? ' ' + x.section : ''}</Text>
                        {x.room ? '\n' + x.room : ''}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={{ marginTop: 10 }}>
        {secs.map((x, i) => (
          <View key={x.id || i} style={s.task}>
            <View style={{ flex: 1 }}>
              <Text style={[t.body, { marginBottom: 0 }]}>
                <Text style={{ fontFamily: fonts.sansBold }}>{x.course}</Text> {x.section || ''}
              </Text>
              <Small>
                {(x.days || '').split('').map((c: string) => DAYNAMES[c] || c).join(' ')}  {x.start || ''}-{x.end || ''}
                {x.room ? `  |  ${x.room}` : ''}
                {x.teacher ? `  |  ${x.teacher}` : ''}
              </Small>
            </View>
            <Btn small variant="ghost" title="×" onPress={() => commit((y) => (y.routine = y.routine.filter((z) => z !== x)))} />
          </View>
        ))}
      </View>
      <Card tone="linen" style={{ marginTop: 10, marginBottom: 0 }}>
        <Grid cols={2}>
          <Field label="Course">
            <Input value={n.course} placeholder="CSE 115" autoCapitalize="characters" onLive={(v) => setN({ ...n, course: v })} />
          </Field>
          <Field label="Section">
            <Input value={n.section} placeholder="Section" onLive={(v) => setN({ ...n, section: v })} />
          </Field>
          <Field label="Starts">
            <DateField mode="time" value={n.start} onChange={(v) => setN({ ...n, start: v })} />
          </Field>
          <Field label="Ends">
            <DateField mode="time" value={n.end} onChange={(v) => setN({ ...n, end: v })} />
          </Field>
          <Field label="Room">
            <Input value={n.room} placeholder="Room" onLive={(v) => setN({ ...n, room: v })} />
          </Field>
          <Field label="Faculty">
            <Input value={n.teacher} placeholder="Faculty initials" autoCapitalize="characters" onLive={(v) => setN({ ...n, teacher: v })} />
          </Field>
        </Grid>
        <Field label="Days">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {DAYS.map((d) => (
              <Pill key={d} gold={n.days.indexOf(d) >= 0} onPress={() => setN({ ...n, days: n.days.indexOf(d) >= 0 ? n.days.replace(d, '') : n.days + d })}>
                {DAYNAMES[d]}
              </Pill>
            ))}
          </View>
        </Field>
        <Btns>
          <Btn
            small
            title="+ Add section"
            onPress={() => {
              if (!n.course || !n.days || !n.start || !n.end) return toast('Course, days, start and end are needed');
              commit((y) => y.routine.push({ ...n, sem, id: uid() }));
              setN(blank);
            }}
          />
        </Btns>
      </Card>
    </Card>
  );
}

export default function Semester() {
  const { D, G, commit } = usePlanner();
  const sem = G.currentSem();
  const p3 = part(D, 3);
  const p6 = part(D, 6);
  return (
    <TabPage tab="semester">
      <H1>This semester</H1>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={{ width: 150 }}>
          <Select compact label="Semester" allowClear={false} options={G.semesters()} value={sem} onChange={(v) => commit((y) => (y.current = v))} />
        </View>
        <Small style={{ flex: 1 }}>Every page below belongs to this semester; switch semesters and the pages switch with it.</Small>
      </View>
      <Tasks sem={sem} />
      <Routine sem={sem} />
      {p3 ? (
        <View key={'p3' + sem}>
          <H2>The semester pages</H2>
          <Small style={{ marginBottom: 10 }}>
            The working pages of the planner, one set per semester: set-up, weekly routine, a course page for every course, the mid-semester check-in, the finals plan and the
            close-out. They save as you type.
          </Small>
          <SectionsAsDetails blocks={p3.blocks} scope={`p3/${sem}`} />
        </View>
      ) : null}
      {p6 ? (
        <View key={'p6' + sem}>
          <H2>Everyday pages</H2>
          <SectionsAsDetails blocks={p6.blocks} scope={`p6/${sem}`} />
        </View>
      ) : null}
    </TabPage>
  );
}

const s = StyleSheet.create({
  task: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.linen },
  gridRow: { flexDirection: 'row', gap: 3, marginBottom: 3 },
  hourCol: { width: 40, fontFamily: fonts.sansSemi, fontSize: 11, color: colors.clay, paddingTop: 6 },
  dayHead: { flex: 1, textAlign: 'center', fontFamily: fonts.sansBold, fontSize: 11, color: colors.clay, paddingVertical: 4 },
  slot: { flex: 1, minHeight: 34, borderRadius: 6, backgroundColor: colors.linen, padding: 2 },
  slotT: { fontFamily: fonts.sans, fontSize: 9.5, color: '#fff' },
});
