import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UI } from '../lib/colors';
import { Glass } from './Glass';

/** Right-edge map controls: Trails toggle + conditional Everyone recenter. */
export function MapFabs({
  bottom,
  showTrails,
  onToggleTrails,
  showRecenter,
  onRecenter,
}: {
  bottom: number;
  showTrails: boolean;
  onToggleTrails: () => void;
  showRecenter: boolean;
  onRecenter: () => void;
}) {
  return (
    <View style={[styles.col, { bottom }]} pointerEvents="box-none">
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
  col: { position: 'absolute', right: 14, alignItems: 'flex-end', gap: 8 },
  fab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9 },
  fabOn: { backgroundColor: 'rgba(255,255,255,0.92)' },
  fabText: { color: UI.text, fontSize: 13, fontWeight: '600' },
  fabTextOn: { color: UI.bg },
});
