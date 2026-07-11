import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UI } from '../lib/colors';
import { Glass } from './Glass';

/** Session title bar: back, name + convergence line, invite. */
export function SessionHeader({
  title,
  sub,
  highlightSub = false,
  onBack,
  onInvite,
}: {
  title: string;
  sub: string;
  /** amber sub line — used once everyone has arrived */
  highlightSub?: boolean;
  onBack: () => void;
  onInvite: () => void;
}) {
  return (
    <SafeAreaView style={styles.wrap} pointerEvents="box-none">
      <Glass style={styles.bar} radius={18} intensity={44}>
        <Pressable onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={UI.text} />
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => {}}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={[styles.sub, highlightSub && { color: UI.brand }]} numberOfLines={1}>
            {sub}
          </Text>
        </Pressable>
        <Pressable style={styles.invite} onPress={onInvite}>
          <MaterialCommunityIcons name="account-plus-outline" size={14} color={UI.bg} />
          <Text style={styles.inviteText}>Invite</Text>
        </Pressable>
      </Glass>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: { color: UI.text, fontSize: 16, fontWeight: '800' },
  sub: { color: UI.textDim, fontSize: 12, marginTop: 1 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  inviteText: { color: UI.bg, fontSize: 13, fontWeight: '700' },
});
