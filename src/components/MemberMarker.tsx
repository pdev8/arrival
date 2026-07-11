import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { SimMember } from '../demo/simulation';
import { UI } from '../lib/colors';
import { formatEtaClock, formatLevel } from '../lib/geo';

interface Props {
  member: SimMember;
  /** current map camera rotation (deg) so arrows stay true when the map is rotated */
  mapHeading?: number;
  selected: boolean;
  /** invisible but still mounted (riding in a cluster) — unmounting would
      flash the photo on remount */
  hidden?: boolean;
  onPress: () => void;
}

/**
 * Photo-forward direction puck. The profile photo fills the whole teardrop —
 * three corners at full radius, the tip corner tightened — so the shape reads
 * as the photo itself leaning into the direction of travel. A small triangle
 * in the member's color pokes out past the pointed corner, like the sharpened
 * lead of a pencil, so the color leads the photo without tinting it. Idle
 * members relax back to a plain circle. The photo counter-rotates upright.
 */
export function MemberMarker({ member, mapHeading = 0, selected, hidden = false, onPress }: Props) {
  const moving = member.state === 'walking' || member.state === 'driving';
  const rot = moving ? member.heading - mapHeading + 45 : 0;

  return (
    <Marker
      coordinate={member.pos}
      anchor={{ x: 0.5, y: 0.4 }}
      onPress={hidden ? undefined : onPress}
      tappable={!hidden}
      opacity={hidden ? 0 : 1}
      tracksViewChanges
      zIndex={member.isYou ? 20 : 10}
    >
      <View style={styles.wrap}>
        <View style={[styles.holder, { transform: [{ rotate: `${rot}deg` }] }]}>
          {/* pencil lead: a mini teardrop nosing out past the drop's corner — softly
              rounded point outside, the rest hidden under the photo */}
          {moving && <View style={[styles.tip, { backgroundColor: member.color }]} />}
          <View
            style={[
              styles.drop,
              { borderColor: member.color },
              !moving && styles.idle,
              selected && styles.selected,
            ]}
          >
            <Image
              source={member.avatar}
              fadeDuration={0}
              style={[styles.photo, { transform: [{ rotate: `${-rot}deg` }] }]}
            />
          </View>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagName}>{member.name}</Text>
          {/* off street level: B1 / F2 chip so verticality reads on the map */}
          {member.level != null && (
            <Text style={styles.tagLevel}>{formatLevel(member.level)}</Text>
          )}
          {/* paused reads inside the timer itself: ❚❚ next to the frozen clock */}
          {member.state === 'stopped' && (
            <MaterialCommunityIcons name="pause" size={10} color={member.color} />
          )}
          <Text style={[styles.tagEta, { color: member.color }]}>
            {member.state === 'arrived' ? 'here' : formatEtaClock(member.etaMin)}
          </Text>
        </View>
      </View>
    </Marker>
  );
}

const SIZE = 44;
const R = SIZE / 2;
const PHOTO = Math.ceil(SIZE * 1.45); // oversized so counter-rotation never exposes corners
const HOLDER = 64; // headroom for the pencil tip to clear the drop's corner

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  holder: {
    width: HOLDER,
    height: HOLDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drop: {
    width: SIZE,
    height: SIZE,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14161C',
    borderTopLeftRadius: 8, // the tip
    borderTopRightRadius: R,
    borderBottomLeftRadius: R,
    borderBottomRightRadius: R,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  idle: { borderTopLeftRadius: R },
  selected: { borderWidth: 3.5 },
  photo: { width: PHOTO, height: PHOTO },
  // Mini drop aligned with the big one: its rounded point clears the photo's
  // corner by ~7.5px; the side corners taper into the colored ring, and the
  // rest hides under the photo.
  tip: {
    position: 'absolute',
    left: 7,
    top: 7,
    width: 13,
    height: 13,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 4,
    backgroundColor: UI.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  tagName: { color: UI.text, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.1 },
  tagLevel: {
    color: UI.text,
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  tagEta: { fontSize: 10.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
