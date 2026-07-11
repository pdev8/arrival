import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { UI } from '../lib/colors';

/** Small action chip used on stop cards and anywhere a compact toggle fits. */
export function Pill({
  icon,
  label,
  active,
  onPress,
}: {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      {icon && <MaterialCommunityIcons name={icon} size={13} color={active ? '#fff' : UI.textDim} />}
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 5.5,
  },
  pillActive: { backgroundColor: UI.accent, borderColor: UI.accent },
  pillText: { color: UI.text, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
});
