import React from 'react';
import { Image, ImageSourcePropType, Text, View } from 'react-native';
import { UI } from '../lib/colors';
import { DotRing } from './DotRing';

/**
 * The shared identity unit: an avatar wrapped in a DotRing of route progress.
 * Green ring when arrived; member color while en route.
 */
export function AvatarRing({
  source,
  name = '?',
  size,
  avatarSize,
  progress,
  color,
  arrived = false,
  count = 14,
  pulse = false,
}: {
  /** photo when we have one; falls back to an initial on the member color */
  source?: ImageSourcePropType;
  name?: string;
  size: number;
  avatarSize: number;
  progress: number;
  color: string;
  arrived?: boolean;
  count?: number;
  /** breathe the dot being earned right now — work in progress, not a score */
  pulse?: boolean;
}) {
  const face = { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {source ? (
        <Image source={source} fadeDuration={0} style={[face, { backgroundColor: '#14161C' }]} />
      ) : (
        <View style={[face, { backgroundColor: `${color}33`, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: UI.text, fontSize: avatarSize * 0.42, fontWeight: '800' }}>{name[0]?.toUpperCase()}</Text>
        </View>
      )}
      <DotRing
        size={size}
        progress={progress}
        color={arrived ? UI.success : color}
        count={count}
        pulse={pulse}
      />
    </View>
  );
}
