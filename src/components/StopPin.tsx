import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { SessionStop } from '../demo/simulation';
import { UI } from '../lib/colors';
import { CATEGORY_ICON } from '../lib/icons';

interface Props {
  stop: SessionStop;
  memberColor: string;
  onPress: () => void;
}

/** Dark chip pin with a category glyph; suggestions render dashed until confirmed. */
export function StopPin({ stop, memberColor, onPress }: Props) {
  const proposed = stop.kind === 'suggestion' && stop.status === 'proposed';
  const done = stop.status === 'done';
  return (
    <Marker coordinate={stop.pos} anchor={{ x: 0.5, y: 1 }} onPress={onPress} tracksViewChanges zIndex={5}>
      <View style={[styles.pin, { borderColor: memberColor }, proposed && styles.proposed, done && styles.done]}>
        <MaterialCommunityIcons name={CATEGORY_ICON[stop.category]} size={15} color={UI.text} />
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
