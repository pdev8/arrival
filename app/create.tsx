import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmbientMap } from '../src/components/AmbientMap';
import { Glass } from '../src/components/Glass';
import { UI } from '../src/lib/colors';
import { SCENARIOS } from '../src/demo/data';

const DURATIONS = [
  { label: '2h', min: 120 },
  { label: '4h', min: 240 },
  { label: '8h', min: 480 },
  { label: '12h', min: 720 },
  { label: '24h', min: 1440 },
];

function makeJoinCode(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const group = () =>
    Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

const DEFAULT_NAMES = { mall: 'Mall run — Hudson Yards', roadtrip: 'Lake Tahoe Weekend' } as const;

export default function CreateSession() {
  const router = useRouter();
  const [kind, setKindState] = useState<'roadtrip' | 'mall'>('mall');
  const [name, setName] = useState<string>(DEFAULT_NAMES.mall);
  const [durationMin, setDurationMin] = useState(240);

  const setKind = (next: 'roadtrip' | 'mall') => {
    setKindState(next);
    // keep the demo name in sync unless the user typed their own
    setName((cur) => (cur === DEFAULT_NAMES.mall || cur === DEFAULT_NAMES.roadtrip ? DEFAULT_NAMES[next] : cur));
  };

  const start = () => {
    router.replace({
      pathname: '/session',
      params: { name: name.trim() || 'Untitled session', kind, durationMin: String(durationMin), code: makeJoinCode() },
    });
  };

  return (
    <View style={styles.root}>
      <AmbientMap zoom={13.4} />
      <SafeAreaView style={styles.screen}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backRow}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={UI.brand} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>New session</Text>
        <Text style={styles.subtitle}>Share one link — everyone appears on the map.</Text>

        <Glass style={styles.card} radius={22} intensity={36}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Where are we headed?"
            placeholderTextColor={UI.textDim}
          />

          <Text style={styles.label}>Kind</Text>
          <View style={styles.row}>
            <KindTile
              icon="storefront-outline"
              label="Mall meetup"
              active={kind === 'mall'}
              onPress={() => setKind('mall')}
            />
            <KindTile
              icon="car-outline"
              label="Road trip"
              active={kind === 'roadtrip'}
              onPress={() => setKind('roadtrip')}
            />
          </View>
        </Glass>

        <Glass style={styles.card} radius={22} intensity={36}>
          <Text style={styles.label}>{kind === 'roadtrip' ? 'Destination' : 'Meet-up spot'}</Text>
          <View style={styles.destRow}>
            <View style={styles.destIcon}>
              <MaterialCommunityIcons name="flag-checkered" size={16} color={UI.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.destName}>
                {SCENARIOS[kind].destination.name}
              </Text>
              <Text style={styles.destHint}>Demo destination — place search arrives with M2</Text>
            </View>
          </View>

          <Text style={styles.label}>Session length</Text>
          <View style={styles.row}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d.min}
                onPress={() => setDurationMin(d.min)}
                style={[styles.chip, durationMin === d.min && styles.chipActive]}
              >
                <Text style={[styles.chipText, durationMin === d.min && styles.chipTextActive]}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
        </Glass>

        <View style={{ flex: 1 }} />
        <Pressable style={styles.primaryBtn} onPress={start}>
          <Text style={styles.primaryBtnText}>Create & get invite link</Text>
        </Pressable>
        <Text style={styles.footNote}>Location sharing ends automatically when the session does.</Text>
      </SafeAreaView>
    </View>
  );
}

function KindTile({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.kindTile, active && styles.kindTileActive]}>
      <MaterialCommunityIcons name={icon} size={20} color={active ? UI.bg : UI.textDim} />
      <Text style={[styles.kindText, active && styles.kindTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: UI.bg },
  screen: { flex: 1, padding: 20 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginLeft: -6, marginBottom: 8 },
  back: { color: UI.brand, fontSize: 16, fontWeight: '600' },
  title: { color: UI.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: UI.textDim, fontSize: 14, marginTop: 4, marginBottom: 16 },
  card: { padding: 16, paddingTop: 6, marginBottom: 12 },
  label: {
    color: UI.textDim,
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: UI.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  kindTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 13,
  },
  kindTileActive: { backgroundColor: '#fff', borderColor: '#fff' },
  kindText: { color: UI.text, fontSize: 15, fontWeight: '600' },
  kindTextActive: { color: UI.bg },
  destRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  destIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destName: { color: UI.text, fontSize: 15.5, fontWeight: '700' },
  destHint: { color: UI.textDim, fontSize: 12, marginTop: 2 },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  chipText: { color: UI.text, fontSize: 14.5, fontWeight: '600' },
  chipTextActive: { color: UI.bg },
  primaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: UI.bg, fontSize: 16, fontWeight: '700' },
  footNote: { color: UI.textDim, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
