import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FeedEvent, SimMember, Simulation } from '../demo/simulation';
import { UI } from '../lib/colors';
import { formatDistance, timeAgo } from '../lib/format';
import { Glass } from './Glass';
import { StopCard } from './StopCard';

const SCREEN_H = Dimensions.get('window').height;
export const DOCK_H = Math.min(Math.round(SCREEN_H * 0.5), 460);
/** visible height when collapsed: handle + live ticker line */
export const DOCK_PEEK = 76;
const OPEN = 0;
const CLOSED = DOCK_H - DOCK_PEEK;

/**
 * The coordination surface, slimmed down: members live in the rail above, so
 * the dock is just stops/suggestions and the activity timeline. Collapsed it
 * shows a one-line live ticker (latest event); drag or tap to expand. When
 * everyone arrives it leads with a session recap.
 */
export function ActivityDock({ sim }: { sim: Simulation }) {
  const y = useRef(new Animated.Value(CLOSED)).current;
  const yNow = useRef(CLOSED);
  const dragFrom = useRef(CLOSED);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = y.addListener(({ value }) => {
      yNow.current = value;
      setOpen(value < CLOSED / 2);
    });
    return () => y.removeListener(id);
  }, [y]);

  const snapTo = (target: number) => {
    // JS driver on purpose: the pan gesture writes this value via setValue
    Animated.spring(y, { toValue: target, useNativeDriver: false, bounciness: 5 }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragFrom.current = yNow.current;
      },
      onPanResponderMove: (_e, g) => {
        y.setValue(Math.min(Math.max(dragFrom.current + g.dy, OPEN), CLOSED));
      },
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dy) < 6 && Math.abs(g.vy) < 0.3) {
          snapTo(yNow.current > CLOSED / 2 ? OPEN : CLOSED); // tap toggles
          return;
        }
        snapTo(yNow.current + g.vy * 160 > CLOSED / 2 ? CLOSED : OPEN);
      },
    })
  ).current;

  const activeStops = sim.stops.filter((s) => s.status !== 'done');
  const latest = sim.feed[0];

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: y }] }]}>
      <Glass style={styles.dock} radius={24} intensity={52}>
        <View {...pan.panHandlers} style={styles.handleZone}>
          <View style={styles.handle} />
          {!open && latest && (
            <View style={styles.ticker}>
              <TickerDot memberId={latest.memberId} members={sim.members} />
              <Text style={styles.tickerText} numberOfLines={1}>
                {latest.text}
              </Text>
              <Text style={styles.tickerTime}>{timeAgo(sim.elapsedSec - latest.at)}</Text>
            </View>
          )}
          {open && <Text style={styles.dockTitle}>Activity</Text>}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={open}>
          {sim.allArrived && <Recap sim={sim} />}

          {activeStops.length > 0 && <Text style={styles.sectionTitle}>Stops & suggestions</Text>}
          {activeStops.map((s) => (
            <StopCard key={s.id} stop={s} sim={sim} />
          ))}

          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.feedList}>
            <View style={styles.feedRail} />
            {sim.feed.map((e) => (
              <FeedRow key={e.id} e={e} members={sim.members} elapsedSec={sim.elapsedSec} />
            ))}
          </View>
          <View style={{ height: 28 }} />
        </ScrollView>
      </Glass>
    </Animated.View>
  );
}

/** Session recap once everyone's arrived: the numbers the walk earned. */
function Recap({ sim }: { sim: Simulation }) {
  const first = sim.members.find((m) => m.id === sim.arrivalOrder[0]);
  const last = sim.members.find((m) => m.id === sim.arrivalOrder[sim.arrivalOrder.length - 1]);
  const groupSteps = sim.members.reduce((s, m) => s + m.steps, 0);
  const you = sim.members.find((m) => m.isYou);
  return (
    <View style={styles.recap}>
      <Text style={styles.recapTitle}>Everyone made it</Text>
      <Text style={styles.recapSub}>Saved to your archive — open it any time from Home.</Text>
      <View style={styles.recapRow}>
        {groupSteps > 0 && <Stat label="group steps" value={groupSteps.toLocaleString()} />}
        {you && <Stat label="you covered" value={formatDistance(you.traveledM)} />}
        {first && <Stat label="first in" value={first.name} />}
        {last && first !== last && <Stat label="last in" value={last.name} />}
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

function TickerDot({ memberId, members }: { memberId?: string; members: SimMember[] }) {
  const member = members.find((m) => m.id === memberId);
  if (!member) return <View style={[styles.tickerFallback]} />;
  return <Image source={member.avatar} fadeDuration={0} style={[styles.tickerAvatar, { borderColor: member.color }]} />;
}

/** Memoized on the row's visible output: the event is immutable, the member's
 *  avatar/color are stable per id, so only the "3m" bucket can change it. */
const FeedRow = React.memo(
  function FeedRow({ e, members, elapsedSec }: { e: FeedEvent; members: SimMember[]; elapsedSec: number }) {
    const member = members.find((m) => m.id === e.memberId);
    return (
      <View style={styles.feedRow}>
        {member ? (
          <Image source={member.avatar} fadeDuration={0} style={[styles.feedAvatar, { borderColor: member.color }]} />
        ) : (
          <View style={styles.feedSysDot}>
            <MaterialCommunityIcons name="flag-outline" size={11} color={UI.textDim} />
          </View>
        )}
        <Text style={styles.feedText}>{e.text}</Text>
        <Text style={styles.feedTime}>{timeAgo(elapsedSec - e.at)}</Text>
      </View>
    );
  },
  (prev, next) =>
    prev.e.id === next.e.id &&
    timeAgo(prev.elapsedSec - prev.e.at) === timeAgo(next.elapsedSec - next.e.at)
);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    height: DOCK_H,
  },
  dock: { flex: 1, paddingHorizontal: 14, backgroundColor: 'rgba(11,13,18,0.16)' },
  handleZone: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  handle: { width: 40, height: 4.5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  dockTitle: {
    color: UI.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 6,
  },
  ticker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7, paddingHorizontal: 4, alignSelf: 'stretch' },
  tickerAvatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, backgroundColor: UI.bg },
  tickerFallback: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' },
  tickerText: { color: UI.text, fontSize: 12.5, flex: 1 },
  tickerTime: { color: UI.textDim, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  recap: {
    borderWidth: 1,
    borderColor: `${UI.brand}55`,
    backgroundColor: `${UI.brand}14`,
    borderRadius: 16,
    padding: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  recapTitle: { color: UI.brand, fontSize: 14, fontWeight: '800' },
  recapSub: { color: UI.textDim, fontSize: 11.5, marginTop: 2 },
  recapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  stat: { minWidth: 70 },
  statValue: { color: UI.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: UI.textDim, fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  sectionTitle: {
    color: UI.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 6,
  },
  feedList: { position: 'relative' },
  feedRail: {
    position: 'absolute',
    left: 10.5,
    top: 10,
    bottom: 10,
    width: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  feedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5.5 },
  feedAvatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, marginRight: 10, backgroundColor: UI.bg },
  feedSysDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  feedText: { color: UI.text, fontSize: 13, flex: 1, lineHeight: 17 },
  feedTime: { color: UI.textDim, fontSize: 11, fontWeight: '600', marginLeft: 8, fontVariant: ['tabular-nums'] },
});
