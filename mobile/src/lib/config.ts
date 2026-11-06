import Constants from 'expo-constants';

/**
 * Backend URL. Priority:
 *  1. EXPO_PUBLIC_API_URL (set in mobile/.env or the shell)
 *  2. In development, the machine running Metro on port 4000, so a phone on
 *     the same Wi-Fi reaches the local backend without extra setup
 *  3. expo.extra.apiUrl in app.json
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081" in dev
  if (__DEV__ && hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:4000`;
  }

  const fromConfig = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  return (fromConfig || 'http://localhost:4000').replace(/\/+$/, '');
}

export const API_URL = resolveApiUrl();
