import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageSourcePropType } from 'react-native';
import {
  LatLng,
  cumulativeDistances,
  distanceM,
  headingAlongRoute,
  pointAlongRoute,
  routeSlice,
} from '../lib/geo';
import { CATEGORY_EMOJI, LevelSpan, MemberSeed, Scenario, StopCategory } from './data';
import { Stoplight, findLights } from './lights';

/** simulation tick interval — 4 Hz keeps marker motion fluid */
const TICK_MS = 250;

export { CATEGORY_EMOJI };
export type { StopCategory };

export type MemberState = 'driving' | 'walking' | 'stopped' | 'arrived';

/** speeds above this read as driving; below, walking */
const DRIVING_MPS = 3;

/** average stride length used to derive step counts from distance walked */
const STRIDE_M = 0.75;

export interface SimMember {
  id: string;
  name: string;
  avatar: ImageSourcePropType;
  color: string;
  isYou: boolean;
  pos: LatLng;
  heading: number;
  state: MemberState;
  /** real-time minutes to destination */
  etaMin: number;
  remainingM: number;
  /** foot vs car — decides whether a step count is meaningful */
  mode: 'foot' | 'car';
  /** steps taken this session (0 for drivers) */
  steps: number;
  /** fraction of their route completed, 0..1 — drives the progress rings */
  progress: number;
  /** floors relative to street (-1 = B1, 2 = F2), null when at street level */
  level: number | null;
  /** what the level is ("subway", "shops") when known */
  levelLabel?: string;
  /** distance covered this session, meters */
  traveledM: number;
  /** the path traveled this session, for breadcrumb trails */
  trail: LatLng[];
  statusNote?: string;
}

export interface SessionStop {
  id: string;
  kind: 'announcement' | 'suggestion';
  status: 'proposed' | 'confirmed' | 'active' | 'done';
  category: StopCategory;
  name: string;
  note?: string;
  pos: LatLng;
  createdBy: string;
  participants: string[];
  votesUp: string[];
  votesDown: string[];
}

export interface FeedEvent {
  id: string;
  at: number; // elapsed demo seconds
  memberId?: string;
  text: string;
}

interface InternalMember {
  seed: MemberSeed;
  route: LatLng[]; // corner-smoothed
  cum: number[];
  totalM: number;
  /** where on the route this member started the session */
  startM: number;
  progressM: number;
  stopUntil: number | null;
  /** brief stoplight wait — pauses movement without changing state */
  waitUntil: number | null;
  lights: Stoplight[];
  nextLight: number;
  arrived: boolean;
  joinedScriptedStop: boolean;
  statusNote?: string;
}

interface SimState {
  scenario: Scenario;
  elapsed: number;
  members: Map<string, InternalMember>;
  stops: SessionStop[];
  feed: FeedEvent[];
  feedSeq: number;
  scriptedStopPosted: boolean;
  scriptedSuggestPosted: boolean;
  allyVoted: boolean;
  /** member ids in the order they arrived — powers the recap */
  arrivalOrder: string[];
  /** distance of the scripted stop POI along a given member's route (or null if off-route) */
  stopPoiAtM: Map<string, number | null>;
}

export interface Simulation {
  members: SimMember[];
  stops: SessionStop[];
  feed: FeedEvent[];
  allArrived: boolean;
  /** member ids in arrival order (first → last so far) */
  arrivalOrder: string[];
  /** demo seconds since the session started — for relative feed timestamps */
  elapsedSec: number;
  vote: (stopId: string, up: boolean) => void;
  joinStop: (stopId: string) => void;
  announceStop: (pos: LatLng, category: StopCategory, note: string) => void;
  suggestStop: (pos: LatLng, category: StopCategory, note: string) => void;
}

const SCRIPTED_STOP_ID = 'stop-scripted';
const SCRIPTED_SUGGEST_ID = 'sugg-scripted';
/** how close (m) the POI must be to a member's route to make them pull over */
const ON_ROUTE_TOLERANCE_M = 300;

export function useSimulation(running: boolean, scenario: Scenario): Simulation {
  const sim = useRef<SimState | null>(null);

  if (!sim.current) {
    const members = new Map<string, InternalMember>();
    const stopPoiAtM = new Map<string, number | null>();
    for (const seed of scenario.members) {
      // routes are real street geometry (see routes.ts) — no corner smoothing,
      // which used to cut diagonally through corner buildings
      const route = scenario.routes[seed.routeKey];
      const cum = cumulativeDistances(route);
      const totalM = cum[cum.length - 1];
      const startM = totalM * seed.startFrac;
      const lights = seed.cruiseMps < DRIVING_MPS ? findLights(route, cum, seed.id) : [];
      const firstLight = lights.findIndex((l) => l.atM > startM);
      members.set(seed.id, {
        seed,
        route,
        cum,
        totalM,
        startM,
        progressM: startM,
        stopUntil: null,
        waitUntil: null,
        lights,
        nextLight: firstLight === -1 ? lights.length : firstLight,
        arrived: false,
        joinedScriptedStop: false,
      });
      stopPoiAtM.set(seed.id, distanceAlongRoute(route, cum, scenario.stopEvent.poi.pos));
    }
    sim.current = {
      scenario,
      elapsed: 0,
      members,
      stops: [],
      feed: [],
      feedSeq: 0,
      scriptedStopPosted: false,
      scriptedSuggestPosted: false,
      allyVoted: false,
      arrivalOrder: [],
      stopPoiAtM,
    };
    pushFeed(sim.current, undefined, `Session started — ${scenario.members.length} members sharing`);
    for (const seed of scenario.members) {
      pushFeed(sim.current, seed.id, `${seed.name} joined the session`);
    }
  }

  const [snapshot, setSnapshot] = useState(() => buildSnapshot(sim.current!));
  const publish = useCallback(() => setSnapshot(buildSnapshot(sim.current!)), []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      tick(sim.current!, TICK_MS / 1000);
      publish();
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [running, publish]);

  const vote = useCallback(
    (stopId: string, up: boolean) => {
      const s = sim.current!;
      const stop = s.stops.find((x) => x.id === stopId);
      if (!stop || stop.kind !== 'suggestion') return;
      stop.votesUp = stop.votesUp.filter((v) => v !== 'you');
      stop.votesDown = stop.votesDown.filter((v) => v !== 'you');
      (up ? stop.votesUp : stop.votesDown).push('you');
      maybeConfirm(s, stop);
      publish();
    },
    [publish]
  );

  const joinStop = useCallback(
    (stopId: string) => {
      const s = sim.current!;
      const stop = s.stops.find((x) => x.id === stopId);
      const you = s.members.get('you')!;
      if (!stop || stop.participants.includes('you')) return;
      stop.participants.push('you');
      if (stopId === SCRIPTED_STOP_ID) you.joinedScriptedStop = true;
      pushFeed(s, 'you', `You're stopping at ${stop.name} too`);
      publish();
    },
    [publish]
  );

  const announceStop = useCallback(
    (pos: LatLng, category: StopCategory, note: string) => {
      const s = sim.current!;
      const you = s.members.get('you')!;
      const name = note.trim() || 'Quick stop';
      s.stops.push({
        id: `stop-you-${s.feedSeq}`,
        kind: 'announcement',
        status: 'active',
        category,
        name,
        note: note.trim() || undefined,
        pos,
        createdBy: 'you',
        participants: ['you'],
        votesUp: [],
        votesDown: [],
      });
      you.stopUntil = s.elapsed + 30;
      you.statusNote = `stopping — ${name}`;
      pushFeed(s, 'you', `You're stopping: ${name}`);
      publish();
    },
    [publish]
  );

  const suggestStop = useCallback(
    (pos: LatLng, category: StopCategory, note: string) => {
      const s = sim.current!;
      const name = note.trim() || 'Suggested stop';
      s.stops.push({
        id: `sugg-you-${s.feedSeq}`,
        kind: 'suggestion',
        status: 'proposed',
        category,
        name,
        pos,
        createdBy: 'you',
        participants: [],
        votesUp: ['you'],
        votesDown: [],
      });
      pushFeed(s, 'you', `You suggested ${name}`);
      publish();
    },
    [publish]
  );

  return { ...snapshot, vote, joinStop, announceStop, suggestStop };
}

function pushFeed(s: SimState, memberId: string | undefined, text: string) {
  s.feed.unshift({ id: `f${s.feedSeq++}`, at: s.elapsed, memberId, text });
}

function maybeConfirm(s: SimState, stop: SessionStop) {
  if (stop.kind === 'suggestion' && stop.status === 'proposed' && stop.votesUp.length >= 2) {
    stop.status = 'confirmed';
    pushFeed(s, stop.createdBy, `${stop.name} confirmed — ${stop.votesUp.length} in`);
  }
}

function tick(s: SimState, dtSec: number) {
  s.elapsed += dtSec;
  const { scenario } = s;
  const { stopEvent, suggestEvent } = scenario;

  // scripted suggestion + ally vote
  if (!s.scriptedSuggestPosted && s.elapsed >= suggestEvent.atElapsedSec) {
    s.scriptedSuggestPosted = true;
    const who = memberName(s, suggestEvent.memberId);
    s.stops.push({
      id: SCRIPTED_SUGGEST_ID,
      kind: 'suggestion',
      status: 'proposed',
      category: suggestEvent.poi.category,
      name: suggestEvent.poi.name,
      note: suggestEvent.note,
      pos: suggestEvent.poi.pos,
      createdBy: suggestEvent.memberId,
      participants: [],
      votesUp: [suggestEvent.memberId],
      votesDown: [],
    });
    pushFeed(s, suggestEvent.memberId, `${who} suggested ${suggestEvent.poi.name} — “${suggestEvent.note}”`);
  }
  if (s.scriptedSuggestPosted && !s.allyVoted && s.elapsed >= suggestEvent.allyVote.atElapsedSec) {
    s.allyVoted = true;
    const stop = s.stops.find((x) => x.id === SCRIPTED_SUGGEST_ID);
    if (stop && !stop.votesUp.includes(suggestEvent.allyVote.memberId)) {
      stop.votesUp.push(suggestEvent.allyVote.memberId);
      pushFeed(s, suggestEvent.allyVote.memberId, `${memberName(s, suggestEvent.allyVote.memberId)} is in for ${stop.name}`);
      maybeConfirm(s, stop);
    }
  }

  for (const m of s.members.values()) {
    if (m.arrived) continue;
    const poiAtM = s.stopPoiAtM.get(m.seed.id) ?? null;

    // scripted friend announces their stop on reaching the POI
    if (m.seed.id === stopEvent.memberId && !s.scriptedStopPosted && poiAtM !== null && m.progressM >= poiAtM - 60) {
      s.scriptedStopPosted = true;
      m.stopUntil = s.elapsed + stopEvent.durationSec;
      m.statusNote = stopEvent.note.toLowerCase();
      s.stops.push({
        id: SCRIPTED_STOP_ID,
        kind: 'announcement',
        status: 'active',
        category: stopEvent.poi.category,
        name: stopEvent.poi.name,
        note: stopEvent.note,
        pos: stopEvent.poi.pos,
        createdBy: stopEvent.memberId,
        participants: [stopEvent.memberId],
        votesUp: [],
        votesDown: [],
      });
      pushFeed(s, stopEvent.memberId, `${m.seed.name} stopped at ${stopEvent.poi.name} — “${stopEvent.note}”`);
    }

    // if you joined the scripted stop, pull over when you reach it
    if (
      m.seed.isYou &&
      m.joinedScriptedStop &&
      m.stopUntil === null &&
      poiAtM !== null &&
      m.progressM >= poiAtM - 60 &&
      m.progressM < poiAtM + 400
    ) {
      m.joinedScriptedStop = false;
      m.stopUntil = s.elapsed + 25;
      m.statusNote = `stopped at ${stopEvent.poi.name}`;
    }

    // stoplights: a short curb wait at some corners and crossings — the
    // person just stands at the light, so no state change and no feed noise
    if (m.waitUntil !== null && s.elapsed >= m.waitUntil) m.waitUntil = null;
    if (
      m.waitUntil === null &&
      m.stopUntil === null &&
      m.nextLight < m.lights.length &&
      m.progressM >= m.lights[m.nextLight].atM
    ) {
      m.waitUntil = s.elapsed + m.lights[m.nextLight].waitSec;
      m.nextLight++;
    }

    // resume
    if (m.stopUntil !== null && s.elapsed >= m.stopUntil) {
      m.stopUntil = null;
      m.statusNote = undefined;
      pushFeed(s, m.seed.id, `${m.seed.name} is moving again`);
      if (m.seed.id === stopEvent.memberId) {
        const scripted = s.stops.find((x) => x.id === SCRIPTED_STOP_ID);
        if (scripted && scripted.status === 'active') scripted.status = 'done';
      }
    }

    // advance
    if (m.stopUntil === null && m.waitUntil === null) {
      m.progressM = Math.min(m.progressM + m.seed.cruiseMps * dtSec * scenario.timeScale, m.totalM);
    }

    // arrival
    if (m.totalM - m.progressM <= scenario.arriveRadiusM) {
      m.arrived = true;
      m.progressM = m.totalM;
      m.statusNote = undefined;
      s.arrivalOrder.push(m.seed.id);
      pushFeed(s, m.seed.id, `${m.seed.name} arrived at ${scenario.destination.name}`);
    }
  }
}

function memberName(s: SimState, id: string): string {
  return s.members.get(id)?.seed.name ?? id;
}

/** Demo stand-in for sensed vertical position (real build: CLLocation.floor,
 *  barometric altitude, and GPS-loss inference for subways). Exported for tests. */
export function levelAt(
  levelSpans: LevelSpan[] | undefined,
  frac: number
): { level: number | null; levelLabel?: string } {
  const span = levelSpans?.find((s) => frac >= s.fromFrac && frac <= s.toFrac);
  return span ? { level: span.level, levelLabel: span.label } : { level: null };
}


/** Distance along a route of its closest waypoint to a POI, or null if the POI isn't on this route. */
function distanceAlongRoute(route: LatLng[], cum: number[], poi: LatLng): number | null {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < route.length; i++) {
    const d = distanceM(route[i], poi);
    if (d < bestD) {
      bestD = d;
      best = cum[i];
    }
  }
  return bestD <= ON_ROUTE_TOLERANCE_M ? best : null;
}

function buildSnapshot(s: SimState): {
  members: SimMember[];
  stops: SessionStop[];
  feed: FeedEvent[];
  allArrived: boolean;
  arrivalOrder: string[];
  elapsedSec: number;
} {
  const members: SimMember[] = [];
  for (const m of s.members.values()) {
    const { pos } = pointAlongRoute(m.route, m.cum, m.progressM);
    // look-ahead window scaled to speed: the arrow sweeps through turns
    const lookM = Math.max(8, m.seed.cruiseMps * 6);
    const heading = headingAlongRoute(m.route, m.cum, m.progressM, lookM);
    const remainingM = Math.max(0, m.totalM - m.progressM);
    const mode: 'foot' | 'car' = m.seed.cruiseMps >= DRIVING_MPS ? 'car' : 'foot';
    const moving: MemberState = mode === 'car' ? 'driving' : 'walking';
    // a stop pushes the ETA out by the time left standing still (in real terms),
    // so the clock jumps up when someone stops, then resumes counting down
    const stopDelayMin =
      m.stopUntil !== null ? Math.max(0, (m.stopUntil - s.elapsed) * s.scenario.timeScale) / 60 : 0;
    members.push({
      id: m.seed.id,
      name: m.seed.name,
      avatar: m.seed.avatar,
      color: m.seed.color,
      isYou: m.seed.isYou,
      pos,
      heading,
      state: m.arrived ? 'arrived' : m.stopUntil !== null ? 'stopped' : moving,
      etaMin: remainingM / m.seed.cruiseMps / 60 + stopDelayMin,
      remainingM,
      mode,
      steps: mode === 'foot' ? Math.round((m.progressM - m.startM) / STRIDE_M) : 0,
      progress: m.totalM > 0 ? m.progressM / m.totalM : 1,
      ...levelAt(m.seed.levelSpans, m.totalM > 0 ? m.progressM / m.totalM : 1),
      traveledM: m.progressM - m.startM,
      trail: routeSlice(m.route, m.cum, m.startM, m.progressM),
      statusNote: m.statusNote,
    });
  }
  return {
    members,
    stops: [...s.stops],
    feed: [...s.feed],
    allArrived: members.every((m) => m.state === 'arrived'),
    arrivalOrder: [...s.arrivalOrder],
    elapsedSec: s.elapsed,
  };
}
