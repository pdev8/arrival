import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SimMember } from '../demo/simulation';
import { UI } from '../lib/colors';
import { formatEtaClock } from '../lib/geo';
import { DotRing } from './DotRing';
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
              <View style={styles.avatarWrap}>
                <Image source={m.avatar} fadeDuration={0} style={styles.avatar} />
                <DotRing size={48} progress={m.progress} color={arrived ? UI.success : m.color} count={14} />
              </View>
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
  avatarWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#14161C' },
  name: { color: UI.text, fontSize: 11, fontWeight: '700', marginTop: 5 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 1 },
  eta: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
