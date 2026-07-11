import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DestinationMarker } from '../../src/components/DestinationMarker';
import { Glass } from '../../src/components/Glass';
import { DEMO_AVATARS } from '../../src/demo/data';
import { ArchivedSession, getArchive } from '../../src/lib/archive';
import { UI } from '../../src/lib/colors';
import { formatDistance } from '../../src/lib/format';
import { recapStats } from '../../src/lib/recap';
import { RecapShare } from '../../src/components/RecapShareCard';
import { TRAIL_ALPHAS, alphaHex, buildSegments } from '../../src/lib/trail';

const FIT_PADDING = { top: 140, right: 60, bottom: 180, left: 60 };

/** hide POI/transit clutter on the Google provider (Android); iOS uses
 *  showsPointsOfInterest={false} */
const DECLUTTER_STYLE = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

/**
 * Read-only view of an archived session: every member's full trace in their
 * color on a deliberately quiet map — shops, POIs and transit labels are
 * stripped so the traces ARE the content. Nothing here mutates anything.
 */
export default function ArchiveView() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<ArchivedSession | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (id) getArchive(id).then(setSession);
  }, [id]);

  const trailSegments = useMemo(
    () =>
      (session?.members ?? []).map((m) => ({
        member: m,
        segments: buildSegments(m.trail),
      })),
    [session]
  );

  const fit = () => {
    if (!session) return;
    const pts = [...session.members.flatMap((m) => m.trail), session.destination.pos];
    if (pts.length) mapRef.current?.fitToCoordinates(pts, { edgePadding: FIT_PADDING, animated: false });
  };

  if (!session) {
    return (
      <View style={styles.screen}>
        <SafeAreaView>
          <Text style={styles.missing}>This archive isn’t on this device.</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.missingBack}>‹ Back</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const groupSteps = session.members.reduce((s, m) => s + m.steps, 0);
  const you = session.members.find((m) => m.id === 'you');
  const first = session.members.find((m) => m.id === session.arrivalOrder[0]);
  const ended = new Date(session.endedAt);

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        onMapReady={fit}
        pitchEnabled={false}
        showsCompass={false}
        showsBuildings={false}
        showsPointsOfInterest={false}
        customMapStyle={DECLUTTER_STYLE}
        toolbarEnabled={false}
      >
        {trailSegments.map(({ member, segments }) =>
          segments.map((pts, i) => (
            <Polyline
              key={`${member.id}-seg-${i}`}
              coordinates={pts}
              strokeColor={`${member.color}${alphaHex(TRAIL_ALPHAS[i] ?? 0.85)}`}
              strokeWidth={member.mode === 'foot' ? 5 : 3.5}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={member.mode === 'foot' ? [0.1, 11] : [8, 6]}
              zIndex={4}
            />
          ))
        )}

        {session.members.map((m) => {
          const end = m.trail[m.trail.length - 1];
          if (!end) return null;
          return (
            <Marker key={`end-${m.id}`} coordinate={end} anchor={{ x: 0.5, y: 0.5 }} tappable={false} zIndex={10}>
              <View style={styles.endWrap}>
                {DEMO_AVATARS[m.avatarKey] ? (
                  <Image source={DEMO_AVATARS[m.avatarKey]} fadeDuration={0} style={[styles.endAvatar, { borderColor: m.color }]} />
                ) : (
                  <View style={[styles.endAvatar, styles.endFallback, { borderColor: m.color }]}>
                    <Text style={styles.endInitial}>{m.name[0]}</Text>
                  </View>
                )}
                <View style={styles.endTag}>
                  <Text style={styles.endName}>{m.name}</Text>
                </View>
              </View>
            </Marker>
          );
        })}

        <DestinationMarker name={session.destination.name} pos={session.destination.pos} />
      </MapView>

      <SafeAreaView style={styles.header} pointerEvents="box-none">
        <Glass style={styles.headerBar} radius={18} intensity={44}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={UI.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{session.name}</Text>
            <Text style={styles.sub}>
              Archived · read-only ·{' '}
              {ended.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="archive-outline" size={13} color={UI.brand} />
          </View>
        </Glass>
      </SafeAreaView>

      <View style={styles.statsWrap} pointerEvents="box-none">
        <Glass style={styles.stats} radius={20} intensity={44}>
          <Stat label="people" value={String(session.members.length)} />
          {groupSteps > 0 && <Stat label="group steps" value={groupSteps.toLocaleString()} />}
          {you && <Stat label="you covered" value={formatDistance(you.traveledM)} />}
          {first && <Stat label="first in" value={first.name} />}
          <Stat label="duration" value={`${Math.max(1, Math.round(session.durationSec / 60))} min`} />
          <RecapShare
            sessionName={session.name}
            destinationName={session.destination.name}
            endedAt={session.endedAt}
            durationSec={session.durationSec}
            members={session.members.map((m) => ({
              id: m.id,
              name: m.name,
              color: m.color,
              avatar: DEMO_AVATARS[m.avatarKey],
              steps: m.steps,
            }))}
            stats={recapStats(session.members, session.arrivalOrder)}
          />
        </Glass>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: { color: UI.text, fontSize: 16, fontWeight: '800' },
  sub: { color: UI.brand, fontSize: 12, marginTop: 1, fontWeight: '600' },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${UI.brand}1F`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endWrap: { alignItems: 'center' },
  endAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, backgroundColor: '#14161C' },
  endFallback: { alignItems: 'center', justifyContent: 'center' },
  endInitial: { color: UI.text, fontSize: 13, fontWeight: '800' },
  endTag: {
    marginTop: 3,
    backgroundColor: UI.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  endName: { color: UI.text, fontSize: 10, fontWeight: '700' },
  statsWrap: { position: 'absolute', left: 10, right: 10, bottom: 14 },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stat: { minWidth: 64 },
  statValue: { color: UI.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: UI.textDim, fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  missing: { color: UI.text, fontSize: 16, fontWeight: '700', padding: 24 },
  missingBack: { color: UI.brand, fontSize: 15, fontWeight: '600', paddingHorizontal: 24 },
});
