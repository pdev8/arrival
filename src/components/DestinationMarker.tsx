import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { LatLng } from '../lib/geo';
import { UI } from '../lib/colors';

/** The checkered destination flag with its name tag. */
/**
 * The flag. ALWAYS MOUNTED, even in free roam when there is no destination yet
 * — an invisible slot instead of an absent child, because mounting a marker
 * mid-session re-adds every annotation on the map and flashes MapKit's default
 * pin (see .claude/skills/arrival-map/SKILL.md). `visible` drives opacity, not
 * mounting.
 */
export function DestinationMarker({
  name,
  pos,
  visible = true,
  onPress,
}: {
  name: string;
  pos: LatLng;
  visible?: boolean;
  onPress?: () => void;
}) {
  return (
    <Marker
      coordinate={pos}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={8}
      opacity={visible ? 1 : 0}
      tappable={visible}
      onPress={onPress}
    >
      <View style={styles.wrap}>
        <View style={styles.pin}>
          <MaterialCommunityIcons name="flag-checkered" size={15} color={UI.text} />
        </View>
        <View style={styles.tag}>
          <Text style={styles.label}>{name}</Text>
          {onPress && <Text style={styles.nav}>navigate ›</Text>}
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: UI.chip,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  tag: {
    marginTop: 4,
    backgroundColor: UI.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  label: { color: UI.text, fontSize: 10.5, fontWeight: '700' },
  nav: { color: UI.textDim, fontSize: 9.5, fontWeight: '600', marginTop: 0.5 },
});
