import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { UI } from '../lib/colors';
import { formatDistance } from '../lib/format';
import { LatLng } from '../lib/geo';
import { Place, ratingLabel, searchDemoPlaces, searchPlaces } from '../lib/places';
import { AnchoredCard } from './AnchoredCard';

/**
 * Where are we heading?
 *
 * UNFOLDS OUT OF THE DESTINATION CHIP, like the meeting-time card unfolds out of
 * the time chip — the two halves of the plan behave the same way. It used to drop
 * from the whole top edge of the screen, which looked like it came from nowhere.
 *
 * It also STOPS AT THE KEYBOARD (see below). Anchoring at the top helps, but it
 * isn't enough on its own: the results list is long, the field autofocuses, and a
 * card that keeps growing will happily put its results underneath the keyboard —
 * hiding the one thing you opened it for.
 *
 * A destination isn't a pin, it's a decision: each result says how far it is, how
 * well reviewed, and links out so you can look closer before committing the group
 * to walk there. Ratings and links are optional BY DESIGN — OpenStreetMap knows
 * where things are but not what people think of them, and a card without them
 * must still look finished. (Yelp lands behind lib/places' searchPlaces; this UI
 * won't change.)
 */
/** head + search field + "pick on map" + the card's padding and gaps */
const CHROME_H = 178;
/** never squeeze the results to nothing — better to be tight than empty */
const MIN_LIST_H = 130;

export function DestinationSheet({
  visible,
  near,
  current,
  anchorTop,
  onSet,
  onPickOnMap,
  onClose,
}: {
  visible: boolean;
  /** where the group is now — results are ranked from here */
  near: LatLng;
  /** the name it already has, when changing rather than setting */
  current: string | null;
  anchorTop: number;
  onSet: (pos: LatLng, name: string) => void;
  onPickOnMap: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  /**
   * THE CARD STOPS AT THE KEYBOARD.
   *
   * This card autofocuses a text field, so the keyboard is always up — and the
   * results are the whole point of the card, so growing down behind the keyboard
   * hides exactly the thing you opened it for. The available room is the strip
   * between the session bar and the top of the keyboard, and we MEASURE it:
   * keyboard height varies by device, by keyboard type, and by whether a
   * predictive bar or a third-party keyboard is in play. Every hard-coded guess
   * at it is wrong on somebody's phone.
   */
  const { height: screenH } = useWindowDimensions();
  const [keyboardH, setKeyboardH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKeyboardH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const listMax = Math.max(MIN_LIST_H, screenH - keyboardH - anchorTop - CHROME_H - 12);

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
    <AnchoredCard visible={visible} anchorTop={anchorTop} anchor="left" onClose={onClose}>
      <View style={styles.head}>
        <Text style={styles.title}>
          {current ? 'Change the destination' : 'Where are we heading?'}
        </Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <MaterialCommunityIcons name="close" size={18} color={UI.textDim} />
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
        style={[styles.list, { maxHeight: listMax }]}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {searching ? 'Searching…' : 'Nothing found — try fewer words, or pick it on the map.'}
          </Text>
        }
        renderItem={({ item }) => <PlaceRow place={item} onPress={() => onSet(item.pos, item.name)} />}
      />

      <Pressable style={styles.mapBtn} onPress={onPickOnMap}>
        <MaterialCommunityIcons name="map-marker-plus-outline" size={15} color={UI.text} />
        <Text style={styles.mapBtnText}>Pick a spot on the map instead</Text>
      </Pressable>
    </AnchoredCard>
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
  head: { flexDirection: 'row', alignItems: 'center' },
  title: { color: UI.text, fontSize: 15, fontWeight: '800', flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  input: { flex: 1, color: UI.text, fontSize: 15, fontWeight: '600' },
  list: {},
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  name: { color: UI.text, fontSize: 14, fontWeight: '700' },
  meta: { color: UI.textDim, fontSize: 11.5, marginTop: 1 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsText: { color: UI.text, fontSize: 11.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dist: { color: UI.textDim, fontSize: 11.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  link: { color: UI.accent, fontSize: 11.5, fontWeight: '700' },
  empty: { color: UI.textDim, fontSize: 12.5, paddingVertical: 16, textAlign: 'center' },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 11,
    paddingVertical: 10,
  },
  mapBtnText: { color: UI.text, fontSize: 12.5, fontWeight: '600' },
});
