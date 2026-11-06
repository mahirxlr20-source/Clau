import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FeedbackProvider } from '../components/controls';
import { Loading } from '../components/Loading';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ProgressProvider } from '../context/ProgressContext';
import { colors } from '../theme';

function RootNavigator() {
  const { status } = useAuth();
  if (status === 'loading') return <Loading />;
  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.parchment } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // The Tabula faces: Fraunces in three optical cuts and Caveat (the brand kit's own
  // files, SIL Open Font License), with Inter for text.
  const [loaded] = useFonts({
    FrauncesDisplay: require('../../assets/fonts/FrauncesDisplay-700.ttf'),
    Fraunces: require('../../assets/fonts/Fraunces-700.ttf'),
    'Fraunces-Italic': require('../../assets/fonts/Fraunces-400i.ttf'),
    FrauncesText: require('../../assets/fonts/FrauncesText-700.ttf'),
    Caveat: require('../../assets/fonts/Caveat-700.ttf'),
    Inter: Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });
  if (!loaded) return <Loading />;

  return (
    <SafeAreaProvider>
      <FeedbackProvider>
        <AuthProvider>
          <ProgressProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </ProgressProvider>
        </AuthProvider>
      </FeedbackProvider>
    </SafeAreaProvider>
  );
}
