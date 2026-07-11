import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { SimMember } from '../demo/simulation';
import { UI } from '../lib/colors';
import { formatEtaClock } from '../lib/geo';

interface Props {
  member: SimMember;
  /** current map camera rotation (deg) so arrows stay true when the map is rotated */
  mapHeading?: number;
  selected: boolean;
  onPress: () => void;
}

/**
 * Photo-forward direction puck. The profile photo fills the whole teardrop —
 * three corners at full radius, the tip corner tightened — so the shape reads
 * as the photo itself leaning into the direction of travel. A thin ring in the
 * member's color plus a dark halo keep it legible on any tile. Idle members
 * relax back to a plain circle. The photo counter-rotates to stay upright.
 */
export function MemberMarker({ member, mapHeading = 0, selected, onPress }: Props) {
  const moving = member.state === 'walking' || member.state === 'driving';
  const rot = moving ? member.heading - mapHeading + 45 : 0;

  return (
    <Marker
      coordinate={member.pos}
      anchor={{ x: 0.5, y: 0.4 }}
      onPress={onPress}
      tracksViewChanges
      zIndex={member.isYou ? 20 : 10}
    >
      <View style={styles.wrap}>
        <View style={[styles.holder, { transform: [{ rotate: `${rot}deg` }] }]}>
          {/* liquid tip: translucent color layers in the teardrop's own shape,
              offset toward the tip so they bleed out ahead of the photo */}
          {moving && <View style={[styles.glowOuter, { backgroundColor: member.color }]} />}
          {moving && <View style={[styles.glowInner, { backgroundColor: member.color }]} />}
          <View
            style={[
              styles.drop,
              { borderColor: member.color },
              !moving && styles.idle,
              selected && styles.selected,
            ]}
          >
            <Image
              source={{ uri: member.avatarUrl }}
              style={[styles.photo, { transform: [{ rotate: `${-rot}deg` }] }]}
            />
          </View>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagName}>{member.name}</Text>
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
const HOLDER = 64; // headroom for the liquid tip to bleed past the drop

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  holder: {
    width: HOLDER,
    height: HOLDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: HOLDER,
    height: HOLDER,
    opacity: 0.16,
    borderTopLeftRadius: 14,
    borderTopRightRadius: HOLDER / 2,
    borderBottomLeftRadius: HOLDER / 2,
    borderBottomRightRadius: HOLDER / 2,
  },
  glowInner: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 56,
    height: 56,
    opacity: 0.34,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
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
  tagEta: { fontSize: 10.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
