import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageSourcePropType } from 'react-native';
import {
  LatLng,
  cumulativeDistances,
  distanceM,
  headingAlongRoute,
  pointAlongRoute,
  routeSlice,
} from '../lib/geo';
import { Fix, Motion, motionFrom, pushFix } from '../lib/motion';
import { formatClockTime, slackMin } from '../lib/schedule';
import { CATEGORY_EMOJI, LevelSpan, MemberSeed, Scenario, StopCategory } from './data';
import { Stoplight, findLights } from './lights';
import { Reactions, toggleReaction } from './reactions';
import { sensedFix } from './sensor';

/** simulation tick interval — 4 Hz keeps marker motion fluid */
const TICK_MS = 250;
/**
 * Hard cap on stops. The map pre-mounts exactly this many pin slots
 * (MAX_STOP_PINS in session.tsx) because MapView's child list must never grow
 * at runtime — see .claude/skills/arrival-map/SKILL.md. A stop beyond the cap
 * would have no slot to render into, so it is not created at all.
 */
export const MAX_STOPS = 12;

/** Adaptive tick: once everyone has arrived nothing on the map moves, so the
 *  clock drops to 1 Hz (feed timestamps still age). Exported for tests. */
export function tickIntervalMs(allArrived: boolean): number {
  return allArrived ? 1000 : TICK_MS;
}

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
  /** bundled demo photo; live members have none until real profiles (A epic) */
  avatar?: ImageSourcePropType;
  color: string;
  isYou: boolean;
  pos: LatLng;
  /**
   * Course over ground — the way they are TRAVELLING, never the way the phone
   * points (see lib/motion). NULL when we haven't earned one: they've never
   * moved, they've been still long enough that a stale course would be a lie,
   * or the fixes are too vague to say. Null is not north. A null heading means
   * the puck shows no direction at all.
   */
  heading: number | null;
  /**
   * Are they travelling *right now* — the sensor's answer, hysteretic.
   *
   * Deliberately separate from `state`, because the two are allowed to
   * disagree: a walker stopped at a red light is socially still "walking" (the
   * copy shouldn't shout STOPPED every block) but is not moving, so their arrow
   * dims instead of pointing confidently down a street they aren't walking.
   */
  moving: boolean;
  state: MemberState;
  /** real-time minutes to destination — NULL in free roam (no destination):
   *  not "zero minutes away", but "there is nowhere to be". Every surface that
   *  shows an ETA must handle it. */
  etaMin: number | null;
  remainingM: number;
  /** foot vs car — decides whether a step count is meaningful */
  mode: 'foot' | 'car';
  /** steps taken this session (0 for drivers) */
  steps: number;
  /**
   * Minutes early (+) or late (−) against the meeting time. NULL when the
   * question has no answer: no meeting time, or no ETA. Null is not "on time" —
   * every surface that colours this must not paint an unknown green.
   */
  slackMin: number | null;
  /** fraction of their route completed, 0..1 — drives the progress rings */
  progress: number;
  /** floors relative to street (-1 = B1, 2 = F2), null when at street level */
  level: number | null;
  /** what the level is ("subway", "shops") when known */
  levelLabel?: string;
  /** distance covered this session, meters */
  traveledM: number;
  /** left the session — frozen at last-known position, excluded from convergence */
  left?: boolean;
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
  /** emoji → member ids who reacted */
  reactions?: Reactions;
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
  /** what the demo's fake receiver has reported lately — see demo/sensor.ts */
  fixes: Fix[];
  motion: Motion;
  /** sim-clock ms of the last synthesized fix, and its sequence number */
  lastFixAt: number;
  fixSeq: number;
}

/**
 * The demo's members live on a clock that runs `timeScale` faster than ours:
 * `elapsed` counts wall seconds while positions advance at
 * `cruiseMps * timeScale`. Fixes are stamped in THEIR clock, so distance over
 * time reproduces their true speed and the motion gate sees the same numbers a
 * real receiver would.
 */
const simClockMs = (s: SimState) => s.elapsed * s.scenario.timeScale * 1000;

/** one GPS reading a second, in the members' own clock */
const FIX_INTERVAL_MS = 1000;
/** how much walking history to invent for someone who joins mid-stride */
const SEED_FIXES = 10;

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
  /**
   * Where the group is heading — or NULL, which is a first-class state, not a
   * missing value. A session can start as free roam (just track us and keep
   * our trails) and get a destination later, because people decide where
   * they're going after they're already out.
   */
  destination: Destination | null;
  /** set or change the destination mid-session; everyone sees it */
  setDestination: (pos: LatLng, name: string) => void;
  /**
   * When we're supposed to BE there (ms epoch), or null for "no time to be
   * anywhere". This is what turns every ETA in the product into early-or-late.
   * Independent of the destination: you can agree on eight o'clock before you've
   * agreed on the restaurant.
   */
  meetAt: number | null;
  /** set, change, or clear (null) the meeting time; everyone sees it */
  setMeetTime: (at: number | null) => void;
  allArrived: boolean;
  /** member ids in arrival order (first → last so far) */
  arrivalOrder: string[];
  /** demo seconds since the session started — for relative feed timestamps */
  elapsedSec: number;
  vote: (stopId: string, up: boolean) => void;
  /** toggle your emoji reaction on a feed event */
  react: (eventId: string, emoji: string) => void;
  joinStop: (stopId: string) => void;
  announceStop: (pos: LatLng, category: StopCategory, note: string) => void;
  suggestStop: (pos: LatLng, category: StopCategory, note: string) => void;
}

const SCRIPTED_STOP_ID = 'stop-scripted';
const SCRIPTED_SUGGEST_ID = 'sugg-scripted';
/** how close (m) the POI must be to a member's route to make them pull over */
const ON_ROUTE_TOLERANCE_M = 300;

export interface Destination {
  name: string;
  pos: LatLng;
}

export function useSimulation(
  running: boolean,
  scenario: Scenario,
  /** null = free roam: the session starts with nowhere to be */
  initialDestination: Destination | null = scenario.destination
): Simulation {
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
      // stoplights are a street thing — walkers only, and never inside a mall
      const lights =
        seed.cruiseMps < DRIVING_MPS && scenario.key !== 'mall' ? findLights(route, cum, seed.id) : [];
      const firstLight = lights.findIndex((l) => l.atM > startM);
      // Everyone joins mid-stride, so invent the walk that got them here — a
      // member who has been moving deserves an arrow on the first frame. Anyone
      // who starts at the top of their route genuinely has no history, and
      // correctly has no direction until they earn one.
      const fixes = seedFixes(seed, route, cum, startM);
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
        fixes,
        motion: motionFrom(fixes, null, 0),
        lastFixAt: 0,
        fixSeq: 0,
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
    const ms = tickIntervalMs(snapshot.allArrived);
    const interval = setInterval(() => {
      tick(sim.current!, ms / 1000);
      publish();
    }, ms);
    return () => clearInterval(interval);
  }, [running, publish, snapshot.allArrived]);

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

  const react = useCallback(
    (eventId: string, emoji: string) => {
      const s = sim.current!;
      const e = s.feed.find((x) => x.id === eventId);
      if (!e) return;
      e.reactions = toggleReaction(e.reactions, emoji, 'you');
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
      if (s.stops.length < MAX_STOPS) s.stops.push({
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

  const [destination, setDest] = useState<Destination | null>(initialDestination);
  const setDestination = useCallback(
    (pos: LatLng, name: string) => {
      setDest({ pos, name });
      const s = sim.current;
      if (s) {
        pushFeed(s, 'you', `You set the destination: ${name}`);
        publish();
      }
    },
    [publish]
  );

  const [meetAt, setMeet] = useState<number | null>(null);
  const setMeetTime = useCallback(
    (at: number | null) => {
      setMeet(at);
      const s = sim.current;
      if (s) {
        pushFeed(s, 'you', at ? `You set the meeting time: ${formatClockTime(at)}` : 'You cleared the meeting time');
        publish();
      }
    },
    [publish]
  );

  const suggestStop = useCallback(
    (pos: LatLng, category: StopCategory, note: string) => {
      const s = sim.current!;
      const name = note.trim() || 'Suggested stop';
      if (s.stops.length < MAX_STOPS) s.stops.push({
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

  // Slack is the only field that moves on the WALL clock rather than the sim's,
  // so it's computed here at the boundary rather than inside buildSnapshot — a
  // member standing perfectly still still gets later as eight o'clock approaches.
  const members = useMemo(
    () => snapshot.members.map((m) => ({ ...m, slackMin: slackMin(m.etaMin, meetAt, Date.now()) })),
    [snapshot.members, meetAt]
  );

  return {
    ...snapshot,
    members,
    destination,
    setDestination,
    meetAt,
    setMeetTime,
    vote,
    react,
    joinStop,
    announceStop,
    suggestStop,
  };
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
    if (s.stops.length < MAX_STOPS) s.stops.push({
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
      if (s.stops.length < MAX_STOPS) s.stops.push({
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
      const greeter = s.arrivalOrder[0];
      s.arrivalOrder.push(m.seed.id);
      pushFeed(s, m.seed.id, `${m.seed.name} arrived at ${scenario.destination.name}`);
      // someone already there celebrates the arrival — feed feels alive
      if (greeter && greeter !== m.seed.id) {
        s.feed[0].reactions = { '🎉': [greeter] };
      }
    }
  }

  // THE RECEIVER. Every member — including the ones who have arrived and the
  // ones standing at a light — gets a noisy fix once a second and runs it
  // through the same gate a real phone does. Arrived members must be in here
  // too, or their last course would hang around forever instead of decaying.
  const now = simClockMs(s);
  for (const m of s.members.values()) {
    if (now - m.lastFixAt < FIX_INTERVAL_MS) continue;
    m.lastFixAt = now;
    m.fixSeq++;
    const standingStill = m.arrived || m.stopUntil !== null || m.waitUntil !== null;
    const { pos } = pointAlongRoute(m.route, m.cum, m.progressM);
    const course = headingAlongRoute(m.route, m.cum, m.progressM, lookAheadM(m.seed));
    const fix = sensedFix(
      m.seed.id,
      m.fixSeq,
      pos,
      course,
      standingStill ? 0 : m.seed.cruiseMps,
      now
    );
    m.fixes = pushFix(m.fixes, fix);
    m.motion = motionFrom(m.fixes, m.motion, now);
  }
}

/** look-ahead window scaled to speed, so the arrow sweeps through turns */
const lookAheadM = (seed: MemberSeed) => Math.max(8, seed.cruiseMps * 6);

/**
 * The walk that got them to their start line. Real fixes, lightly dirtied —
 * enough history for the gate to hand them a direction immediately, rather than
 * making every member start the demo as a directionless circle for ten seconds.
 */
function seedFixes(seed: MemberSeed, route: LatLng[], cum: number[], startM: number): Fix[] {
  const fixes: Fix[] = [];
  for (let k = SEED_FIXES; k >= 1; k--) {
    const atM = startM - seed.cruiseMps * k;
    if (atM < 0) continue;
    const { pos } = pointAlongRoute(route, cum, atM);
    const course = headingAlongRoute(route, cum, atM, lookAheadM(seed));
    fixes.push(sensedFix(seed.id, -k, pos, course, seed.cruiseMps, -k * FIX_INTERVAL_MS));
  }
  return fixes;
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
    // The RENDERED position is the clean one — the noise lives in the fixes we
    // hand the gate (demo/sensor.ts), not in where the puck is drawn. Direction
    // is what we're making honest here; position smoothing is its own problem.
    const { pos } = pointAlongRoute(m.route, m.cum, m.progressM);
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
      heading: m.motion.heading,
      moving: m.motion.moving,
      state: m.arrived ? 'arrived' : m.stopUntil !== null ? 'stopped' : moving,
      etaMin: remainingM / m.seed.cruiseMps / 60 + stopDelayMin,
      // filled in at the hook's boundary: slack runs on the wall clock, not the
      // sim's, and buildSnapshot has no business knowing what time it is
      slackMin: null,
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
