import { Stack } from 'expo-router';
import { Loading } from '../../components/Loading';
import { useProgress } from '../../context/ProgressContext';
import { colors, fonts } from '../../theme';

export default function AppLayout() {
  const { ready } = useProgress();
  if (!ready) return <Loading />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.parchment },
        headerStyle: { backgroundColor: colors.parchment },
        headerTitleStyle: { fontFamily: fonts.serif, color: colors.ink },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="pick" options={{ headerShown: true, title: 'Choose your planner', presentation: 'modal' }} />
      <Stack.Screen name="subscribe" options={{ headerShown: true, title: 'Premium', presentation: 'modal' }} />
      <Stack.Screen name="payment-result" options={{ headerShown: true, title: 'Payment', headerBackVisible: false }} />
    </Stack>
  );
}
