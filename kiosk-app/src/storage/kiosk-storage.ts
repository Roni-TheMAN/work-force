import * as SecureStore from "expo-secure-store";

import type { PersistedKioskSession } from "../types/kiosk";

const STORAGE_KEY = "workforce.kiosk.session.v1";

export async function loadPersistedKioskSession(): Promise<PersistedKioskSession | null> {
  const rawValue = await SecureStore.getItemAsync(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PersistedKioskSession;
  } catch {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    return null;
  }
}

export async function persistKioskSession(session: PersistedKioskSession): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));
}

export async function clearPersistedKioskSession(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
