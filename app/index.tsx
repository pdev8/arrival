import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Blobs } from '../src/components/Blobs';
import { Glass } from '../src/components/Glass';
import { UI } from '../src/lib/colors';

export default function Home() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <Blobs />
      <SafeAreaView style={styles.safe}>
        <View style={styles.heroWrap}>
          <Glass style={styles.hero} radius={30} intensity={45}>
            <View style={styles.mark}>
              <View style={styles.markDot} />
            </View>
            <Text style={styles.title}>Arrival</Text>
            <Text style={styles.tagline}>
              Live map for your group.{'\n'}See everyone. Coordinate every stop.
            </Text>
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
            <Glass style={styles.secondaryBtn} radius={16} intensity={40}>
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
  heroWrap: { paddingHorizontal: 20, marginTop: 96 },
  hero: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderTopLeftRadius: 8,
    borderWidth: 4,
    borderColor: UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  markDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: UI.accent },
  title: { color: UI.text, fontSize: 40, fontWeight: '800', letterSpacing: -1.2, marginTop: 16 },
  tagline: { color: UI.textDim, fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 22 },
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
