import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UI } from '../lib/colors';
import { Glass } from './Glass';

/**
 * Map controls, parked top-right directly under the session bar (which holds
 * Invite): Trails toggle + conditional Everyone recenter. A row, not a
 * column — they sit beside each other so the map keeps its whole lower half.
 */
export function MapFabs({
  showTrails,
  onToggleTrails,
  showRecenter,
  onRecenter,
}: {
  showTrails: boolean;
  onToggleTrails: () => void;
  showRecenter: boolean;
  onRecenter: () => void;
}) {
  return (
    <SafeAreaView style={styles.row} edges={['top']} pointerEvents="box-none">
      <Pressable onPress={onToggleTrails}>
        <Glass style={[styles.fab, showTrails && styles.fabOn]} radius={20} intensity={44}>
          <MaterialCommunityIcons name="map-marker-path" size={14} color={showTrails ? UI.bg : UI.text} />
          <Text style={[styles.fabText, showTrails && styles.fabTextOn]}>Trails</Text>
        </Glass>
      </Pressable>
      {showRecenter && (
        <Pressable onPress={onRecenter}>
          <Glass style={styles.fab} radius={20} intensity={44}>
            <MaterialCommunityIcons name="arrow-collapse-all" size={14} color={UI.text} />
            <Text style={styles.fabText}>Everyone</Text>
          </Glass>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // header bar is ~56pt tall (padding + two text lines) + its 6pt top margin
  row: {
    position: 'absolute',
    top: 68,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9 },
  fabOn: { backgroundColor: 'rgba(255,255,255,0.92)' },
  fabText: { color: UI.text, fontSize: 13, fontWeight: '600' },
  fabTextOn: { color: UI.bg },
});
