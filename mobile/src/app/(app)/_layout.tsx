import { Href, router, Stack, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Loading } from '../../components/ui';
import { useProgress } from '../../context/ProgressContext';

// Screens the app reopens after login. Add your own screens here.
const RESUMABLE_ROUTES = ['/', '/notes'];

export default function AppLayout() {
  const pathname = usePathname();
  const { progress, ready, update } = useProgress();
  const resumed = useRef(false);

  // Once saved progress has loaded, reopen the screen the user was last on.
  useEffect(() => {
    if (!ready || resumed.current) return;
    resumed.current = true;
    const last = progress.lastRoute;
    if (pathname === '/' && last !== '/' && RESUMABLE_ROUTES.includes(last)) {
      router.push(last as Href);
    }
  }, [ready, pathname, progress.lastRoute]);

  // Remember the current screen as part of progress.
  useEffect(() => {
    if (!ready || !resumed.current || !RESUMABLE_ROUTES.includes(pathname)) return;
    update((p) => (p.lastRoute === pathname ? p : { ...p, lastRoute: pathname }));
  }, [ready, pathname, update]);

  if (!ready) return <Loading />;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'My tasks' }} />
      <Stack.Screen name="notes" options={{ title: 'Notes' }} />
      <Stack.Screen name="subscribe" options={{ title: 'Premium', presentation: 'modal' }} />
      <Stack.Screen name="payment-result" options={{ title: 'Payment', headerBackVisible: false }} />
    </Stack>
  );
}
