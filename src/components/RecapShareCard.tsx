import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { forwardRef, useRef } from 'react';
import {
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { UI } from '../lib/colors';
import { formatDistance } from '../lib/format';
import { RecapStats } from '../lib/recap';

export interface CardMember {
  id: string;
  name: string;
  color: string;
  avatar?: ImageSourcePropType;
  steps: number;
}

interface Props {
  sessionName: string;
  destinationName: string;
  endedAt: number;
  durationSec: number;
  members: CardMember[];
  stats: RecapStats;
}

/**
 * The shareable arrival recap — rendered off-screen and captured with
 * view-shot, so it uses solid fills (no blur) and fixed dimensions. Brand
 * mark + session identity up top, the earned numbers in the middle, the
 * crew along the bottom.
 */
export const RecapShareCard = forwardRef<View, Props>(function RecapShareCard(
  { sessionName, destinationName, endedAt, durationSec, members, stats },
  ref
) {
  const ended = new Date(endedAt);
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.brandRow}>
        <View style={styles.mark}>
          <View style={styles.markDot} />
        </View>
        <Text style={styles.brand}>Arrival</Text>
        <Text style={styles.date}>
          {ended.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>

      <Text style={styles.title}>{sessionName}</Text>
      <Text style={styles.sub}>Everyone made it to {destinationName}</Text>

      <View style={styles.statsRow}>
        {stats.groupSteps > 0 && <Stat value={stats.groupSteps.toLocaleString()} label="group steps" />}
        {stats.youTraveledM != null && stats.youTraveledM > 0 && (
          <Stat value={formatDistance(stats.youTraveledM)} label="you covered" />
        )}
        <Stat value={`${Math.max(1, Math.round(durationSec / 60))} min`} label="together" />
        {stats.firstName && <Stat value={stats.firstName} label="first in" />}
      </View>

      <View style={styles.crewRow}>
        {members.slice(0, 7).map((m) =>
          m.avatar ? (
            <Image key={m.id} source={m.avatar} fadeDuration={0} style={[styles.face, { borderColor: m.color }]} />
          ) : (
            <View key={m.id} style={[styles.face, styles.faceFallback, { borderColor: m.color }]}>
              <Text style={styles.faceInitial}>{m.name[0]}</Text>
            </View>
          )
        )}
        <Text style={styles.crewLabel}>
          {members.length} {members.length === 1 ? 'friend' : 'friends'}, zero “where are you” texts
        </Text>
      </View>

      <Text style={styles.foot}>arrival.app</Text>
    </View>
  );
});

/**
 * "Share recap" button + the off-screen card it captures. The card must be
 * mounted (not display:none) for view-shot, so it hides 1000pt off-screen.
 * iOS shares the PNG; Android's Share can't take a file url, so it falls
 * back to a text summary until expo-sharing lands.
 */
export function RecapShare(props: Props) {
  const cardRef = useRef<View>(null);
  const share = async () => {
    const { stats, sessionName, destinationName } = props;
    const text =
      `${sessionName} — everyone made it to ${destinationName}. ` +
      `${stats.groupSteps > 0 ? `${stats.groupSteps.toLocaleString()} group steps. ` : ''}Tracked with Arrival.`;
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Share.share(Platform.OS === 'ios' ? { url: uri } : { message: text });
    } catch {
      Share.share({ message: text }).catch(() => {});
    }
  };
  return (
    <>
      <Pressable style={shareStyles.btn} onPress={share}>
        <MaterialCommunityIcons name="share-variant-outline" size={13} color={UI.bg} />
        <Text style={shareStyles.btnText}>Share recap</Text>
      </Pressable>
      <View style={shareStyles.offscreen} pointerEvents="none">
        <RecapShareCard ref={cardRef} {...props} />
      </View>
    </>
  );
}

const shareStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: UI.brand,
    borderRadius: 11,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  btnText: { color: UI.bg, fontSize: 12.5, fontWeight: '800' },
  offscreen: { position: 'absolute', left: -1000, top: 0 },
});

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: UI.bg,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderTopLeftRadius: 4,
    borderWidth: 2.5,
    borderColor: UI.brand,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: UI.brand },
  brand: { color: UI.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  date: { marginLeft: 'auto', color: UI.textDim, fontSize: 12, fontWeight: '600' },
  title: { color: UI.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 18 },
  sub: { color: UI.brand, fontSize: 13.5, fontWeight: '700', marginTop: 3 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 18 },
  stat: { minWidth: 76 },
  statValue: { color: UI.text, fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: {
    color: UI.textDim,
    fontSize: 10.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  crewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  face: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    marginRight: -8,
    backgroundColor: '#14161C',
  },
  faceFallback: { alignItems: 'center', justifyContent: 'center' },
  faceInitial: { color: UI.text, fontSize: 13, fontWeight: '800' },
  crewLabel: { color: UI.textDim, fontSize: 11.5, fontWeight: '600', marginLeft: 18, flexShrink: 1 },
  foot: { color: UI.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 18 },
});
