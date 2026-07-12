import React, { useEffect, useRef } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { SimMember } from '../demo/simulation';
import { MemberCard } from './MemberCard';

interface Props {
  /** deck order — frozen by the caller while the pager is open, so live
      ETA crossings can't reorder pages under an active swipe */
  members: SimMember[];
  selectedId: string | null;
  you?: SimMember;
  onFocus: (id: string) => void;
  onRetrace: (m: SimMember) => void;
  onClose: () => void;
}

/**
 * The detailed member view as a horizontal pager: swipe left/right to move
 * between cards; landing on a page focuses that member (camera follows).
 * Selection changes from outside (marker tap) glide the deck to that page.
 */
export function MemberPager({ members, selectedId, you, onFocus, onRetrace, onClose }: Props) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<SimMember>>(null);
  const indexRef = useRef(Math.max(0, members.findIndex((m) => m.id === selectedId)));

  useEffect(() => {
    const idx = members.findIndex((m) => m.id === selectedId);
    if (idx >= 0 && idx !== indexRef.current) {
      indexRef.current = idx;
      listRef.current?.scrollToIndex({ index: idx, animated: true });
    }
  }, [selectedId, members]);

  return (
    <FlatList
      ref={listRef}
      style={{ flexGrow: 0 }}
      data={members}
      keyExtractor={(m) => m.id}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={indexRef.current}
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      onMomentumScrollEnd={(e) => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / width);
        const m = members[idx];
        if (m && idx !== indexRef.current) {
          indexRef.current = idx;
          onFocus(m.id);
        }
      }}
      renderItem={({ item }) => (
        <View style={{ width }}>
          <MemberCard member={item} you={you} onRetrace={() => onRetrace(item)} onClose={onClose} />
        </View>
      )}
    />
  );
}
