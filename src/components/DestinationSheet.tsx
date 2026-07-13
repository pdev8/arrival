import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UI } from '../lib/colors';
import { formatDistance } from '../lib/format';
import { LatLng } from '../lib/geo';
import { Place, ratingLabel, searchDemoPlaces, searchPlaces } from '../lib/places';
import { Glass } from './Glass';

/**
 * Search for the place the group is heading to.
 *
 * THIS ONE OPENS FROM THE TOP, not the bottom, and that's not a style choice:
 * it's a search field, so the keyboard is always up, and a bottom sheet would
 * hand the keyboard exactly the space the results need. Dropping it from the
 * header — where you tapped — keeps the field under your thumb, the results in
 * the clear, and the keyboard in the dead space beneath them.
 *
 * A destination isn't a pin, it's a decision: each result says how far it is,
 * how well reviewed, and links out so you can look closer before committing
 * the group to walk there. Ratings and links are optional by design —
 * OpenStreetMap knows where things are but not what people think of them, and
 * a card without them must still look finished. (Yelp lands behind
 * lib/places' searchPlaces; this UI won't change.)
 */
export function DestinationSheet({
  visible,
  near,
  current,
  onSet,
  onPickOnMap,
  onClose,
}: {
  visible: boolean;
  /** where the group is now — results are ranked from here */
  near: LatLng;
  /** the name it already has, when changing rather than setting */
  current: string | null;
  onSet: (pos: LatLng, name: string) => void;
  onPickOnMap: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  // drop down from the top edge (Modal's own "slide" only comes up from below)
  const drop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(drop, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 180,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, drop]);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setResults(searchDemoPlaces('', near));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // debounced: a search per keystroke would hammer the provider and flicker
  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    const mine = ++seq.current;
    if (q.length < 2) {
      setResults(searchDemoPlaces(q, near));
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const found = await searchPlaces(q, near);
      if (seq.current !== mine) return; // a newer keystroke won
      setResults(found);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View
        style={[
          styles.dropWrap,
          {
            transform: [
              { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-420, 0] }) },
            ],
          },
        ]}
      >
        <SafeAreaView edges={['top']}>
          <Glass style={styles.sheet} radius={24} intensity={60}>
            <View style={styles.head}>
              <Text style={styles.title}>
                {current ? 'Change the destination' : 'Where are we heading?'}
              </Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={20} color={UI.textDim} />
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <MaterialCommunityIcons name="magnify" size={17} color={UI.textDim} />
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder="Coffee, a park, an address…"
                placeholderTextColor={UI.textDim}
                autoFocus
                returnKeyType="search"
              />
              {searching && <ActivityIndicator size="small" color={UI.textDim} />}
            </View>

            <FlatList
              data={results}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {searching ? 'Searching…' : 'Nothing found — try fewer words, or pick it on the map.'}
                </Text>
              }
              renderItem={({ item }) => (
                <PlaceRow place={item} onPress={() => onSet(item.pos, item.name)} />
              )}
            />

            <Pressable style={styles.mapBtn} onPress={onPickOnMap}>
              <MaterialCommunityIcons name="map-marker-plus-outline" size={15} color={UI.text} />
              <Text style={styles.mapBtnText}>Pick a spot on the map instead</Text>
            </Pressable>
          </Glass>
        </SafeAreaView>
      </Animated.View>

      {/* everything below the panel closes it — and the keyboard lives here,
          in space the results never needed */}
      <Pressable style={styles.backdrop} onPress={onClose} />
    </Modal>
  );
}

/** One candidate: what it is, how far, what people think, and a way to look closer. */
function PlaceRow({ place, onPress }: { place: Place; onPress: () => void }) {
  const stars = ratingLabel(place);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[place.category, place.address].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.factRow}>
          {stars && (
            <View style={styles.stars}>
              <MaterialCommunityIcons name="star" size={11} color={UI.brand} />
              <Text style={styles.starsText}>{stars}</Text>
            </View>
          )}
          {place.distanceM != null && (
            <Text style={styles.dist}>{formatDistance(place.distanceM)} away</Text>
          )}
          {place.url && (
            <Pressable onPress={() => Linking.openURL(place.url!)} hitSlop={8}>
              <Text style={styles.link}>{place.url.includes('yelp') ? 'Yelp ›' : 'Website ›'}</Text>
            </Pressable>
          )}
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={UI.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // anchored to the TOP edge and bled past it: only the bottom corners exist
  dropWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  sheet: {
    marginHorizontal: 8,
    marginTop: -40,
    paddingTop: 52,
    padding: 16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    gap: 12,
  },
  backdrop: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center' },
  title: { color: UI.text, fontSize: 17, fontWeight: '800', flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: { flex: 1, color: UI.text, fontSize: 15, fontWeight: '600' },
  list: { maxHeight: 300 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  name: { color: UI.text, fontSize: 14.5, fontWeight: '700' },
  meta: { color: UI.textDim, fontSize: 12, marginTop: 1 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsText: { color: UI.text, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dist: { color: UI.textDim, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  link: { color: UI.accent, fontSize: 12, fontWeight: '700' },
  empty: { color: UI.textDim, fontSize: 13, paddingVertical: 18, textAlign: 'center' },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingVertical: 11,
  },
  mapBtnText: { color: UI.text, fontSize: 13.5, fontWeight: '600' },
});
