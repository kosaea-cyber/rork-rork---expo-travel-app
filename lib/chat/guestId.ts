import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const KEY = 'chat_guest_id_v1';

export async function getOrCreateGuestId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY);
  if (existing && existing.trim()) return existing;

  const id = randomUUID();
  await AsyncStorage.setItem(KEY, id);
  return id;
}

export async function resetGuestId(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
