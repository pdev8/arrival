import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmbientMap } from '../src/components/AmbientMap';
import { Glass } from '../src/components/Glass';
import { UI } from '../src/lib/colors';

const FEATURES = [
  {
    icon: 'map-marker-radius' as const,
    color: '#5B8DEF',
    title: 'Live map',
    sub: "Everyone's position, heading and ETA at a glance",
  },
  {
    icon: 'shoe-print' as const,
    color: '#4CAF83',
    title: 'Trails',
    sub: 'Retrace anyone’s footprints, in their color',
  },
  {
    icon: 'thumb-up-outline' as const,
    color: '#8B7CF6',
    title: 'Stops & votes',
    sub: 'Suggest a detour — the group decides',
  },
];

/**
 * Home sits on a live, slowly drifting map — the glass genuinely blurs the
 * city, which is the product promise before a single word is read.
 */
export default function Home() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <AmbientMap />
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <View style={styles.hero}>
            <View style={styles.mark}>
              <View style={styles.markDot} />
            </View>
            <Text style={styles.title}>Arrival</Text>
            <Text style={styles.tagline}>
              One link puts your whole group on a shared map —{'\n'}every step, every stop, until everyone arrives.
            </Text>
          </View>

          <Glass style={styles.features} radius={24} intensity={32}>
            {FEATURES.map((f, i) => (
              <View key={f.title} style={[styles.featureRow, i > 0 && styles.featureRowBorder]}>
                <View style={[styles.featureIcon, { backgroundColor: `${f.color}24` }]}>
                  <MaterialCommunityIcons name={f.icon} size={17} color={f.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureSub}>{f.sub}</Text>
                </View>
              </View>
            ))}
          </Glass>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/create')}>
            <Text style={styles.primaryBtnText}>Start a session</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert('Join a session', 'Joining by link/code arrives with the live backend (M1). This demo simulates a full session — tap “Start a session”.')
            }
          >
            <Glass style={styles.secondaryBtn} radius={16} intensity={32}>
              <Text style={styles.secondaryBtnText}>Join with a link</Text>
            </Glass>
          </Pressable>
          <Text style={styles.demoNote}>Demo build — members are simulated</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },
  safe: { flex: 1, justifyContent: 'space-between' },
  top: { paddingHorizontal: 20, gap: 14 },
  hero: { alignItems: 'center', paddingVertical: 38 },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderTopLeftRadius: 8,
    borderWidth: 4,
    borderColor: UI.brand,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  markDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: UI.brand },
  title: { color: UI.text, fontSize: 42, fontWeight: '800', letterSpacing: -1.2, marginTop: 18 },
  tagline: { color: UI.textDim, fontSize: 14.5, textAlign: 'center', marginTop: 10, lineHeight: 21 },
  features: { paddingHorizontal: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  featureRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: { color: UI.text, fontSize: 14.5, fontWeight: '700' },
  featureSub: { color: UI.textDim, fontSize: 12.5, marginTop: 1.5 },
  actions: { padding: 24, gap: 12 },
  primaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: UI.bg, fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 15, alignItems: 'center' },
  secondaryBtnText: { color: UI.text, fontSize: 16, fontWeight: '600' },
  demoNote: { color: UI.textDim, fontSize: 12, textAlign: 'center', marginTop: 4 },
});
