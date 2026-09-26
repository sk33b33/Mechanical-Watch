import { metres, type Length } from "@/units/length";
import type { Vec2 } from "@/math/vec2";
import { isValidModule, isValidToothCount, pitchDiameter } from "@/math/gearMath";
import type { Movement } from "@/domain/movement";
import type { Gear } from "@/domain/gear";
import type { KeylessWorks, StemPinion } from "@/domain/keyless";
import type { PlacementSolution } from "./solvePlacement";
import { isCompleteFrame } from "@/assembly/assemblyGeometry";

/**
 * Right-angle engagement of a stem pinion with an ordinary wheel
 * (ASM-0019). Pitch model: the pinion's pitch circle lies in a plane
 * perpendicular to the stem, the wheel's in its mid-plane, and they touch
 * at one point on the wheel's pitch circle, on the crown side of the
 * wheel's axis (σ = +1), directly above or below the stem axis.
 *
 * Rolling at that point gives ω_wheel = s (z_pinion / z_wheel) ω_pinion,
 * where s = +1 if the stem axis is above the wheel's mid-plane (+Z) and
 * −1 if below. Angular velocities are about +Z for the wheel and about
 * the stem direction u (pointing out to the crown) for the pinion.
 * Derivation: at the contact P = C + R u, the wheel moves at
 * ω_w ẑ × R u = ω_w R (ẑ × u); the pinion, centred s·r above P, moves at
 * ω_p u × (−s r ẑ) = s r ω_p (ẑ × u). Equal velocities give ω_w R = s r ω_p.
 */
export type VerticalSide = 1 | -1;

/** s, or null when the stem is level with the wheel's mid-plane or either height is not finite. */
export function verticalSide(stemHeight: Length, wheel: Gear): VerticalSide | null {
  if (!Number.isFinite(stemHeight) || !Number.isFinite(wheel.zCentre)) return null;
  const d = stemHeight - wheel.zCentre;
  return d > 0 ? 1 : d < 0 ? -1 : null;
}

export function isDefinedPinion(p: StemPinion): boolean {
  return isValidToothCount(p.toothCount) && isValidModule(p.module);
}

/** The stem's plan line: through the crown wheel's axis, direction u (unit, toward the crown). */
export interface StemLine {
  origin: Vec2;
  u: { x: number; y: number };
}

export function stemLine(movement: Movement, keyless: KeylessWorks, placement: PlacementSolution): StemLine | null {
  const crownWheel = movement.gears[keyless.crownWheelGearId];
  if (crownWheel === undefined || !Number.isFinite(keyless.stemDirection)) return null;
  const origin = placement.shaftPositions.get(crownWheel.shaftId);
  if (origin === undefined) return null;
  return { origin, u: { x: Math.cos(keyless.stemDirection), y: Math.sin(keyless.stemDirection) } };
}

/** Along-stem coordinate of a plan point (from the crown wheel axis, positive toward the crown). */
export function alongStem(line: StemLine, p: Vec2): number {
  return (p.x - line.origin.x) * line.u.x + (p.y - line.origin.y) * line.u.y;
}

/** Perpendicular plan distance from the stem line. Zero for a wheel whose axis the stem crosses. */
export function offsetFromStem(line: StemLine, p: Vec2): number {
  return Math.abs((p.x - line.origin.x) * line.u.y - (p.y - line.origin.y) * line.u.x);
}

export interface StemEngagement {
  wheel: Gear;
  pinion: StemPinion;
  /** Plan distance of the wheel's axis from the stem line (should be 0, KEY-002). */
  planOffset: number;
  /** |stem height − wheel mid-plane| − pinion pitch radius (should be 0, KEY-002). */
  heightError: number;
  /** Along-stem position of the pinion's centre (at the contact), from the crown wheel axis. */
  pinionAlongStem: number;
  /** Contact point in 3D, for drawing. */
  contact: { x: number; y: number; z: number };
  side: VerticalSide;
}

/** Geometry of one engagement, or null if its inputs are not defined or unresolved. */
export function stemEngagement(
  line: StemLine,
  stemHeight: Length,
  pinion: StemPinion,
  wheel: Gear,
  placement: PlacementSolution,
): StemEngagement | null {
  const axis = placement.shaftPositions.get(wheel.shaftId);
  const side = verticalSide(stemHeight, wheel);
  if (axis === undefined || side === null || !isDefinedPinion(pinion)) return null;
  if (!isValidToothCount(wheel.toothCount) || !isValidModule(wheel.module)) return null;
  const R = pitchDiameter(wheel.module, wheel.toothCount) / 2;
  const r = pitchDiameter(pinion.module, pinion.toothCount) / 2;
  const contact = { x: axis.x + R * line.u.x, y: axis.y + R * line.u.y, z: wheel.zCentre };
  return {
    wheel,
    pinion,
    planOffset: offsetFromStem(line, axis),
    heightError: Math.abs(stemHeight - wheel.zCentre) - r,
    pinionAlongStem: alongStem(line, { x: metres(contact.x), y: metres(contact.y) }),
    contact,
    side,
  };
}

export function stemPinionPitchRadius(pinion: StemPinion): Length {
  return metres(pitchDiameter(pinion.module, pinion.toothCount) / 2);
}

/** Along-stem distance from the line origin to the outside of the mainplate, for placing the crown. */
export function mainplateEdgeAlongStem(movement: Movement, line: StemLine): number | null {
  let best: number | null = null;
  for (const frame of Object.values(movement.frames)) {
    if (frame.kind !== "MAINPLATE" || !isCompleteFrame(frame)) continue;
    const o = frame.outline;
    let t: number;
    if (o.kind === "CIRCLE") {
      // Ray origin + t u meets |p − c| = r.
      const dx = line.origin.x - o.centre.x;
      const dy = line.origin.y - o.centre.y;
      const b = dx * line.u.x + dy * line.u.y;
      const c = dx * dx + dy * dy - o.radius * o.radius;
      const disc = b * b - c;
      if (disc < 0) continue;
      t = -b + Math.sqrt(disc);
    } else {
      t = Math.max(...o.points.map((p) => (p.x - line.origin.x) * line.u.x + (p.y - line.origin.y) * line.u.y));
    }
    best = best === null ? t : Math.max(best, t);
  }
  return best;
}

