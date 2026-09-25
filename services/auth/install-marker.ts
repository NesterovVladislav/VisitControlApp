import AsyncStorage from '@react-native-async-storage/async-storage';

import { ProtectedSessionRepository, protectedSessionRepository } from './protected-session';

export const INSTALLATION_MARKER_KEY = 'visit-control.installation.v1';
const INSTALLATION_MARKER_VALUE = '1';

export interface InstallationMarkerStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

type SessionCleaner = Pick<ProtectedSessionRepository, 'clear'>;

export async function ensureCurrentInstallation(
  markerStore: InstallationMarkerStore = AsyncStorage,
  repository: SessionCleaner = protectedSessionRepository,
): Promise<void> {
  const marker = await markerStore.getItem(INSTALLATION_MARKER_KEY);
  if (marker === INSTALLATION_MARKER_VALUE) return;

  await repository.clear();
  await markerStore.setItem(INSTALLATION_MARKER_KEY, INSTALLATION_MARKER_VALUE);
}
