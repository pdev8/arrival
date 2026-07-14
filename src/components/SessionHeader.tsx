import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UI } from '../lib/colors';
import { formatMeetTime } from '../lib/schedule';
import { Glass } from './Glass';

/**
 * Session title bar: back, name + convergence line, and the four things you
 * can do to the session — set where you're going, set when you're meeting,
 * invite people, and leave.
 *
 * Leave is MINE alone: the session keeps running for everyone else and I can
 * rejoin with the same code. There is deliberately no "end for everyone" —
 * a session finishes when its time runs out or when everyone has left.
 *
 * The destination row is the interesting one. A session can start as free roam
 * (no destination at all), and the group can decide where they're going after
 * they're already out — so this is a live control, not a label: it reads "Set
 * destination" when there isn't one, and the place's name when there is,
 * tappable either way to set or change it.
 *
 * Invite is icon-only. The word cost more space than it earned.
 */
export function SessionHeader({
  title,
  sub,
  destinationName,
  meetAt,
  highlightSub = false,
  onBack,
  onSetDestination,
  onSetMeetTime,
  onInvite,
  onLeave,
  onHeight,
}: {
  title: string;
  sub: string;
  /** null = free roam */
  destinationName: string | null;
  /** null = no time to be anywhere. Independent of the destination — you can
   *  agree on eight o'clock before you've agreed on the restaurant. */
  meetAt: number | null;
  /** amber sub line — used once everyone has arrived */
  highlightSub?: boolean;
  onBack: () => void;
  onSetDestination: () => void;
  onSetMeetTime: () => void;
  onInvite: () => void;
  /** leave — MY participation only. The session lives on without me, and I can
   *  rejoin with the same code. It is not an "end session" button. */
  onLeave: () => void;
  /** the bar's real height, safe-area included — the map chips park under it.
   *  Measured, not assumed: the bar grows when a destination is set, and every
   *  hard-coded offset we've written here has eventually collided with it. */
  onHeight?: (h: number) => void;
}) {
  return (
    <SafeAreaView
      // TOP ONLY. SafeAreaView defaults to ALL edges, so without this it pads the
      // BOTTOM by the home-indicator inset (~34pt) — inside a bar that is pinned
      // to top:0, where a bottom inset means nothing. That padding is invisible,
      // but it is inside the view we MEASURE, so onHeight over-reported by 34pt
      // and everything that parks under the bar — the chips, the cards that
      // unfold from it — sat a phantom inch below it.
      edges={['top']}
      style={styles.wrap}
      pointerEvents="box-none"
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
    >
      <Glass style={styles.bar} radius={18} intensity={44}>
        <View style={styles.row}>
          <Pressable onPress={onBack} hitSlop={12}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={UI.text} />
          </Pressable>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.sub, highlightSub && { color: UI.brand }]} numberOfLines={1}>
              {sub}
            </Text>
          </View>

          <Pressable style={styles.iconBtn} onPress={onInvite} hitSlop={8}>
            <MaterialCommunityIcons name="account-plus-outline" size={17} color={UI.bg} />
          </Pressable>

          <Pressable style={styles.leaveBtn} onPress={onLeave} hitSlop={8}>
            <MaterialCommunityIcons name="exit-to-app" size={17} color={UI.danger} />
          </Pressable>
        </View>

        {/* WHERE and WHEN, side by side and separately tappable. They are
            genuinely independent: a group can settle on eight o'clock long
            before it settles on the restaurant, and either can be set — or
            changed — after everyone is already out the door. */}
        <View style={styles.plan}>
          <Pressable style={styles.dest} onPress={onSetDestination}>
            <MaterialCommunityIcons
              name={destinationName ? 'flag-variant' : 'flag-plus-outline'}
              size={13}
              color={destinationName ? UI.brand : UI.textDim}
            />
            <Text
              style={[styles.destText, !destinationName && styles.planEmpty]}
              numberOfLines={1}
            >
              {destinationName ?? 'Set destination'}
            </Text>
          </Pressable>

          <View style={styles.planSep} />

          <Pressable style={styles.time} onPress={onSetMeetTime} hitSlop={6}>
            <MaterialCommunityIcons
              name={meetAt ? 'clock-outline' : 'clock-plus-outline'}
              size={13}
              color={meetAt ? UI.brand : UI.textDim}
            />
            <Text style={[styles.timeText, !meetAt && styles.planEmpty]} numberOfLines={1}>
              {meetAt ? formatMeetTime(meetAt, Date.now()) : 'Set time'}
            </Text>
          </Pressable>
        </View>
      </Glass>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  bar: {
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: UI.text, fontSize: 16, fontWeight: '800' },
  sub: { color: UI.textDim, fontSize: 12, marginTop: 1 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${UI.danger}88`,
    backgroundColor: `${UI.danger}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  // The place can be long ("Murray's Cheese, 254 Bleecker"); the time never is —
  // so the place flexes and the time holds its ground. Both carry real vertical
  // padding: as bare text-and-icon rows they were ~13pt tall, which is a third
  // of the smallest thing a thumb can reliably hit.
  dest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    paddingRight: 4,
  },
  destText: { color: UI.text, fontSize: 12.5, fontWeight: '700', flex: 1 },
  planSep: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: 'rgba(255,255,255,0.18)' },
  // an actual chip, so it looks like the control it is — and so the card that
  // grows out of it has something to grow out of
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  timeText: { color: UI.text, fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  planEmpty: { color: UI.textDim, fontWeight: '600' },
});
