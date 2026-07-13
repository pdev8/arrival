import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UI } from '../lib/colors';
import { Glass } from './Glass';

/**
 * Session title bar: back, name + convergence line, and the three things you
 * can do to the session — set where you're going, invite people, and leave.
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
  highlightSub = false,
  onBack,
  onSetDestination,
  onInvite,
  onLeave,
  onHeight,
}: {
  title: string;
  sub: string;
  /** null = free roam */
  destinationName: string | null;
  /** amber sub line — used once everyone has arrived */
  highlightSub?: boolean;
  onBack: () => void;
  onSetDestination: () => void;
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

        <Pressable style={styles.dest} onPress={onSetDestination}>
          <MaterialCommunityIcons
            name={destinationName ? 'flag-variant' : 'flag-plus-outline'}
            size={13}
            color={destinationName ? UI.brand : UI.textDim}
          />
          <Text
            style={[styles.destText, !destinationName && styles.destEmpty]}
            numberOfLines={1}
          >
            {destinationName ?? 'Set destination'}
          </Text>
          <MaterialCommunityIcons name="pencil" size={11} color={UI.textDim} />
        </Pressable>
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
  dest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  destText: { color: UI.text, fontSize: 12.5, fontWeight: '700', flex: 1 },
  destEmpty: { color: UI.textDim, fontWeight: '600' },
});
