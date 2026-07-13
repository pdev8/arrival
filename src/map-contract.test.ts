import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * THE MAP RENDERING CONTRACT — executable.
 *
 * The map is the product: if pucks vanish or flash, nothing else matters. Each
 * rule below cost a round of on-device debugging, and three of them were
 * re-broken later by changes that looked obviously safe. A document didn't
 * stop that. This does.
 *
 * These are static assertions over the source. They're deliberately blunt: a
 * false alarm costs you a minute, a regression costs a day of two-phone
 * testing. If one fails, read .claude/skills/arrival-map/SKILL.md — you broke
 * the map. Do not "fix" the test.
 *
 * Platform truths behind the rules (verified in the vendored rn-maps source,
 * node_modules/react-native-maps/ios/AirMaps/):
 *  - AIRMap doesn't override didUpdateReactSubviews, so ANY change to MapView's
 *    child list re-adds EVERY marker annotation → MapKit re-queries
 *    viewForAnnotation → default MKMarkerAnnotationView flashes ("dot
 *    splatter") or the custom view is lost (vanished puck).
 *  - A Polyline's renderer is created only in setCoordinates:. A strokeColor
 *    change never redraws.
 *  - Dash patterns re-rasterize on every zoom change.
 */

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

const session = read('app/session.tsx');
const trail = read('src/components/TrailPath.tsx');
const marker = read('src/components/MemberMarker.tsx');

/** the JSX inside <MapView> … </MapView> — where every rule applies */
const mapChildren = (() => {
  const open = session.indexOf('<MapView');
  const bodyStart = session.indexOf('>', session.indexOf('onLongPress'));
  const close = session.indexOf('</MapView>');
  expect(open).toBeGreaterThan(-1);
  expect(close).toBeGreaterThan(bodyStart);
  return session.slice(bodyStart, close);
})();

/** strip comments — the rules are about code, and the comments quote the bugs */
const code = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const mapCode = code(mapChildren);
const trailCode = code(trail);
const markerCode = code(marker);

describe('map contract: MapView’s child list is static', () => {
  // Mounting or unmounting ONE child re-adds every marker annotation.
  it('never filters members before rendering markers', () => {
    expect(mapCode).not.toMatch(/sim\.members[\s\S]{0,40}\.filter\(/);
  });

  it('never conditionally renders anything under MapView', () => {
    // `cond && <Foo />` and ternaries into JSX both mount/unmount children
    expect(mapCode).not.toMatch(/&&\s*</);
    expect(mapCode).not.toMatch(/\?\s*<[A-Z]/);
  });

  it('has no clustering: facepiles mounted and unmounted members', () => {
    expect(session).not.toMatch(/useClusters|clusterVisibility|ClusterMarker/);
  });

  it('renders one TrailPath per member, unconditionally', () => {
    expect(mapCode).toMatch(/sim\.members\.map\([\s\S]{0,120}<TrailPath/);
  });

  it('renders markers BEFORE trails (child order is load-bearing)', () => {
    expect(mapCode.indexOf('<MemberMarker')).toBeGreaterThan(-1);
    expect(mapCode.indexOf('<TrailPath')).toBeGreaterThan(mapCode.indexOf('<MemberMarker'));
  });
});

describe('map contract: polyline visibility is coordinates, never strokeColor', () => {
  it('TrailPath never unmounts itself', () => {
    expect(trailCode).not.toMatch(/if\s*\(\s*!\s*visible\s*\)\s*return\s+null/);
  });

  it('TrailPath drives visibility through coordinates', () => {
    expect(trailCode).toMatch(/coordinates=\{[^}]*visible/);
  });

  it('TrailPath never hides a line with a transparent stroke (it will not redraw)', () => {
    expect(trailCode).not.toMatch(/transparent/i);
  });
});

describe('map contract: the trail head is live', () => {
  it('uses headSegment so a dot follows a moving member', () => {
    expect(trailCode).toMatch(/headSegment\(/);
  });

  it('the head does not require a settled body (a new member has travelled 0m)', () => {
    expect(trailCode).toMatch(/member\.trail\[0\]/);
  });
});

describe('map contract: the marker’s custom view is static', () => {
  it('the puck child is memoized separately from the Marker', () => {
    expect(markerCode).toMatch(/const Puck = React\.memo\(/);
  });

  it('the puck never receives position (that would re-render it 4x/second)', () => {
    const puckProps = markerCode.slice(markerCode.indexOf('<Puck'), markerCode.indexOf('/>', markerCode.indexOf('<Puck')));
    expect(puckProps).not.toMatch(/\bpos\b|coordinate/);
  });

  it('selection does not restyle the puck (it rebuilds the native view → flash)', () => {
    expect(markerCode).not.toMatch(/selected\s*&&\s*styles\./);
  });

  it('the map tag uses the coarse ETA (a per-second countdown churns the view)', () => {
    expect(markerCode).toMatch(/formatEtaCoarse/);
    expect(markerCode).not.toMatch(/formatEtaClock/);
  });
});

describe('map contract: the camera never re-applies zoom on the tick', () => {
  it('zoom/altitude is passed only on the transition into follow', () => {
    // the tick path must call setCamera with center only
    expect(session).toMatch(/setCamera\(\{\s*center:[^}]*\}\)/);
    // and the zoomed framing must be guarded by a "have we already framed them" ref
    expect(session).toMatch(/followedRef/);
  });

  it('re-centres only after the member has actually moved', () => {
    expect(session).toMatch(/RECENTER_M/);
  });
});

describe('map contract: the Trails toggle is authoritative', () => {
  it('selection does not force a trail on (the user could not turn it off)', () => {
    expect(mapCode).not.toMatch(/visible=\{[^}]*selectedId/);
    expect(mapCode).toMatch(/visible=\{showTrails\}/);
  });
});
