import { Blocks } from '../../../components/blocks';
import { TabPage } from '../../../components/PlannerShell';
import { CalcSheet, LogSheet } from '../../../components/sheets';
import { Details, H1, H2, Small } from '../../../components/tabula';
import { usePlanner } from '../../../context/PlannerContext';
import { part, sections } from '../../../planners/model';

export default function Toolkit() {
  const { D, G } = usePlanner();
  const p4 = part(D, 4);
  const secs = p4 ? sections(p4.blocks) : [];
  const intro = secs.find((x) => !x.title);
  const sheets = D.sheets.filter((sp) => !sp.programs || sp.programs.indexOf(G.current().key) >= 0);
  return (
    <TabPage tab="toolkit">
      <H1>The {D.dept.short} toolkit</H1>
      {intro ? <Blocks blocks={intro.blocks} scope="p4/intro" /> : null}
      {secs.map((sec, i) =>
        sec.title ? (
          <Details key={i} title={sec.title}>
            {() => <Blocks blocks={sec.blocks} scope={`p4/${i}`} />}
          </Details>
        ) : null,
      )}
      {sheets.length ? (
        <>
          <H2>Logs and calculators</H2>
          <Small style={{ marginBottom: 10 }}>
            The same sheets as the Excel tracker, here in the app - counts, countdowns and flags update as you type. Export any of them as CSV, or download the Excel file from More.
          </Small>
          {sheets.map((sp) => (
            <Details key={sp.name} title={sp.name + (sp.blurb ? ' - ' + sp.blurb : '')}>
              {() => (sp.kind === 'calc' ? <CalcSheet spec={sp} /> : <LogSheet spec={sp} />)}
            </Details>
          ))}
        </>
      ) : null}
    </TabPage>
  );
}
