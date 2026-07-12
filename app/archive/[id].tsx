import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { BoundingBox, Marker, Polyline, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DestinationMarker } from '../../src/components/DestinationMarker';
import { Glass } from '../../src/components/Glass';
import { RecapShare } from '../../src/components/RecapShareCard';
import { DEMO_AVATARS } from '../../src/demo/data';
import { ArchivedMember, ArchivedSession, getArchive } from '../../src/lib/archive';
import { ProximityGroup, groupByProximity } from '../../src/lib/clusters';
import { UI } from '../../src/lib/colors';
import { formatDistance, formatEtaClock } from '../../src/lib/format';
import { constrainMapRegion, cumulativeDistances, isZoomedInside } from '../../src/lib/geo';
import { recapStats } from '../../src/lib/recap';
import { buildReplayChunks, isChunkWalked, replayFrameAt } from '../../src/lib/replay';
import { rosterPile } from '../../src/lib/roster';
import { TRAIL_ALPHAS, alphaHex, buildSegments } from '../../src/lib/trail';

const FIT_PADDING = { top: 140, right: 60, bottom: 250, left: 60 };
const RETRACE_PADDING = { top: 128, right: 46, bottom: 210, left: 46 };
const END_GROUP_RADIUS_M = 80;
const END_PILE_MAX = 5;
const BOUNDARY_RETURN_MS = 320;
/** Wait for the initial `animated: false` fit to settle before snapshotting the
 *  overview bounds — `onRegionChangeComplete` is not reliably fired for a
 *  non-animated fit on Apple Maps, so we can't depend on it to lock. */
const OVERVIEW_LOCK_DELAY_MS = 360;

/** Wall-clock length of a full retrace at 1×, regardless of how long the real
 *  trip took — a 40-minute walk still replays in a watchable few seconds. */
const REPLAY_BASE_MS = 9000;
const SPEEDS = [1, 2, 4] as const;
/**
 * The retrace steps on a fixed interval, advancing a FIXED fraction per tick.
 *
 * It deliberately does not measure elapsed time. Driving this off
 * requestAnimationFrame + a Date.now() delta meant any stall in the loop got
 * converted into a *skip*: the loop would go quiet, then fire once with a
 * multi-second delta, and the elapsed-time math would take progress straight to
 * 1 — the retrace hung and then painted the whole path in a single frame. With a
 * fixed increment a stall can only ever slow the replay down, never skip it.
 *
 * 20 Hz: fast enough to read as motion, slow enough that each tick is one cheap
 * React render rather than a 60 Hz reconcile of the entire map.
 */
const REPLAY_TICK_MS = 50;
/** How many static pieces the retraced trail is cut into. Each is one dot or two
 *  at typical retrace zoom, so they light up roughly dot by dot. */
const REPLAY_CHUNKS = 120;

/** hide POI/transit clutter on the Google provider (Android); iOS uses
 *  showsPointsOfInterest={false} */
const DECLUTTER_STYLE = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

type TrailSegments = { member: ArchivedMember; segments: LatLngList[] };
type LatLngList = { latitude: number; longitude: number }[];

/**
 * Read-only view of an archived session: every member's full trace in their
 * color on a deliberately quiet map — shops, POIs and transit labels are
 * stripped so the traces ARE the content. Nothing here mutates anything.
 *
 * The panel lists one row per member; tapping a row *retraces* them — their
 * route redraws from start to finish while everyone else falls back, with
 * play/pause, scrub and speed. The camera frames their trail once on start and
 * then holds still: chasing the head every tick would churn the map at 60 Hz
 * and fight the viewport lock below.
 *
 * Viewport: the first fit IS the default view and the boundary. You cannot zoom
 * out past it, and panning is *disabled* at that frame rather than rubber-banded
 * — it only unlocks once you have zoomed in, and then only up to the edges.
 */
export default function ArchiveView() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<ArchivedSession | null>(null);
  const [overviewLimits, setOverviewLimits] = useState<{
    minZoomLevel?: number;
    maxCenterCoordinateDistance?: number;
  }>({});
  /** Pinned to the default frame until the user zooms in. */
  const [panEnabled, setPanEnabled] = useState(false);

  const [replayId, setReplayId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  /** 0..1 through the focused member's trail. `progressRef` mirrors it so the
   *  interval can advance without re-subscribing on every tick. */
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  const mapRef = useRef<MapView>(null);
  const fitRequestedRef = useRef(false);
  const viewportLockedRef = useRef(false);
  const overviewBoundsRef = useRef<BoundingBox | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fitRequestedRef.current = false;
    viewportLockedRef.current = false;
    overviewBoundsRef.current = null;
    setOverviewLimits({});
    setPanEnabled(false);
    setReplayId(null);
    setPlaying(false);
    setProgress(0);
    progressRef.current = 0;
    if (id) getArchive(id).then(setSession);
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    };
  }, [id]);

  const trailSegments: TrailSegments[] = useMemo(
    () =>
      (session?.members ?? []).map((m) => ({
        member: m,
        segments: buildSegments(m.trail),
      })),
    [session]
  );

  /** Cumulative distances per member, so each replay frame is a lookup, not a
   *  re-measure of the whole trail. */
  const cumByMember = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const member of session?.members ?? []) {
      map.set(member.id, cumulativeDistances(member.trail));
    }
    return map;
  }, [session]);

  const endGroups = useMemo(
    () =>
      groupByProximity(
        (session?.members ?? []).flatMap((member) => {
          const pos = member.trail[member.trail.length - 1];
          return pos ? [{ member, pos }] : [];
        }),
        END_GROUP_RADIUS_M
      ),
    [session]
  );

  const replaying = session?.members.find((member) => member.id === replayId) ?? null;
  const replayCum = replaying ? (cumByMember.get(replaying.id) ?? []) : [];
  const totalM = replayCum.length ? replayCum[replayCum.length - 1] : 0;

  const frame = replaying ? replayFrameAt(replaying.trail, replayCum, progress) : null;

  /**
   * The focused member's trail, cut into static pieces ONCE. Their geometry never
   * changes during the retrace — only each piece's stroke color flips as the head
   * passes it. That is what lets the dots actually render: a growing polyline
   * hands MapKit new geometry every tick and it never settles long enough to
   * stroke the dash pattern.
   */
  const chunks = useMemo(() => {
    if (!replaying) return [];
    return buildReplayChunks(
      replaying.trail,
      cumByMember.get(replaying.id) ?? [],
      REPLAY_CHUNKS
    );
  }, [replaying, cumByMember]);

  const seek = (next: number) => {
    progressRef.current = next;
    setProgress(next);
  };

  useEffect(() => {
    if (!playing || !replaying) return;

    // A FIXED fraction per tick — never a measured elapsed time. See REPLAY_TICK_MS.
    const increment = REPLAY_TICK_MS / (REPLAY_BASE_MS / speed);

    const timer = setInterval(() => {
      const next = progressRef.current + increment;
      if (next >= 1) {
        progressRef.current = 1;
        setProgress(1);
        setPlaying(false);
        return;
      }
      progressRef.current = next;
      setProgress(next);
    }, REPLAY_TICK_MS);

    return () => clearInterval(timer);
  }, [playing, speed, replaying]);

  const fit = () => {
    if (!session) return;
    const pts = [...session.members.flatMap((m) => m.trail), session.destination.pos];
    if (!pts.length) return;

    fitRequestedRef.current = true;
    mapRef.current?.fitToCoordinates(pts, { edgePadding: FIT_PADDING, animated: false });
    // fit() always lands on the default frame, where panning is pinned. Assert that
    // here rather than waiting for a settle event that a non-animated fit may never
    // emit — otherwise closing a retrace after a zoom leaves the map pannable at rest.
    setPanEnabled(false);

    // This fitted frame IS the default view and the boundary. Snapshot it once,
    // driven off the fit itself rather than off a region-settle event that may
    // never arrive — otherwise the first user pan would become the "default".
    if (viewportLockedRef.current || lockTimerRef.current) return;
    lockTimerRef.current = setTimeout(() => {
      lockTimerRef.current = null;
      void lockOverview();
    }, OVERVIEW_LOCK_DELAY_MS);
  };

  const lockOverview = async () => {
    const map = mapRef.current;
    if (!map || !fitRequestedRef.current) return;
    if (viewportLockedRef.current) return;

    viewportLockedRef.current = true;
    try {
      const [bounds, camera] = await Promise.all([map.getMapBoundaries(), map.getCamera()]);
      overviewBoundsRef.current = bounds;
      if (Platform.OS === 'android') map.setMapBoundaries(bounds.northEast, bounds.southWest);
      setOverviewLimits({
        minZoomLevel: camera.zoom,
        maxCenterCoordinateDistance: camera.altitude,
      });
    } catch {
      viewportLockedRef.current = false;
    }
  };

  const handleRegionSettled = async (region: Region) => {
    if (!viewportLockedRef.current) {
      await lockOverview();
      return;
    }

    const bounds = overviewBoundsRef.current;
    const map = mapRef.current;
    if (!map || !bounds) return;

    // Pan is a zoomed-in affordance only — at the default frame the map is pinned.
    setPanEnabled(isZoomedInside(region, bounds));

    // Apple Maps has no native boundary (setMapBoundaries is Android-only), so
    // the settled frame is clamped back inside the edges by hand.
    if (Platform.OS !== 'ios') return;
    const constrained = constrainMapRegion(region, bounds);
    const crossedBoundary =
      Math.abs(constrained.latitude - region.latitude) > 0.0000001 ||
      Math.abs(constrained.longitude - region.longitude) > 0.0000001;
    if (crossedBoundary) map.animateToRegion(constrained, BOUNDARY_RETURN_MS);
  };

  const startReplay = (member: ArchivedMember) => {
    setReplayId(member.id);
    setSpeed(1);
    seek(0);
    setPlaying(true);

    if (!session) return;
    // A member who never moved has a 1-point trail and nothing to fit — frame them
    // against the destination instead of leaving the camera wherever it was.
    const pts =
      member.trail.length >= 2 ? member.trail : [...member.trail, session.destination.pos];
    if (pts.length < 2) return;
    requestAnimationFrame(() =>
      mapRef.current?.fitToCoordinates(pts, { edgePadding: RETRACE_PADDING, animated: true })
    );
  };

  const closeReplay = () => {
    setReplayId(null);
    setPlaying(false);
    seek(0);
    fit();
  };

  const togglePlay = () => {
    // Hitting play on a finished retrace restarts it rather than sitting at the end.
    if (!playing && progressRef.current >= 1) seek(0);
    setPlaying((was) => !was);
  };

  const scrubTo = (next: number) => {
    setPlaying(false);
    seek(next);
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
  const ended = new Date(session.endedAt);

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        onMapReady={fit}
        onRegionChangeComplete={(region) => void handleRegionSettled(region)}
        scrollEnabled={panEnabled}
        zoomEnabled
        minZoomLevel={overviewLimits.minZoomLevel}
        cameraZoomRange={
          overviewLimits.maxCenterCoordinateDistance
            ? { maxCenterCoordinateDistance: overviewLimits.maxCenterCoordinateDistance }
            : undefined
        }
        zoomTapEnabled={false}
        zoomControlEnabled={false}
        scrollDuringRotateOrZoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        moveOnMarkerPress={false}
        showsCompass={false}
        showsBuildings={false}
        showsPointsOfInterest={false}
        customMapStyle={DECLUTTER_STYLE}
        toolbarEnabled={false}
      >
        <StaticTrails trailSegments={trailSegments} replayId={replayId} />

        {/* The retrace. Static geometry, laid down once: the whole route is on
            screen as ghosted dots from the start, and each piece flips to full
            color as the head passes over it. Nothing here ever changes shape. */}
        {replaying &&
          chunks.map((chunk, i) => (
            <Polyline
              key={`replay-${replaying.id}-${i}`}
              coordinates={chunk.pts}
              strokeColor={
                isChunkWalked(chunk, frame?.traveledM ?? 0)
                  ? replaying.color
                  : `${replaying.color}2E`
              }
              strokeWidth={replaying.mode === 'foot' ? 6 : 5}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={replaying.mode === 'foot' ? [0.1, 11] : [8, 6]}
              zIndex={6}
            />
          ))}

        {/* The head of the retrace. Interpolated mid-segment, so it glides between
            waypoints instead of hopping from one to the next. */}
        {replaying && frame?.head && (
          <Marker coordinate={frame.head} anchor={{ x: 0.5, y: 0.5 }} tappable={false} zIndex={12}>
            <View style={[styles.replayHead, { backgroundColor: replaying.color }]} />
          </Marker>
        )}

        <EndPiles groups={endGroups} replayId={replayId} />

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

      <View style={styles.panelWrap} pointerEvents="box-none">
        <Glass style={styles.panel} radius={20} intensity={44}>
          {replaying ? (
            <ReplayControls
              member={replaying}
              progress={progress}
              traveledM={frame?.traveledM ?? 0}
              totalM={totalM}
              playing={playing}
              speed={speed}
              durationSec={session.durationSec}
              onTogglePlay={togglePlay}
              onScrub={scrubTo}
              onCycleSpeed={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
              onClose={closeReplay}
            />
          ) : (
            <>
              <ArchiveRoster members={session.members} onRetrace={startReplay} />
              <View style={styles.divider} />
              <View style={styles.statsRow}>
                <Stat label="people" value={String(session.members.length)} />
                <Stat label="group steps" value={groupSteps.toLocaleString()} />
                <Stat
                  label="duration"
                  value={`${Math.max(1, Math.round(session.durationSec / 60))} min`}
                />
              </View>
              {/* Its own row: the button carries alignSelf/marginTop of its own, which
                  is what made it wrap and leave a hole when it sat among the stats. */}
              <View style={styles.shareRow}>
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
              </View>
            </>
          )}
        </Glass>
      </View>
    </View>
  );
}

/**
 * Everyone's traces. Memoized so the retrace's per-frame progress never
 * reconciles them — they only change when the focused member changes.
 */
const StaticTrails = React.memo(function StaticTrails({
  trailSegments,
  replayId,
}: {
  trailSegments: TrailSegments[];
  replayId: string | null;
}) {
  return (
    <>
      {trailSegments.map(({ member, segments }) => {
        // The member being retraced is drawn entirely by the chunk overlay — ghost
        // and all — so skip them here rather than double-stroking their trail.
        if (member.id === replayId) return null;
        const isMuted = !!replayId;
        return segments.map((pts, i) => (
          <Polyline
            key={`${member.id}-seg-${i}`}
            coordinates={pts}
            strokeColor={
              isMuted
                ? `${member.color}14`
                : `${member.color}${alphaHex(TRAIL_ALPHAS[i] ?? 0.85)}`
            }
            strokeWidth={member.mode === 'foot' ? 5 : 3.5}
            lineCap="round"
            lineJoin="round"
            lineDashPattern={member.mode === 'foot' ? [0.1, 11] : [8, 6]}
            zIndex={4}
          />
        ));
      })}
    </>
  );
});

/** Where everyone finished. Memoized for the same reason as StaticTrails. */
const EndPiles = React.memo(function EndPiles({
  groups,
  replayId,
}: {
  groups: ProximityGroup<{ member: ArchivedMember; pos: { latitude: number; longitude: number } }>[];
  replayId: string | null;
}) {
  return (
    <>
      {groups.map((group) => (
        <Marker
          key={`end-${group.members.map(({ member }) => member.id).join('-')}`}
          coordinate={group.center}
          anchor={{ x: 0.5, y: 1.05 }}
          tappable={false}
          zIndex={10}
        >
          <ArchiveEndPile
            members={group.members.map(({ member }) => member)}
            replayId={replayId}
          />
        </Marker>
      ))}
    </>
  );
});

/** One row per member: tap anyone to retrace them. */
function ArchiveRoster({
  members,
  onRetrace,
}: {
  members: ArchivedMember[];
  onRetrace: (member: ArchivedMember) => void;
}) {
  return (
    <View>
      <Text style={styles.rosterHeading}>Retrace someone</Text>
      <ScrollView
        style={styles.rosterList}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.rosterListContent}
      >
        {members.map((member) => (
          <Pressable key={member.id} style={styles.row} onPress={() => onRetrace(member)}>
            <Avatar member={member} size={30} />
            <View style={styles.rowCopy}>
              <Text style={styles.rowName} numberOfLines={1}>{member.name}</Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {member.steps.toLocaleString()} steps · {formatDistance(member.traveledM)}
              </Text>
            </View>
            <View style={[styles.rowPlay, { backgroundColor: `${member.color}2E` }]}>
              <MaterialCommunityIcons name="map-marker-path" size={15} color={member.color} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ReplayControls({
  member,
  progress,
  traveledM,
  totalM,
  playing,
  speed,
  durationSec,
  onTogglePlay,
  onScrub,
  onCycleSpeed,
  onClose,
}: {
  member: ArchivedMember;
  progress: number;
  traveledM: number;
  totalM: number;
  playing: boolean;
  speed: number;
  durationSec: number;
  onTogglePlay: () => void;
  onScrub: (next: number) => void;
  onCycleSpeed: () => void;
  onClose: () => void;
}) {
  const trackWidth = useRef(0);
  const onScrubRef = useRef(onScrub);
  onScrubRef.current = onScrub;

  // Created once: rebuilding the responder every render drops the gesture
  // mid-drag, so it reads the live callback through a ref instead.
  const pan = useMemo(() => {
    const seek = (x: number) => {
      if (!trackWidth.current) return;
      onScrubRef.current(Math.max(0, Math.min(1, x / trackWidth.current)));
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => seek(e.nativeEvent.locationX),
      onPanResponderMove: (e) => seek(e.nativeEvent.locationX),
    });
  }, []);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.replayHeader}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.replayBack}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={UI.text} />
        </Pressable>
        <Avatar member={member} size={32} />
        <View style={styles.rowCopy}>
          <Text style={styles.rowName} numberOfLines={1}>{member.name}</Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {formatDistance(traveledM)} of {formatDistance(totalM)}
          </Text>
        </View>
        <Pressable onPress={onCycleSpeed} style={styles.speedChip} hitSlop={6}>
          <Text style={styles.speedText}>{speed}×</Text>
        </Pressable>
      </View>

      <View style={styles.replayRow}>
        <Pressable
          onPress={onTogglePlay}
          style={[styles.playButton, { backgroundColor: member.color }]}
          hitSlop={6}
        >
          <MaterialCommunityIcons
            name={playing ? 'pause' : progress >= 1 ? 'replay' : 'play'}
            size={18}
            color={UI.bg}
          />
        </Pressable>

        <View style={styles.trackWrap} onLayout={onTrackLayout} {...pan.panHandlers}>
          <View style={styles.track} />
          <View
            style={[
              styles.trackFill,
              { width: `${progress * 100}%`, backgroundColor: member.color },
            ]}
          />
          <View style={[styles.knob, { left: `${progress * 100}%`, borderColor: member.color }]} />
        </View>

        <Text style={styles.clock}>{formatEtaClock((durationSec * progress) / 60)}</Text>
      </View>
    </View>
  );
}

function Avatar({ member, size }: { member: ArchivedMember; size: number }) {
  const shape = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderColor: member.color,
  };
  return DEMO_AVATARS[member.avatarKey] ? (
    <Image source={DEMO_AVATARS[member.avatarKey]} fadeDuration={0} style={[styles.avatar, shape]} />
  ) : (
    <View style={[styles.avatar, styles.fallback, shape]}>
      <Text style={styles.initial}>{member.name[0]}</Text>
    </View>
  );
}

function ArchiveEndPile({
  members,
  replayId,
}: {
  members: ArchivedMember[];
  replayId: string | null;
}) {
  const active = replayId ? members.find((member) => member.id === replayId) : undefined;
  const { shown, hidden } = rosterPile(members, replayId, END_PILE_MAX);
  const label =
    active?.name ?? (members.length === 1 ? members[0].name : `${members.length} finished here`);

  return (
    <View style={[styles.endWrap, replayId && !active && styles.endWrapMuted]}>
      <View style={styles.endPile}>
        {shown.map((member, index) => (
          <View
            key={member.id}
            style={[
              { marginLeft: index === 0 ? 0 : -12, zIndex: shown.length - index },
              active?.id === member.id && styles.endAvatarActive,
            ]}
          >
            <Avatar member={member} size={34} />
          </View>
        ))}
        {hidden.length > 0 && (
          <View style={[styles.avatar, styles.fallback, styles.endMore]}>
            <Text style={styles.endMoreText}>+{hidden.length}</Text>
          </View>
        )}
      </View>
      <View style={styles.endTag}>
        <Text style={styles.endName}>{label}</Text>
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

  avatar: { borderWidth: 2, backgroundColor: '#14161C' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: UI.text, fontSize: 12, fontWeight: '800' },

  replayHead: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },

  endWrap: { alignItems: 'center' },
  endWrapMuted: { opacity: 0.28 },
  endPile: { flexDirection: 'row', alignItems: 'center' },
  endAvatarActive: { transform: [{ scale: 1.16 }] },
  endMore: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginLeft: -12,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: UI.chip,
  },
  endMoreText: { color: UI.text, fontSize: 11, fontWeight: '800' },
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

  panelWrap: { position: 'absolute', left: 10, right: 10, bottom: 14 },
  panel: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },

  rosterHeading: {
    color: UI.textDim,
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  rosterList: { maxHeight: 188 },
  rosterListContent: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
    paddingRight: 2,
  },
  rowCopy: { flex: 1, gap: 1 },
  rowName: { color: UI.text, fontSize: 13.5, fontWeight: '800' },
  rowMeta: { color: UI.textDim, fontSize: 11.5, fontWeight: '600' },
  rowPlay: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  replayHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  replayBack: {
    width: 26,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedChip: {
    height: 26,
    minWidth: 34,
    borderRadius: 9,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: { color: UI.text, fontSize: 11.5, fontWeight: '800', fontVariant: ['tabular-nums'] },

  replayRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackWrap: { flex: 1, height: 28, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)' },
  trackFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2 },
  knob: {
    position: 'absolute',
    width: 13,
    height: 13,
    marginLeft: -6.5,
    borderRadius: 7,
    borderWidth: 3,
    backgroundColor: '#fff',
  },
  clock: {
    color: UI.text,
    fontSize: 11.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 34,
    textAlign: 'right',
  },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.14)' },
  /** Three even columns — no wrapping, so nothing can drop to a second line. */
  statsRow: { flexDirection: 'row' },
  shareRow: { flexDirection: 'row', justifyContent: 'center' },
  stat: { flex: 1 },
  statValue: { color: UI.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: {
    color: UI.textDim,
    fontSize: 10.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  missing: { color: UI.text, fontSize: 16, fontWeight: '700', padding: 24 },
  missingBack: { color: UI.brand, fontSize: 15, fontWeight: '600', paddingHorizontal: 24 },
});
