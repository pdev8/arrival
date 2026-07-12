import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SimMember } from '../demo/simulation';
import { UI } from '../lib/colors';
import { compassDir, formatDistance, formatEtaClock, formatLevel, statusLine } from '../lib/format';
import { bearingDeg, distanceM } from '../lib/geo';
import { STATE_ICON } from '../lib/icons';
import { AvatarRing } from './AvatarRing';
import { filledDots } from './DotRing';
import { Glass } from './Glass';
import { MEMBER_SURFACE_H } from './MemberRail';
import { WalkingIcon } from './WalkingIcon';

interface Props {
  member: SimMember;
  /** you, for the "0.4 mi NE of you" line (undefined when member IS you) */
  you?: SimMember;
  onRetrace: () => void;
  onClose: () => void;
}

/**
 * Focused view of one member, shown in place of the rail while following
 * them. Locked to MEMBER_SURFACE_H — the exact height of the rail it
 * replaces — so selecting/closing never shifts the layout, and no member
 * state (departed, arrived, long name) changes the footprint: every text
 * line truncates instead of wrapping.
 */
function MemberCardInner({ member, you, onRetrace, onClose }: Props) {
  const arrived = member.state === 'arrived';

  const relative =
    you && you.id !== member.id
      ? `${formatDistance(distanceM(you.pos, member.pos))} ${compassDir(bearingDeg(you.pos, member.pos))} of you`
      : null;

  return (
    <Glass style={styles.card} radius={20} intensity={44}>
      <View style={styles.topRow}>
        <AvatarRing
          source={member.avatar}
          name={member.name}
          size={51}
          avatarSize={37}
          progress={member.progress}
          color={member.color}
          arrived={arrived}
          count={16}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {member.name}
          </Text>
          <View style={styles.statusRow}>
            {member.state === 'walking' ? (
              <WalkingIcon />
            ) : (
              <MaterialCommunityIcons name={STATE_ICON[member.state]} size={12} color={UI.textDim} />
            )}
            <Text style={styles.status} numberOfLines={1}>
              {statusLine(member)}
              {relative && <Text style={{ color: member.color, fontWeight: '700' }}> · {relative}</Text>}
              {member.level != null && (
                <Text>
                  {' · '}
                  {formatLevel(member.level)}
                  {member.levelLabel ? ` ${member.levelLabel}` : ''}
                </Text>
              )}
            </Text>
          </View>
        </View>
        <View style={styles.etaCol}>
          <Text style={[styles.eta, member.left ? { color: UI.textDim } : { color: arrived ? UI.success : member.color }]}>
            {member.left ? '—' : arrived ? 'here' : formatEtaClock(member.etaMin)}
          </Text>
          {!arrived && !member.left && <Text style={styles.etaLabel}>eta</Text>}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.actionPrimary} onPress={onRetrace}>
          <MaterialCommunityIcons name="map-marker-path" size={13} color={UI.bg} />
          <Text style={styles.actionPrimaryText}>Retrace steps</Text>
        </Pressable>
        <Pressable style={styles.actionGhost} onPress={onClose}>
          <Text style={styles.actionGhostText}>Close</Text>
        </Pressable>
      </View>
    </Glass>
  );
}

/**
 * Memoized on what the card actually draws. The pager mounts one card per
 * member and the sim ticks at 4 Hz, so without this every tick re-renders
 * every page. The relative-bearing line moves with either position, hence
 * both are in the comparator; callbacks are stable (useCallback upstream).
 */
export const MemberCard = React.memo(
  MemberCardInner,
  (prev, next) =>
    prev.member.id === next.member.id &&
    prev.member.name === next.member.name &&
    prev.member.color === next.member.color &&
    prev.member.state === next.member.state &&
    prev.member.left === next.member.left &&
    prev.member.statusNote === next.member.statusNote &&
    prev.member.level === next.member.level &&
    prev.member.steps === next.member.steps &&
    Math.round(prev.member.remainingM) === Math.round(next.member.remainingM) &&
    Math.round(prev.member.etaMin * 60) === Math.round(next.member.etaMin * 60) &&
    filledDots(prev.member.progress, 16) === filledDots(next.member.progress, 16) &&
    prev.member.pos === next.member.pos &&
    prev.you?.pos === next.you?.pos
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    height: MEMBER_SURFACE_H,
    justifyContent: 'space-between',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: UI.text, fontSize: 15, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  status: { color: UI.textDim, fontSize: 12.5, flexShrink: 1 },
  etaCol: { alignItems: 'flex-end' },
  eta: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  etaLabel: { color: UI.textDim, fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  actions: { flexDirection: 'row', gap: 8 },
  actionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 11,
    paddingVertical: 6,
  },
  actionPrimaryText: { color: UI.bg, fontSize: 12.5, fontWeight: '700' },
  actionGhost: {
    paddingHorizontal: 14,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionGhostText: { color: UI.text, fontSize: 12.5, fontWeight: '600' },
});
