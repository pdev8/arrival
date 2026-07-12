import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { UI } from '../lib/colors';
import { surfaceError } from '../lib/errors';
import { Glass } from './Glass';

interface Props {
  visible: boolean;
  sessionName: string;
  joinCode: string;
  onClose: () => void;
}

/**
 * The invite panel: the join code big enough to read across a table, the
 * link one tap from the clipboard, and the OS share sheet as the secondary.
 * (B3 upgrades the link to a real universal link; the code + copy flow is
 * how joining works until then.)
 */
export function InviteSheet({ visible, sessionName, joinCode, onClose }: Props) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const link = `https://arrival.app/j/${joinCode}`;
  const message = `Join my Arrival session “${sessionName}”: ${link}`;

  useEffect(() => {
    if (!visible) setCopied(null);
  }, [visible]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (what: 'link' | 'code') => {
    try {
      await Clipboard.setStringAsync(what === 'link' ? link : joinCode);
      setCopied(what);
    } catch (e) {
      surfaceError('Copying invite', e);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.wrap}>
        <Glass style={styles.sheet} radius={26} intensity={56}>
          <Text style={styles.title}>Invite to {sessionName}</Text>
          <Text style={styles.sub}>Anyone with the code can join while the session is live.</Text>

          <Pressable style={styles.codeBox} onPress={() => copy('code')}>
            <Text style={styles.code}>{joinCode}</Text>
            <Text style={styles.codeHint}>
              {copied === 'code' ? 'Copied ✓' : 'tap to copy code'}
            </Text>
          </Pressable>

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => copy('link')}>
              <MaterialCommunityIcons
                name={copied === 'link' ? 'check' : 'link-variant'}
                size={15}
                color={UI.bg}
              />
              <Text style={styles.btnPrimaryText}>{copied === 'link' ? 'Copied' : 'Copy link'}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnOutline]}
              onPress={() => Share.share({ message }).catch(() => {})}
            >
              <MaterialCommunityIcons name="share-variant-outline" size={15} color={UI.text} />
              <Text style={styles.btnText}>Share…</Text>
            </Pressable>
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // invisible tap-to-close catcher — no dim: the map stays fully visible
  // above the sheet (the dim itself read as a ghost panel)
  backdrop: { flex: 1 },
  // flush bottom sheet: full width, bottom edge (and its corners/border)
  // pushed well past the screen so only the top corners read as rounded
  wrap: {},
  sheet: {
    padding: 18,
    paddingBottom: 84,
    marginBottom: -40,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  title: { color: UI.text, fontSize: 18, fontWeight: '800' },
  sub: { color: UI.textDim, fontSize: 12.5, marginTop: 3 },
  codeBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${UI.brand}55`,
    backgroundColor: `${UI.brand}14`,
    alignItems: 'center',
    paddingVertical: 14,
  },
  code: {
    color: UI.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  codeHint: { color: UI.brand, fontSize: 11, fontWeight: '700', marginTop: 3 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 13,
    paddingVertical: 13,
  },
  btnPrimary: { backgroundColor: '#fff' },
  btnPrimaryText: { color: UI.bg, fontSize: 14, fontWeight: '700' },
  btnOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnText: { color: UI.text, fontSize: 14, fontWeight: '600' },
});
