import { Href, Redirect } from 'expo-router';
import { TABS } from '../../components/PlannerShell';
import { useProgress } from '../../context/ProgressContext';
import { CATALOG } from '../../planners/catalog';

// Where the app opens after login: the planner and the tab the user left, or the
// planner picker for a new account.
export default function Resume() {
  const { progress } = useProgress();
  const active = progress.activePlanner && CATALOG.some((c) => c.id === progress.activePlanner);
  if (!active) return <Redirect href="/pick" />;
  const last = TABS.some(([k]) => `/${k}` === progress.lastRoute) ? progress.lastRoute : '/home';
  return <Redirect href={last as Href} />;
}
