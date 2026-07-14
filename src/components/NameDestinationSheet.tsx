import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { UI } from '../lib/colors';
import { LatLng } from '../lib/geo';
import { AnchoredCard } from './AnchoredCard';

/**
 * Name a spot the group picked by tapping the map — the escape hatch for places
 * search can't find (a bench, a corner, "the fountain"). The position is already
 * decided; this is only the label everyone will see.
 *
 * IT UNROLLS FROM THE DESTINATION CHIP, exactly like the search card does — and
 * that isn't decoration, it's continuity. This IS the destination flow: you
 * opened the destination card, chose "pick it on the map", tapped, and now you're
 * naming it. Three steps of one decision, so all three come out of the same
 * place. It used to drop from the top of the screen instead, which made the last
 * step of a flow look like the start of a different one.
 *
 * (It also inherits AnchoredCard's fixed backdrop and its real close animation —
 * this sheet had both bugs.)
 */
export function NameDestinationSheet({
  pos,
  anchorTop,
  onSet,
  onClose,
}: {
  /** null = closed */
  pos: LatLng | null;
  anchorTop: number;
  onSet: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (pos) setName('');
  }, [pos]);

  const trimmed = name.trim();
  return (
    <AnchoredCard visible={!!pos} anchorTop={anchorTop} anchor="left" onClose={onClose}>
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
    </AnchoredCard>
  );
}

const styles = StyleSheet.create({
  title: { color: UI.text, fontSize: 15, fontWeight: '800' },
  sub: { color: UI.textDim, fontSize: 12.5, marginTop: -6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: UI.text,
    fontSize: 15,
    fontWeight: '600',
  },
  actions: { flexDirection: 'row', gap: 8 },
  primary: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 11,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryOff: { opacity: 0.4 },
  primaryText: { color: UI.bg, fontSize: 13.5, fontWeight: '700' },
  ghost: {
    paddingHorizontal: 16,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { color: UI.text, fontSize: 13, fontWeight: '600' },
});
