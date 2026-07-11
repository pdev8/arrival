import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SimMember } from '../demo/simulation';
import { UI } from '../lib/colors';
import { compassDir, formatDistance, formatEtaClock, formatLevel } from '../lib/format';
import { bearingDeg, distanceM } from '../lib/geo';
import { STATE_ICON } from '../lib/icons';
import { AvatarRing } from './AvatarRing';
import { Glass } from './Glass';
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
 * them: identity + live status, where they are relative to YOU (distance +
 * compass direction — the "which way do I look" answer a map alone doesn't
 * give), and Retrace, which frames their whole trail on the map.
 */
export function MemberCard({ member, you, onRetrace, onClose }: Props) {
  const arrived = member.state === 'arrived';
  let status =
    member.state === 'arrived'
      ? 'Arrived'
      : member.state === 'stopped'
        ? (member.statusNote ?? 'Stopped')
        : `${formatDistance(member.remainingM)} out`;
  if (member.mode === 'foot' && member.steps > 0) status += ` · ${member.steps.toLocaleString()} steps`;

  const relative =
    you && you.id !== member.id
      ? `${formatDistance(distanceM(you.pos, member.pos))} ${compassDir(bearingDeg(you.pos, member.pos))} of you`
      : null;

  return (
    <Glass style={styles.card} radius={20} intensity={44}>
      <View style={styles.topRow}>
        <AvatarRing
          source={member.avatar}
          size={56}
          avatarSize={42}
          progress={member.progress}
          color={member.color}
          arrived={arrived}
          count={16}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{member.name}</Text>
          <View style={styles.statusRow}>
            {member.state === 'walking' ? (
              <WalkingIcon />
            ) : (
              <MaterialCommunityIcons name={STATE_ICON[member.state]} size={12} color={UI.textDim} />
            )}
            <Text style={styles.status} numberOfLines={1}>
              {status}
            </Text>
          </View>
          {relative && (
            <Text style={[styles.relative, { color: member.color }]}>{relative}</Text>
          )}
          {member.level != null && (
            <Text style={styles.level}>
              {formatLevel(member.level)}
              {member.levelLabel ? ` · ${member.levelLabel}` : ''} —{' '}
              {member.level < 0 ? 'below street level' : 'above street level'}
            </Text>
          )}
        </View>
        <View style={styles.etaCol}>
          <Text style={[styles.eta, { color: arrived ? UI.success : member.color }]}>
            {arrived ? 'here' : formatEtaClock(member.etaMin)}
          </Text>
          {!arrived && <Text style={styles.etaLabel}>eta</Text>}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.actionPrimary} onPress={onRetrace}>
          <MaterialCommunityIcons name="map-marker-path" size={14} color={UI.bg} />
          <Text style={styles.actionPrimaryText}>Retrace steps</Text>
        </Pressable>
        <Pressable style={styles.actionGhost} onPress={onClose}>
          <Text style={styles.actionGhostText}>Close</Text>
        </Pressable>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, padding: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: UI.text, fontSize: 16, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  status: { color: UI.textDim, fontSize: 12.5, flexShrink: 1 },
  relative: { fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  level: { color: UI.textDim, fontSize: 12, fontWeight: '600', marginTop: 2 },
  etaCol: { alignItems: 'flex-end' },
  eta: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  etaLabel: { color: UI.textDim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
  },
  actionPrimaryText: { color: UI.bg, fontSize: 13.5, fontWeight: '700' },
  actionGhost: {
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionGhostText: { color: UI.text, fontSize: 13.5, fontWeight: '600' },
});
