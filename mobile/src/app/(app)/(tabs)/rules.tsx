import { SectionsAsDetails } from '../../../components/blocks';
import { TabPage } from '../../../components/PlannerShell';
import { Empty, H1 } from '../../../components/tabula';
import { usePlanner } from '../../../context/PlannerContext';
import { part } from '../../../planners/model';

export default function Rules() {
  const { D } = usePlanner();
  // The HTML planner looks this part up as "Part 2 - ..."; the 2026-27 build calls it
  // "the Rules tab - ...", so its Rules tab came up empty. Both are found here.
  const p2 = part(D, 2);
  return (
    <TabPage tab="rules">
      <H1>Rules that move your CGPA and your money</H1>
      {p2 ? <SectionsAsDetails blocks={p2.blocks} scope="p2" /> : <Empty>This planner has no rules pages.</Empty>}
    </TabPage>
  );
}
