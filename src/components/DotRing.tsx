import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { UI } from '../lib/colors';

/**
 * How many of `count` dots are COMPLETE at `progress` — the ring's whole visual
 * state, and the index of the dot currently being earned.
 *
 * FLOOR, not round. A dot lights when its slice of the route is actually
 * covered, not when it's half covered, and that matters far more than it sounds:
 * the dot at THIS index is the one in progress — the one that blinks. Rounding
 * made a dot go solid at 50%, so the blinking dot was the NEXT one along, which
 * hadn't been started. The ring was calling half-finished work done and then
 * cheering for work nobody had begun.
 */
export function filledDots(progress: number, count: number): number {
  return Math.floor(Math.min(1, Math.max(0, progress)) * count);
}

/**
 * Progress as a ring of dots around an avatar — dots fill clockwise from 12
 * o'clock as the member covers their route. Pure views (no SVG dependency),
 * and unlike an arc it reads at a glance even at chip size.
 *
 * THE DOT IN PROGRESS BREATHES — the one being earned right now, blinking until
 * it's complete, at which point it goes solid and the next one takes over. So
 * the ring reads as work in PROGRESS rather than a static score: you can see
 * someone earning a dot, not merely sitting on the last one. It's the difference
 * between a progress bar and a spinner, and a group map wants both.
 *
 * It breathes only when there is genuinely something in progress (`isProgressing`
 * in lib/format). A stopped member's ring holds perfectly still — which is
 * information too: nothing is happening there.
 *
 * Memoized on the FILLED COUNT, not raw progress: progress changes every
 * simulation tick, but the ring only looks different when a dot flips.
 */
export const DotRing = React.memo(DotRingInner, (prev, next) =>
  prev.size === next.size &&
  prev.color === next.color &&
  (prev.count ?? 12) === (next.count ?? 12) &&
  (prev.dot ?? 3) === (next.dot ?? 3) &&
  (prev.pulse ?? false) === (next.pulse ?? false) &&
  filledDots(prev.progress, prev.count ?? 12) === filledDots(next.progress, next.count ?? 12)
);

function DotRingInner({
  size,
  progress,
  color,
  count = 12,
  dot = 3,
  pulse = false,
}: {
  size: number;
  progress: number;
  color: string;
  count?: number;
  dot?: number;
  /** breathe the dot in progress — this member is actively closing the gap */
  pulse?: boolean;
}) {
  const r = size / 2 - dot / 2;
  const filled = filledDots(progress, count);
  /**
   * The dot being earned RIGHT NOW — the first incomplete one. It blinks until
   * it's complete, then goes solid and the next one takes over. None once the
   * ring is full: there's nothing left to earn.
   */
  const current = filled < count ? filled : -1;
  const breath = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse || current < 0) {
      breath.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 0.2,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, current, breath]);

  return (
    <View style={{ position: 'absolute', width: size, height: size }} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * 2 * Math.PI - Math.PI / 2;
        const breathing = pulse && i === current;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: size / 2 + r * Math.cos(a) - dot / 2,
              top: size / 2 + r * Math.sin(a) - dot / 2,
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              // the dot in progress already wears the member's colour — it is being
              // earned, not merely empty
              backgroundColor: i < filled || breathing ? color : UI.track,
              opacity: breathing ? breath : 1,
            }}
          />
        );
      })}
    </View>
  );
}
