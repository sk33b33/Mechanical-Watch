import type { Length } from "@/units/length";
import { metres } from "@/units/length";
import type { Angle } from "@/units/angle";

/** A point in the mainplate plane (movement coordinates, metres). */
export interface Vec2 {
  x: Length;
  y: Length;
}

export function vec2(x: Length, y: Length): Vec2 {
  return { x, y };
}

export function isFiniteVec2(v: Vec2): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y);
}

export function distance(a: Vec2, b: Vec2): Length {
  return metres(Math.hypot(a.x - b.x, a.y - b.y));
}

/** Point at `dist` from `origin` in direction `angle` (from +X, counter-clockwise). */
export function polarOffset(origin: Vec2, dist: Length, angle: Angle): Vec2 {
  return {
    x: metres(origin.x + dist * Math.cos(angle)),
    y: metres(origin.y + dist * Math.sin(angle)),
  };
}

/** Even-odd ray cast. Points exactly on an edge may fall either way. */
export function pointInPolygon(p: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (a === undefined || b === undefined) continue;
    const crosses = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** True if a disc of `radius` around `centre` shares any area with the polygon. */
export function circleOverlapsPolygon(centre: Vec2, radius: number, polygon: readonly Vec2[]): boolean {
  if (pointInPolygon(centre, polygon)) return true;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (a === undefined || b === undefined) continue;
    if (distanceToSegment(centre, a, b) < radius) return true;
  }
  return false;
}
