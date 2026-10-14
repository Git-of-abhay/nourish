import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'nourish_seen_badges';

/** Which badges the user has already been congratulated for, kept on this device. */
export async function seenBadges(): Promise<string[]> {
  try {
    const raw = Platform.OS === 'web' ? window.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch { return []; }
}

export async function rememberBadges(ids: string[]): Promise<void> {
  try {
    const raw = JSON.stringify(ids);
    if (Platform.OS === 'web') window.localStorage.setItem(KEY, raw); else await SecureStore.setItemAsync(KEY, raw);
  } catch { /* the toast may show again next time, which is harmless */ }
}
