import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Blobs } from '../src/components/Blobs';
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

const DEFAULT_NAMES = { hangout: 'Saturday in the Village', roadtrip: 'Lake Tahoe Weekend' } as const;

export default function CreateSession() {
  const router = useRouter();
  const [kind, setKindState] = useState<'roadtrip' | 'hangout'>('hangout');
  const [name, setName] = useState<string>(DEFAULT_NAMES.hangout);
  const [durationMin, setDurationMin] = useState(240);

  const setKind = (next: 'roadtrip' | 'hangout') => {
    setKindState(next);
    // keep the demo name in sync unless the user typed their own
    setName((cur) => (cur === DEFAULT_NAMES.hangout || cur === DEFAULT_NAMES.roadtrip ? DEFAULT_NAMES[next] : cur));
  };

  const start = () => {
    router.replace({
      pathname: '/session',
      params: { name: name.trim() || 'Untitled session', kind, durationMin: String(durationMin), code: makeJoinCode() },
    });
  };

  return (
    <View style={styles.root}>
      <Blobs />
      <SafeAreaView style={styles.screen}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>New session</Text>

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
        <Choice label="🏙 Hangout" active={kind === 'hangout'} onPress={() => setKind('hangout')} />
        <Choice label="🚗 Road trip" active={kind === 'roadtrip'} onPress={() => setKind('roadtrip')} />
      </View>

      <Text style={styles.label}>{kind === 'roadtrip' ? 'Destination' : 'Meet-up spot'}</Text>
      <View style={styles.destCard}>
        <Text style={styles.destName}>
          🏁 {SCENARIOS[kind === 'roadtrip' ? 'roadtrip' : 'walk'].destination.name}
        </Text>
        <Text style={styles.destHint}>Demo destination — place search arrives with M2</Text>
      </View>

      <Text style={styles.label}>Session length</Text>
      <View style={styles.row}>
        {DURATIONS.map((d) => (
          <Choice key={d.min} label={d.label} active={durationMin === d.min} onPress={() => setDurationMin(d.min)} />
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <Pressable style={styles.primaryBtn} onPress={start}>
        <Text style={styles.primaryBtnText}>Create & get invite link</Text>
      </Pressable>
      </SafeAreaView>
    </View>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: UI.bg },
  screen: { flex: 1, padding: 20 },
  back: { color: UI.accent, fontSize: 17, marginBottom: 6 },
  title: { color: UI.text, fontSize: 30, fontWeight: '900', marginBottom: 18 },
  label: {
    color: UI.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: UI.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  choice: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  choiceActive: { backgroundColor: '#fff', borderColor: '#fff' },
  choiceText: { color: UI.text, fontSize: 15, fontWeight: '600' },
  choiceTextActive: { color: UI.bg },
  destCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 14,
  },
  destName: { color: UI.text, fontSize: 16, fontWeight: '700' },
  destHint: { color: UI.textDim, fontSize: 12, marginTop: 3 },
  primaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: UI.bg, fontSize: 16, fontWeight: '700' },
});
