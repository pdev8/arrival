import { ImageSourcePropType } from 'react-native';
import { LatLng } from '../lib/geo';
import { MEMBER_PALETTE } from '../lib/colors';
import { DRIVE_ROUTES, RoutePoints, WALK_ROUTES } from './routes';

/** [lat, lng] pairs → LatLng objects */
const pts = (r: RoutePoints): LatLng[] => r.map(([latitude, longitude]) => ({ latitude, longitude }));

export type StopCategory = 'gas' | 'coffee' | 'food' | 'restroom' | 'scenic' | 'other';

export const CATEGORY_EMOJI: Record<StopCategory, string> = {
  gas: '⛽',
  coffee: '☕',
  food: '🍔',
  restroom: '🚻',
  scenic: '📸',
  other: '📍',
};

export interface MemberSeed {
  id: string;
  name: string;
  avatar: ImageSourcePropType;
  color: string;
  isYou: boolean;
  routeKey: string;
  /** starting position as fraction of total route length */
  startFrac: number;
  /** cruise speed, real m/s (~1.4 walking, ~30 driving) */
  cruiseMps: number;
}

/** Demo profile photos, bundled locally so markers paint synchronously —
 *  remote avatars flashed empty whenever cluster changes remounted a marker. */
const AVATARS = {
  you: require('../../assets/avatars/you.jpg'),
  sarah: require('../../assets/avatars/sarah.jpg'),
  mike: require('../../assets/avatars/mike.jpg'),
  jess: require('../../assets/avatars/jess.jpg'),
  alex: require('../../assets/avatars/alex.jpg'),
  priya: require('../../assets/avatars/priya.jpg'),
  noah: require('../../assets/avatars/noah.jpg'),
} as const;

export interface ScenarioPoi {
  name: string;
  category: StopCategory;
  pos: LatLng;
}

export interface Scenario {
  key: 'walk' | 'roadtrip';
  destination: { name: string; pos: LatLng };
  routes: Record<string, LatLng[]>;
  members: MemberSeed[];
  /** simulation speed multiplier so the demo plays out in a few minutes */
  timeScale: number;
  arriveRadiusM: number;
  initialRegion: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  /** scripted: a friend announces a stop when they reach this POI */
  stopEvent: { memberId: string; poi: ScenarioPoi; note: string; durationSec: number };
  /** scripted: a friend suggests a stop; an ally upvotes later */
  suggestEvent: {
    memberId: string;
    poi: ScenarioPoi;
    note: string;
    atElapsedSec: number;
    allyVote: { memberId: string; atElapsedSec: number };
  };
}

/* ------------------------------------------------------------------ */
/* NYC walking hangout — friends converging on Washington Square Park  */
/* ------------------------------------------------------------------ */

const WALK: Scenario = {
  key: 'walk',
  destination: { name: 'Washington Square Park', pos: { latitude: 40.7308, longitude: -73.9973 } },
  // Real pedestrian routes (OSRM foot profile) — they follow sidewalks and
  // cross at corners instead of cutting through blocks. See routes.ts.
  routes: Object.fromEntries(Object.entries(WALK_ROUTES).map(([k, r]) => [k, pts(r)])),
  members: [
    { id: 'you', name: 'You', avatar: AVATARS.you, color: MEMBER_PALETTE[0], isYou: true, routeKey: 'you', startFrac: 0.08, cruiseMps: 1.5 },
    { id: 'sarah', name: 'Sarah', avatar: AVATARS.sarah, color: MEMBER_PALETTE[3], isYou: false, routeKey: 'sarah', startFrac: 0.15, cruiseMps: 1.4 },
    { id: 'mike', name: 'Mike', avatar: AVATARS.mike, color: MEMBER_PALETTE[1], isYou: false, routeKey: 'mike', startFrac: 0.1, cruiseMps: 1.5 },
    { id: 'jess', name: 'Jess', avatar: AVATARS.jess, color: MEMBER_PALETTE[2], isYou: false, routeKey: 'jess', startFrac: 0.12, cruiseMps: 1.45 },
    { id: 'alex', name: 'Alex', avatar: AVATARS.alex, color: MEMBER_PALETTE[4], isYou: false, routeKey: 'alex', startFrac: 0.05, cruiseMps: 1.5 },
    { id: 'priya', name: 'Priya', avatar: AVATARS.priya, color: MEMBER_PALETTE[5], isYou: false, routeKey: 'priya', startFrac: 0.08, cruiseMps: 1.4 },
    { id: 'noah', name: 'Noah', avatar: AVATARS.noah, color: MEMBER_PALETTE[6], isYou: false, routeKey: 'noah', startFrac: 0.03, cruiseMps: 1.55 },
  ],
  timeScale: 1, // real time — a walk across the Village takes as long as it takes
  arriveRadiusM: 40,
  initialRegion: { latitude: 40.7305, longitude: -73.9965, latitudeDelta: 0.02, longitudeDelta: 0.02 },
  stopEvent: {
    memberId: 'mike',
    poi: { name: 'Think Coffee — E 8th St', category: 'coffee', pos: { latitude: 40.7306, longitude: -73.9938 } },
    note: 'Grabbing a coffee, ~3 min',
    durationSec: 180,
  },
  suggestEvent: {
    memberId: 'jess',
    poi: { name: "Joe's Pizza — Carmine St", category: 'food', pos: { latitude: 40.7305, longitude: -74.0021 } },
    note: 'Slice before the park?',
    atElapsedSec: 20,
    allyVote: { memberId: 'sarah', atElapsedSec: 40 },
  },
};

/* ------------------------------------------------------------------ */
/* Tahoe road trip — two highway corridors into South Lake Tahoe       */
/* ------------------------------------------------------------------ */

const ROADTRIP: Scenario = {
  key: 'roadtrip',
  destination: { name: 'South Lake Tahoe', pos: { latitude: 38.9399, longitude: -119.9772 } },
  // Real highway geometry (OSRM car profile) — hugs the actual US-50 and
  // I-80/CA-89 corridors instead of straight-line hops. See routes.ts.
  routes: Object.fromEntries(Object.entries(DRIVE_ROUTES).map(([k, r]) => [k, pts(r)])),
  members: [
    { id: 'you', name: 'You', avatar: AVATARS.you, color: MEMBER_PALETTE[0], isYou: true, routeKey: 'us50', startFrac: 0.2, cruiseMps: 31 },
    { id: 'sarah', name: 'Sarah', avatar: AVATARS.sarah, color: MEMBER_PALETTE[3], isYou: false, routeKey: 'us50', startFrac: 0.55, cruiseMps: 30 },
    { id: 'mike', name: 'Mike', avatar: AVATARS.mike, color: MEMBER_PALETTE[1], isYou: false, routeKey: 'us50', startFrac: 0.31, cruiseMps: 33 },
    { id: 'jess', name: 'Jess', avatar: AVATARS.jess, color: MEMBER_PALETTE[2], isYou: false, routeKey: 'i80', startFrac: 0.3, cruiseMps: 32 },
  ],
  timeScale: 25,
  arriveRadiusM: 500,
  initialRegion: { latitude: 38.85, longitude: -120.7, latitudeDelta: 1.6, longitudeDelta: 1.6 },
  stopEvent: {
    memberId: 'mike',
    poi: { name: 'Shell — Placerville', category: 'gas', pos: { latitude: 38.7296, longitude: -120.7985 } },
    note: 'Need gas, ~10 min',
    durationSec: 40,
  },
  suggestEvent: {
    memberId: 'jess',
    poi: { name: 'Burger Stop — Truckee', category: 'food', pos: { latitude: 39.328, longitude: -120.1833 } },
    note: 'Lunch on the way in?',
    atElapsedSec: 25,
    allyVote: { memberId: 'sarah', atElapsedSec: 45 },
  },
};

export const SCENARIOS: Record<'walk' | 'roadtrip', Scenario> = { walk: WALK, roadtrip: ROADTRIP };
