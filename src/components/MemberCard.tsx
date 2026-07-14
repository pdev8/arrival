import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SessionStop, SimMember } from '../demo/simulation';
import { UI } from '../lib/colors';
import { compassDir, formatDistance, formatLevel, headlineLabel, headlineTone, isProgressing, memberHeadline, statusLine } from '../lib/format';
import { canJoin } from '../lib/stops';
import { toneColor } from '../lib/tone';
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
  /** the stop they're at or committed to — what you'd be joining */
  stop: SessionStop | null;
  /** somewhere to actually navigate to (false on your own card in free roam) */
  canNavigate: boolean;
  onJoin: () => void;
  onNavigate: () => void;
  onClose: () => void;
}

/**
 * Focused view of one member, shown in place of the rail while following
 * them. Locked to MEMBER_SURFACE_H — the exact height of the rail it
 * replaces — so selecting/closing never shifts the layout, and no member
 * state (departed, arrived, long name) changes the footprint: every text
 * line truncates instead of wrapping.
 *
 * THE ACTIONS ARE LIVE ACTIONS. This card used to lead with "Retrace steps",
 * which is a thing you want when a session is OVER — and the archive already
 * does it properly, with an animated replay. Mid-session, retracing someone is
 * idle curiosity; what you actually want is to act on where they are right now.
 * So: JOIN them at the stop they've pulled over at, or NAVIGATE to them.
 */
function MemberCardInner({ member, you, stop, canNavigate, onJoin, onNavigate, onClose }: Props) {
  const arrived = member.state === 'arrived';
  const joinable = canJoin(stop);

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
          pulse={isProgressing(member)}
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
          <Text style={[styles.eta, { color: toneColor(headlineTone(member), member.color) }]}>
            {member.left ? '—' : memberHeadline(member)}
          </Text>
          {!member.left && !!headlineLabel(member) && (
            <Text style={styles.etaLabel}>{headlineLabel(member)}</Text>
          )}
        </View>
      </View>
      {/* Both buttons are ALWAYS rendered, disabled rather than removed. The
          card's height is fixed by contract and the deck is a pager — a button
          that comes and goes would make every page a different shape. A dimmed
          "Join" also teaches the affordance: it lights up the moment someone
          pulls over. */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionPrimary, !joinable && styles.actionOff]}
          disabled={!joinable}
          onPress={onJoin}
        >
          <MaterialCommunityIcons name="account-multiple-plus" size={13} color={UI.bg} />
          <Text style={styles.actionPrimaryText} numberOfLines={1}>
            {joinLabel(member, stop)}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.actionSecondary, !canNavigate && styles.actionOff]}
          disabled={!canNavigate}
          onPress={onNavigate}
        >
          <MaterialCommunityIcons name="navigation-variant-outline" size={13} color={UI.text} />
          <Text style={styles.actionSecondaryText}>Navigate</Text>
        </Pressable>

        <Pressable style={styles.actionGhost} onPress={onClose}>
          <Text style={styles.actionGhostText}>Close</Text>
        </Pressable>
      </View>
    </Glass>
  );
}

/**
 * What the Join button says. Naming the place is the whole point — "Join" is a
 * shrug, "Join at Joe's Pizza" is a decision you can make without looking
 * anywhere else.
 */
function joinLabel(member: SimMember, stop: SessionStop | null): string {
  if (!stop) return 'Join';
  if (!canJoin(stop)) return member.isYou ? 'Your stop' : 'Joined';
  return `Join at ${stop.name}`;
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
    Math.round((prev.member.etaMin ?? -1) * 60) === Math.round((next.member.etaMin ?? -1) * 60) &&
    // slack in its own right: a member standing still has a FROZEN eta and still
    // gets later as the meeting approaches. Without this the card would sit on
    // "5 min late" while they miss the whole thing.
    Math.round(prev.member.slackMin ?? Infinity) === Math.round(next.member.slackMin ?? Infinity) &&
    Math.round(prev.member.traveledM / 10) === Math.round(next.member.traveledM / 10) &&
    filledDots(prev.member.progress, 16) === filledDots(next.member.progress, 16) &&
    // the ring breathes only while they're closing the gap — a stopped member's
    // ring must actually stop
    isProgressing(prev.member) === isProgressing(next.member) &&
    // the Join button's whole existence turns on this: which stop, and whether
    // I'm already in it
    prev.stop?.id === next.stop?.id &&
    prev.stop?.participants.length === next.stop?.participants.length &&
    prev.canNavigate === next.canNavigate &&
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
  actionPrimaryText: { color: UI.bg, fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  actionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  actionSecondaryText: { color: UI.text, fontSize: 12.5, fontWeight: '600' },
  /** disabled, not removed — the card's height is fixed and the deck is a pager */
  actionOff: { opacity: 0.38 },
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
