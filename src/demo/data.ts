import { LatLng } from '../lib/geo';
import { MEMBER_PALETTE } from '../lib/colors';

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
  avatarUrl: string;
  color: string;
  isYou: boolean;
  routeKey: string;
  /** starting position as fraction of total route length */
  startFrac: number;
  /** cruise speed, real m/s (~1.4 walking, ~30 driving) */
  cruiseMps: number;
}

/** Demo profile photos (stable portrait CDN) — real users upload their own. */
const AVATARS = {
  you: 'https://randomuser.me/api/portraits/men/32.jpg',
  sarah: 'https://randomuser.me/api/portraits/women/44.jpg',
  mike: 'https://randomuser.me/api/portraits/men/76.jpg',
  jess: 'https://randomuser.me/api/portraits/women/68.jpg',
  alex: 'https://randomuser.me/api/portraits/men/45.jpg',
  priya: 'https://randomuser.me/api/portraits/women/12.jpg',
  noah: 'https://randomuser.me/api/portraits/men/22.jpg',
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
  // Waypoints trace the sidewalk grid block-by-block (best-effort without a
  // pedestrian-routing API); Chaikin smoothing rounds every corner at load.
  routes: {
    // Union Square → down Broadway → west on Washington Pl → the park
    you: [
      { latitude: 40.7359, longitude: -73.9911 },
      { latitude: 40.7348, longitude: -73.992 },
      { latitude: 40.7332, longitude: -73.9929 },
      { latitude: 40.7317, longitude: -73.9938 },
      { latitude: 40.7305, longitude: -73.9946 },
      { latitude: 40.731, longitude: -73.9958 },
      { latitude: 40.7312, longitude: -73.9971 },
      { latitude: 40.7308, longitude: -73.9973 },
    ],
    // SoHo → north up LaGuardia Pl → park SW corner
    sarah: [
      { latitude: 40.7237, longitude: -73.9992 },
      { latitude: 40.726, longitude: -73.9992 },
      { latitude: 40.7283, longitude: -73.9985 },
      { latitude: 40.7297, longitude: -73.9979 },
      { latitude: 40.7308, longitude: -73.9973 },
    ],
    // Astor Pl → west along E 8th/Waverly → park NE corner
    mike: [
      { latitude: 40.7299, longitude: -73.9907 },
      { latitude: 40.7303, longitude: -73.9922 },
      { latitude: 40.7306, longitude: -73.9938 },
      { latitude: 40.731, longitude: -73.9958 },
      { latitude: 40.7311, longitude: -73.997 },
      { latitude: 40.7308, longitude: -73.9973 },
    ],
    // Christopher & 7th Ave → east on W 4th → park SW corner
    jess: [
      { latitude: 40.7338, longitude: -74.0027 },
      { latitude: 40.7328, longitude: -74.0012 },
      { latitude: 40.7318, longitude: -73.9999 },
      { latitude: 40.7312, longitude: -73.9987 },
      { latitude: 40.7305, longitude: -73.998 },
      { latitude: 40.7308, longitude: -73.9973 },
    ],
    // Chelsea: W 23rd & 7th → east to 5th Ave → straight down to the Arch
    alex: [
      { latitude: 40.7443, longitude: -73.995 },
      { latitude: 40.742, longitude: -73.9891 },
      { latitude: 40.7382, longitude: -73.992 },
      { latitude: 40.7353, longitude: -73.9941 },
      { latitude: 40.7332, longitude: -73.9956 },
      { latitude: 40.7316, longitude: -73.9971 },
      { latitude: 40.7308, longitude: -73.9973 },
    ],
    // Lower East Side: Delancey & Essex → northwest → up LaGuardia
    priya: [
      { latitude: 40.7183, longitude: -73.9878 },
      { latitude: 40.7205, longitude: -73.993 },
      { latitude: 40.7237, longitude: -73.9958 },
      { latitude: 40.7266, longitude: -73.9989 },
      { latitude: 40.7288, longitude: -73.9986 },
      { latitude: 40.7308, longitude: -73.9973 },
    ],
    // Midtown: Herald Sq → down Broadway → joins your route at Union Sq
    noah: [
      { latitude: 40.7484, longitude: -73.988 },
      { latitude: 40.742, longitude: -73.9893 },
      { latitude: 40.7359, longitude: -73.9911 },
      { latitude: 40.7332, longitude: -73.9929 },
      { latitude: 40.7305, longitude: -73.9946 },
      { latitude: 40.7312, longitude: -73.9971 },
      { latitude: 40.7308, longitude: -73.9973 },
    ],
  },
  members: [
    { id: 'you', name: 'You', avatarUrl: AVATARS.you, color: MEMBER_PALETTE[0], isYou: true, routeKey: 'you', startFrac: 0.08, cruiseMps: 1.5 },
    { id: 'sarah', name: 'Sarah', avatarUrl: AVATARS.sarah, color: MEMBER_PALETTE[3], isYou: false, routeKey: 'sarah', startFrac: 0.15, cruiseMps: 1.4 },
    { id: 'mike', name: 'Mike', avatarUrl: AVATARS.mike, color: MEMBER_PALETTE[1], isYou: false, routeKey: 'mike', startFrac: 0.1, cruiseMps: 1.5 },
    { id: 'jess', name: 'Jess', avatarUrl: AVATARS.jess, color: MEMBER_PALETTE[2], isYou: false, routeKey: 'jess', startFrac: 0.12, cruiseMps: 1.45 },
    { id: 'alex', name: 'Alex', avatarUrl: AVATARS.alex, color: MEMBER_PALETTE[4], isYou: false, routeKey: 'alex', startFrac: 0.05, cruiseMps: 1.5 },
    { id: 'priya', name: 'Priya', avatarUrl: AVATARS.priya, color: MEMBER_PALETTE[5], isYou: false, routeKey: 'priya', startFrac: 0.08, cruiseMps: 1.4 },
    { id: 'noah', name: 'Noah', avatarUrl: AVATARS.noah, color: MEMBER_PALETTE[6], isYou: false, routeKey: 'noah', startFrac: 0.03, cruiseMps: 1.55 },
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

const US50: LatLng[] = [
  { latitude: 38.5816, longitude: -121.4944 },
  { latitude: 38.6244, longitude: -121.3272 },
  { latitude: 38.678, longitude: -121.1761 },
  { latitude: 38.6857, longitude: -121.0405 },
  { latitude: 38.7296, longitude: -120.7985 },
  { latitude: 38.7613, longitude: -120.5863 },
  { latitude: 38.777, longitude: -120.2945 },
  { latitude: 38.811, longitude: -120.124 },
  { latitude: 38.8145, longitude: -120.032 },
  { latitude: 38.8574, longitude: -119.982 },
  { latitude: 38.9399, longitude: -119.9772 },
];

const I80: LatLng[] = [
  { latitude: 38.7521, longitude: -121.288 },
  { latitude: 38.8966, longitude: -121.0769 },
  { latitude: 39.1007, longitude: -120.9533 },
  { latitude: 39.2937, longitude: -120.6743 },
  { latitude: 39.328, longitude: -120.1833 },
  { latitude: 39.1677, longitude: -120.1452 },
  { latitude: 39.0322, longitude: -120.1204 },
  { latitude: 38.9399, longitude: -119.9772 },
];

const ROADTRIP: Scenario = {
  key: 'roadtrip',
  destination: { name: 'South Lake Tahoe', pos: { latitude: 38.9399, longitude: -119.9772 } },
  routes: { us50: US50, i80: I80 },
  members: [
    { id: 'you', name: 'You', avatarUrl: AVATARS.you, color: MEMBER_PALETTE[0], isYou: true, routeKey: 'us50', startFrac: 0.2, cruiseMps: 31 },
    { id: 'sarah', name: 'Sarah', avatarUrl: AVATARS.sarah, color: MEMBER_PALETTE[3], isYou: false, routeKey: 'us50', startFrac: 0.55, cruiseMps: 30 },
    { id: 'mike', name: 'Mike', avatarUrl: AVATARS.mike, color: MEMBER_PALETTE[1], isYou: false, routeKey: 'us50', startFrac: 0.31, cruiseMps: 33 },
    { id: 'jess', name: 'Jess', avatarUrl: AVATARS.jess, color: MEMBER_PALETTE[2], isYou: false, routeKey: 'i80', startFrac: 0.3, cruiseMps: 32 },
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
