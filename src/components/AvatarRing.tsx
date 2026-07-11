import React from 'react';
import { Image, ImageSourcePropType, View } from 'react-native';
import { UI } from '../lib/colors';
import { DotRing } from './DotRing';

/**
 * The shared identity unit: an avatar wrapped in a DotRing of route progress.
 * Green ring when arrived; member color while en route.
 */
export function AvatarRing({
  source,
  size,
  avatarSize,
  progress,
  color,
  arrived = false,
  count = 14,
}: {
  source: ImageSourcePropType;
  size: number;
  avatarSize: number;
  progress: number;
  color: string;
  arrived?: boolean;
  count?: number;
}) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={source}
        fadeDuration={0}
        style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: '#14161C' }}
      />
      <DotRing size={size} progress={progress} color={arrived ? UI.success : color} count={count} />
    </View>
  );
}
