import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  radius?: number;
}

/**
 * Frosted panel: a hairline stroke over truly translucent glass. The ultra-thin
 * material matters — the plain 'dark' tint is itself ~80% smoke, which made
 * every panel read as opaque no matter how low our own fill went.
 */
export function Glass({ children, style, intensity = 36, radius = 18 }: Props) {
  return (
    <BlurView
      intensity={intensity}
      tint="systemUltraThinMaterialDark"
      experimentalBlurMethod="dimezisBlurView"
      style={[styles.glass, { borderRadius: radius }, style]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  glass: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(13,15,20,0.18)',
  },
});
