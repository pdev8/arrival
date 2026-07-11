import AsyncStorage from '@react-native-async-storage/async-storage';
import { LatLng } from './geo';

/**
 * Archived sessions: a completed session frozen to the profile — members,
 * their full traces (trails), steps, arrival order — for the read-only
 * archive view. Local-first (AsyncStorage); syncs to the backend with M1.
 */

export interface ArchivedMember {
  id: string;
  name: string;
  color: string;
  /** demo members resolve avatars by id; real profiles replace this in M1 */
  avatarKey: string;
  mode: 'foot' | 'car';
  steps: number;
  traveledM: number;
  trail: LatLng[];
}

export interface ArchivedSession {
  id: string;
  name: string;
  kind: string;
  /** epoch ms when the session completed */
  endedAt: number;
  durationSec: number;
  destination: { name: string; pos: LatLng };
  members: ArchivedMember[];
  arrivalOrder: string[];
}

const KEY = 'arrival:archives:v1';
/** keep the archive bounded — trails make records heavy */
const MAX_ARCHIVES = 50;

export async function listArchives(): Promise<ArchivedSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ArchivedSession[]) : [];
  } catch {
    return [];
  }
}

export async function getArchive(id: string): Promise<ArchivedSession | null> {
  return (await listArchives()).find((a) => a.id === id) ?? null;
}

/** Prepend (newest first); replace any existing record with the same id. */
export async function saveArchive(session: ArchivedSession): Promise<void> {
  const rest = (await listArchives()).filter((a) => a.id !== session.id);
  await AsyncStorage.setItem(KEY, JSON.stringify([session, ...rest].slice(0, MAX_ARCHIVES)));
}

export async function hasArchive(id: string): Promise<boolean> {
  return (await getArchive(id)) !== null;
}
