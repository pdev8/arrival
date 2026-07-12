import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StopCategory } from '../demo/simulation';
import { UI } from '../lib/colors';
import { CATEGORY_ICON } from '../lib/icons';
import { LatLng } from '../lib/geo';
import { Glass } from './Glass';

const CATEGORIES: StopCategory[] = ['coffee', 'food', 'gas', 'restroom', 'scenic', 'other'];

/** Long-press sheet: pick a category + note, then announce or suggest a stop. */
export function PlaceSheet({
  pos,
  onClose,
  onAnnounce,
  onSuggest,
}: {
  pos: LatLng | null;
  onClose: () => void;
  onAnnounce: (cat: StopCategory, note: string) => void;
  onSuggest: (cat: StopCategory, note: string) => void;
}) {
  const [category, setCategory] = useState<StopCategory>('coffee');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (pos) {
      setCategory('coffee');
      setNote('');
    }
  }, [pos]);

  return (
    <Modal visible={pos !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.wrap}>
        <Glass style={styles.sheet} radius={26} intensity={56}>
          <Text style={styles.title}>Dropped pin</Text>
          <Text style={styles.sub}>
            {pos ? `${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}` : ''}
          </Text>
          <View style={styles.catRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.catBtn, category === c && styles.catBtnActive]}
              >
                <MaterialCommunityIcons
                  name={CATEGORY_ICON[c]}
                  size={19}
                  color={category === c ? UI.bg : UI.textDim}
                />
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)"
            placeholderTextColor={UI.textDim}
          />
          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => onAnnounce(category, note)}>
              <Text style={styles.btnPrimaryText}>I&apos;m stopping here</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => onSuggest(category, note)}>
              <Text style={styles.btnText}>Suggest to group</Text>
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
  // flush bottom sheet — matches InviteSheet's anchoring
  wrap: {},
  sheet: {
    padding: 18,
    paddingBottom: 86,
    marginBottom: -40,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  title: { color: UI.text, fontSize: 18, fontWeight: '800' },
  sub: { color: UI.textDim, fontSize: 12, marginTop: 2 },
  catRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  catBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  noteInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: UI.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 12,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#fff' },
  btnPrimaryText: { color: UI.bg, fontSize: 14, fontWeight: '700' },
  btnOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnText: { color: UI.text, fontSize: 14, fontWeight: '600' },
});
