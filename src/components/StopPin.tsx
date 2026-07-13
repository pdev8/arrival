import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { SessionStop } from '../demo/simulation';
import { UI } from '../lib/colors';
import { LatLng } from '../lib/geo';
import { CATEGORY_ICON } from '../lib/icons';

interface Props {
  /** undefined = an EMPTY SLOT: mounted, invisible, not tappable. See below. */
  stop?: SessionStop;
  memberColor: string;
  /** where an empty slot parks (never seen — it's transparent) */
  fallbackPos: LatLng;
  onPress?: () => void;
}

const NOOP = () => {};

/**
 * Dark chip pin with a category glyph; suggestions render dashed until confirmed.
 *
 * Stop pins are a FIXED POOL (see MAX_STOP_PINS in session.tsx), because stops
 * are created at RUNTIME — scripted ones fire ~20s into a session, and you can
 * long-press to add your own. Pushing a new pin used to GROW MapView's child
 * list, and per the map contract that re-adds EVERY marker annotation: MapKit
 * re-queries viewForAnnotation, the brand-new pin's react children aren't
 * attached yet, so rn-maps returns an MKMarkerAnnotationView — a big red
 * balloon (the "dot splatter") — and the re-add can lose other markers' custom
 * views entirely. Slots therefore mount once and stay mounted; unused ones
 * carry opacity 0, which is a plain UIView alpha write that never re-queries
 * the annotation.
 *
 * The child view is ALWAYS rendered (even when empty) so reactSubviews.count is
 * never 0 — that's the condition rn-maps uses to decide it should hand back a
 * default pin.
 */
export function StopPin({ stop, memberColor, fallbackPos, onPress = NOOP }: Props) {
  const proposed = stop?.kind === 'suggestion' && stop?.status === 'proposed';
  const done = stop?.status === 'done';
  return (
    <Marker
      coordinate={stop?.pos ?? fallbackPos}
      anchor={{ x: 0.5, y: 1 }}
      onPress={onPress}
      opacity={stop ? 1 : 0}
      tappable={!!stop}
      tracksViewChanges
      zIndex={5}
    >
      <View style={[styles.pin, { borderColor: memberColor }, proposed && styles.proposed, done && styles.done]}>
        <MaterialCommunityIcons name={CATEGORY_ICON[stop?.category ?? 'other']} size={15} color={UI.text} />
      </View>
      <View style={[styles.stem, { backgroundColor: memberColor }, done && styles.done]} />
    </Marker>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: UI.chip,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  proposed: { borderStyle: 'dashed' },
  done: { opacity: 0.35 },
  stem: { width: 2, height: 7, alignSelf: 'center', borderRadius: 1 },
});
