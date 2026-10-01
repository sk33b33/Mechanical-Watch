import type { Point2D } from "./gearOutline";

/**
 * Where a line (base + t·dir, |dir| = 1) crosses a solid's 2D footprint,
 * as a range of the line's own parameter t. Used to fill the section
 * view's cut faces (STATUS.md "section view has no caps"): every solid
 * drawn by this app is a Z-extrusion of a 2D footprint, and the section
 * plane is always vertical (SectionState in viewport.ts), so a cap is
 * just these t-intervals turned into a vertical quad at each one.
 */
export interface Interval {
  t0: number;
  t1: number;
}

const EPSILON = 1e-12;

/** The chord where a line crosses a circle, or null if it misses (or is tangent). */
export function lineCircleInterval(base: Point2D, dir: Point2D, centre: Point2D, radius: number): Interval | null {
  const dx = base.x - centre.x;
  const dy = base.y - centre.y;
  const b = dir.x * dx + dir.y * dy;
  const c = dx * dx + dy * dy - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const t0 = -b - root;
  const t1 = -b + root;
  return t1 - t0 > EPSILON ? { t0, t1 } : null;
}

/**
 * Where a line crosses a simple (non-self-intersecting) closed polygon,
 * as t-intervals, even-odd rule. Works for any winding and for concave
 * outlines (gear teeth), not just convex ones.
 */
export function linePolygonIntervals(base: Point2D, dir: Point2D, polygon: readonly Point2D[]): Interval[] {
  const crossings: number[] = [];
  const n = polygon.length;
  for (let i = 0; i < n; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    if (a === undefined || b === undefined) continue;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const det = ex * dir.y - ey * dir.x;
    if (Math.abs(det) < EPSILON) continue; // edge parallel to the line: no isolated crossing
    const rx = a.x - base.x;
    const ry = a.y - base.y;
    const s = (dir.x * ry - dir.y * rx) / det;
    if (s < 0 || s >= 1) continue; // half-open so a shared vertex is counted once
    crossings.push((ex * ry - ey * rx) / det);
  }
  crossings.sort((p, q) => p - q);
  const intervals: Interval[] = [];
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const t0 = crossings[i];
    const t1 = crossings[i + 1];
    if (t0 !== undefined && t1 !== undefined && t1 - t0 > EPSILON) intervals.push({ t0, t1 });
  }
  return intervals;
}

function subtractOne(seg: Interval, hole: Interval): Interval[] {
  if (hole.t1 <= seg.t0 || hole.t0 >= seg.t1) return [seg];
  const pieces: Interval[] = [];
  if (hole.t0 - seg.t0 > EPSILON) pieces.push({ t0: seg.t0, t1: hole.t0 });
  if (seg.t1 - hole.t1 > EPSILON) pieces.push({ t0: hole.t1, t1: seg.t1 });
  return pieces;
}

/** `base` minus every interval in `cut` (e.g. a gear's outline minus its bore). */
export function subtractIntervals(base: readonly Interval[], cut: readonly Interval[]): Interval[] {
  let result: Interval[] = [...base];
  for (const hole of cut) result = result.flatMap((seg) => subtractOne(seg, hole));
  return result;
}

/**
 * Footprint of a bar extending from the local origin by `length` in
 * direction `angle`, `width` across (e.g. the pallet fork's lever and
 * arms, each a `THREE.BoxGeometry` translated then rotated the same way).
 */
export function barFootprint(angle: number, length: number, width: number): Point2D[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rotate = (x: number, y: number): Point2D => ({ x: x * c - y * s, y: x * s + y * c });
  const half = width / 2;
  return [rotate(0, -half), rotate(length, -half), rotate(length, half), rotate(0, half)];
}

/** Footprint of an axis-aligned square of side `size`, centred at `centre` (e.g. a pallet stone). */
export function squareFootprint(centre: Point2D, size: number): Point2D[] {
  const half = size / 2;
  return [
    { x: centre.x - half, y: centre.y - half },
    { x: centre.x + half, y: centre.y - half },
    { x: centre.x + half, y: centre.y + half },
    { x: centre.x - half, y: centre.y + half },
  ];
}
