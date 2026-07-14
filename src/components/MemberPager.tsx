import React, { useEffect, useRef } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { SessionStop, SimMember } from '../demo/simulation';
import { MemberCard } from './MemberCard';

interface Props {
  /** deck order — frozen by the caller while the pager is open, so live
      ETA crossings can't reorder pages under an active swipe */
  members: SimMember[];
  selectedId: string | null;
  you?: SimMember;
  onFocus: (id: string) => void;
  /** the stop a member is at, if any — what Join would join */
  stopFor: (m: SimMember) => SessionStop | null;
  canNavigate: (m: SimMember) => boolean;
  onJoin: (m: SimMember) => void;
  onNavigate: (m: SimMember) => void;
  onClose: () => void;
}

/**
 * The detailed member view as a horizontal pager: swipe left/right to move
 * between cards; landing on a page focuses that member (camera follows).
 *
 * Two things this file has to get right, both learned on device:
 *
 * 1. The FlatList's `data` is the frozen ID list, NOT the live member objects.
 *    The sim rebuilds every member 4x/second; feeding that straight in
 *    re-rendered the list constantly and let it fight a swipe in progress —
 *    pages snapped back to the member you just swiped away from. Cards read
 *    live members out of a ref instead, refreshed on a 1 Hz tick.
 *
 * 2. The scroll-sync effect only runs for selection changes that came from
 *    OUTSIDE (a marker tap). Selection changes that WE caused by landing on a
 *    page must not scroll the list again — that was the other half of the
 *    snap-back.
 */
export function MemberPager({ members, selectedId, you, onFocus, stopFor, canNavigate, onJoin, onNavigate, onClose }: Props) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);

  // stable page list: ids only, identity fixed for as long as the deck is open
  const idsRef = useRef<string[]>([]);
  if (idsRef.current.length !== members.length || idsRef.current.some((id, i) => id !== members[i]?.id)) {
    idsRef.current = members.map((m) => m.id);
  }
  const ids = idsRef.current;

  // live members, read at render time — never a prop of the list
  const membersRef = useRef(members);
  membersRef.current = members;
  const youRef = useRef(you);
  youRef.current = you;

  const indexRef = useRef(Math.max(0, ids.indexOf(selectedId ?? '')));
  /** the page WE focused — selection echoing back must not re-scroll us */
  const focusedRef = useRef(selectedId);

  useEffect(() => {
    if (selectedId === focusedRef.current) return; // our own landing, ignore
    focusedRef.current = selectedId;
    const idx = ids.indexOf(selectedId ?? '');
    if (idx >= 0 && idx !== indexRef.current) {
      indexRef.current = idx;
      listRef.current?.scrollToIndex({ index: idx, animated: true });
    }
  }, [selectedId, ids]);

  return (
    <FlatList
      ref={listRef}
      style={{ flexGrow: 0 }}
      data={ids}
      extraData={Math.floor(Date.now() / 1000)} // refresh cards ~1 Hz, not 4
      keyExtractor={(id) => id}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={indexRef.current}
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      onMomentumScrollEnd={(e) => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / width);
        const id = ids[idx];
        if (id && idx !== indexRef.current) {
          indexRef.current = idx;
          focusedRef.current = id; // remember: this selection is ours
          onFocus(id);
        }
      }}
      renderItem={({ item: id }) => {
        const m = membersRef.current.find((x) => x.id === id);
        if (!m) return <View style={{ width }} />;
        return (
          <View style={{ width }}>
            <MemberCard
              member={m}
              you={youRef.current}
              stop={stopFor(m)}
              canNavigate={canNavigate(m)}
              onJoin={() => onJoin(m)}
              onNavigate={() => onNavigate(m)}
              onClose={onClose}
            />
          </View>
        );
      }}
    />
  );
}
