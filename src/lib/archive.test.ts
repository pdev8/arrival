import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArchivedSession, getArchive, hasArchive, listArchives, saveArchive } from './archive';

const make = (id: string, name = 'Test session'): ArchivedSession => ({
  id,
  name,
  kind: 'walk',
  endedAt: 1_700_000_000_000,
  durationSec: 1200,
  destination: { name: 'Park', pos: { latitude: 40.73, longitude: -73.99 } },
  members: [
    {
      id: 'you',
      name: 'You',
      color: '#5B8DEF',
      avatarKey: 'you',
      mode: 'foot',
      steps: 1234,
      traveledM: 900,
      trail: [
        { latitude: 40.72, longitude: -73.99 },
        { latitude: 40.73, longitude: -73.99 },
      ],
    },
  ],
  arrivalOrder: ['you'],
});

beforeEach(() => AsyncStorage.clear());

describe('archive store', () => {
  it('starts empty', async () => {
    expect(await listArchives()).toEqual([]);
    expect(await getArchive('nope')).toBeNull();
    expect(await hasArchive('nope')).toBe(false);
  });

  it('round-trips a session', async () => {
    const a = make('s1');
    await saveArchive(a);
    expect(await getArchive('s1')).toEqual(a);
    expect(await hasArchive('s1')).toBe(true);
  });

  it('keeps newest first', async () => {
    await saveArchive(make('s1'));
    await saveArchive(make('s2'));
    const list = await listArchives();
    expect(list.map((a) => a.id)).toEqual(['s2', 's1']);
  });

  it('replaces an existing id instead of duplicating', async () => {
    await saveArchive(make('s1', 'Old name'));
    await saveArchive(make('s1', 'New name'));
    const list = await listArchives();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('New name');
  });

  it('survives corrupt storage', async () => {
    await AsyncStorage.setItem('arrival:archives:v1', 'not-json{');
    expect(await listArchives()).toEqual([]);
  });
});
