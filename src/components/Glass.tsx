import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';

interface Props {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  radius?: number;
}

/** Frosted panel: near-black glass with a hairline stroke. */
export function Glass({ children, style, intensity = 45, radius = 18 }: Props) {
  return (
    <BlurView
      intensity={intensity}
      tint="dark"
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
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(11,13,18,0.62)',
  },
});
