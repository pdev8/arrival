import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { UI } from '../lib/colors';

/**
 * A tiny person walking in profile: legs scissor from the hip, arms swing
 * opposite from the shoulder, far-side limbs dimmed, slight forward lean and
 * a bob per stride. Limb wrappers are twice the limb's length with the limb
 * in the bottom half, so rotating the wrapper pivots the limb at its joint.
 */
export function WalkingIcon() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 360, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  const swing = (from: string, to: string) =>
    t.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const bob = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -0.8, 0] });
  return (
    <Animated.View style={[walker.figure, { transform: [{ translateY: bob }, { rotate: '6deg' }] }]}>
      <Animated.View style={[walker.armPivot, walker.far, { transform: [{ rotate: swing('30deg', '-30deg') }] }]}>
        <View style={walker.arm} />
      </Animated.View>
      <Animated.View style={[walker.legPivot, walker.far, { transform: [{ rotate: swing('-26deg', '26deg') }] }]}>
        <View style={walker.leg} />
      </Animated.View>
      <View style={walker.head} />
      <View style={walker.torso} />
      <Animated.View style={[walker.legPivot, { transform: [{ rotate: swing('26deg', '-26deg') }] }]}>
        <View style={walker.leg} />
      </Animated.View>
      <Animated.View style={[walker.armPivot, { transform: [{ rotate: swing('-30deg', '30deg') }] }]}>
        <View style={walker.arm} />
      </Animated.View>
    </Animated.View>
  );
}

const walker = StyleSheet.create({
  figure: { width: 11, height: 15, alignItems: 'center' },
  head: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: UI.textDim },
  torso: { width: 2, height: 4.5, borderRadius: 1, backgroundColor: UI.textDim, marginTop: 0.5 },
  far: { opacity: 0.5 },
  armPivot: { position: 'absolute', left: 4.75, top: 0, width: 1.5, height: 9 },
  arm: { position: 'absolute', top: 4.5, width: 1.5, height: 4.5, borderRadius: 1, backgroundColor: UI.textDim },
  legPivot: { position: 'absolute', left: 4.5, top: 2.5, width: 2, height: 12 },
  leg: { position: 'absolute', top: 6, width: 2, height: 6, borderRadius: 1, backgroundColor: UI.textDim },
});
