import { Linking, Platform } from 'react-native';
import { LatLng } from './geo';

/**
 * Open a pin in the platform's maps app with directions — Arrival is the
 * coordination layer, not the navigator (SPEC F8). Falls back to Google Maps
 * on the web if no native handler takes the URL.
 */
export function navigateTo(pos: LatLng, label: string, mode: 'walk' | 'drive' = 'walk') {
  const q = `${pos.latitude},${pos.longitude}`;
  const url =
    Platform.OS === 'ios'
      ? `maps://?daddr=${q}&dirflg=${mode === 'walk' ? 'w' : 'd'}&q=${encodeURIComponent(label)}`
      : `google.navigation:q=${q}&mode=${mode === 'walk' ? 'w' : 'd'}`;
  const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=${mode === 'walk' ? 'walking' : 'driving'}`;
  Linking.openURL(url).catch(() => Linking.openURL(webFallback).catch(() => {}));
}
