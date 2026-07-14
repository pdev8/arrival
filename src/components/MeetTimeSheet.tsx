import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { UI } from '../lib/colors';
import { formatMeetTime, resolveMeetTime, splitClock, untilLabel } from '../lib/schedule';
import { AnchoredCard } from './AnchoredCard';

/**
 * When are we meeting? TYPE IT.
 *
 * This started as a scrolling list of quarter-hours and that was wrong: a list
 * makes you hunt for a time you already know. People arrive at this control
 * having ALREADY decided — "we said eight" — so the fastest thing we can do is
 * get out of the way and let them say eight.
 *
 * Two digits, a meridiem, done. The three shortcuts underneath are for the other
 * case, where the plan is relative rather than absolute ("give me an hour").
 *
 * No native date picker, and that's deliberate: adding one means `pod install`,
 * which wipes the fmt/Xcode-26 patch, which means everybody rebuilds. Two text
 * fields cost none of that — and they're faster anyway.
 */

/** the relative plans people actually make: "give me half an hour" */
const QUICK_MIN = [30, 60, 120];

export function MeetTimeSheet({
  visible,
  meetAt,
  anchorTop,
  onSet,
  onClose,
}: {
  visible: boolean;
  /** null = no time to be anywhere */
  meetAt: number | null;
  anchorTop: number;
  onSet: (at: number | null) => void;
  onClose: () => void;
}) {
  // Frozen while open: the preview must not drift under your thumb as the clock
  // ticks, and "in 25 min" recomputing mid-type is just noise.
  const now = useMemo(() => Date.now(), [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [pm, setPm] = useState(true);

  // seed from whatever is already agreed, or from the next half hour
  useEffect(() => {
    if (!visible) return;
    const seed = splitClock(meetAt ?? now + 30 * 60_000);
    setHour(String(seed.hour12));
    setMinute(String(seed.minute).padStart(2, '0'));
    setPm(seed.pm);
  }, [visible, meetAt, now]);

  const resolved = resolveMeetTime(Number(hour), Number(minute), pm, now);

  return (
    <AnchoredCard visible={visible} anchorTop={anchorTop} anchor="right" style={styles.card} onClose={onClose}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{meetAt ? 'Meeting time' : 'When are we meeting?'}</Text>
          <Text style={styles.sub}>
            {/* the resolved time, live — including the day, because typing 1:00
                at 11pm means tomorrow and the card must say so before you commit */}
            {formatMeetTime(resolved, now)} · {untilLabel(resolved, now)}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <MaterialCommunityIcons name="close" size={18} color={UI.textDim} />
        </Pressable>
      </View>

      <View style={styles.clock}>
        <TextInput
          style={styles.digits}
          value={hour}
          onChangeText={(t) => setHour(t.replace(/\D/g, '').slice(0, 2))}
          keyboardType="number-pad"
          selectTextOnFocus
          maxLength={2}
          returnKeyType="done"
        />
        <Text style={styles.colon}>:</Text>
        <TextInput
          style={styles.digits}
          value={minute}
          onChangeText={(t) => setMinute(t.replace(/\D/g, '').slice(0, 2))}
          onBlur={() => setMinute((m) => String(Math.min(59, Number(m) || 0)).padStart(2, '0'))}
          keyboardType="number-pad"
          selectTextOnFocus
          maxLength={2}
          returnKeyType="done"
        />
        <View style={styles.meridiem}>
          {(['AM', 'PM'] as const).map((label) => {
            const on = (label === 'PM') === pm;
            return (
              <Pressable
                key={label}
                style={[styles.mBtn, on && styles.mBtnOn]}
                onPress={() => setPm(label === 'PM')}
              >
                <Text style={[styles.mText, on && styles.mTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable style={styles.set} onPress={() => onSet(resolved)}>
        <Text style={styles.setText}>Set meeting time</Text>
      </Pressable>

      <View style={styles.quickRow}>
        {QUICK_MIN.map((m) => (
          <Pressable key={m} style={styles.quick} onPress={() => onSet(now + m * 60_000)}>
            <Text style={styles.quickText}>{m < 60 ? `+${m} min` : `+${m / 60} hr`}</Text>
          </Pressable>
        ))}
        {/* Clearing is a real choice, not an escape hatch: a group can decide
            they're not on a clock after all, and every card drops back to a
            plain ETA. */}
        <Pressable style={styles.quick} onPress={() => onSet(null)} disabled={meetAt == null}>
          <Text style={[styles.quickText, meetAt == null && styles.quickOff]}>None</Text>
        </Pressable>
      </View>
    </AnchoredCard>
  );
}

const styles = StyleSheet.create({
  // hangs off the right edge, under the time chip — the destination card spans
  // the bar because a search needs the room; a clock does not
  card: { width: 266 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { color: UI.text, fontSize: 14.5, fontWeight: '800' },
  sub: { color: UI.brand, fontSize: 11.5, fontWeight: '700', marginTop: 2 },

  clock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  digits: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 10,
    paddingVertical: 10,
    color: UI.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  colon: { color: UI.textDim, fontSize: 20, fontWeight: '800', marginTop: -2 },
  meridiem: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mBtn: { paddingHorizontal: 10, paddingVertical: 5.5, alignItems: 'center' },
  mBtnOn: { backgroundColor: '#fff' },
  mText: { color: UI.textDim, fontSize: 11.5, fontWeight: '800' },
  mTextOn: { color: UI.bg },

  set: { backgroundColor: '#fff', borderRadius: 11, paddingVertical: 10, alignItems: 'center' },
  setText: { color: UI.bg, fontSize: 13.5, fontWeight: '700' },

  quickRow: { flexDirection: 'row', gap: 6 },
  quick: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 9,
    paddingVertical: 7,
    alignItems: 'center',
  },
  quickText: { color: UI.text, fontSize: 11, fontWeight: '700' },
  quickOff: { color: UI.textDim, opacity: 0.45 },
});
