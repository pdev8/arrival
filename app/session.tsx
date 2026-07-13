import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutAnimation, StyleSheet, View, useWindowDimensions } from 'react-native';
import MapView from 'react-native-maps';
import { ActivityDock, DOCK_PEEK } from '../src/components/ActivityDock';
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
import { SCENARIOS } from '../src/demo/data';
import { MAX_STOPS, SimMember, useSimulation } from '../src/demo/simulation';
import { useLiveTrip } from '../src/live/useLiveTrip';
import { leaveLiveTrip } from '../src/lib/live-session';
import { supabaseConfigured } from '../src/lib/supabase';
import { saveArchive } from '../src/lib/archive';
import { surfaceError } from '../src/lib/errors';
import { UI } from '../src/lib/colors';
import { summarizeConvergence } from '../src/lib/convergence';
import { LatLng, distanceM } from '../src/lib/geo';
import { navigateTo } from '../src/lib/nav-deeplinks';
import { sortMembers } from '../src/lib/roster';

const FIT_PADDING = { top: 130, right: 60, bottom: 320, left: 60 };
/** stop-pin slots, pre-mounted: MapView's child list must never grow (see the
 *  map contract). MAX_STOPS is the sim's own cap — one source of truth, so a
 *  stop can never exist without a slot to render into. */
const MAX_STOP_PINS = MAX_STOPS;
const TRAIL_PADDING = { top: 150, right: 70, bottom: 340, left: 70 };
/** follow-mode zoom per scenario kind (Google provider reads zoom…) */
const FOLLOW_ZOOM: Record<string, number> = { walk: 16.5, roadtrip: 11, mall: 18 };
/** …but Apple Maps ignores camera.zoom and wants altitude (meters) */
const FOLLOW_ALTITUDE: Record<string, number> = { walk: 1400, roadtrip: 90000, mall: 500 };
/** re-center the follow camera only after the member has moved this far —
 *  keeps the map off the 4 Hz tick without the puck ever leaving the frame */
const RECENTER_M = 8;

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
  const { width: screenW } = useWindowDimensions();
  // member surface slides aside while the activity dock is expanded
  const memberX = useRef(new Animated.Value(0)).current;
  const onDockOpenChange = useCallback(
    (open: boolean) => {
      Animated.spring(memberX, { toValue: open ? -screenW : 0, useNativeDriver: true, bounciness: 6 }).start();
    },
    [memberX, screenW]
  );
  const [autoFit, setAutoFit] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** camera-follow the selected member; off while retracing/panning so the
      card can stay open without the camera snapping back every tick */
  const [follow, setFollow] = useState(false);
  const [showTrails, setShowTrails] = useState(false);
  const [placePick, setPlacePick] = useState<LatLng | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [mapHeading, setMapHeading] = useState(0);
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

  /**
   * Camera: follow the selected member, otherwise auto-fit the whole crew.
   *
   * ZOOM IS APPLIED ONCE, on the transition into follow — never on the tick.
   * This effect re-runs 4x/second (sim.members is a new array every tick), and
   * passing zoom/altitude every time made Apple Maps re-apply the zoom 4x/sec.
   * Dash patterns are specified in SCREEN POINTS and re-rasterize on every zoom
   * change, so the trails were being re-scaled continuously — dots rendering at
   * the wrong size for a frame ("the dot splatter"), trails flickering and
   * lagging. It only ever showed up while tracking a member, because the
   * whole-crew view throttles its fit to 1 Hz. After the initial framing we
   * pass center ONLY, and only when they've actually moved.
   */
  const followedRef = useRef<string | null>(null);
  const lastCenterRef = useRef<LatLng | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const selected = sim.members.find((m) => m.id === selectedId);

    if (selected && follow) {
      const isNewFollow = followedRef.current !== selected.id;
      if (isNewFollow) {
        // frame them: the ONLY place zoom/altitude is set
        followedRef.current = selected.id;
        lastCenterRef.current = selected.pos;
        map.animateCamera(
          {
            center: selected.pos,
            zoom: FOLLOW_ZOOM[scenario.key] ?? 16,
            altitude: FOLLOW_ALTITUDE[scenario.key] ?? 1400,
          },
          { duration: 350 }
        );
        return;
      }
      // already framed: re-center only, and only once they've moved enough to
      // matter — a walker at 1.4 m/s trips this ~3x/second at most, and the
      // camera keeps whatever zoom the user has since pinched to.
      const last = lastCenterRef.current;
      if (!last || distanceM(last, selected.pos) >= RECENTER_M) {
        lastCenterRef.current = selected.pos;
        map.setCamera({ center: selected.pos });
      }
      return;
    }

    followedRef.current = null;
    lastCenterRef.current = null;
    if (!selectedId && autoFit && fitCounter.current++ % 4 === 0) {
      map.fitToCoordinates(
        [...sim.members.map((m) => m.pos), scenario.destination.pos],
        { edgePadding: FIT_PADDING, animated: true }
      );
    }
  }, [sim.members, selectedId, autoFit, follow]);

  // Track map rotation so the marker arrows compensate for a rotated map.
  const onRegionSettled = () => {
    mapRef.current
      ?.getCamera()
      .then((c) => setMapHeading(c.heading ?? 0))
      .catch(() => {});
  };

  // NO CLUSTERING, in either source. Facepiles meant members mounted and
  // unmounted as groups re-formed — and every marker lifecycle event is a
  // chance for Apple Maps + New Arch to lose the view for good (#5911).
  // Tracking a member was the worst case: the camera flies, the zoom
  // threshold shifts, the groups re-form, and pucks vanish mid-follow.
  // Pucks now mount once and never unmount. Facepiles can return when #5911
  // is fixed (roadmap T2 validates on an old-arch dev build, where the bug
  // doesn't exist); lib/clusters and its tests are kept for that revival and
  // still serve the archive's static layout.

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
      setShowTrails(true); // there has to be a trail to retrace
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

        {/* MEMBER MARKERS COME FIRST, and nothing may be mounted above them.
            Anything that mounts ahead of a marker shifts its index in
            MapView's child list; rn-maps re-reconciles the annotations, and
            Apple Maps + New Arch answers by dropping their custom views
            (#5911). Toggling trails used to mount up to 7 TrailPaths above
            this block — every puck vanished, permanently. Overlays draw
            beneath markers regardless of child order, so this costs nothing
            visually.

            Every member is mounted, always — no clustering, no opacity flips,
            and keys are STABLE across selection (a '-sel' remount "self-heal"
            only bought a blank marker until its next prop update). */}
        {sim.members.map((m) => (
          <MemberMarker
            key={m.id}
            member={m}
            mapHeading={mapHeading}
            selected={m.id === selectedId}
            repaintTick={repaintTick}
            onPress={() => select(m.id)}
          />
        ))}

        {/* Stop pins are a FIXED POOL, for the same reason the trails are:
            sim.stops starts EMPTY and grows at runtime (scripted stops fire
            ~20s in; long-press adds your own). Pushing one grew MapView's
            child list — which re-adds EVERY marker annotation (see the trail
            comment below) — and it did so ABOVE the member markers, shifting
            their index too. A brand-new pin's react children aren't attached
            when MapKit re-queries viewForAnnotation, so rn-maps handed back a
            default MKMarkerAnnotationView: a big red balloon. Slots now mount
            once; unused ones are transparent and untappable. */}
        {Array.from({ length: MAX_STOP_PINS }, (_, i) => {
          const s = sim.stops[i];
          return (
            <StopPin
              key={`stop-slot-${i}`}
              stop={s}
              memberColor={
                s ? (sim.members.find((m) => m.id === s.createdBy)?.color ?? UI.accent) : UI.accent
              }
              fallbackPos={scenario.destination.pos}
            />
          );
        })}

        {/* Trails render LAST and are ALWAYS MOUNTED — one TrailPath per
            member for the life of the session, hidden ones simply carrying no
            coordinates. This is not an optimization, it's the fix for the
            splatter: AIRMap inherits RN's didUpdateReactSubviews, which calls
            addSubview() on every child, and AIRMap remaps that to
            addAnnotation: for markers. So mounting or unmounting a single
            polyline re-adds EVERY member's annotation; if MapKit's
            viewForAnnotation query lands before a marker's children are
            attached, rn-maps hands back a default MKMarkerAnnotationView — the
            big coloured balloon — or the puck vanishes. Never change this
            child list at runtime. */}
        {sim.members.map((m) => (
          <TrailPath key={`trail-${m.id}`} member={m} visible={showTrails} />
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
      <Animated.View style={[styles.memberArea, { transform: [{ translateX: memberX }] }]} pointerEvents="box-none">
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
      </Animated.View>
      )}

      {!sheetOpen && (
        <ActivityDock
          sim={sim}
          sessionName={sessionName}
          destinationName={scenario.destination.name}
          onOpenChange={onDockOpenChange}
        />
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
