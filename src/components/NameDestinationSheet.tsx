import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UI } from '../lib/colors';
import { LatLng } from '../lib/geo';
import { Glass } from './Glass';

/**
 * Name a spot the group picked by tapping the map — the escape hatch for
 * places that search can't find (a bench, a corner, "the fountain"). The
 * position is already decided; this is only the label everyone will see.
 * Searching for a real place is the main path (DestinationSheet).
 *
 * Drops from the TOP, like the search sheet: it's a text field, so the
 * keyboard is up, and anything anchored to the bottom ends up underneath it.
 */
export function NameDestinationSheet({
  pos,
  onSet,
  onClose,
}: {
  /** null = closed */
  pos: LatLng | null;
  onSet: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const drop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (pos) setName('');
    Animated.timing(drop, {
      toValue: pos ? 1 : 0,
      duration: pos ? 240 : 160,
      easing: pos ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [pos, drop]);

  const trimmed = name.trim();
  return (
    <Modal visible={!!pos} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View
        style={[
          styles.dropWrap,
          { transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-260, 0] }) }] },
        ]}
      >
        <SafeAreaView edges={['top']}>
          <Glass style={styles.sheet} radius={24} intensity={60}>
            <Text style={styles.title}>Name this spot</Text>
            <Text style={styles.sub}>Everyone sees it, and ETAs start counting from here.</Text>

            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="The fountain, the north gate, Mike’s stoop…"
              placeholderTextColor={UI.textDim}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => trimmed && onSet(trimmed)}
            />

            <View style={styles.actions}>
              <Pressable
                style={[styles.primary, !trimmed && styles.primaryOff]}
                disabled={!trimmed}
                onPress={() => onSet(trimmed)}
              >
                <Text style={styles.primaryText}>Set destination</Text>
              </Pressable>
              <Pressable style={styles.ghost} onPress={onClose}>
                <Text style={styles.ghostText}>Cancel</Text>
              </Pressable>
            </View>
          </Glass>
        </SafeAreaView>
      </Animated.View>

      {/* the keyboard lives down here now, out of the results' way */}
      <Pressable style={styles.backdrop} onPress={onClose} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  dropWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  backdrop: { flex: 1 },
  sheet: {
    marginHorizontal: 8,
    marginTop: -40,
    paddingTop: 52,
    padding: 16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    gap: 10,
  },
  title: { color: UI.text, fontSize: 18, fontWeight: '800' },
  sub: { color: UI.textDim, fontSize: 13, marginTop: -4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: UI.text,
    fontSize: 15,
    fontWeight: '600',
  },
  actions: { flexDirection: 'row', gap: 8 },
  primary: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryOff: { opacity: 0.4 },
  primaryText: { color: UI.bg, fontSize: 15, fontWeight: '700' },
  ghost: {
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { color: UI.text, fontSize: 14, fontWeight: '600' },
});
