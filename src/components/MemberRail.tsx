import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SimMember } from '../demo/simulation';
import { UI } from '../lib/colors';
import { formatEtaClock } from '../lib/format';
import { AvatarRing } from './AvatarRing';
import { Glass } from './Glass';

interface Props {
  members: SimMember[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * The primary member surface: a horizontal rail of avatar chips, each ringed
 * by progress dots (route completed) in the member's color, with a live ETA
 * underneath. Everyone is glanceable at once without opening a sheet; tap a
 * chip to focus that member on the map and open their card.
 */
export function MemberRail({ members, selectedId, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.rail}
    >
      {members.map((m) => {
        const selected = m.id === selectedId;
        const arrived = m.state === 'arrived';
        return (
          <Pressable key={m.id} onPress={() => onSelect(m.id)}>
            <Glass style={[styles.chip, selected && styles.chipSelected]} radius={16} intensity={36}>
              <AvatarRing
                source={m.avatar}
                size={48}
                avatarSize={36}
                progress={m.progress}
                color={m.color}
                arrived={arrived}
              />
              <Text style={styles.name} numberOfLines={1}>
                {m.name}
              </Text>
              <View style={styles.etaRow}>
                {m.state === 'stopped' && (
                  <MaterialCommunityIcons name="pause" size={10} color={m.color} />
                )}
                <Text style={[styles.eta, { color: arrived ? UI.success : m.color }]}>
                  {arrived ? 'here' : formatEtaClock(m.etaMin)}
                </Text>
              </View>
            </Glass>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { flexGrow: 0 },
  row: { gap: 8, paddingHorizontal: 12 },
  chip: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, width: 74 },
  chipSelected: { borderColor: 'rgba(255,255,255,0.55)' },
  name: { color: UI.text, fontSize: 11, fontWeight: '700', marginTop: 5 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 1 },
  eta: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
