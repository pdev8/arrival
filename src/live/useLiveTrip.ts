import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FeedEvent, SimMember, Simulation } from '../demo/simulation';
import { surfaceError } from '../lib/errors';
import { LatLng, distanceM } from '../lib/geo';
import { ensureSignedIn, supabase } from '../lib/supabase';
import { appendToTrail, stateFromSpeed, straightLineEtaMin, trailDistanceM } from './live-helpers';

/** publish cadence (foreground, SPEC §5.3); background rates land with B5 */
const PUBLISH_MS = 3000;
/** snapshot upsert for late joiners */
const SNAPSHOT_MS = 30000;
const ARRIVE_RADIUS_M = 40;
const STRIDE_M = 0.75;

interface WireMember {
  id: string;
  name: string;
  color: string;
  isYou: boolean;
  pos: LatLng | null;
  heading: number;
  speed: number | null;
  trail: LatLng[];
  firstRemainingM: number | null;
  arrived: boolean;
  lastAt: number;
}

interface PosPayload {
  id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
}

/**
 * B4 — the live counterpart of useSimulation, same Simulation shape so the
 * session screen swaps sources with one conditional. Realtime positions ride
 * a private trip:{id} broadcast channel; the roster and feed ride
 * postgres_changes; your own GPS publishes at foreground cadence and
 * snapshots every 30 s for late joiners. Stops & votes go live in B6 —
 * their actions surface a notice until then.
 */
export function useLiveTrip(
  enabled: boolean,
  tripId: string | undefined,
  destination: { name: string; pos: LatLng },
  youName: string
): Simulation | null {
  const membersRef = useRef(new Map<string, WireMember>());
  const startAtRef = useRef(0);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [tick, setTick] = useState(0); // bumped on every wire update

  useEffect(() => {
    if (!enabled || !tripId || !supabase) return;
    let dead = false;
    let watcher: Location.LocationSubscription | null = null;
    let snapshotTimer: ReturnType<typeof setInterval> | null = null;
    let lastPublish = 0;
    startAtRef.current = Date.now();
    const bump = () => !dead && setTick((t) => t + 1);

    const loadRoster = async (youId: string) => {
      const { data: rows, error } = await supabase!
        .from('trip_members')
        .select('user_id,color,last_lat,last_lng,last_heading,last_speed,state')
        .eq('trip_id', tripId);
      if (error) return surfaceError('Loading members', error);
      const ids = (rows ?? []).map((r) => r.user_id);
      const { data: profiles } = await supabase!
        .from('profiles')
        .select('id,display_name')
        .in('id', ids);
      const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
      for (const r of rows ?? []) {
        const existing = membersRef.current.get(r.user_id);
        const pos =
          r.last_lat != null && r.last_lng != null
            ? { latitude: r.last_lat, longitude: r.last_lng }
            : null;
        membersRef.current.set(r.user_id, {
          id: r.user_id,
          name: r.user_id === youId ? 'You' : (names.get(r.user_id) ?? 'Friend'),
          color: r.color,
          isYou: r.user_id === youId,
          pos: existing?.pos ?? pos,
          heading: existing?.heading ?? r.last_heading ?? 0,
          speed: existing?.speed ?? r.last_speed ?? null,
          trail: existing?.trail ?? (pos ? [pos] : []),
          firstRemainingM: existing?.firstRemainingM ?? (pos ? distanceM(pos, destination.pos) : null),
          arrived: existing?.arrived ?? r.state === 'arrived',
          lastAt: existing?.lastAt ?? 0,
        });
      }
      bump();
    };

    const applyPos = (p: PosPayload) => {
      const m = membersRef.current.get(p.id);
      if (!m) return; // roster refresh will pick them up
      const pos = { latitude: p.lat, longitude: p.lng };
      m.pos = pos;
      m.heading = p.heading ?? m.heading;
      m.speed = p.speed;
      m.trail = appendToTrail(m.trail, pos);
      if (m.firstRemainingM == null) m.firstRemainingM = distanceM(pos, destination.pos);
      m.arrived = m.arrived || distanceM(pos, destination.pos) <= ARRIVE_RADIUS_M;
      m.lastAt = Date.now();
      bump();
    };

    (async () => {
      try {
        const youId = await ensureSignedIn();
        await supabase!.rpc('upsert_display_name', { p_name: youName }).then(
          ({ error }) => error && console.warn('display name', error.message)
        );
        await loadRoster(youId);

        const channel = supabase!
          .channel(`trip:${tripId}`, { config: { private: true, broadcast: { self: false } } })
          .on('broadcast', { event: 'pos' }, ({ payload }) => applyPos(payload as PosPayload))
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}` },
            () => loadRoster(youId)
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'trip_events', filter: `trip_id=eq.${tripId}` },
            (msg) => {
              const row = msg.new as { id: number; type: string; actor_id: string | null; created_at: string };
              const who = membersRef.current.get(row.actor_id ?? '');
              setFeed((f) => [
                {
                  id: String(row.id),
                  at: (Date.parse(row.created_at) - startAtRef.current) / 1000,
                  memberId: row.actor_id ?? undefined,
                  text: eventText(row.type, who?.name ?? 'Someone'),
                },
                ...f,
              ]);
            }
          )
          .subscribe((status, err) => {
            if (status === 'CHANNEL_ERROR') surfaceError('Live channel', err ?? 'connection failed');
          });

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
              channel.send({ type: 'broadcast', event: 'pos', payload }).catch(() => {});
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
      supabase?.removeAllChannels();
    };
  }, [enabled, tripId]);

  return useMemo(() => {
    if (!enabled || !tripId) return null;
    const members: SimMember[] = [...membersRef.current.values()]
      .filter((m) => m.pos)
      .map((m) => {
        const pos = m.pos!;
        const remainingM = Math.max(0, distanceM(pos, destination.pos));
        const traveledM = trailDistanceM(m.trail);
        const state = stateFromSpeed(m.speed, m.arrived);
        const mode = state === 'driving' ? ('car' as const) : ('foot' as const);
        const first = m.firstRemainingM ?? remainingM;
        return {
          id: m.id,
          name: m.name,
          avatar: undefined, // photos arrive with real profiles (A epic)
          color: m.color,
          isYou: m.isYou,
          pos,
          heading: m.heading,
          state,
          etaMin: m.arrived ? 0 : straightLineEtaMin(pos, destination.pos, m.speed),
          remainingM,
          mode,
          steps: mode === 'foot' ? Math.round(traveledM / STRIDE_M) : 0,
          progress: first > 0 ? Math.min(1, 1 - remainingM / first) : 1,
          level: null,
          traveledM,
          trail: m.trail,
        };
      });
    const notReady = (what: string) => () =>
      surfaceError(what, 'Live stops & votes arrive with the next backend PR (B6)');
    return {
      members,
      stops: [],
      feed,
      allArrived: members.length > 0 && members.every((m) => m.state === 'arrived'),
      arrivalOrder: [],
      elapsedSec: (Date.now() - startAtRef.current) / 1000,
      vote: notReady('Voting'),
      react: notReady('Reactions'),
      joinStop: notReady('Joining stops'),
      announceStop: notReady('Announcing stops'),
      suggestStop: notReady('Suggesting stops'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tripId, tick, feed]);
}

function eventText(type: string, name: string): string {
  switch (type) {
    case 'session_started':
      return 'Session started';
    case 'member_joined':
      return `${name} joined the session`;
    case 'session_completed':
      return 'Session ended';
    default:
      return `${name} · ${type}`;
  }
}
