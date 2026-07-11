import React from 'react';
import { View } from 'react-native';
import { UI } from '../lib/colors';

/**
 * Progress as a ring of dots around an avatar — dots fill clockwise from 12
 * o'clock as the member covers their route. Pure views (no SVG dependency),
 * and unlike an arc it reads at a glance even at chip size.
 */
export function DotRing({
  size,
  progress,
  color,
  count = 12,
  dot = 3,
}: {
  size: number;
  progress: number;
  color: string;
  count?: number;
  dot?: number;
}) {
  const r = size / 2 - dot / 2;
  const filled = Math.round(Math.min(1, Math.max(0, progress)) * count);
  return (
    <View style={{ position: 'absolute', width: size, height: size }} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * 2 * Math.PI - Math.PI / 2;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: size / 2 + r * Math.cos(a) - dot / 2,
              top: size / 2 + r * Math.sin(a) - dot / 2,
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: i < filled ? color : UI.track,
            }}
          />
        );
      })}
    </View>
  );
}
