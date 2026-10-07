import type { Length } from "@/units/length";
import { radians, type Angle } from "@/units/angle";
import type { Movement } from "./movement";
import type { EntityId } from "./ids";
import type { ShaftId } from "./shaft";
import type { MoonPhaseId } from "./moonPhase";
import { windowsPerRevolution } from "./moonPhase";
import type { DateComplicationId } from "./dateComplication";
import type { MonthComplicationId } from "./monthComplication";
import { LEAP_YEAR_LABELS, LEAP_YEAR_SLOT_COUNT, type LeapYearComplicationId } from "./leapYearComplication";
import { MONTHS_PER_YEAR, MONTH_NAMES } from "@/kinematics/monthComplication";
import { moonPhaseFraction } from "@/kinematics/moonPhase";
import { starPosition } from "@/kinematics/dateComplication";

/**
 * A unified read of the four "disc on its own arbor" complications
 * (MoonPhase, DateComplication, MonthComplication, LeapYearComplication)
 * for anything that needs to treat them alike without re-deriving each
 * one's own field names — `DialWindow`'s own geometry/validation/
 * rendering, chiefly (`src/domain/dialWindow.ts`).
 */
export interface DiscComplicationRef {
  kind: "MoonPhase" | "DateComplication" | "MonthComplication" | "LeapYearComplication";
  id: EntityId;
  name: string;
  shaftId: ShaftId;
  discRadius: Length;
  zLo: Length;
  zHi: Length;
  /** Discrete positions evenly spaced around the disc, label text first-to-last going around once; null for MoonPhase, which has no discrete positions. */
  positionLabels: readonly string[] | null;
}

export function findDiscComplication(movement: Movement, id: EntityId): DiscComplicationRef | undefined {
  const moon = movement.moonPhases[id as MoonPhaseId];
  if (moon !== undefined) {
    return {
      kind: "MoonPhase", id: moon.id, name: moon.name, shaftId: moon.shaftId,
      discRadius: (moon.diameter / 2) as Length,
      zLo: moon.faceHeight, zHi: (moon.faceHeight + moon.thickness) as Length,
      positionLabels: null,
    };
  }
  const date = movement.dateComplications[id as DateComplicationId];
  if (date !== undefined) {
    return {
      kind: "DateComplication", id: date.id, name: date.name, shaftId: date.starShaftId,
      discRadius: (date.starTipDiameter / 2) as Length,
      zLo: (date.starZCentre - date.starThickness / 2) as Length, zHi: (date.starZCentre + date.starThickness / 2) as Length,
      positionLabels: Number.isInteger(date.starToothCount) && date.starToothCount > 0
        ? Array.from({ length: date.starToothCount }, (_, i) => String(i + 1))
        : null,
    };
  }
  const month = movement.monthComplications[id as MonthComplicationId];
  if (month !== undefined) {
    return {
      kind: "MonthComplication", id: month.id, name: month.name, shaftId: month.starShaftId,
      discRadius: (month.starTipDiameter / 2) as Length,
      zLo: (month.starZCentre - month.starThickness / 2) as Length, zHi: (month.starZCentre + month.starThickness / 2) as Length,
      positionLabels: MONTH_NAMES,
    };
  }
  const year = movement.leapYearComplications[id as LeapYearComplicationId];
  if (year !== undefined) {
    return {
      kind: "LeapYearComplication", id: year.id, name: year.name, shaftId: year.wheelShaftId,
      discRadius: (year.wheelTipDiameter / 2) as Length,
      zLo: (year.wheelZCentre - year.wheelThickness / 2) as Length, zHi: (year.wheelZCentre + year.wheelThickness / 2) as Length,
      positionLabels: LEAP_YEAR_LABELS,
    };
  }
  return undefined;
}

/**
 * The current human-readable value a disc complication shows, read from
 * its own arbor's simulated angle — the same read `xxxComplicationSection.ts`'s
 * own "Current position" row already does per type, unified here for
 * `DialWindow`'s own inspector/viewport label. Null when the complication
 * is not yet fully declared enough to read (e.g. no star tooth count).
 */
export function discComplicationLabel(movement: Movement, shaftAngle: Readonly<Record<ShaftId, Angle>>, id: EntityId): string | null {
  const moon = movement.moonPhases[id as MoonPhaseId];
  if (moon !== undefined) {
    const fraction = moonPhaseFraction(shaftAngle[moon.shaftId] ?? radians(0), windowsPerRevolution(moon.windowCount));
    return `${String(Math.round(fraction * 100))}%`;
  }
  const date = movement.dateComplications[id as DateComplicationId];
  if (date !== undefined) {
    if (!(Number.isInteger(date.starToothCount) && date.starToothCount > 0)) return null;
    const position = starPosition(shaftAngle[date.starShaftId] ?? radians(0), date.starToothCount);
    return String(position + 1);
  }
  const month = movement.monthComplications[id as MonthComplicationId];
  if (month !== undefined) {
    const position = starPosition(shaftAngle[month.starShaftId] ?? radians(0), MONTHS_PER_YEAR);
    return MONTH_NAMES[position] ?? String(position + 1);
  }
  const year = movement.leapYearComplications[id as LeapYearComplicationId];
  if (year !== undefined) {
    const position = starPosition(shaftAngle[year.wheelShaftId] ?? radians(0), LEAP_YEAR_SLOT_COUNT);
    return LEAP_YEAR_LABELS[position] ?? String(position + 1);
  }
  return null;
}
