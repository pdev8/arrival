import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SessionStop, Simulation } from '../demo/simulation';
import { UI } from '../lib/colors';
import { CATEGORY_ICON } from '../lib/icons';
import { navigateTo } from '../lib/nav-deeplinks';
import { Pill } from './Pill';

/** One stop/suggestion in the dock: creator color rail, vote or join actions. */
export function StopCard({ stop, sim }: { stop: SessionStop; sim: Simulation }) {
  const creator = sim.members.find((m) => m.id === stop.createdBy);
  const color = creator?.color ?? UI.accent;
  const youVotedUp = stop.votesUp.includes('you');
  const youVotedDown = stop.votesDown.includes('you');
  const youJoined = stop.participants.includes('you');

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name={CATEGORY_ICON[stop.category]} size={14} color={color} />
        <Text style={styles.title}>{stop.name}</Text>
        {stop.status === 'confirmed' && <Text style={styles.confirmed}>Confirmed</Text>}
      </View>
      <Text style={styles.meta}>
        {stop.kind === 'suggestion' ? `Suggested by ${creator?.name ?? '?'}` : `${creator?.name ?? '?'} is stopping`}
        {stop.note ? ` · “${stop.note}”` : ''}
      </Text>
      <View style={styles.actions}>
        {stop.kind === 'suggestion' ? (
          <>
            <Pill icon="thumb-up-outline" label={`${stop.votesUp.length}`} active={youVotedUp} onPress={() => sim.vote(stop.id, true)} />
            <Pill icon="thumb-down-outline" label={`${stop.votesDown.length}`} active={youVotedDown} onPress={() => sim.vote(stop.id, false)} />
          </>
        ) : stop.createdBy !== 'you' ? (
          <Pill
            icon={youJoined ? 'check' : 'plus'}
            label={youJoined ? 'Stopping too' : "I'll stop too"}
            active={youJoined}
            onPress={() => sim.joinStop(stop.id)}
          />
        ) : (
          <Text style={styles.meta}>Your stop</Text>
        )}
        {stop.participants.length > 1 && <Text style={styles.meta}>{stop.participants.length} stopping</Text>}
        <View style={{ marginLeft: 'auto' }}>
          <Pill
            icon="navigation-variant-outline"
            label="Navigate"
            active={false}
            onPress={() =>
              navigateTo(
                stop.pos,
                stop.name,
                sim.members.find((m) => m.isYou)?.mode === 'car' ? 'drive' : 'walk'
              )
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 10,
    marginBottom: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: UI.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  confirmed: {
    color: UI.success,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 'auto',
  },
  meta: { color: UI.textDim, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
});
