import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { SimMember } from '../demo/simulation';
import { UI } from '../lib/colors';
import { LatLng } from '../lib/geo';

interface Props {
  members: SimMember[];
  center: LatLng;
  onPress: () => void;
}

/**
 * Members close together merge into one marker: a facepile of overlapping
 * avatars (up to four, remainder as a +N chip) over a single label.
 */
export function ClusterMarker({ members, center, onPress }: Props) {
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  const label =
    members.length === 2 ? `${members[0].name} & ${members[1].name}` : `${members.length} together`;

  return (
    <Marker coordinate={center} anchor={{ x: 0.5, y: 0.4 }} onPress={onPress} tracksViewChanges zIndex={15}>
      <View style={styles.wrap}>
        <View style={styles.pile}>
          {shown.map((m, i) =>
            m.avatar ? (
              <Image
                key={m.id}
                source={m.avatar}
                fadeDuration={0}
                style={[
                  styles.face,
                  { borderColor: m.color, marginLeft: i === 0 ? 0 : -14, zIndex: shown.length - i },
                ]}
              />
            ) : (
              <View
                key={m.id}
                style={[
                  styles.face,
                  styles.faceInitial,
                  { borderColor: m.color, marginLeft: i === 0 ? 0 : -14, zIndex: shown.length - i },
                ]}
              >
                <Text style={styles.faceInitialText}>{m.name[0]?.toUpperCase()}</Text>
              </View>
            )
          )}
          {extra > 0 && (
            <View style={[styles.face, styles.more]}>
              <Text style={styles.moreText}>+{extra}</Text>
            </View>
          )}
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{label}</Text>
        </View>
      </View>
    </Marker>
  );
}

const FACE = 38;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pile: { flexDirection: 'row', alignItems: 'center' },
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    borderWidth: 2,
    backgroundColor: '#14161C',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  more: {
    marginLeft: -14,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.chip,
  },
  moreText: { color: UI.text, fontSize: 12, fontWeight: '700' },
  faceInitial: { alignItems: 'center', justifyContent: 'center' },
  faceInitialText: { color: UI.text, fontSize: 14, fontWeight: '800' },
  tag: {
    marginTop: 4,
    backgroundColor: UI.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  tagText: { color: UI.text, fontSize: 10.5, fontWeight: '700' },
});
