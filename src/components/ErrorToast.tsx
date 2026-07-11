import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UI } from '../lib/colors';
import { SurfacedError, onSurfacedError } from '../lib/errors';

const AUTO_DISMISS_MS = 6000;

/**
 * Global host for surfaced errors: a dismissible banner naming what failed
 * ("Create session — network request failed"). Mount once at the root.
 */
export function ErrorToastHost() {
  const [current, setCurrent] = useState<SurfacedError | null>(null);

  useEffect(() => onSurfacedError(setCurrent), []);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setCurrent(null), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;
  return (
    <SafeAreaView style={styles.wrap} pointerEvents="box-none">
      <Pressable style={styles.toast} onPress={() => setCurrent(null)}>
        <MaterialCommunityIcons name="alert-circle-outline" size={16} color={UI.danger} />
        <View style={{ flex: 1 }}>
          <Text style={styles.context}>{current.context}</Text>
          <Text style={styles.message} numberOfLines={2}>
            {current.message}
          </Text>
        </View>
        <MaterialCommunityIcons name="close" size={15} color={UI.textDim} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(20,16,18,0.97)',
    borderWidth: 1,
    borderColor: `${UI.danger}66`,
  },
  context: { color: UI.danger, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  message: { color: UI.text, fontSize: 13, marginTop: 1 },
});
