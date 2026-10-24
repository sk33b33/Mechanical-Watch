import type { Movement } from "@/domain/movement";
import { updateDialWindow, updateShaft, updateYearDigitComplication } from "@/domain/movement";
import type { Shaft, ShaftId } from "@/domain/shaft";
import type { EntityId } from "@/domain/ids";
import type { DateComplicationId } from "@/domain/dateComplication";
import type { MonthComplicationId } from "@/domain/monthComplication";
import type { LeapYearComplicationId } from "@/domain/leapYearComplication";
import type { SeasonComplicationId } from "@/domain/seasonComplication";
import type { YearDigitComplicationId } from "@/domain/yearDigitComplication";
import { metres } from "@/units/length";
import { radians } from "@/units/angle";
import { solvePlacement } from "@/kinematics/solvePlacement";
import type { Vec2 } from "@/math/vec2";

/**
 * Moving a calendar wheel and its window together on the dial (follow-up 35, ASM-0087).
 *
 * The wheels that can be moved are the jump-driven calendar wheels (date, day of week, month,
 * leap year, season) and the year-digit barrels. They are not gear-meshed, so their position is a
 * declared one, and the jump links (ASM-0048 to ASM-0050, ASM-0057) have no centre distance to
 * keep: the drawn cam and jumper follow the new position by themselves. A wheel placed by a mesh
 * (MESH_POLAR) swings round its partner at the fixed centre distance, so the teeth stay in
 * contact (nothing about the mesh is silently changed). A coaxial wheel cannot be moved.
 * Every window that shows the moved wheel moves by the same step.
 */
export interface WheelGroup {
  /** The complications that move together (all four digits of a year display, otherwise one). */
  complicationIds: EntityId[];
  shaftIds: ShaftId[];
  yearDigitIds: YearDigitComplicationId[];
}

export function wheelGroupOf(movement: Movement, id: EntityId): WheelGroup | null {
  const date = movement.dateComplications[id as DateComplicationId];
  if (date !== undefined) return { complicationIds: [date.id], shaftIds: [date.starShaftId], yearDigitIds: [] };
  const month = movement.monthComplications[id as MonthComplicationId];
  if (month !== undefined) return { complicationIds: [month.id], shaftIds: [month.starShaftId], yearDigitIds: [] };
  const leap = movement.leapYearComplications[id as LeapYearComplicationId];
  if (leap !== undefined) return { complicationIds: [leap.id], shaftIds: [leap.wheelShaftId], yearDigitIds: [] };
  const season = movement.seasonComplications[id as SeasonComplicationId];
  if (season !== undefined) return { complicationIds: [season.id], shaftIds: [season.wheelShaftId], yearDigitIds: [] };
  const digit = movement.yearDigitComplications[id as YearDigitComplicationId];
  if (digit !== undefined) {
    const siblings = Object.values(movement.yearDigitComplications).filter((d) => d.monthComplicationId === digit.monthComplicationId);
    return { complicationIds: siblings.map((d) => d.id), shaftIds: [], yearDigitIds: siblings.map((d) => d.id) };
  }
  return null;
}

/** Where a wheel's axis is now (plan position), or null when it has none to read. */
export function wheelCentre(movement: Movement, id: EntityId): Vec2 | null {
  const group = wheelGroupOf(movement, id);
  if (group === null) return null;
  const firstShaft = group.shaftIds[0];
  if (firstShaft !== undefined) return solvePlacement(movement).shaftPositions.get(firstShaft) ?? null;
  const firstDigit = group.yearDigitIds[0] === undefined ? undefined : movement.yearDigitComplications[group.yearDigitIds[0]];
  return firstDigit === undefined ? null : firstDigit.axleOrigin;
}

function moveShaft(movement: Movement, shaft: Shaft, positions: ReadonlyMap<ShaftId, Vec2>, dx: number, dy: number): { movement: Movement; actual: Vec2 } | null {
  const here = positions.get(shaft.id);
  if (here === undefined) return null;
  const placement = shaft.placement;
  if (placement.kind === "FIXED") {
    const position = { x: metres(placement.position.x + dx), y: metres(placement.position.y + dy) };
    return { movement: updateShaft(movement, shaft.id, { placement: { kind: "FIXED", position } }), actual: { x: metres(dx), y: metres(dy) } };
  }
  if (placement.kind === "MESH_POLAR") {
    // Swing round the partner: keep the ideal centre distance, turn the direction toward where it was dragged.
    const partner = positions.get(placement.referenceShaftId);
    if (partner === undefined) return null;
    const radius = Math.hypot(here.x - partner.x, here.y - partner.y);
    if (radius === 0) return null;
    const angle = Math.atan2(here.y + dy - partner.y, here.x + dx - partner.x);
    const moved = { x: partner.x + radius * Math.cos(angle), y: partner.y + radius * Math.sin(angle) };
    return {
      movement: updateShaft(movement, shaft.id, { placement: { ...placement, angle: radians(angle) } }),
      actual: { x: metres(moved.x - here.x), y: metres(moved.y - here.y) },
    };
  }
  return null; // coaxial: it shares its reference's axis
}

/**
 * The design with the wheel `id` (and the windows that show it) moved by about (dx, dy) metres, or null
 * when it cannot be moved. For a swinging mesh-placed wheel the step is the real one along the arc.
 */
export function moveWheelBy(movement: Movement, id: EntityId, dx: number, dy: number): Movement | null {
  const group = wheelGroupOf(movement, id);
  if (group === null) return null;
  let next = movement;
  let actual: Vec2 = { x: metres(dx), y: metres(dy) };
  if (group.shaftIds.length > 0) {
    const positions = solvePlacement(movement).shaftPositions;
    let first = true;
    for (const shaftId of group.shaftIds) {
      const shaft = next.shafts[shaftId];
      if (shaft === undefined) return null;
      const moved = moveShaft(next, shaft, positions, dx, dy);
      if (moved === null) return null;
      next = moved.movement;
      if (first) { actual = moved.actual; first = false; }
    }
  }
  for (const digitId of group.yearDigitIds) {
    const digit = next.yearDigitComplications[digitId];
    if (digit === undefined) return null;
    next = updateYearDigitComplication(next, digitId, { axleOrigin: { x: metres(digit.axleOrigin.x + dx), y: metres(digit.axleOrigin.y + dy) } });
  }
  const shown = new Set<EntityId>(group.complicationIds);
  for (const window of Object.values(next.dialWindows)) {
    if (!shown.has(window.complicationId)) continue;
    next = updateDialWindow(next, window.id, { centre: { x: metres(window.centre.x + actual.x), y: metres(window.centre.y + actual.y) } });
  }
  return next;
}
