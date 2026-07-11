import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { ActivityDock, DOCK_PEEK } from '../src/components/ActivityDock';
import { ClusterMarker } from '../src/components/ClusterMarker';
import { DestinationMarker } from '../src/components/DestinationMarker';
import { MapFabs } from '../src/components/MapFabs';
import { MemberCard } from '../src/components/MemberCard';
import { MemberMarker } from '../src/components/MemberMarker';
import { MemberRail } from '../src/components/MemberRail';
import { PlaceSheet } from '../src/components/PlaceSheet';
import { SessionHeader } from '../src/components/SessionHeader';
import { StopPin } from '../src/components/StopPin';
import { TrailPath } from '../src/components/TrailPath';
import { useClusters } from '../src/hooks/useClusters';
import { SCENARIOS } from '../src/demo/data';
import { SimMember, useSimulation } from '../src/demo/simulation';
import { saveArchive } from '../src/lib/archive';
import { UI } from '../src/lib/colors';
import { summarizeConvergence } from '../src/lib/convergence';
import { LatLng } from '../src/lib/geo';
import { navigateTo } from '../src/lib/nav-deeplinks';

const FIT_PADDING = { top: 130, right: 60, bottom: 320, left: 60 };
const TRAIL_PADDING = { top: 150, right: 70, bottom: 340, left: 70 };
/** follow-mode zoom per scenario kind */
const FOLLOW_ZOOM: Record<string, number> = { walk: 16.5, roadtrip: 11, mall: 18 };

export default function SessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; kind?: string; durationMin?: string; code?: string }>();
  const sessionName = params.name ?? 'Session';
  const joinCode = params.code ?? 'kfx-mqvp-dhz';
  const durationMin = Number(params.durationMin ?? 240);
  const scenario =
    SCENARIOS[params.kind === 'roadtrip' ? 'roadtrip' : params.kind === 'mall' ? 'mall' : 'walk'];

  const sim = useSimulation(true, scenario);
  const mapRef = useRef<MapView>(null);
  const [autoFit, setAutoFit] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** camera-follow the selected member; off while retracing/panning so the
      card can stay open without the camera snapping back every tick */
  const [follow, setFollow] = useState(false);
  const [showTrails, setShowTrails] = useState(false);
  const [placePick, setPlacePick] = useState<LatLng | null>(null);
  const [mapHeading, setMapHeading] = useState(0);
  const [region, setRegion] = useState<Region>(scenario.initialRegion as Region);
  const fitCounter = useRef(0);
  const endsAt = useRef(Date.now() + durationMin * 60_000);

  const inviteMessage = `Join my Arrival session “${sessionName}”: https://arrival.app/j/${joinCode}`;

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
    }).catch(() => {});
  }, [sim.allArrived]);

  // Camera: follow the selected member, otherwise auto-fit the whole crew.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const selected = sim.members.find((m) => m.id === selectedId);
    if (selected && follow) {
      map.setCamera({ center: selected.pos, zoom: FOLLOW_ZOOM[scenario.key] ?? 16 });
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

  const clusters = useClusters(sim.members, region);
  const clusteredIds = useMemo(
    () =>
      new Set(
        clusters.filter((c) => c.members.length > 1).flatMap((c) => c.members.map((m) => m.id))
      ),
    [clusters]
  );

  const remaining = Math.max(0, endsAt.current - Date.now());
  const remH = Math.floor(remaining / 3_600_000);
  const remM = Math.floor((remaining % 3_600_000) / 60_000);
  const you = sim.members.find((m) => m.isYou);
  const selected = sim.members.find((m) => m.id === selectedId);

  const headerSub =
    summarizeConvergence(sim.members) +
    (you && you.mode === 'foot' && you.steps > 0 ? ` · ${you.steps.toLocaleString()} steps` : '') +
    ` · ends ${remH > 0 ? `${remH}h ` : ''}${remM}m`;

  // stable identity so memoized chips/markers aren't re-rendered by the handler
  const select = useCallback((id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
    setFollow(true);
    setAutoFit(false);
  }, []);

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

        {/* every member marker stays mounted for the whole session — markers
            riding in a cluster go transparent instead of unmounting, so their
            photos never remount (remounts were the avatar flash on zoom) */}
        {sim.members.map((m) => (
          <MemberMarker
            key={m.id}
            member={m}
            mapHeading={mapHeading}
            selected={m.id === selectedId}
            hidden={clusteredIds.has(m.id) && m.id !== selectedId}
            onPress={() => select(m.id)}
          />
        ))}
        {clusters
          .filter((c) => c.members.length > 1)
          .map((c) => (
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
        onBack={() => router.replace('/')}
        onInvite={() => Share.share({ message: inviteMessage }).catch(() => {})}
      />

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

      {/* member surface: rail of everyone, or the focused member's card */}
      <View style={styles.memberArea} pointerEvents="box-none">
        {selected ? (
          <MemberCard
            member={selected}
            you={you}
            onRetrace={() => retrace(selected)}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <MemberRail members={sim.members} selectedId={selectedId} onSelect={select} />
        )}
      </View>

      <ActivityDock sim={sim} sessionName={sessionName} destinationName={scenario.destination.name} />

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
