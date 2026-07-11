// Fetches real street-following geometry from OSRM (foot + car profiles),
// simplifies it, and emits src/demo/routes.ts for the Arrival demo.
import { writeFileSync } from 'node:fs';

const DEST = [-73.9973, 40.7308]; // Washington Square Park [lng, lat]
const WALKS = {
  you: [-73.9911, 40.7359], // Union Square
  sarah: [-73.9992, 40.7237], // SoHo
  mike: [-73.9907, 40.7299], // Astor Pl
  jess: [-74.0027, 40.7338], // Christopher & 7th
  alex: [-73.995, 40.7443], // W 23rd & 7th
  priya: [-73.9878, 40.7183], // Delancey & Essex
  noah: [-73.988, 40.7484], // Herald Sq
};
const TAHOE = [-119.9772, 38.9399];
const DRIVES = {
  us50: [[-121.4944, 38.5816], [-120.7985, 38.7296], TAHOE], // via Placerville (Shell stop)
  i80: [[-121.288, 38.7521], [-120.1833, 39.328], TAHOE], // via Truckee (Burger stop)
};

async function route(profile, coords) {
  const path = coords.map((c) => c.join(',')).join(';');
  const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/${profile}/${path}?geometries=geojson&overview=full`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.code !== 'Ok') throw new Error(`${profile} ${path}: ${json.code}`);
  return json.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

// Douglas–Peucker on [lat, lng] pairs, tolerance in degrees.
function simplify(pts, tol) {
  if (pts.length <= 2) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = pointSegDist(pts[i], pts[a], pts[b]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol) {
      keep[idx] = true;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function pointSegDist([py, px], [ay, ax], [by, bx]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

const round = (pts) => pts.map(([lat, lng]) => [+lat.toFixed(5), +lng.toFixed(5)]);

const walk = {};
for (const [id, start] of Object.entries(WALKS)) {
  const pts = await route('foot', [start, DEST]);
  walk[id] = round(simplify(pts, 0.00002)); // ~6m
  console.log(`walk ${id}: ${pts.length} -> ${walk[id].length} pts`);
}

const drive = {};
for (const [id, coords] of Object.entries(DRIVES)) {
  const pts = await route('car', coords);
  drive[id] = round(simplify(pts, 0.0003)); // ~60m
  console.log(`drive ${id}: ${pts.length} -> ${drive[id].length} pts`);
}

const fmt = (obj) =>
  Object.entries(obj)
    .map(([k, pts]) => `  ${k}: [\n    ${JSON.stringify(pts).slice(1, -1).replaceAll('],[', '], [')}\n  ],`)
    .join('\n');

const out = `/**
 * Street-following demo routes, generated from OSRM (OpenStreetMap) foot/car
 * profiles and Douglas-Peucker-simplified. [lat, lng] pairs. Regenerate with
 * the fetch-routes script if start points or destinations change.
 */
export type RoutePoints = [number, number][];

export const WALK_ROUTES: Record<string, RoutePoints> = {
${fmt(walk)}
};

export const DRIVE_ROUTES: Record<string, RoutePoints> = {
${fmt(drive)}
};
`;
writeFileSync(new URL('../src/demo/routes.ts', import.meta.url), out);
console.log('wrote src/demo/routes.ts');
