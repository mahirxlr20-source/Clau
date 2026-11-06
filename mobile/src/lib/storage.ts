import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Secrets (the refresh token) go in the iOS Keychain / Android Keystore.
// SecureStore isn't available on web, so web falls back to AsyncStorage.
const useSecureStore = Platform.OS !== 'web';

export const secureStorage = {
  get: (key: string) => (useSecureStore ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key)),
  set: (key: string, value: string) =>
    useSecureStore ? SecureStore.setItemAsync(key, value) : AsyncStorage.setItem(key, value),
  remove: (key: string) => (useSecureStore ? SecureStore.deleteItemAsync(key) : AsyncStorage.removeItem(key)),
};

// Non-secret local cache (offline copy of saved progress).
export const cacheStorage = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  set: (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value)),
  remove: (key: string) => AsyncStorage.removeItem(key),
};
