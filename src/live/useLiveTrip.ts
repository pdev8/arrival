import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Destination, FeedEvent, SessionStop, SimMember, Simulation, StopCategory } from '../demo/simulation';
import { surfaceError } from '../lib/errors';
import { LatLng, distanceM } from '../lib/geo';
import { ensureSignedIn, supabase } from '../lib/supabase';
import { Tracked, applyBroadcast, mergeSnapshot, simMotion, stateFromSpeed } from './live-helpers';
import {
  EventRow,
  ParticipantRow,
  StopRow,
  VoteRow,
  mapEvent,
  mapReactions,
  mapStops,
  youify,
} from './live-stops';

/** publish cadence (foreground, SPEC §5.3); background rates land with B5 */
const PUBLISH_MS = 3000;
/** snapshot upsert cadence — also the worst-case visibility if broadcast
 *  delivery fails, so it's tight for M1 */
const SNAPSHOT_MS = 10000;
/** roster poll safety net: even with zero realtime delivery, everyone's
 *  snapshot position surfaces at this cadence */
const POLL_MS = 15000;
const ARRIVE_RADIUS_M = 40;
const FEED_HISTORY = 50;

interface WireMember extends Tracked {
  id: string;
  left: boolean;
  name: string;
  color: string;
  isYou: boolean;
}

interface PosPayload {
  id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
}

/**
 * B4+B6 — the live counterpart of useSimulation, same Simulation shape so
 * the session screen swaps sources with one conditional. Realtime positions
 * ride a private trip:{id} broadcast channel; roster, stops, votes and feed
 * ride postgres_changes; your own GPS publishes at foreground cadence and
 * snapshots every 30 s for late joiners.
 *
 * Boundary rule: everywhere the UI sees an id (member ids, stop voters,
 * reaction ids, feed actors), YOUR uuid is translated to the literal 'you'
 * (see live-stops.ts) — the components were built against the demo sim and
 * key self-checks off that literal.
 */
export function useLiveTrip(
  enabled: boolean,
  tripId: string | undefined,
  /** null = free roam. The destination is TRIP state: it can be set (or
   *  changed) after the session has started, and every member sees it. */
  initialDestination: Destination | null,
  youName: string
): Simulation | null {
  const membersRef = useRef(new Map<string, WireMember>());
  const namesRef = useRef(new Map<string, string>());
  const youIdRef = useRef<string | null>(null);
  const startAtRef = useRef(0);
  const [destination, setDest] = useState<Destination | null>(initialDestination);
  const destRef = useRef<Destination | null>(initialDestination);
  destRef.current = destination;
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [stops, setStops] = useState<SessionStop[]>([]);
  const [tick, setTick] = useState(0); // bumped on every wire update

  useEffect(() => {
    if (!enabled || !tripId || !supabase) return;
    let dead = false;
    let watcher: Location.LocationSubscription | null = null;
    let snapshotTimer: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let sendFailureSurfaced = false;
    let lastPublish = 0;
    startAtRef.current = Date.now();
    const bump = () => !dead && setTick((t) => t + 1);

    /** the destination is TRIP state: read it, then follow it live — anyone
     *  can set or change it mid-session and everyone must see the same flag */
    const loadDestination = async () => {
      const { data, error } = await supabase!
        .from('trips')
        .select('destination_name,destination_lat,destination_lng')
        .eq('id', tripId)
        .maybeSingle();
      if (error || dead || !data) return;
      const next =
        data.destination_lat != null && data.destination_lng != null
          ? {
              name: data.destination_name ?? 'Destination',
              pos: { latitude: data.destination_lat, longitude: data.destination_lng },
            }
          : null;
      setDest(next);
    };

    const loadRoster = async (youId: string) => {
      const { data: rows, error } = await supabase!
        .from('trip_members')
        .select('user_id,color,last_lat,last_lng,last_heading,last_speed,state,last_updated_at,left_at')
        .eq('trip_id', tripId);
      if (error) return surfaceError('Loading members', error);
      const ids = (rows ?? []).map((r) => r.user_id);
      const { data: profiles } = await supabase!
        .from('profiles')
        .select('id,display_name')
        .in('id', ids);
      for (const p of profiles ?? []) namesRef.current.set(p.id, p.display_name);
      for (const r of rows ?? []) {
        const existing = membersRef.current.get(r.user_id);
        const tracked = mergeSnapshot(
          existing,
          {
            pos:
              r.last_lat != null && r.last_lng != null
                ? { latitude: r.last_lat, longitude: r.last_lng }
                : null,
            at: r.last_updated_at ? Date.parse(r.last_updated_at) : 0,
            heading: r.last_heading,
            speed: r.last_speed,
            arrivedState: r.state === 'arrived',
          },
          destRef.current?.pos ?? null,
          ARRIVE_RADIUS_M
        );
        membersRef.current.set(r.user_id, {
          id: r.user_id,
          left: r.left_at != null,
          name: r.user_id === youId ? 'You' : (namesRef.current.get(r.user_id) ?? 'Friend'),
          color: r.color,
          isYou: r.user_id === youId,
          ...tracked,
        });
      }
      bump();
    };

    const actorName = (id: string | null, youId: string) =>
      id === youId ? 'You' : id ? (namesRef.current.get(id) ?? 'Someone') : 'Someone';

    const loadFeed = async (youId: string) => {
      const { data, error } = await supabase!
        .from('trip_events')
        .select('id,type,actor_id,payload,reactions,created_at')
        .eq('trip_id', tripId)
        .order('id', { ascending: false })
        .limit(FEED_HISTORY);
      if (error) return surfaceError('Loading activity', error);
      if (dead) return;
      setFeed(
        (data as EventRow[]).map((row) =>
          mapEvent(row, actorName(row.actor_id, youId), youId, startAtRef.current)
        )
      );
    };

    const loadStops = async (youId: string) => {
      const { data: stopRows, error } = await supabase!
        .from('stops')
        .select('id,trip_id,created_by,kind,status,category,name,lat,lng,note')
        .eq('trip_id', tripId);
      if (error) return surfaceError('Loading stops', error);
      const ids = (stopRows ?? []).map((s) => s.id);
      let votes: VoteRow[] = [];
      let participants: ParticipantRow[] = [];
      if (ids.length) {
        const [v, p] = await Promise.all([
          supabase!.from('stop_votes').select('stop_id,user_id,vote').in('stop_id', ids),
          supabase!.from('stop_participants').select('stop_id,user_id').in('stop_id', ids),
        ]);
        votes = (v.data as VoteRow[]) ?? [];
        participants = (p.data as ParticipantRow[]) ?? [];
      }
      if (dead) return;
      setStops(mapStops((stopRows as StopRow[]) ?? [], votes, participants, youId));
    };

    const applyPos = (p: PosPayload) => {
      const m = membersRef.current.get(p.id);
      if (!m) {
        // a member we haven't loaded yet — fetch the roster, then re-apply
        const youId = youIdRef.current;
        if (youId) loadRoster(youId).then(() => membersRef.current.has(p.id) && applyPos(p));
        return;
      }
      membersRef.current.set(p.id, {
        ...m,
        ...applyBroadcast(m, p, destRef.current?.pos ?? null, ARRIVE_RADIUS_M, Date.now()),
      });
      bump();
    };

    (async () => {
      try {
        const youId = await ensureSignedIn();
        youIdRef.current = youId;
        await supabase!.rpc('upsert_display_name', { p_name: youName }).then(
          ({ error }) => error && console.warn('display name', error.message)
        );
        await loadRoster(youId);
        await Promise.all([loadDestination(), loadFeed(youId), loadStops(youId)]);

        const refreshStops = () => loadStops(youId);
        const channel = supabase!
          .channel(`trip:${tripId}`, { config: { private: true, broadcast: { self: false } } })
          .on('broadcast', { event: 'pos' }, ({ payload }) => applyPos(payload as PosPayload))
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}` },
            () => loadRoster(youId)
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'trip_events', filter: `trip_id=eq.${tripId}` },
            (msg) => {
              const row = msg.new as EventRow;
              setFeed((f) => [
                mapEvent(row, actorName(row.actor_id, youId), youId, startAtRef.current),
                ...f.filter((e) => e.id !== String(row.id)),
              ]);
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'trip_events', filter: `trip_id=eq.${tripId}` },
            (msg) => {
              const row = msg.new as EventRow;
              setFeed((f) =>
                f.map((e) =>
                  e.id === String(row.id) ? { ...e, reactions: mapReactions(row.reactions, youId) } : e
                )
              );
            }
          )
          // stops/votes/participants: any change → refetch the bundle. Volume
          // is human-scale; votes/participants can't filter by trip (no
          // trip_id column) so RLS is the filter.
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'stops', filter: `trip_id=eq.${tripId}` },
            refreshStops
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
            loadDestination
          )
          .on('postgres_changes', { event: '*', schema: 'public', table: 'stop_votes' }, refreshStops)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'stop_participants' },
            refreshStops
          )
          .subscribe((status, err) => {
            if (status === 'CHANNEL_ERROR') surfaceError('Live channel', err ?? 'connection failed');
          });

        // safety net: even with zero realtime delivery, snapshots surface here
        pollTimer = setInterval(() => loadRoster(youId), POLL_MS);

        // your own GPS → broadcast (throttled) + periodic snapshot
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          surfaceError('Location permission', 'Denied — others can’t see you move');
        } else {
          watcher = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: PUBLISH_MS, distanceInterval: 5 },
            (loc) => {
              const now = Date.now();
              if (now - lastPublish < PUBLISH_MS) return;
              lastPublish = now;
              const payload: PosPayload = {
                id: youId,
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
                heading: loc.coords.heading != null && loc.coords.speed! > 1 ? loc.coords.heading : null,
                speed: loc.coords.speed,
              };
              applyPos(payload);
              channel.send({ type: 'broadcast', event: 'pos', payload }).then((resp) => {
                if (resp !== 'ok' && !sendFailureSurfaced) {
                  sendFailureSurfaced = true;
                  surfaceError('Live position send', `broadcast ${resp} — others update via 10s snapshots`);
                }
              });
            }
          );
          snapshotTimer = setInterval(() => {
            const you = membersRef.current.get(youId);
            if (!you?.pos) return;
            supabase!
              .from('trip_members')
              .update({
                last_lat: you.pos.latitude,
                last_lng: you.pos.longitude,
                last_heading: you.heading,
                last_speed: you.speed,
                state: stateFromSpeed(you.speed, you.arrived),
                last_updated_at: new Date().toISOString(),
              })
              .eq('trip_id', tripId)
              .eq('user_id', youId)
              .then(({ error }) => error && surfaceError('Position snapshot', error));
          }, SNAPSHOT_MS);
        }

        return () => channel.unsubscribe();
      } catch (e) {
        surfaceError('Joining live session', e);
      }
    })();

    return () => {
      dead = true;
      watcher?.remove();
      if (snapshotTimer) clearInterval(snapshotTimer);
      if (pollTimer) clearInterval(pollTimer);
      supabase?.removeAllChannels();
    };
  }, [enabled, tripId]);

  // ------------------------------------------------------------- actions

  const vote = useCallback(
    (stopId: string, up: boolean) => {
      const youId = youIdRef.current;
      if (!supabase || !youId) return;
      supabase
        .from('stop_votes')
        .upsert({ stop_id: stopId, user_id: youId, vote: up ? 1 : -1 })
        .then(({ error }) => error && surfaceError('Voting', error));
    },
    []
  );

  const joinStop = useCallback((stopId: string) => {
    const youId = youIdRef.current;
    if (!supabase || !youId) return;
    supabase
      .from('stop_participants')
      .upsert({ stop_id: stopId, user_id: youId })
      .then(({ error }) => error && surfaceError('Joining stop', error));
  }, []);

  const postStop = useCallback(
    (kind: 'announcement' | 'suggestion') =>
      (pos: LatLng, category: StopCategory, note: string) => {
        const youId = youIdRef.current;
        if (!supabase || !youId || !tripId) return;
        supabase
          .from('stops')
          .insert({
            trip_id: tripId,
            created_by: youId,
            kind,
            status: kind === 'announcement' ? 'active' : 'proposed',
            category,
            name: note.trim() || (kind === 'announcement' ? 'Quick stop' : 'Suggested stop'),
            note: note.trim() || null,
            lat: pos.latitude,
            lng: pos.longitude,
          })
          .then(({ error }) => error && surfaceError('Posting stop', error));
      },
    [tripId]
  );

  const setDestination = useCallback(
    (pos: LatLng, name: string) => {
      if (!supabase || !tripId) return;
      // optimistic: the flag lands immediately for you, and the realtime
      // trips UPDATE brings everyone else along
      setDest({ pos, name });
      supabase
        .rpc('set_destination', {
          p_trip_id: tripId,
          p_name: name,
          p_lat: pos.latitude,
          p_lng: pos.longitude,
        })
        .then(({ error }) => error && surfaceError('Setting the destination', error));
    },
    [tripId]
  );

  const react = useCallback((eventId: string, emoji: string) => {
    const youId = youIdRef.current;
    if (!supabase || !youId) return;
    supabase
      .rpc('toggle_reaction', { p_event_id: Number(eventId), p_emoji: emoji })
      .then(({ data, error }) => {
        if (error) return surfaceError('Reacting', error);
        // optimistic-ish: apply the authoritative result immediately
        setFeed((f) =>
          f.map((e) =>
            e.id === eventId
              ? { ...e, reactions: mapReactions(data as Record<string, string[]>, youId) }
              : e
          )
        );
      });
  }, []);

  return useMemo(() => {
    if (!enabled || !tripId) return null;
    const youId = youIdRef.current ?? '';
    const members: SimMember[] = [...membersRef.current.values()]
      .filter((m) => m.pos)
      .map((m) => ({
        id: youify(m.id, youId),
        left: m.left || undefined,
        name: m.name,
        avatar: undefined, // photos arrive with real profiles (A epic)
        color: m.color,
        isYou: m.isYou,
        pos: m.pos!,
        heading: m.heading,
        level: null,
        trail: m.trail,
        ...simMotion(m, destination?.pos ?? null),
      }));
    return {
      members,
      stops,
      feed,
      destination,
      setDestination,
      // free roam never "completes" — there's nowhere to arrive. It ends when
      // someone ends it.
      allArrived:
        !!destination &&
        members.filter((m) => !m.left).length > 0 &&
        members.filter((m) => !m.left).every((m) => m.state === 'arrived'),
      arrivalOrder: [],
      elapsedSec: (Date.now() - startAtRef.current) / 1000,
      vote,
      react,
      joinStop,
      announceStop: postStop('announcement'),
      suggestStop: postStop('suggestion'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tripId, tick, feed, stops, destination, setDestination, vote, react, joinStop, postStop]);
}
