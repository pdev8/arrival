import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { SimMember } from '../demo/simulation';
import { UI } from '../lib/colors';
import { formatLevel, memberHeadline } from '../lib/format';

interface Props {
  member: SimMember;
  /** current map camera rotation (deg) so arrows stay true when the map is rotated */
  mapHeading?: number;
  selected: boolean;
  /** changes every few seconds — breaks memoization so every marker gets a
      periodic prop nudge, repainting views the native side silently lost */
  repaintTick?: number;
  onPress: () => void;
}

/**
 * Photo-forward direction puck. The profile photo fills the whole teardrop —
 * three corners at full radius, the tip corner tightened — so the shape reads
 * as the photo itself leaning into the direction of travel. A small triangle
 * in the member's color pokes out past the pointed corner, like the sharpened
 * lead of a pencil, so the color leads the photo without tinting it. Idle
 * members relax back to a plain circle. The photo counter-rotates upright.
 *
 * THE CHURN RULE (why this file is split in two):
 * A moving member's coordinate changes 4x/second. That MUST reach the native
 * annotation — it's how the puck moves — but it must NOT re-render the custom
 * child view, because churning a custom marker view is exactly what makes
 * Apple Maps + New Arch drop it (#5911), and a dropped view never comes back.
 * So <Marker> takes the live coordinate while its child is a separately
 * memoized <Puck> that knows nothing about position. Walking a member now
 * re-renders zero child views. Everything the puck DOES draw is quantized to
 * change rarely: heading to 5°, ETA to whole minutes (formatEtaCoarse — the
 * rail and card carry the live countdown instead).
 *
 * SELECTION DOES NOT TOUCH THE PUCK. It used to thicken the border, which
 * recreated the native view on every swipe — Apple Maps flashes its default
 * pin ("a big bright dot") while a custom view is rebuilt, and when the
 * rebuild fails the puck is simply gone. Selection is already unmistakable:
 * the camera flies to them and their card is up. Don't add a selected style
 * back here.
 */
export const MemberMarker = React.memo(
  MemberMarkerInner,
  (prev, next) =>
    prev.selected === next.selected &&
    prev.repaintTick === next.repaintTick &&
    Math.round(prev.mapHeading ?? 0) === Math.round(next.mapHeading ?? 0) &&
    prev.member.id === next.member.id &&
    prev.member.pos.latitude === next.member.pos.latitude &&
    prev.member.pos.longitude === next.member.pos.longitude &&
    prev.member.name === next.member.name &&
    prev.member.color === next.member.color &&
    prev.member.state === next.member.state &&
    prev.member.moving === next.member.moving &&
    prev.member.left === next.member.left &&
    prev.member.level === next.member.level &&
    headingBucket(prev.member.heading) === headingBucket(next.member.heading) &&
    Math.round((prev.member.etaMin ?? -1)) === Math.round((next.member.etaMin ?? -1)) &&
    // slack has to be here in its own right: a member standing perfectly still
    // has a FROZEN eta and still gets later as the meeting approaches. Without
    // this their tag would say "5 late" forever.
    minuteBucket(prev.member.slackMin) === minuteBucket(next.member.slackMin) &&
    Math.round(prev.member.traveledM / 50) === Math.round(next.member.traveledM / 50)
);

/** 5° buckets, and a bucket of its own for "we don't know" — which is emphatically
 *  not the same as 0°, which is due north. */
const headingBucket = (h: number | null) => (h == null ? -1 : Math.round(h / 5));
/** whole minutes, with a bucket for "no meeting time" that no real value can hit */
const minuteBucket = (n: number | null | undefined) => (n == null ? Infinity : Math.round(n));

function MemberMarkerInner({ member, mapHeading = 0, selected, repaintTick: _repaintTick, onPress }: Props) {
  // THREE HONEST STATES, and the third one is the whole point:
  //
  //   moving  — we know their course and they're travelling it: full lean, lit tip
  //   paused  — we know it, but they're standing (a light, a shoelace): lean, dim tip
  //   still   — WE DON'T KNOW, and we say so by drawing nothing: a plain circle
  //
  // "Still" covers the person who never moved, the one who's been stopped long
  // enough that their old course is a lie, and the one whose fixes are too vague
  // to call (lib/motion decides which). Its emptiness is information: nobody has
  // to guess whether that puck is about to go somewhere.
  //
  // Arrived and departed members are never "known" — they aren't heading
  // anywhere, and a leaning puck at the destination reads as still walking.
  const known = member.heading != null && member.state !== 'arrived' && !member.left;
  const moving = known && member.moving;
  // quantized so the child view's props change rarely, not every tick
  const rot = known ? Math.round((member.heading! - mapHeading) / 5) * 5 + 45 : 0;

  return (
    <Marker
      coordinate={member.pos}
      anchor={{ x: 0.5, y: 0.4 }}
      onPress={onPress}
      tracksViewChanges
      zIndex={selected ? 30 : member.isYou ? 20 : 10}
    >
      <Puck
        name={member.name}
        color={member.color}
        avatar={member.avatar}
        state={member.state}
        level={member.level}
        left={!!member.left}
        etaMin={member.etaMin}
        slackMin={member.slackMin}
        traveledM={member.traveledM}
        rot={rot}
        moving={moving}
        known={known}
      />
    </Marker>
  );
}

interface PuckProps {
  name: string;
  color: string;
  avatar?: SimMember['avatar'];
  state: SimMember['state'];
  level: number | null;
  left: boolean;
  etaMin: number | null;
  /** early (+) / late (−) against the meeting time — the tag says this when it
   *  exists, because "8 late" beats "12m" every time */
  slackMin: number | null;
  traveledM: number;
  rot: number;
  /** travelling right now — the tip is lit */
  moving: boolean;
  /** we have a course at all — false means the puck shows no direction */
  known: boolean;
}

/**
 * The marker's custom view. Knows NOTHING about position — that's the point:
 * it must not re-render while a member walks. Memoized on the coarse values it
 * actually draws, so its native view tree is created once and left alone.
 */
const Puck = React.memo(
  function Puck({ name, color, avatar, state, level, left, etaMin, slackMin, traveledM, rot, moving, known }: PuckProps) {
    // A meeting time → "8 late". A destination → "12m". Free roam → distance
    // covered. Always the COARSE form: a live m:ss countdown inside a marker
    // re-renders its custom view every second, and that is how Apple Maps loses
    // pucks (see the map contract).
    const eta = memberHeadline({ etaMin, slackMin, left, state, traveledM }, true);
    return (
      <View style={[styles.wrap, left && styles.leftDim]}>
        <View style={[styles.holder, { transform: [{ rotate: `${rot}deg` }] }]}>
          {/* Pencil lead: a mini teardrop nosing out past the drop's corner —
              softly rounded point outside, the rest hidden under the photo.
              ALWAYS MOUNTED, hidden with opacity. It used to render as
              `{moving && <View/>}`, which was survivable only because `moving`
              almost never changed; the motion gate makes it change for real, and
              adding or removing a subview of a live annotation view is exactly
              the churn that makes Apple Maps drop the whole puck (#5911). Lit
              while they travel, dimmed while they're paused with a course we
              still trust, invisible when we have no course to show. */}
          <View style={[styles.tip, { backgroundColor: color, opacity: tipOpacity(moving, known) }]} />
          <View
            style={[styles.drop, { borderColor: color }, !known && styles.idle]}
          >
            {avatar ? (
              <Image
                source={avatar}
                fadeDuration={0}
                style={[styles.photo, { transform: [{ rotate: `${-rot}deg` }] }]}
              />
            ) : (
              <View style={[styles.initialWrap, { backgroundColor: `${color}40`, transform: [{ rotate: `${-rot}deg` }] }]}>
                <Text style={styles.initial}>{name[0]?.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.tag}>
          {/* tag reads: name · time · level · pause */}
          <Text style={styles.tagName}>{name}</Text>
          <Text style={[styles.tagEta, left ? styles.tagLeft : { color }]}>{eta}</Text>
          {/* off street level: B1 / F2 chip so verticality reads on the map */}
          {!left && level != null && <Text style={styles.tagLevel}>{formatLevel(level)}</Text>}
          {!left && state === 'stopped' && (
            <MaterialCommunityIcons name="pause" size={10} color={color} />
          )}
        </View>
      </View>
    );
  },
  (p, n) =>
    p.name === n.name &&
    p.color === n.color &&
    p.avatar === n.avatar &&
    p.state === n.state &&
    p.level === n.level &&
    p.left === n.left &&
    p.rot === n.rot &&
    p.moving === n.moving &&
    p.known === n.known &&
    Math.round(p.etaMin ?? -1) === Math.round(n.etaMin ?? -1) &&
    minuteBucket(p.slackMin) === minuteBucket(n.slackMin) &&
    Math.round(p.traveledM / 50) === Math.round(n.traveledM / 50)
);

/** lit while travelling · dimmed while paused on a course we still trust · gone
 *  when there is no honest course to draw */
const tipOpacity = (moving: boolean, known: boolean) => (moving ? 1 : known ? 0.35 : 0);

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
  photo: { width: PHOTO, height: PHOTO },
  initialWrap: { width: PHOTO, height: PHOTO, alignItems: 'center', justifyContent: 'center' },
  initial: { color: UI.text, fontSize: 19, fontWeight: '800' },
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
    alignItems: 'center',
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
  tagLeft: { color: UI.textDim, fontSize: 10.5, fontWeight: '700' },
  leftDim: { opacity: 0.55 },
});
