import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityDock, DOCK_PEEK } from '../src/components/ActivityDock';
import { ClusterMarker } from '../src/components/ClusterMarker';
import { Glass } from '../src/components/Glass';
import { MemberCard } from '../src/components/MemberCard';
import { MemberMarker } from '../src/components/MemberMarker';
import { MemberRail } from '../src/components/MemberRail';
import { StopPin } from '../src/components/StopPin';
import { TrailPath } from '../src/components/TrailPath';
import { SCENARIOS } from '../src/demo/data';
import { SimMember, StopCategory, useSimulation } from '../src/demo/simulation';
import { UI } from '../src/lib/colors';
import { CATEGORY_ICON } from '../src/lib/icons';
import { LatLng, distanceM } from '../src/lib/geo';

const FIT_PADDING = { top: 130, right: 60, bottom: 320, left: 60 };
const TRAIL_PADDING = { top: 150, right: 70, bottom: 340, left: 70 };
const CATEGORIES: StopCategory[] = ['coffee', 'food', 'gas', 'restroom', 'scenic', 'other'];
/** cluster regrouping cadence — membership flapping at 4 Hz remounted photo
 *  facepiles constantly; splits/merges every couple of seconds read fine */
const CLUSTER_REGROUP_MS = 2500;

export default function SessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; kind?: string; durationMin?: string; code?: string }>();
  const sessionName = params.name ?? 'Session';
  const joinCode = params.code ?? 'kfx-mqvp-dhz';
  const durationMin = Number(params.durationMin ?? 240);
  const scenario = SCENARIOS[params.kind === 'roadtrip' ? 'roadtrip' : 'walk'];

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

  // Camera: follow the selected member, otherwise auto-fit the whole crew.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const selected = sim.members.find((m) => m.id === selectedId);
    if (selected && follow) {
      map.setCamera({ center: selected.pos, zoom: scenario.key === 'walk' ? 16.5 : 11 });
    } else if (!selectedId && autoFit) {
      if (fitCounter.current++ % 4 === 0) {
        map.fitToCoordinates(
          [...sim.members.map((m) => m.pos), scenario.destination.pos],
          { edgePadding: FIT_PADDING, animated: true }
        );
      }
    }
  }, [sim.members, selectedId, autoFit, follow]);

  // Track map rotation (arrow compensation) and region (cluster threshold, trail density).
  const onRegionSettled = (r: Region) => {
    setRegion(r);
    mapRef.current
      ?.getCamera()
      .then((c) => setMapHeading(c.heading ?? 0))
      .catch(() => {});
  };

  // Members within ~6% of the visible map merge into a facepile cluster.
  // Membership is throttled: recomputing it at the 4 Hz tick made groupings
  // flap whenever spacing hovered near the threshold, remounting facepile
  // photos over and over (a churn source behind the flaky-avatar bug).
  // Between regroups only the centers track live positions.
  const clusterMemo = useRef({ ids: [] as string[][], at: 0, thresholdM: 0 });
  const clusters = useMemo(() => {
    const thresholdM = region.latitudeDelta * 111_000 * 0.06;
    const now = Date.now();
    const memo = clusterMemo.current;
    const thresholdMoved = Math.abs(thresholdM - memo.thresholdM) > memo.thresholdM * 0.25;
    if (now - memo.at > CLUSTER_REGROUP_MS || thresholdMoved) {
      const groups: { members: SimMember[]; center: LatLng }[] = [];
      for (const m of sim.members) {
        const g = groups.find((x) => distanceM(x.center, m.pos) < thresholdM);
        if (g) {
          g.members.push(m);
          const n = g.members.length;
          g.center = {
            latitude: g.members.reduce((s, x) => s + x.pos.latitude, 0) / n,
            longitude: g.members.reduce((s, x) => s + x.pos.longitude, 0) / n,
          };
        } else {
          groups.push({ members: [m], center: m.pos });
        }
      }
      memo.ids = groups.map((g) => g.members.map((m) => m.id));
      memo.at = now;
      memo.thresholdM = thresholdM;
    }
    // rebuild the memoized grouping with this tick's live positions
    const byId = new Map(sim.members.map((m) => [m.id, m]));
    return memo.ids
      .map((ids) => ids.map((id) => byId.get(id)).filter((m): m is SimMember => !!m))
      .filter((g) => g.length > 0)
      .map((g) => ({
        members: g,
        center: {
          latitude: g.reduce((s, x) => s + x.pos.latitude, 0) / g.length,
          longitude: g.reduce((s, x) => s + x.pos.longitude, 0) / g.length,
        },
      }));
  }, [sim.members, region]);

  // members currently riding in a multi-member cluster
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

  // Group convergence: the one line that answers "when are we all together?"
  const enRoute = sim.members.filter((m) => m.state !== 'arrived');
  const straggler = enRoute.length
    ? enRoute.reduce((a, b) => (a.etaMin > b.etaMin ? a : b))
    : null;
  const convergence = straggler
    ? `All in ~${Math.max(1, Math.ceil(straggler.etaMin))} min · ${straggler.name} last`
    : 'Everyone’s here';
  const headerSub =
    convergence +
    (you && you.mode === 'foot' && you.steps > 0 ? ` · ${you.steps.toLocaleString()} steps` : '') +
    ` · ends ${remH > 0 ? `${remH}h ` : ''}${remM}m`;

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
        {/* trails: the path each member traveled, in their color — all when
            toggled, always for the selected member (retrace-your-steps).
            Rendered as dotted native polylines (overlays), never markers —
            trail markers destabilized the profile pucks (see TrailPath). */}
        {sim.members
          .filter((m) => (showTrails || m.id === selectedId) && m.trail.length > 1)
          .map((m) => (
            <TrailPath key={`trail-${m.id}`} member={m} />
          ))}

        <Marker coordinate={scenario.destination.pos} anchor={{ x: 0.5, y: 0.5 }} zIndex={8}>
          <View style={styles.destWrap}>
            <View style={styles.destPin}>
              <MaterialCommunityIcons name="flag-checkered" size={15} color={UI.text} />
            </View>
            <View style={styles.destTag}>
              <Text style={styles.destLabel}>{scenario.destination.name}</Text>
            </View>
          </View>
        </Marker>

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
            onPress={() => {
              setSelectedId((cur) => (cur === m.id ? null : m.id));
              setFollow(true);
              setAutoFit(false);
            }}
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

      {/* header */}
      <SafeAreaView style={styles.header} pointerEvents="box-none">
        <Glass style={styles.headerBar} radius={18} intensity={44}>
          <Pressable onPress={() => router.replace('/')} hitSlop={12}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={UI.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{sessionName}</Text>
            <Text style={[styles.headerSub, sim.allArrived && { color: UI.brand }]} numberOfLines={1}>
              {headerSub}
            </Text>
          </View>
          <Pressable style={styles.inviteBtn} onPress={() => Share.share({ message: inviteMessage }).catch(() => {})}>
            <MaterialCommunityIcons name="account-plus-outline" size={14} color={UI.bg} />
            <Text style={styles.inviteBtnText}>Invite</Text>
          </Pressable>
        </Glass>
      </SafeAreaView>

      {/* map controls */}
      <View style={styles.fabCol} pointerEvents="box-none">
        <Pressable onPress={() => setShowTrails((v) => !v)}>
          <Glass style={[styles.fab, showTrails && styles.fabOn]} radius={20} intensity={44}>
            <MaterialCommunityIcons name="map-marker-path" size={14} color={showTrails ? UI.bg : UI.text} />
            <Text style={[styles.fabText, showTrails && styles.fabTextOn]}>Trails</Text>
          </Glass>
        </Pressable>
        {(!autoFit || selectedId) && (
          <Pressable
            onPress={() => {
              setSelectedId(null);
              setAutoFit(true);
              fitCounter.current = 0;
            }}
          >
            <Glass style={styles.fab} radius={20} intensity={44}>
              <MaterialCommunityIcons name="arrow-collapse-all" size={14} color={UI.text} />
              <Text style={styles.fabText}>Everyone</Text>
            </Glass>
          </Pressable>
        )}
      </View>

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
          <MemberRail
            members={sim.members}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId((cur) => (cur === id ? null : id));
              setFollow(true);
              setAutoFit(false);
            }}
          />
        )}
      </View>

      <ActivityDock sim={sim} />

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

function PlaceSheet({
  pos,
  onClose,
  onAnnounce,
  onSuggest,
}: {
  pos: LatLng | null;
  onClose: () => void;
  onAnnounce: (cat: StopCategory, note: string) => void;
  onSuggest: (cat: StopCategory, note: string) => void;
}) {
  const [category, setCategory] = useState<StopCategory>('coffee');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (pos) {
      setCategory('coffee');
      setNote('');
    }
  }, [pos]);

  return (
    <Modal visible={pos !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.placeWrap}>
        <Glass style={styles.placeSheet} radius={26} intensity={56}>
          <Text style={styles.placeTitle}>Dropped pin</Text>
          <Text style={styles.placeSub}>
            {pos ? `${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}` : ''}
          </Text>
          <View style={styles.catRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.catBtn, category === c && styles.catBtnActive]}
              >
                <MaterialCommunityIcons
                  name={CATEGORY_ICON[c]}
                  size={19}
                  color={category === c ? UI.bg : UI.textDim}
                />
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)"
            placeholderTextColor={UI.textDim}
          />
          <View style={styles.placeActions}>
            <Pressable style={[styles.placeBtn, styles.placeBtnPrimary]} onPress={() => onAnnounce(category, note)}>
              <Text style={styles.placeBtnPrimaryText}>I'm stopping here</Text>
            </Pressable>
            <Pressable style={[styles.placeBtn, styles.placeBtnOutline]} onPress={() => onSuggest(category, note)}>
              <Text style={styles.placeBtnText}>Suggest to group</Text>
            </Pressable>
          </View>
        </Glass>
      </View>
    </Modal>
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
  headerTitle: { color: UI.text, fontSize: 16, fontWeight: '800' },
  headerSub: { color: UI.textDim, fontSize: 12, marginTop: 1 },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  inviteBtnText: { color: UI.bg, fontSize: 13, fontWeight: '700' },
  fabCol: {
    position: 'absolute',
    right: 14,
    bottom: DOCK_PEEK + 130,
    alignItems: 'flex-end',
    gap: 8,
  },
  fab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9 },
  fabOn: { backgroundColor: 'rgba(255,255,255,0.92)' },
  fabText: { color: UI.text, fontSize: 13, fontWeight: '600' },
  fabTextOn: { color: UI.bg },
  memberArea: { position: 'absolute', left: 0, right: 0, bottom: DOCK_PEEK + 20 },
  destWrap: { alignItems: 'center' },
  destPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: UI.chip,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  destTag: {
    marginTop: 4,
    backgroundColor: UI.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  destLabel: { color: UI.text, fontSize: 10.5, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  placeWrap: { paddingHorizontal: 10, paddingBottom: 12 },
  placeSheet: { padding: 18, paddingBottom: 26 },
  placeTitle: { color: UI.text, fontSize: 18, fontWeight: '800' },
  placeSub: { color: UI.textDim, fontSize: 12, marginTop: 2 },
  catRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  catBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  noteInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: UI.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 12,
  },
  placeActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  placeBtn: {
    flex: 1,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
  },
  placeBtnPrimary: { backgroundColor: '#fff' },
  placeBtnPrimaryText: { color: UI.bg, fontSize: 14, fontWeight: '700' },
  placeBtnOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  placeBtnText: { color: UI.text, fontSize: 14, fontWeight: '600' },
});
