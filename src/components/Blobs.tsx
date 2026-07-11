import React from 'react';
import { StyleSheet, View } from 'react-native';
import { UI } from '../lib/colors';

/** Barely-there ambient light behind glass surfaces — depth without noise. */
export function Blobs() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.glow, { top: -180, right: -140, backgroundColor: UI.accent }]} />
      <View style={[styles.glow, { bottom: -220, left: -160, backgroundColor: '#8B7CF6' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 999,
    opacity: 0.07,
  },
});
