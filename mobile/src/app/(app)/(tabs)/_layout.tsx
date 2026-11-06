import { Redirect, usePathname } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { PlannerTabBar, TABS } from '../../../components/PlannerShell';
import { AccentProvider } from '../../../components/tabula';
import { PlannerProvider, usePlanner } from '../../../context/PlannerContext';
import { useProgress } from '../../../context/ProgressContext';

function PlannerTabs() {
  const { entry } = usePlanner();
  const { update } = useProgress();
  const pathname = usePathname();

  // Remember the tab, so the next login reopens it.
  useEffect(() => {
    if (TABS.some(([k]) => `/${k}` === pathname)) update((p) => (p.lastRoute === pathname ? p : { ...p, lastRoute: pathname }));
  }, [pathname, update]);

  return (
    <AccentProvider value={{ accent: entry.accent, tint: entry.tint }}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <PlannerTabBar {...props} />}>
        {TABS.map(([name, title]) => (
          <Tabs.Screen key={name} name={name} options={{ title }} />
        ))}
      </Tabs>
    </AccentProvider>
  );
}

export default function TabsLayout() {
  return (
    <PlannerProvider fallback={<Redirect href="/pick" />}>
      <PlannerTabs />
    </PlannerProvider>
  );
}
