import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClusterMarker } from '../src/components/ClusterMarker';
import { Glass } from '../src/components/Glass';
import { MemberMarker } from '../src/components/MemberMarker';
import { SessionSheet } from '../src/components/SessionSheet';
import { StopPin } from '../src/components/StopPin';
import { SCENARIOS } from '../src/demo/data';
import { SimMember, StopCategory, useSimulation } from '../src/demo/simulation';
import { UI } from '../src/lib/colors';
import { CATEGORY_ICON } from '../src/lib/icons';
import { LatLng, distanceM } from '../src/lib/geo';

const FIT_PADDING = { top: 130, right: 60, bottom: 340, left: 60 };
const CATEGORIES: StopCategory[] = ['coffee', 'food', 'gas', 'restroom', 'scenic', 'other'];

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
  const [placePick, setPlacePick] = useState<LatLng | null>(null);
  const [mapHeading, setMapHeading] = useState(0);
  const [region, setRegion] = useState<Region>(scenario.initialRegion as Region);
  const fitCounter = useRef(0);
  const endsAt = useRef(Date.now() + durationMin * 60_000);
  const sharedOnce = useRef(false);

  const inviteMessage = `Join my Arrival session “${sessionName}”: https://arrival.app/j/${joinCode}`;

  // Meet-style moment: surface the invite link right after the session is created.
  useEffect(() => {
    if (sharedOnce.current) return;
    sharedOnce.current = true;
    const t = setTimeout(() => Share.share({ message: inviteMessage }).catch(() => {}), 800);
    return () => clearTimeout(t);
  }, [inviteMessage]);

  // Camera: follow the selected member, otherwise auto-fit the whole crew (§4 top-down view).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const selected = sim.members.find((m) => m.id === selectedId);
    if (selected) {
      // instant lock onto the member — no eased pan
      map.setCamera({ center: selected.pos, zoom: scenario.key === 'walk' ? 15.5 : 11 });
    } else if (autoFit) {
      if (fitCounter.current++ % 4 === 0) {
        map.fitToCoordinates(
          [...sim.members.map((m) => m.pos), scenario.destination.pos],
          { edgePadding: FIT_PADDING, animated: true }
        );
      }
    }
  }, [sim.members, selectedId, autoFit]);

  // Track map rotation (arrow compensation) and region (cluster threshold).
  const onRegionSettled = (r: Region) => {
    setRegion(r);
    mapRef.current
      ?.getCamera()
      .then((c) => setMapHeading(c.heading ?? 0))
      .catch(() => {});
  };

  // Members within ~6% of the visible map merge into a facepile cluster.
  const clusters = useMemo(() => {
    const thresholdM = region.latitudeDelta * 111_000 * 0.06;
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
    return groups;
  }, [sim.members, region]);

  const remaining = Math.max(0, endsAt.current - Date.now());
  const remH = Math.floor(remaining / 3_600_000);
  const remM = Math.floor((remaining % 3_600_000) / 60_000);

  const memberColor = useMemo(
    () => (id: string) => sim.members.find((m) => m.id === id)?.color ?? UI.accent,
    [sim.members]
  );

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
          setSelectedId(null);
        }}
        onLongPress={(e) => setPlacePick(e.nativeEvent.coordinate)}
      >
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
          <StopPin key={s.id} stop={s} memberColor={memberColor(s.createdBy)} onPress={() => {}} />
        ))}

        {clusters.map((c) =>
          c.members.length === 1 ? (
            <MemberMarker
              key={c.members[0].id}
              member={c.members[0]}
              mapHeading={mapHeading}
              selected={c.members[0].id === selectedId}
              onPress={() => {
                setSelectedId((cur) => (cur === c.members[0].id ? null : c.members[0].id));
                setAutoFit(false);
              }}
            />
          ) : (
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
          )
        )}
      </MapView>

      {/* header */}
      <SafeAreaView style={styles.header} pointerEvents="box-none">
        <Glass style={styles.headerBar} radius={18} intensity={55}>
          <Pressable onPress={() => router.replace('/')} hitSlop={12}>
            <Text style={styles.headerBack}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{sessionName}</Text>
            <Text style={styles.headerSub}>
              Ends in {remH > 0 ? `${remH}h ` : ''}{remM}m · {joinCode}
            </Text>
          </View>
          <Pressable style={styles.inviteBtn} onPress={() => Share.share({ message: inviteMessage }).catch(() => {})}>
            <MaterialCommunityIcons name="account-plus-outline" size={14} color={UI.bg} />
            <Text style={styles.inviteBtnText}>Invite</Text>
          </Pressable>
        </Glass>
      </SafeAreaView>

      {/* recenter */}
      {(!autoFit || selectedId) && (
        <Pressable
          style={styles.recenterWrap}
          onPress={() => {
            setSelectedId(null);
            setAutoFit(true);
            fitCounter.current = 0;
          }}
        >
          <Glass style={styles.recenter} radius={20} intensity={55}>
            <MaterialCommunityIcons name="arrow-collapse-all" size={14} color={UI.text} />
            <Text style={styles.recenterText}>Everyone</Text>
          </Glass>
        </Pressable>
      )}

      <SessionSheet
        sim={sim}
        selectedId={selectedId}
        onSelectMember={(id) => {
          setSelectedId((cur) => (cur === id ? null : id));
          setAutoFit(false);
        }}
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
        <Glass style={styles.placeSheet} radius={26} intensity={70}>
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
    gap: 10,
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerBack: { color: UI.text, fontSize: 28, fontWeight: '600', marginTop: -3 },
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
  recenterWrap: { position: 'absolute', right: 14, bottom: 300 },
  recenter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9 },
  recenterText: { color: UI.text, fontSize: 13, fontWeight: '600' },
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
