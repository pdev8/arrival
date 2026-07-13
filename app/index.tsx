import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmbientMap } from '../src/components/AmbientMap';
import { Glass } from '../src/components/Glass';
import { SCENARIOS } from '../src/demo/data';
import { seedNycArchive } from '../src/demo/nyc-archive';
import { ArchivedSession, listArchives } from '../src/lib/archive';
import { createLiveTrip, joinLiveTrip } from '../src/lib/live-session';
import {
  DEFAULT_DURATION_MIN,
  DEFAULT_KIND,
  DURATIONS,
  canStartSession,
  makeJoinCode,
} from '../src/lib/session-setup';
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

/** the NYC walk this project started with — 7 people, real routes, photos */
const DEMO = {
  name: 'Saturday in the Village',
  code: 'kfx-mqvp-dhz',
  crew: SCENARIOS.walk.members,
};

/**
 * Home sits on a live, slowly drifting map — the glass genuinely blurs the
 * city, which is the product promise before a single word is read.
 */
export default function Home() {
  const router = useRouter();
  const [archives, setArchives] = useState<ArchivedSession[]>([]);
  const [name, setName] = useState('');
  const [durationMin, setDurationMin] = useState(DEFAULT_DURATION_MIN);
  const [creating, setCreating] = useState(false);
  const ready = canStartSession(name) && !creating;

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

  // Live backend when configured (B2): the RPC mints the real join code.
  // Kind and destination aren't asked for — they're the walk scenario until
  // place search lands (M2).
  const start = async () => {
    if (!ready) return;
    const trimmed = name.trim();
    let code = makeJoinCode();
    let tripId: string | undefined;
    if (supabaseConfigured) {
      setCreating(true);
      try {
        const trip = await createLiveTrip({
          name: trimmed,
          kind: DEFAULT_KIND,
          durationMin,
          destinationName: SCENARIOS.walk.destination.name,
          destination: SCENARIOS.walk.destination.pos,
        });
        code = trip.joinCode;
        tripId = trip.id;
      } catch (e) {
        surfaceError('Live session unavailable — demo mode', e);
      } finally {
        setCreating(false);
      }
    }
    router.push({
      pathname: '/session',
      params: {
        name: trimmed,
        kind: DEFAULT_KIND,
        durationMin: String(durationMin),
        code,
        ...(tripId ? { live: '1', tripId } : {}),
      },
    });
  };

  return (
    <View style={styles.screen}>
      <AmbientMap />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.top}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.hero}>
            <View style={styles.mark}>
              <View style={styles.markDot} />
            </View>
            <Text style={styles.title}>Arrival</Text>
            <Text style={styles.tagline}>
              One link puts your whole group on a shared map —{'\n'}every step, every stop, until everyone arrives.
            </Text>
          </View>

          {/* Starting a session asks for the two things that actually vary: a
              name and a length. Everything else has a sane default. */}
          <Text style={styles.sectionTitle}>New session</Text>
          <Glass style={styles.createCard} radius={24} intensity={32}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Where are we headed?"
              placeholderTextColor={UI.textDim}
              returnKeyType="done"
              onSubmitEditing={start}
            />

            <Text style={styles.label}>Session length</Text>
            <View style={styles.chipRow}>
              {DURATIONS.map((d) => (
                <Pressable
                  key={d.min}
                  onPress={() => setDurationMin(d.min)}
                  style={[styles.chip, durationMin === d.min && styles.chipActive]}
                >
                  <Text style={[styles.chipText, durationMin === d.min && styles.chipTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.primaryBtn, styles.createBtn, !ready && styles.primaryBtnOff]}
              onPress={start}
              disabled={!ready}
            >
              <Text style={styles.primaryBtnText}>
                {creating ? 'Creating…' : 'Start a session'}
              </Text>
            </Pressable>
            <Text style={styles.cardNote}>Location sharing ends when the session does.</Text>
          </Glass>

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

          {/* The demo session: the NYC walk that started this project, running
              live with the whole crew — the one place to see every feature
              (trails, stops, votes, reactions, convergence, recap) without a
              second phone. */}
          <Text style={styles.sectionTitle}>Demo session</Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/session',
                params: { name: DEMO.name, kind: 'walk', durationMin: '240', code: DEMO.code },
              })
            }
          >
            <Glass style={styles.demoCard} radius={24} intensity={32}>
              <View style={styles.demoTop}>
                <View style={styles.livePip}>
                  <View style={styles.livePipDot} />
                  <Text style={styles.livePipText}>Live</Text>
                </View>
                <Text style={styles.demoName} numberOfLines={1}>{DEMO.name}</Text>
              </View>
              <Text style={styles.demoSub}>
                {DEMO.crew.length} people walking to {SCENARIOS.walk.destination.name} — trails, stops,
                votes and reactions, all running.
              </Text>
              <View style={styles.demoBottom}>
                <View style={styles.facepile}>
                  {DEMO.crew.map((m, i) => (
                    <Image
                      key={m.id}
                      source={m.avatar}
                      fadeDuration={0}
                      style={[styles.face, { borderColor: m.color, marginLeft: i === 0 ? 0 : -9 }]}
                    />
                  ))}
                </View>
                <Text style={styles.demoGo}>Open</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={UI.brand} />
              </View>
            </Glass>
          </Pressable>

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
                      live: '1',
                      tripId: trip.id,
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
  createCard: { padding: 16, paddingTop: 4 },
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
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
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
  createBtn: { marginTop: 18 },
  cardNote: { color: UI.textDim, fontSize: 12, textAlign: 'center', marginTop: 10 },
  demoCard: { padding: 14, gap: 8, borderColor: `${UI.brand}55` },
  demoTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  livePip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${UI.brand}24`,
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  livePipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: UI.brand },
  livePipText: { color: UI.brand, fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  demoName: { color: UI.text, fontSize: 15, fontWeight: '800', flex: 1 },
  demoSub: { color: UI.textDim, fontSize: 12.5, lineHeight: 17 },
  demoBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  face: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, backgroundColor: UI.bg },
  facepile: { flexDirection: 'row', flex: 1 },
  demoGo: { color: UI.brand, fontSize: 13, fontWeight: '700' },
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
  hero: { alignItems: 'center', paddingTop: 26, paddingBottom: 24 },
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
  primaryBtnOff: { opacity: 0.4 },
  secondaryBtn: { paddingVertical: 15, alignItems: 'center' },
  secondaryBtnText: { color: UI.text, fontSize: 16, fontWeight: '600' },
  demoNote: { color: UI.textDim, fontSize: 12, textAlign: 'center', marginTop: 4 },
});
