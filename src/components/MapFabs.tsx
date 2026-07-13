import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UI } from '../lib/colors';
import { Glass } from './Glass';

/**
 * Map controls, parked top-right directly under the session bar: Trails toggle
 * + conditional Everyone recenter. A row, not a column — they sit beside each
 * other so the map keeps its whole lower half.
 *
 * `top` is the session bar's MEASURED height (it reports it via onHeight), not
 * a constant: the bar is taller once a destination is set, and a hard-coded
 * offset put these chips straight through it.
 */
export function MapFabs({
  top,
  showTrails,
  onToggleTrails,
  showRecenter,
  onRecenter,
}: {
  /** measured bottom of the session bar — the chips sit right under it, and
   *  keep sitting under it when the bar grows (a destination row, a longer
   *  convergence line). Never hard-code this. */
  top: number;
  showTrails: boolean;
  onToggleTrails: () => void;
  showRecenter: boolean;
  onRecenter: () => void;
}) {
  return (
    <View style={[styles.row, { top }]} pointerEvents="box-none">
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
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
