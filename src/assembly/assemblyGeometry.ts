import type { Length } from "@/units/length";
import { metres } from "@/units/length";
import { circleOverlapsPolygon, distance, pointInPolygon, type Vec2 } from "@/math/vec2";
import type { Movement } from "@/domain/movement";
import type { Frame, Outline } from "@/domain/frame";
import type { Gear } from "@/domain/gear";
import type { Jewel } from "@/domain/jewel";
import type { Shaft, ShaftEnd, ShaftId } from "@/domain/shaft";

/** Closed-open axial interval [lo, hi] in metres. */
export interface ZRange {
  lo: number;
  hi: number;
}

export function frameZRange(frame: Frame): ZRange {
  return { lo: frame.zBottom, hi: frame.zBottom + frame.thickness };
}

export function gearZRange(gear: Gear): ZRange {
  return { lo: gear.zCentre - gear.thickness / 2, hi: gear.zCentre + gear.thickness / 2 };
}

/** True if the intervals share a non-zero length. Touching faces do not overlap. */
export function zOverlaps(a: ZRange, b: ZRange): boolean {
  return a.lo < b.hi && b.lo < a.hi;
}

export function outlineProblems(outline: Outline): string[] {
  if (outline.kind === "CIRCLE") {
    return [
      ...(Number.isFinite(outline.centre.x) && Number.isFinite(outline.centre.y) ? [] : ["outline centre must be finite"]),
      ...(Number.isFinite(outline.radius) && outline.radius > 0 ? [] : ["outline diameter must be a positive length"]),
    ];
  }
  return [
    ...(outline.points.length >= 3 ? [] : ["outline polygon needs at least three points"]),
    ...(outline.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) ? [] : ["every outline point must be finite"]),
  ];
}

/** A frame whose geometry is fully defined: usable by geometric checks and drawing. */
export function isCompleteFrame(frame: Frame): boolean {
  return (
    outlineProblems(frame.outline).length === 0 &&
    Number.isFinite(frame.zBottom) &&
    Number.isFinite(frame.thickness) &&
    frame.thickness > 0
  );
}

export function outlineContains(outline: Outline, p: Vec2): boolean {
  return outline.kind === "CIRCLE"
    ? distance(outline.centre, p) < outline.radius
    : pointInPolygon(p, outline.points);
}

export function outlineOverlapsCircle(outline: Outline, centre: Vec2, radius: number): boolean {
  return outline.kind === "CIRCLE"
    ? distance(outline.centre, centre) < outline.radius + radius
    : circleOverlapsPolygon(centre, radius, outline.points);
}

export function isPositiveLength(value: Length): boolean {
  return Number.isFinite(value) && value > 0;
}

export interface ShaftSupport {
  lower: Jewel | null;
  upper: Jewel | null;
  /** Jewels beyond the first for an end (a shaft end has one bearing). */
  duplicates: Jewel[];
}

export function shaftSupport(movement: Movement, shaftId: ShaftId): ShaftSupport {
  const support: ShaftSupport = { lower: null, upper: null, duplicates: [] };
  for (const jewel of Object.values(movement.jewels)) {
    if (jewel.shaftId !== shaftId) continue;
    const key = jewel.end === "LOWER" ? "lower" : "upper";
    if (support[key] === null) support[key] = jewel;
    else support.duplicates.push(jewel);
  }
  return support;
}

/** Value derived from possibly-unknown inputs. Unknown inputs are named, never defaulted. */
export type DerivedLength =
  | { status: "KNOWN"; value: Length }
  | { status: "UNKNOWN"; missing: string[] }
  | { status: "INVALID_INPUT"; reason: string };

/**
 * Side shake at one shaft end: bore diameter − pivot diameter.
 * Reported as a diametral clearance (ASM-0013, SRC-0011). Its
 * acceptability is only advised against an informal, unconfirmed
 * reference figure (BRG-007, ASM-0029), never a validated limit.
 */
export function sideShake(shaft: Shaft, end: ShaftEnd, jewel: Jewel | null): DerivedLength {
  if (jewel === null) return { status: "UNKNOWN", missing: [`${end.toLowerCase()} bearing`] };
  const pivot = shaft.pivotDiameter[end];
  const bore = jewel.boreDiameter;
  const missing = [
    ...(pivot === null ? [`${end.toLowerCase()} pivot diameter`] : []),
    ...(bore === null ? [`${jewel.name} bore`] : []),
  ];
  if (pivot === null || bore === null) return { status: "UNKNOWN", missing };
  if (!isPositiveLength(pivot)) return { status: "INVALID_INPUT", reason: `${end.toLowerCase()} pivot diameter must be a positive length` };
  if (!isPositiveLength(bore)) return { status: "INVALID_INPUT", reason: `${jewel.name} bore must be a positive length` };
  return { status: "KNOWN", value: metres(bore - pivot) };
}

/**
 * Axial space between the two bearings' inner faces. Bearing faces are
 * taken as flush with the frames' inner faces (ASM-0011).
 */
export function bearingInnerSpan(movement: Movement, support: ShaftSupport): DerivedLength {
  const lowerFrame = support.lower === null ? undefined : movement.frames[support.lower.frameId];
  const upperFrame = support.upper === null ? undefined : movement.frames[support.upper.frameId];
  if (lowerFrame === undefined || upperFrame === undefined) {
    return { status: "UNKNOWN", missing: ["lower and upper bearings in existing frames"] };
  }
  if (!isCompleteFrame(lowerFrame) || !isCompleteFrame(upperFrame)) {
    return { status: "UNKNOWN", missing: ["complete frame dimensions"] };
  }
  return { status: "KNOWN", value: metres(upperFrame.zBottom - frameZRange(lowerFrame).hi) };
}

/** Endshake: bearing inner span − shoulder span (ASM-0011). */
export function endshake(movement: Movement, shaft: Shaft, support: ShaftSupport): DerivedLength {
  const span = bearingInnerSpan(movement, support);
  if (span.status !== "KNOWN") return span;
  if (shaft.shoulderSpan === null) return { status: "UNKNOWN", missing: ["shoulder span"] };
  if (!isPositiveLength(shaft.shoulderSpan)) return { status: "INVALID_INPUT", reason: "shoulder span must be a positive length" };
  return { status: "KNOWN", value: metres(span.value - shaft.shoulderSpan) };
}

/**
 * Axial extent physically occupied by a shaft's arbor: from its lower
 * bearing's frame to its upper bearing's frame, widened to cover any
 * gear mounted outside that span. Null if the shaft has neither
 * bearings nor gears.
 */
export function arborZRange(movement: Movement, shaftId: ShaftId): ZRange | null {
  const ranges: ZRange[] = [];
  for (const jewel of Object.values(movement.jewels)) {
    const frame = movement.frames[jewel.frameId];
    if (jewel.shaftId === shaftId && frame !== undefined && isCompleteFrame(frame)) ranges.push(frameZRange(frame));
  }
  for (const gear of Object.values(movement.gears)) {
    if (gear.shaftId === shaftId && Number.isFinite(gear.zCentre) && Number.isFinite(gear.thickness)) {
      ranges.push(gearZRange(gear));
    }
  }
  if (ranges.length === 0) return null;
  return { lo: Math.min(...ranges.map((r) => r.lo)), hi: Math.max(...ranges.map((r) => r.hi)) };
}
