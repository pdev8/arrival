import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, StyleSheet, View } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { ActivityDock, DOCK_PEEK } from '../src/components/ActivityDock';
import { ClusterMarker } from '../src/components/ClusterMarker';
import { DestinationMarker } from '../src/components/DestinationMarker';
import { InviteSheet } from '../src/components/InviteSheet';
import { MapFabs } from '../src/components/MapFabs';
import { MemberPager } from '../src/components/MemberPager';
import { MemberMarker } from '../src/components/MemberMarker';
import { MemberRail } from '../src/components/MemberRail';
import { PlaceSheet } from '../src/components/PlaceSheet';
import { SessionHeader } from '../src/components/SessionHeader';
import { StopPin } from '../src/components/StopPin';
import { TrailPath } from '../src/components/TrailPath';
import { useClusters } from '../src/hooks/useClusters';
import { clusterVisibility } from '../src/lib/clusters';
import { SCENARIOS } from '../src/demo/data';
import { SimMember, useSimulation } from '../src/demo/simulation';
import { useLiveTrip } from '../src/live/useLiveTrip';
import { leaveLiveTrip } from '../src/lib/live-session';
import { supabaseConfigured } from '../src/lib/supabase';
import { saveArchive } from '../src/lib/archive';
import { surfaceError } from '../src/lib/errors';
import { UI } from '../src/lib/colors';
import { summarizeConvergence } from '../src/lib/convergence';
import { LatLng } from '../src/lib/geo';
import { navigateTo } from '../src/lib/nav-deeplinks';
import { sortMembers } from '../src/lib/roster';

const FIT_PADDING = { top: 130, right: 60, bottom: 320, left: 60 };
const TRAIL_PADDING = { top: 150, right: 70, bottom: 340, left: 70 };
/** follow-mode zoom per scenario kind (Google provider reads zoom…) */
const FOLLOW_ZOOM: Record<string, number> = { walk: 16.5, roadtrip: 11, mall: 18 };
/** …but Apple Maps ignores camera.zoom and wants altitude (meters) */
const FOLLOW_ALTITUDE: Record<string, number> = { walk: 1400, roadtrip: 90000, mall: 500 };

export default function SessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; kind?: string; durationMin?: string; code?: string; live?: string; tripId?: string }>();
  const sessionName = params.name ?? 'Session';
  const joinCode = params.code ?? 'kfx-mqvp-dhz';
  const durationMin = Number(params.durationMin ?? 240);
  const scenario =
    SCENARIOS[params.kind === 'roadtrip' ? 'roadtrip' : params.kind === 'mall' ? 'mall' : 'walk'];

  // live when created/joined against the backend; demo simulation otherwise
  const isLive = params.live === '1' && supabaseConfigured && !!params.tripId;
  const demoSim = useSimulation(!isLive, scenario);
  const liveSim = useLiveTrip(isLive, params.tripId, scenario.destination, 'Paul');
  const sim = isLive && liveSim ? liveSim : demoSim;
  const mapRef = useRef<MapView>(null);
  const [autoFit, setAutoFit] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** camera-follow the selected member; off while retracing/panning so the
      card can stay open without the camera snapping back every tick */
  const [follow, setFollow] = useState(false);
  const [showTrails, setShowTrails] = useState(false);
  const [placePick, setPlacePick] = useState<LatLng | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [mapHeading, setMapHeading] = useState(0);
  const [region, setRegion] = useState<Region>(scenario.initialRegion as Region);
  const fitCounter = useRef(0);
  const endsAt = useRef(Date.now() + durationMin * 60_000);

  // Archive on completion: the session freezes to the profile with every
  // trace intact, viewable read-only from Home (F15).
  const archivedRef = useRef(false);
  useEffect(() => {
    if (!sim.allArrived || archivedRef.current) return;
    archivedRef.current = true;
    saveArchive({
      id: `session-${joinCode}`,
      name: sessionName,
      kind: params.kind ?? 'walk',
      endedAt: Date.now(),
      durationSec: Math.round(sim.elapsedSec),
      destination: scenario.destination,
      members: sim.members.map((m) => ({
        id: m.id,
        name: m.name,
        color: m.color,
        avatarKey: m.id,
        mode: m.mode,
        steps: m.steps,
        traveledM: Math.round(m.traveledM),
        trail: m.trail,
      })),
      arrivalOrder: sim.arrivalOrder,
    }).catch((e) => surfaceError('Saving session to archive', e));
  }, [sim.allArrived]);

  // Camera: follow the selected member, otherwise auto-fit the whole crew.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const selected = sim.members.find((m) => m.id === selectedId);
    if (selected && follow) {
      map.setCamera({
        center: selected.pos,
        zoom: FOLLOW_ZOOM[scenario.key] ?? 16,
        altitude: FOLLOW_ALTITUDE[scenario.key] ?? 1400,
      });
    } else if (!selectedId && autoFit) {
      if (fitCounter.current++ % 4 === 0) {
        map.fitToCoordinates(
          [...sim.members.map((m) => m.pos), scenario.destination.pos],
          { edgePadding: FIT_PADDING, animated: true }
        );
      }
    }
  }, [sim.members, selectedId, autoFit, follow]);

  // Track map rotation (arrow compensation) and region (cluster threshold).
  const onRegionSettled = (r: Region) => {
    setRegion(r);
    mapRef.current
      ?.getCamera()
      .then((c) => setMapHeading(c.heading ?? 0))
      .catch(() => {});
  };

  // grouping input stays STABLE across selection (regrouping per tap churned
  // marker props → #5911 drops); the selected member is carved out of the
  // facepiles at render time instead
  const clusters = useClusters(sim.members, region);
  // LIVE sessions skip clustering entirely: with 2-5 real people, facepiles
  // aren't worth the marker lifecycle churn — every mount/visibility change
  // is a chance for Apple Maps + New Arch to lose the view (#5911). Live
  // pucks mount once at roster load and never unmount or hide.
  const { hiddenIds, piles } = useMemo(
    () => (isLive ? { hiddenIds: new Set<string>(), piles: [] } : clusterVisibility(clusters, selectedId)),
    [clusters, selectedId, isLive]
  );

  // watchdog: bump every 5s so each marker's memo yields a re-render — a
  // guaranteed prop nudge that repaints any view the native side lost
  const repaintTick = Math.floor(Date.now() / 5000);

  const remaining = Math.max(0, endsAt.current - Date.now());
  const remH = Math.floor(remaining / 3_600_000);
  const remM = Math.floor((remaining % 3_600_000) / 60_000);
  const you = sim.members.find((m) => m.isYou);
  const selected = sim.members.find((m) => m.id === selectedId);

  const headerSub =
    (sim.members.filter((m) => !m.left).length === 0
      ? 'Waiting for members…'
      : summarizeConvergence(sim.members.filter((m) => !m.left))) +
    (you && you.mode === 'foot' && you.steps > 0 ? ` · ${you.steps.toLocaleString()} steps` : '') +
    ` · ends ${remH > 0 ? `${remH}h ` : ''}${remM}m`;

  // rail <-> pager swap is a cross-fade, not a pop (both are the same
  // fixed height, so only opacity animates)
  const animateSurface = () =>
    LayoutAnimation.configureNext({
      duration: 200,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });

  // stable identity so memoized chips/markers aren't re-rendered by the handler
  const select = useCallback((id: string) => {
    animateSurface();
    setSelectedId((cur) => (cur === id ? null : id));
    setFollow(true);
    setAutoFit(false);
  }, []);

  // pager landings focus without toggling (the page IS the selection)
  const focusMember = useCallback((id: string) => {
    setSelectedId(id);
    setFollow(true);
    setAutoFit(false);
  }, []);

  // surface order: you, then fastest ETA first, departed last
  const orderedMembers = useMemo(() => sortMembers(sim.members, 'you'), [sim.members]);

  // the deck order is FROZEN while the pager is open: live ETAs cross
  // constantly, and pages reordering under an active swipe is disorienting
  const pagerOpen = selectedId !== null;
  const deckIds = useMemo(
    () => (pagerOpen ? sortMembers(sim.members, 'you').map((m) => m.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pagerOpen]
  );
  const deck = useMemo(
    () => deckIds.map((id) => sim.members.find((m) => m.id === id)).filter((m): m is SimMember => !!m),
    [deckIds, sim.members]
  );

  // while a bottom sheet is up, the session's own bottom panels (rail/card,
  // dock, fabs) would show through the dimmed backdrop as ghost panels
  // stacked above the sheet — hide them so the sheet rises over map only
  const sheetOpen = inviteOpen || placePick !== null;

  const retrace = (m: SimMember) => {
    if (m.trail.length > 1) {
      setFollow(false);
      setAutoFit(false);
      mapRef.current?.fitToCoordinates(m.trail, { edgePadding: TRAIL_PADDING, animated: true });
    }
  };

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={scenario.initialRegion}
        pitchEnabled={false}
        rotateEnabled
        showsCompass
        showsBuildings={false}
        toolbarEnabled={false}
        onRegionChangeComplete={onRegionSettled}
        onPanDrag={() => {
          setAutoFit(false);
          setFollow(false); // keep the card open — just stop steering the camera
        }}
        onLongPress={(e) => setPlacePick(e.nativeEvent.coordinate)}
      >
        {/* trails: dotted native polylines (overlays), never markers — trail
            markers destabilized the profile pucks (see TrailPath) */}
        {sim.members
          .filter((m) => (showTrails || m.id === selectedId) && m.trail.length > 1)
          .map((m) => (
            <TrailPath key={`trail-${m.id}`} member={m} />
          ))}

        <DestinationMarker
          name={scenario.destination.name}
          pos={scenario.destination.pos}
          onPress={() =>
            navigateTo(
              scenario.destination.pos,
              scenario.destination.name,
              scenario.key === 'roadtrip' ? 'drive' : 'walk'
            )
          }
        />

        {sim.stops.map((s) => (
          <StopPin
            key={s.id}
            stop={s}
            memberColor={sim.members.find((m) => m.id === s.createdBy)?.color ?? UI.accent}
            onPress={() => {}}
          />
        ))}

        {/* clustered members are NOT mounted (conditional render, no opacity
            flips — the #5911 drop trigger removed in PR #31). Keys are STABLE
            across selection: the old '-sel' remount "self-heal" caused a
            3-5s blank window on every deselect, because a freshly inserted
            marker on New Arch often doesn't paint until its next prop update
            (which arrives with the next 3s position packet). */}
        {sim.members
          .filter((m) => !hiddenIds.has(m.id))
          .map((m) => (
            <MemberMarker
              key={m.id}
              member={m}
              mapHeading={mapHeading}
              selected={m.id === selectedId}
              repaintTick={repaintTick}
              onPress={() => select(m.id)}
            />
          ))}
        {piles.map((c) => (
            <ClusterMarker
              key={c.members.map((m) => m.id).join('-')}
              members={c.members}
              center={c.center}
              onPress={() => {
                setAutoFit(false);
                setSelectedId(null);
                mapRef.current?.animateToRegion(
                  {
                    ...c.center,
                    latitudeDelta: region.latitudeDelta / 3,
                    longitudeDelta: region.longitudeDelta / 3,
                  },
                  250
                );
              }}
            />
        ))}
      </MapView>

      <SessionHeader
        title={sessionName}
        sub={headerSub}
        highlightSub={sim.allArrived}
        onBack={() => {
          if (isLive && params.tripId) leaveLiveTrip(params.tripId).catch(() => {});
          router.replace('/');
        }}
        onInvite={() => setInviteOpen(true)}
      />

      {!sheetOpen && (
      <MapFabs
        bottom={DOCK_PEEK + 130}
        showTrails={showTrails}
        onToggleTrails={() => setShowTrails((v) => !v)}
        showRecenter={!autoFit || !!selectedId}
        onRecenter={() => {
          setSelectedId(null);
          setAutoFit(true);
          fitCounter.current = 0;
        }}
      />
      )}

      {/* member surface: rail of everyone, or the focused member's card */}
      {!sheetOpen && (
      <View style={styles.memberArea} pointerEvents="box-none">
        {selected ? (
          <MemberPager
            members={deck}
            selectedId={selectedId}
            you={you}
            onFocus={focusMember}
            onRetrace={retrace}
            onClose={() => {
              animateSurface();
              setSelectedId(null);
            }}
          />
        ) : (
          <MemberRail members={orderedMembers} selectedId={selectedId} onSelect={select} />
        )}
      </View>
      )}

      {!sheetOpen && (
        <ActivityDock sim={sim} sessionName={sessionName} destinationName={scenario.destination.name} />
      )}

      <InviteSheet
        visible={inviteOpen}
        sessionName={sessionName}
        joinCode={joinCode}
        onClose={() => setInviteOpen(false)}
      />

      <PlaceSheet
        pos={placePick}
        onClose={() => setPlacePick(null)}
        onAnnounce={(cat, note) => {
          sim.announceStop(placePick!, cat, note);
          setPlacePick(null);
        }}
        onSuggest={(cat, note) => {
          sim.suggestStop(placePick!, cat, note);
          setPlacePick(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },
  memberArea: { position: 'absolute', left: 0, right: 0, bottom: DOCK_PEEK + 20 },
});
