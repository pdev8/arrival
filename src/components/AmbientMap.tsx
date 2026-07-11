import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';
import { LatLng } from '../lib/geo';

const WSP: LatLng = { latitude: 40.7308, longitude: -73.9973 };

/**
 * A live map as ambient background: non-interactive, dimmed under a scrim,
 * drifting slowly so the page feels alive. The glass panels above it blur
 * something real instead of a flat color — the whole point of the material.
 */
export function AmbientMap({ center = WSP, zoom = 14.2 }: { center?: LatLng; zoom?: number }) {
  const ref = useRef<MapView>(null);

  useEffect(() => {
    let flip = false;
    const drift = () => {
      ref.current?.animateCamera(
        {
          center: {
            latitude: center.latitude + (flip ? 0.0035 : -0.0035),
            longitude: center.longitude + (flip ? -0.002 : 0.002),
          },
          heading: flip ? 12 : -12,
          zoom,
          pitch: 0,
        },
        { duration: 16000 }
      );
      flip = !flip;
    };
    const t = setTimeout(drift, 400); // first drift once the map settles
    const id = setInterval(drift, 17000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [center.latitude, center.longitude, zoom]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialCamera={{ center, zoom, heading: -12, pitch: 0 }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        showsBuildings={false}
        toolbarEnabled={false}
      />
      <View style={styles.scrim} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9,11,16,0.62)' },
});
