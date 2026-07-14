import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Glass } from './Glass';

/**
 * A card that UNFOLDS OUT OF THE CHIP YOU TAPPED.
 *
 * The session sheets used to fall from the top edge of the screen, which made
 * them look like they came from nowhere. These hang off the bottom of the
 * session bar, aligned with the control that opened them, and scale up from that
 * corner — so the chip visibly becomes the card.
 *
 * The unfold is scaleY from 0.7 with the origin pinned to the anchor corner:
 * the card grows DOWNWARD out of the chip rather than swelling from its own
 * middle. scaleX barely moves (0.96) because a card that stretches sideways
 * reads as a zoom, not an opening.
 *
 * THE BACKDROP GOES FIRST — rendered after the card, a full-screen Pressable
 * sits on top of it and swallows every tap, so the card looks perfect and does
 * nothing. That shipped once. See src/sheets-contract.test.ts.
 */
export function AnchoredCard({
  visible,
  /** the session bar's MEASURED height — the card hangs off its bottom edge */
  anchorTop,
  /** which chip it grew from: the destination (left) or the time (right) */
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
  useEffect(() => {
    Animated.timing(open, {
      toValue: visible ? 1 : 0,
      duration: visible ? 210 : 140,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, open]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <Animated.View
        style={[
          styles.card,
          // 12pt margins, matching the session bar's, so the card lands UNDER its
          // chip rather than floating somewhere near it. A right-anchored card
          // hangs off the right edge and takes its width from the caller; a
          // left-anchored one spans the bar.
          anchor === 'right' ? styles.right : styles.left,
          // exactly where the caller says — the chips under the bar use the same
          // offset, so a card opens ON them rather than near them
          { top: anchorTop, transformOrigin: anchor === 'right' ? 'top right' : 'top left' },
          style,
          {
            opacity: open,
            transform: [
              { scaleX: open.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              { scaleY: open.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
              { translateY: open.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
            ],
          },
        ]}
      >
        <Glass style={styles.sheet} radius={18} intensity={60}>
          {children}
        </Glass>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  card: { position: 'absolute' },
  left: { left: 12, right: 12 },
  right: { right: 12 },
  sheet: { padding: 12, gap: 10 },
});
