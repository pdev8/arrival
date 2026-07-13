import React, { useMemo, useRef } from 'react';
import { Polyline } from 'react-native-maps';
import { SimMember } from '../demo/simulation';
import { LatLng, distanceM } from '../lib/geo';
import { TRAIL_ALPHAS, TRAIL_PARTS, alphaHex, buildSegments, headSegment } from '../lib/trail';

/** the settled body is rebuilt every this many metres; the head is live */
const BODY_UPDATE_M = 15;
/** …but while the trail is still young, rebuild it every this many metres.
 *  A brand-new member has traveled ~0 m, so a flat 15 m bucket cached an EMPTY
 *  body and didn't recompute for ~11 s of walking — turning trails on early
 *  showed nothing at all ("the initial trace takes a while to kick in"). */
const YOUNG_TRAIL_M = 40;
const YOUNG_UPDATE_M = 4;
/** how far a member must move before the live head redraws (~1s of walking) */
const HEAD_STEP_M = 1.5;
/** nothing drawn — the polyline stays mounted, it just has no geometry */
const EMPTY: LatLng[] = [];

/**
 * A member's breadcrumb trail, as dotted native polylines.
 *
 * ── The two rules that make this work on Apple Maps ──────────────────────────
 *
 * 1. NEVER CHANGE MAPVIEW'S CHILD LIST. AIRMap doesn't override
 *    didUpdateReactSubviews, so it inherits RN's default, which calls
 *    addSubview() on every child — and AIRMap remaps addSubview of a marker to
 *    addAnnotation:. So mounting or unmounting ONE polyline re-adds EVERY
 *    member's annotation, re-running mapView:viewForAnnotation:. If that query
 *    lands before a marker's react children are attached, rn-maps returns an
 *    MKMarkerAnnotationView — a big coloured balloon. That is the "dot
 *    splatter" (and, when it goes the other way, a vanished puck).
 *    => This component ALWAYS renders exactly TRAIL_PARTS + 1 polylines per
 *       member, mounted for the life of the session. Hidden ones simply carry
 *       no coordinates.
 *
 * 2. VISIBILITY IS DRIVEN BY COORDINATES, NEVER BY strokeColor. In
 *    AIRMapPolyline.m the MKPolylineRenderer is created in exactly one place —
 *    setCoordinates: — and every other setter only mutates the existing,
 *    already-rasterized renderer. Nothing ever calls setNeedsDisplay. So a
 *    strokeColor change does not redraw: that's why toggling trails "did
 *    nothing" except for members whose coordinates happened to change anyway.
 *
 * The head is live: the body is memoized (settled points can't change), but the
 * final polyline is redrawn as the member moves, so a dot follows them. The
 * body used to be the WHOLE trail, rebuilt only every 20 m — at walking pace
 * that froze the trail for ~14 s at a time ("the trail goes cold").
 *
 * Dash patterns are in screen points and zoom-compensated by MapKit, but they
 * re-rasterize on every zoom CHANGE — session.tsx therefore applies the follow
 * zoom once, not on every tick. Never add strokeColors here: the gradient
 * renderer breaks dash scaling and doubles width. Keep ≥3 points per polyline
 * (#5285: 2-point polylines vanish on Apple Maps).
 */
export function TrailPath({ member, visible = true }: { member: SimMember; visible?: boolean }) {
  // BODY: settled points. Rebuilt when the member crosses a distance bucket —
  // finely at first (so a new trail appears at once), coarsely once it's long
  // enough that the head carries the live part anyway.
  const step = member.traveledM < YOUNG_TRAIL_M ? YOUNG_UPDATE_M : BODY_UPDATE_M;
  const bucket = Math.floor(member.traveledM / step);
  const trailRef = useRef(member.trail);
  trailRef.current = member.trail;
  const body = useMemo(
    () => buildSegments(trailRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bucket, member.id]
  );

  // HEAD: bridges the last settled point to where the member is NOW. It must
  // NOT depend on the body existing — at session start the body is legitimately
  // empty (no distance travelled yet), and anchoring off it meant no trail was
  // drawn at all until the first bucket flipped. Fall back to the trail's own
  // start, so a dot follows a member from their very first step.
  // Quantized to HEAD_STEP_M so we redraw ~once a second per walker rather
  // than on every 4 Hz tick (each coordinates change costs a native
  // removeOverlay/addOverlay).
  const anchor = body.length
    ? body[body.length - 1][body[body.length - 1].length - 1]
    : (member.trail[0] ?? null);
  const headStep = Math.floor(
    (anchor ? distanceM(anchor, member.pos) : 0) / HEAD_STEP_M
  );
  const head = useMemo(() => {
    if (headStep === 0) return EMPTY;
    return headSegment(anchor, member.pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, headStep, member.id]);

  const foot = member.mode === 'foot';
  const width = foot ? 5 : 3.5;
  const dash = foot ? [0.1, 11] : [8, 6];

  // Fixed child count, always. Hidden or short trails render empty polylines.
  return (
    <>
      {Array.from({ length: TRAIL_PARTS }, (_, i) => (
        <Polyline
          key={`${member.id}-seg-${i}`}
          coordinates={visible ? (body[i] ?? EMPTY) : EMPTY}
          strokeColor={`${member.color}${alphaHex(TRAIL_ALPHAS[i] ?? 0.85)}`}
          strokeWidth={width}
          lineCap="round"
          lineJoin="round"
          lineDashPattern={dash}
          zIndex={4}
        />
      ))}
      <Polyline
        key={`${member.id}-head`}
        coordinates={visible ? head : EMPTY}
        strokeColor={`${member.color}${alphaHex(TRAIL_ALPHAS[TRAIL_PARTS - 1] ?? 0.85)}`}
        strokeWidth={width}
        lineCap="round"
        lineJoin="round"
        lineDashPattern={dash}
        zIndex={4}
      />
    </>
  );
}
