import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { UI } from '../lib/colors';
import { formatDistance, formatEtaClock } from '../lib/geo';
import { CATEGORY_ICON, STATE_ICON } from '../lib/icons';
import { FeedEvent, SessionStop, SimMember, Simulation } from '../demo/simulation';
import { Glass } from './Glass';

const SCREEN_H = Dimensions.get('window').height;
const SHEET_H = Math.min(Math.round(SCREEN_H * 0.62), 560);
// translateY detents: fully open, mid (member list), hidden (grab bar only)
const FULL = 0;
const MID = SHEET_H - 272;
const PEEK = SHEET_H - 64;
const DETENTS = [FULL, MID, PEEK];

interface Props {
  sim: Simulation;
  selectedId: string | null;
  onSelectMember: (id: string) => void;
}

export function SessionSheet({ sim, selectedId, onSelectMember }: Props) {
  const y = useRef(new Animated.Value(MID)).current;
  const yNow = useRef(MID);
  const dragFrom = useRef(MID);
  const [atFull, setAtFull] = useState(false);

  useEffect(() => {
    const id = y.addListener(({ value }) => {
      yNow.current = value;
      setAtFull(value < MID / 2);
    });
    return () => y.removeListener(id);
  }, [y]);

  const snapTo = (target: number) => {
    // JS driver on purpose: the pan gesture drives this value via setValue,
    // and a native-driven value can't be written from JS afterwards (red screen)
    Animated.spring(y, { toValue: target, useNativeDriver: false, bounciness: 6 }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragFrom.current = yNow.current;
      },
      onPanResponderMove: (_e, g) => {
        y.setValue(Math.min(Math.max(dragFrom.current + g.dy, FULL), PEEK));
      },
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dy) < 6 && Math.abs(g.vy) < 0.3) {
          // tap: cycle hidden → mid → full → mid
          const cur = yNow.current;
          snapTo(cur > MID + 40 ? MID : cur > MID / 2 ? FULL : MID);
          return;
        }
        const projected = yNow.current + g.vy * 170;
        let best = DETENTS[0];
        let bestD = Infinity;
        for (const d of DETENTS) {
          const dd = Math.abs(d - projected);
          if (dd < bestD) {
            bestD = dd;
            best = d;
          }
        }
        snapTo(best);
      },
    })
  ).current;

  const activeStops = sim.stops.filter((s) => s.status !== 'done');

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: y }] }]}>
      <Glass style={styles.sheet} radius={26} intensity={55}>
        <View {...pan.panHandlers} style={styles.handleZone}>
          <View style={styles.handle} />
          <Text style={styles.handleHint}>Activity</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={atFull}>
          {sim.members.map((m) => (
            <MemberRow key={m.id} m={m} selected={m.id === selectedId} onPress={() => onSelectMember(m.id)} />
          ))}

          {activeStops.length > 0 && <Text style={styles.sectionTitle}>Stops & suggestions</Text>}
          {activeStops.map((s) => (
            <StopCard key={s.id} stop={s} sim={sim} />
          ))}

          <Text style={styles.sectionTitle}>Feed</Text>
          {sim.feed.map((e) => (
            <FeedRow key={e.id} e={e} members={sim.members} />
          ))}
          <View style={{ height: 28 }} />
        </ScrollView>
      </Glass>
    </Animated.View>
  );
}

function MemberRow({ m, selected, onPress }: { m: SimMember; selected: boolean; onPress: () => void }) {
  const status =
    m.state === 'arrived'
      ? 'Arrived'
      : m.state === 'stopped'
        ? (m.statusNote ?? 'Stopped')
        : `${formatDistance(m.remainingM)} out`;
  return (
    <Pressable onPress={onPress} style={[styles.memberRow, selected && styles.memberRowSelected]}>
      <Image source={{ uri: m.avatarUrl }} style={[styles.avatar, { borderColor: m.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName}>{m.name}</Text>
        <View style={styles.statusRow}>
          <MaterialCommunityIcons name={STATE_ICON[m.state]} size={12} color={UI.textDim} />
          <Text style={styles.memberStatus}>{status}</Text>
        </View>
      </View>
      <Text style={[styles.eta, { color: m.color }]}>
        {m.state === 'arrived' ? '—' : formatEtaClock(m.etaMin)}
      </Text>
    </Pressable>
  );
}

function StopCard({ stop, sim }: { stop: SessionStop; sim: Simulation }) {
  const creator = sim.members.find((m) => m.id === stop.createdBy);
  const color = creator?.color ?? UI.accent;
  const youVotedUp = stop.votesUp.includes('you');
  const youVotedDown = stop.votesDown.includes('you');
  const youJoined = stop.participants.includes('you');

  return (
    <View style={[styles.stopCard, { borderLeftColor: color }]}>
      <View style={styles.stopTitleRow}>
        <MaterialCommunityIcons name={CATEGORY_ICON[stop.category]} size={14} color={color} />
        <Text style={styles.stopTitle}>{stop.name}</Text>
        {stop.status === 'confirmed' && <Text style={styles.confirmed}>Confirmed</Text>}
      </View>
      <Text style={styles.stopMeta}>
        {stop.kind === 'suggestion' ? `Suggested by ${creator?.name ?? '?'}` : `${creator?.name ?? '?'} is stopping`}
        {stop.note ? ` · “${stop.note}”` : ''}
      </Text>
      <View style={styles.stopActions}>
        {stop.kind === 'suggestion' ? (
          <>
            <Pill icon="thumb-up-outline" label={`${stop.votesUp.length}`} active={youVotedUp} onPress={() => sim.vote(stop.id, true)} />
            <Pill icon="thumb-down-outline" label={`${stop.votesDown.length}`} active={youVotedDown} onPress={() => sim.vote(stop.id, false)} />
          </>
        ) : stop.createdBy !== 'you' ? (
          <Pill
            icon={youJoined ? 'check' : 'plus'}
            label={youJoined ? 'Stopping too' : "I'll stop too"}
            active={youJoined}
            onPress={() => sim.joinStop(stop.id)}
          />
        ) : (
          <Text style={styles.stopMeta}>Your stop</Text>
        )}
        {stop.participants.length > 1 && <Text style={styles.stopMeta}>{stop.participants.length} stopping</Text>}
      </View>
    </View>
  );
}

function FeedRow({ e, members }: { e: FeedEvent; members: SimMember[] }) {
  const color = members.find((m) => m.id === e.memberId)?.color ?? UI.textDim;
  return (
    <View style={styles.feedRow}>
      <View style={[styles.feedDot, { backgroundColor: color }]} />
      <Text style={styles.feedText}>{e.text}</Text>
    </View>
  );
}

function Pill({
  icon,
  label,
  active,
  onPress,
}: {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      {icon && <MaterialCommunityIcons name={icon} size={13} color={active ? '#fff' : UI.textDim} />}
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    height: SHEET_H,
  },
  sheet: { flex: 1, paddingHorizontal: 14 },
  handleZone: { alignItems: 'center', paddingVertical: 9 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  handleHint: { color: UI.textDim, fontSize: 11, marginTop: 5, fontWeight: '600' },
  sectionTitle: {
    color: UI.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 6,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  memberRowSelected: { backgroundColor: 'rgba(255,255,255,0.09)' },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    marginRight: 10,
  },
  memberName: { color: UI.text, fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  memberStatus: { color: UI.textDim, fontSize: 12 },
  eta: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stopCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 10,
    marginBottom: 8,
  },
  stopTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stopTitle: { color: UI.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  confirmed: {
    color: UI.success,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 'auto',
  },
  stopMeta: { color: UI.textDim, fontSize: 12, marginTop: 2 },
  stopActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 5.5,
  },
  pillActive: { backgroundColor: UI.accent, borderColor: UI.accent },
  pillText: { color: UI.text, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  feedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  feedDot: { width: 8, height: 8, borderRadius: 4, marginRight: 9 },
  feedText: { color: UI.text, fontSize: 13, flex: 1 },
});
