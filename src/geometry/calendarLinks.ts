import type { Movement } from "@/domain/movement";
import type { ShaftId } from "@/domain/shaft";
import { findDiscComplication } from "@/domain/discComplication";
import type { AssumptionId } from "@/reference/assumptions";
import { YEAR_DIGIT_HOUSING_VISUALIZATION } from "./assemblyGeometry3d";
import { vec2, type Vec2 } from "@/math/vec2";
import { metres } from "@/units/length";

/**
 * Link arms between the calendar wheels (follow-up 43, ASM-0091). The calendar wheels are not meshed; each is
 * advanced by a jump from another part (the date and day-of-week stars by the 24-hour arbor, the month star by
 * the date star, the leap-year and season wheels by the month star). Those are real relationships in the model
 * (the chain diagram lists them), but a wheel with a gap around it looks unconnected, so each jump gets a plain
 * bar drawn from the driving axis to the driven axis. The bar only shows which part drives which: it is not a
 * modelled lever, pawl or cam, it never moves, and nothing reads it (ASM-0004, ASM-0091).
 *
 * The bar lies in a thin layer just on the dial side of the calendar wheels' mid-plane. In the teaching movement
 * that layer is free of every other wheel (a regression test checks it), so a bar never cuts through a wheel it
 * is not attached to.
 */
export const CALENDAR_LINK_VISUALIZATION = {
  widthMetres: 0.5e-3,
  thicknessMetres: 0.03e-3,
  /** The bar's mid-plane relative to the driven wheel's mid-plane (negative is towards the dial). */
  zOffsetMetres: -0.01e-3,
  /** The round hub drawn where the bar meets each axis. */
  hubRadiusMetres: 0.45e-3,
  assumption: "ASM-0091" satisfies AssumptionId,
} as const;

export interface CalendarLink {
  fromShaftId: ShaftId;
  /** Null for the year digits, which have no shaft of their own (a fixed barrel). */
  toShaftId: ShaftId | null;
  /** The bar's route, driver first: two points, or three where it turns a corner (the year digits). */
  path: Vec2[];
  from: Vec2;
  to: Vec2;
  /** Mid-plane of the bar (model z, metres). */
  zCentre: number;
  /** What the driven wheel is called, for the inspector and tests. */
  drivenName: string;
}

/**
 * One link per jump the chain diagram lists: drive arbor → date star, drive arbor → day star, date star → month
 * star, month star → leap-year wheel, month star → season wheel, month star → the year digit housing (a bar that
 * turns one corner, to stay clear of the date star). A link is skipped when either axis has no solved
 * position or the two axes coincide (nothing to draw).
 */
export function calendarLinks(movement: Movement, positions: ReadonlyMap<ShaftId, Vec2>): CalendarLink[] {
  const links: CalendarLink[] = [];
  const add = (fromShaftId: ShaftId, toShaftId: ShaftId, drivenId: string): void => {
    const from = positions.get(fromShaftId);
    const to = positions.get(toShaftId);
    const driven = findDiscComplication(movement, drivenId as never);
    if (from === undefined || to === undefined || driven === undefined) return;
    if (Math.hypot(to.x - from.x, to.y - from.y) < 1e-9) return;
    const zMid = (driven.zLo + driven.zHi) / 2;
    links.push({ fromShaftId, toShaftId, path: [from, to], from, to, zCentre: zMid + CALENDAR_LINK_VISUALIZATION.zOffsetMetres, drivenName: driven.name });
  };
  for (const date of Object.values(movement.dateComplications)) add(date.driveShaftId, date.starShaftId, date.id);
  const dateStarOf = (id: string): ShaftId | undefined => movement.dateComplications[id as keyof typeof movement.dateComplications]?.starShaftId;
  const monthStarOf = (id: string): ShaftId | undefined => movement.monthComplications[id as keyof typeof movement.monthComplications]?.starShaftId;
  for (const month of Object.values(movement.monthComplications)) {
    const from = dateStarOf(month.dateComplicationId);
    if (from !== undefined) add(from, month.starShaftId, month.id);
  }
  for (const leap of Object.values(movement.leapYearComplications)) {
    const from = monthStarOf(leap.monthComplicationId);
    if (from !== undefined) add(from, leap.wheelShaftId, leap.id);
  }
  for (const season of Object.values(movement.seasonComplications)) {
    const from = monthStarOf(season.monthComplicationId);
    if (from !== undefined) add(from, season.wheelShaftId, season.id);
  }
  // The year digits: from the month star, along the month star's row, then up the middle of the digit housing to
  // the housing's near wall, so the bar passes beside the date star rather than through it.
  const digits = Object.values(movement.yearDigitComplications);
  const ones = digits.find((d) => d.digitPlace === "ONES") ?? digits[0];
  const month = ones === undefined ? undefined : movement.monthComplications[ones.monthComplicationId];
  const monthCentre = month === undefined ? undefined : positions.get(month.starShaftId);
  if (ones !== undefined && month !== undefined && monthCentre !== undefined) {
    const housing = YEAR_DIGIT_HOUSING_VISUALIZATION;
    const xMid = digits.reduce((sum, d) => sum + d.axleOrigin.x, 0) / digits.length;
    const above = ones.axleOrigin.y >= monthCentre.y;
    const nearWallOffset = ones.barrelDiameter / 2 + housing.marginMetres + housing.wallThicknessMetres;
    const end = vec2(metres(xMid), metres(ones.axleOrigin.y + (above ? -nearWallOffset : nearWallOffset)));
    const corner = vec2(metres(xMid), monthCentre.y);
    const lastZ = findDiscComplication(movement, month.id);
    if (lastZ !== undefined && Math.hypot(corner.x - monthCentre.x, corner.y - monthCentre.y) > 1e-9 && Math.abs(end.y - corner.y) > 1e-9) {
      links.push({
        fromShaftId: month.starShaftId, toShaftId: null, path: [monthCentre, corner, end], from: monthCentre, to: end,
        zCentre: (lastZ.zLo + lastZ.zHi) / 2 + CALENDAR_LINK_VISUALIZATION.zOffsetMetres, drivenName: "Year digits",
      });
    }
  }
  return links;
}
