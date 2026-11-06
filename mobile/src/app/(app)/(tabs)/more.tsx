import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Blocks, SectionsAsDetails } from '../../../components/blocks';
import { DateField, Field, Input, useFeedback } from '../../../components/controls';
import { TabPage } from '../../../components/PlannerShell';
import { confirmThen } from '../../../components/sheets';
import { Btn, Btns, Card, Details, Grid, H1, H2, Lockup, Small, Tag, t } from '../../../components/tabula';
import { useAuth } from '../../../context/AuthContext';
import { usePlanner } from '../../../context/PlannerContext';
import { useProgress } from '../../../context/ProgressContext';
import { MIME, pickJsonText, printHtml, shareAsset, shareText } from '../../../lib/files';
import { TRACKER_ASSETS } from '../../../planners/catalog';
import { fmtDate, fmtNum } from '../../../planners/formula';
import { part, partByTitle } from '../../../planners/model';
import { blankState, normalizeState } from '../../../planners/types';
import { colors, fonts } from '../../../theme';

const esc = (x: unknown) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const todayISO = () => new Date().toISOString().slice(0, 10);
const PRINT_CSS = `body{font-family:Georgia,serif;color:#2B2520;margin:28px}h1{font-size:26px;margin:0 0 4px}.k{font:600 11px -apple-system,Helvetica,Arial;letter-spacing:.12em;text-transform:uppercase;color:#7A6E62}table{border-collapse:collapse;width:100%;font:12.5px -apple-system,Helvetica,Arial;margin-top:14px}th{text-align:left;color:#fff;padding:6px 8px}td{padding:6px 8px;border-bottom:1px solid #EFE8DA}.foot{font:10px -apple-system,Helvetica,Arial;color:#7A6E62;margin-top:18px}`;

export default function More() {
  const { D, st, G, entry, commit, replace } = usePlanner();
  const { user, subscription, signOut } = useAuth();
  const { flush } = useProgress();
  const { toast } = useFeedback();
  const [coverOpen, setCoverOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const cv = st.settings.cover || (st.settings.cover = {});
  const p = st.profile;
  const p5 = part(D, 5);
  const src = partByTitle(D, 'Sources');
  const premium = subscription.active;
  const needPremium = () => {
    toast('Part of Premium');
    router.push('/subscribe');
  };

  const printCover = () =>
    printHtml(`<html><head><meta charset="utf-8"><style>${PRINT_CSS}.cp{text-align:center;margin-top:120px}.t{font-size:30px;margin:60px 0 10px}td{font-size:15px;padding:10px}</style></head><body><div class="cp">
      <div style="font-size:24px">${esc(D.uni.name)}</div><div class="k" style="margin-top:6px">${esc(D.dept.name)}</div>
      <div class="t">${esc(cv.title || 'Assignment title')}</div><div class="k">${esc(cv.course || 'Course')}${cv.section ? '  |  Section ' + esc(cv.section) : ''}</div>
      <table style="width:70%;margin:60px auto 0">${[
        ['Submitted by', (p.name || 'Name') + (p.id ? ` (${p.id})` : '')],
        ['Programme', G.current().degree],
        ['Submitted to', cv.teacher || ''],
        ['Date', cv.date ? fmtDate(cv.date) : fmtDate(todayISO())],
      ]
        .map((r) => `<tr><td style="color:#7A6E62">${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`)
        .join('')}</table></div></body></html>`);

  const printMap = () => {
    const a = G.audit();
    const rows = a.rows.filter((v) => v.code || v.label);
    printHtml(`<html><head><meta charset="utf-8"><style>${PRINT_CSS}th{background:${entry.accent}}</style></head><body>
      <div class="k">${esc(D.uni.short)} edition  |  ${esc(D.product.edition)}</div><h1>${esc(D.product.title)}</h1>
      <div>${esc(p.name || '')}${p.id ? ' - ' + esc(p.id) : ''}  ·  CGPA ${a.totals.cgpa == null ? '-' : a.totals.cgpa.toFixed(2)}  ·  ${fmtNum(a.totals.earned)} of ${fmtNum(a.totals.required)} credits</div>
      <table><tr><th>Code</th><th>Course</th><th>Cr</th><th>Semester</th><th>Grade</th><th>Status</th></tr>${rows
        .map((v) => `<tr><td><b>${esc(v.code || v.label)}</b></td><td>${esc(v.title)}</td><td>${fmtNum(v.credits)}</td><td>${esc(v.sem)}</td><td>${esc(v.grade)}</td><td>${esc(v.status)}</td></tr>`)
        .join('')}</table><div class="foot">a Tabula Campus planner - ${esc(D.uni.name)} edition. ${esc(D.uni.legal_footer)}.</div></body></html>`);
  };

  const exportBackup = () =>
    shareText(`${D.product.file}_backup_${todayISO()}.json`, JSON.stringify({ product: D.product.id, exported: new Date().toISOString(), state: st }, null, 1), MIME.json, 'public.json');

  const importBackup = async () => {
    try {
      const text = await pickJsonText();
      if (!text) return;
      const obj = JSON.parse(text);
      if (!obj || !obj.state) throw new Error('not a Tabula backup');
      const load = () => {
        replace(normalizeState(obj.state));
        toast('Backup loaded');
      };
      if (obj.product && obj.product !== D.product.id) confirmThen(`This backup is from ${obj.product}. Load it into ${D.product.title} anyway?`, load, 'Load');
      else load();
    } catch (e) {
      toast(`Could not read that file: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <TabPage tab="more">
      <H1>More</H1>

      <Card>
        <H2 style={{ marginTop: 0 }}>Your account</H2>
        <Text style={[t.body, { marginBottom: 2 }]}>{user?.name}</Text>
        <Small>{user?.email}</Small>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <Tag tone={premium ? 'ok' : 'soft'}>{premium ? 'Premium' : 'Free'}</Tag>
          <Small style={{ flex: 1 }}>
            {premium ? `Premium until ${fmtDate(subscription.currentPeriodEnd?.slice(0, 10))}.` : 'Money, Semester, Toolkit, the Excel tracker and printing are part of Premium.'}
          </Small>
        </View>
        <Btns>
          <Btn small variant={premium ? 'secondary' : 'gold'} title={premium ? 'Extend Premium' : 'Go Premium'} onPress={() => router.push('/subscribe')} />
          <Btn small variant="secondary" title="Switch planner" onPress={() => router.push('/pick')} />
          <Btn
            small
            variant="ghost"
            title="Sign out"
            loading={signingOut}
            onPress={async () => {
              setSigningOut(true);
              await flush().catch(() => {});
              await signOut();
            }}
          />
        </Btns>
        <Small>Everything you type in every planner is saved to this account and comes back when you sign in on any phone.</Small>
      </Card>

      {p5 ? (
        <>
          <H2>Beyond the classroom</H2>
          <SectionsAsDetails blocks={p5.blocks} scope="p5" />
        </>
      ) : null}

      <Card>
        <H2 style={{ marginTop: 0 }}>Paper</H2>
        <Small>Print your degree map, or build an assignment cover page and print it.</Small>
        <Btns>
          <Btn small variant="secondary" title="Print my degree map" onPress={() => (premium ? printMap() : needPremium())} />
          <Btn small variant="secondary" title="Assignment cover page" onPress={() => setCoverOpen(!coverOpen)} />
        </Btns>
        {coverOpen ? (
          <View>
            <Grid cols={2}>
              <Field label="Assignment title">
                <Input value={cv.title} onCommit={(v) => commit(() => (cv.title = v))} />
              </Field>
              <Field label="Course code and title">
                <Input value={cv.course} onCommit={(v) => commit(() => (cv.course = v))} />
              </Field>
              <Field label="Section">
                <Input value={cv.section} onCommit={(v) => commit(() => (cv.section = v))} />
              </Field>
              <Field label="Submitted to">
                <Input value={cv.teacher} onCommit={(v) => commit(() => (cv.teacher = v))} />
              </Field>
              <Field label="Date">
                <DateField value={cv.date} onChange={(v) => commit(() => (cv.date = v))} />
              </Field>
            </Grid>
            <View style={{ borderWidth: 1, borderColor: colors.rule, borderRadius: 10, padding: 16, alignItems: 'center', backgroundColor: colors.paper }}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 17, color: colors.ink }}>{D.uni.name}</Text>
              <Small>{D.dept.name}</Small>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginVertical: 14, textAlign: 'center' }}>{cv.title || 'Assignment title'}</Text>
              <Small>
                {cv.course || 'Course'}
                {cv.section ? `  |  Section ${cv.section}` : ''}
              </Small>
              <Small style={{ marginTop: 8 }}>
                Submitted by {p.name || 'Name'}
                {p.id ? ` (${p.id})` : ''}
                {cv.teacher ? ` to ${cv.teacher}` : ''} · {cv.date ? fmtDate(cv.date) : fmtDate(todayISO())}
              </Small>
            </View>
            <Btns>
              <Btn small title="Print the cover page" onPress={() => (premium ? printCover() : needPremium())} />
            </Btns>
          </View>
        ) : null}
      </Card>

      {D.trackers.length ? (
        <Card>
          <H2 style={{ marginTop: 0 }}>Excel tracker</H2>
          <Small>The same degree audit, CGPA lab, fee sheet and department logs as a spreadsheet - for a laptop. It comes with the app; nothing is downloaded from the internet.</Small>
          <Btns>
            {D.trackers.map((name) => (
              <Btn key={name} small variant="secondary" title={`Download ${name}`} onPress={() => (premium ? void shareAsset(TRACKER_ASSETS[name], name, MIME.xlsx) : needPremium())} />
            ))}
          </Btns>
        </Card>
      ) : null}

      <Card>
        <H2 style={{ marginTop: 0 }}>Backup</H2>
        <Small>
          Your planner is already saved to your account. A backup file is a copy you keep yourself - and it is the same format as the HTML planner&apos;s backup, so you can bring in what
          you typed in the HTML file, or take your data back to it.
        </Small>
        <Btns>
          <Btn small title="Export backup" onPress={() => void exportBackup()} />
          <Btn small variant="secondary" title="Import backup" onPress={() => void importBackup()} />
          <Btn
            small
            variant="ghost"
            title="Reset"
            onPress={() =>
              confirmThen(`Erase everything you typed in ${D.product.title}? Export a backup first if in doubt.`, () => {
                replace(blankState());
                toast('Reset');
              }, 'Erase')
            }
          />
        </Btns>
      </Card>

      {src ? <Details title="Sources and small print">{() => <Blocks blocks={src.blocks} scope="src" />}</Details> : null}

      <Card tone="linen">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Lockup height={24} />
          <Text style={{ fontFamily: fonts.serifItalic, fontSize: 13.5, color: colors.ink }}>
            a Tabula Campus planner - {D.uni.name} edition
          </Text>
        </View>
        <Small style={{ marginTop: 8 }}>{D.uni.legal_full}</Small>
        <Small style={{ marginTop: 6 }}>
          Built from the content read on {D.uni.read}. Found something out of date? Change it on your map - and tell us so the next edition is right.
        </Small>
      </Card>
    </TabPage>
  );
}
