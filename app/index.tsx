import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmbientMap } from '../src/components/AmbientMap';
import { Glass } from '../src/components/Glass';
import { seedNycArchive } from '../src/demo/nyc-archive';
import { ArchivedSession, listArchives } from '../src/lib/archive';
import { joinLiveTrip } from '../src/lib/live-session';
import { supabaseConfigured } from '../src/lib/supabase';
import { surfaceError } from '../src/lib/errors';
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
  const [archives, setArchives] = useState<ArchivedSession[]>([]);

  // seed the NYC walk on first run, then load whatever's archived
  useFocusEffect(
    useCallback(() => {
      let live = true;
      seedNycArchive()
        .then(listArchives)
        .then((a) => {
          if (live) setArchives(a);
        })
        .catch((e) => surfaceError('Loading archives', e));
      return () => {
        live = false;
      };
    }, [])
  );

  return (
    <View style={styles.screen}>
      <AmbientMap />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.top} showsVerticalScrollIndicator={false}>
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

          {archives.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Archived sessions</Text>
              <Glass style={styles.archives} radius={24} intensity={32}>
                {archives.slice(0, 4).map((a, i) => (
                  <Pressable
                    key={a.id}
                    style={[styles.archiveRow, i > 0 && styles.archiveRowBorder]}
                    onPress={() => router.push(`/archive/${a.id}`)}
                  >
                    <View style={styles.archiveIcon}>
                      <MaterialCommunityIcons name="archive-outline" size={15} color={UI.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.archiveName} numberOfLines={1}>{a.name}</Text>
                      <Text style={styles.archiveMeta}>
                        {new Date(a.endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {' · '}
                        {a.members.length} people
                        {a.members.some((m) => m.steps > 0)
                          ? ` · ${a.members.reduce((s, m) => s + m.steps, 0).toLocaleString()} steps`
                          : ''}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={UI.textDim} />
                  </Pressable>
                ))}
              </Glass>
            </>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/create')}>
            <Text style={styles.primaryBtnText}>Start a session</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!supabaseConfigured) {
                Alert.alert('Join a session', 'Joining by link/code arrives with the live backend (M1). This demo simulates a full session — tap “Start a session”.');
                return;
              }
              if (Platform.OS !== 'ios') {
                Alert.alert('Join a session', 'Enter-code UI lands with universal links (B3); use iOS to join by code for now.');
                return;
              }
              Alert.prompt('Join a session', 'Enter the invite code (like kfx-mqv-dhz)', async (code) => {
                if (!code) return;
                try {
                  const trip = await joinLiveTrip(code);
                  router.push({
                    pathname: '/session',
                    params: {
                      name: trip.name,
                      kind: trip.kind,
                      code: trip.joinCode,
                      durationMin: String(Math.max(1, Math.round((trip.endsAt - Date.now()) / 60000))),
                    },
                  });
                } catch (e) {
                  surfaceError('Couldn’t join session', e);
                }
              });
            }}
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
  top: { paddingHorizontal: 20, gap: 14, paddingBottom: 8 },
  sectionTitle: {
    color: UI.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: -6,
  },
  archives: { paddingHorizontal: 14 },
  archiveRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  archiveRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  archiveIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: `${UI.brand}1F`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveName: { color: UI.text, fontSize: 14, fontWeight: '700' },
  archiveMeta: { color: UI.textDim, fontSize: 12, marginTop: 1 },
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
