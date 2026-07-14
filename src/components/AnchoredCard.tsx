import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Glass } from './Glass';

/** how far the content travels before we've measured it — overshoot is clipped,
 *  so a generous guess costs nothing and a short one would pop */
const ASSUMED_H = 420;

/**
 * A card that UNROLLS OUT FROM UNDER THE SESSION BAR.
 *
 * It is CLIPPED and SLID, not scaled. That distinction is the whole thing: a
 * scaling card is entirely present the whole time and just gets bigger, which
 * the eye reads as a pop. This one is genuinely revealed top to bottom — the
 * content starts above the clip box and slides down into it, so the card emerges
 * from beneath the bar the way a drawer comes out of a cabinet.
 *
 * THE MODAL MUST OUTLIVE `visible`. `<Modal visible={false}>` unmounts on the
 * spot, so a close animation driven off the same flag never plays a single
 * frame — the card just vanishes. That was half of why this "popped": it wasn't
 * only opening wrong, it wasn't closing at all. `mounted` keeps the modal alive
 * until the animation reports finished.
 *
 * THE BACKDROP GOES FIRST — rendered after the card, a full-screen Pressable
 * sits on top of it and swallows every tap, so the card looks perfect and does
 * nothing. That shipped once, and destination search was dead for a release.
 * See src/sheets-contract.test.ts.
 */
export function AnchoredCard({
  visible,
  /** the session bar's MEASURED height plus the standard gap — the card unrolls
   *  from exactly where the map chips sit */
  anchorTop,
  /** which chip it belongs to: the destination (left) or the time (right) */
  anchor,
  style,
  onClose,
  children,
}: {
  visible: boolean;
  anchorTop: number;
  anchor: 'left' | 'right';
  style?: ViewStyle;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const open = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  /** the card's own height — the exact distance it has to travel to unroll */
  const [contentH, setContentH] = useState(0);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(open, {
      toValue: visible ? 1 : 0,
      duration: visible ? 240 : 170,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // only now may the modal go — see the note above
      if (!visible && finished) setMounted(false);
    });
  }, [visible, open]);

  const slide = open.interpolate({
    inputRange: [0, 1],
    outputRange: [-(contentH || ASSUMED_H), 0],
  });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <Animated.View
        style={[
          styles.card,
          // 12pt margins, matching the session bar's. A left-anchored card spans
          // the bar (a search needs the room); a right-anchored one hangs off the
          // right edge and takes its width from the caller (a clock doesn't).
          anchor === 'right' ? styles.right : styles.left,
          { top: anchorTop },
          style,
          { opacity: open },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.clip}>
          <Animated.View
            onLayout={(e) => setContentH(e.nativeEvent.layout.height)}
            style={{ transform: [{ translateY: slide }] }}
          >
            <Glass style={styles.sheet} radius={18} intensity={60}>
              {children}
            </Glass>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  card: { position: 'absolute' },
  left: { left: 12, right: 12 },
  right: { right: 12 },
  // the cabinet the drawer comes out of: everything above it is cut away, which
  // is what turns a slide into a reveal
  clip: { overflow: 'hidden', borderRadius: 18 },
  sheet: { padding: 12, gap: 10 },
});
