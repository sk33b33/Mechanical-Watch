import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { solvePlacement } from "@/kinematics/solvePlacement";
import { findDiscComplication } from "@/domain/discComplication";
import { gearZRange } from "@/assembly/assemblyGeometry";
import { visualTipRadius } from "@/geometry/gearOutline";
import { calendarLinks, CALENDAR_LINK_VISUALIZATION, type CalendarLink } from "./calendarLinks";
import type { Vec2 } from "@/math/vec2";

const movement = createTeachingMovement();
const positions = solvePlacement(movement).shaftPositions;
const links = calendarLinks(movement, positions);

describe("calendar link arms (ASM-0091)", () => {
  it("draws one link per jump in the chain: date, day, month, leap year, season and the year digits", () => {
    expect(links.map((l) => l.drivenName).sort()).toEqual(["Date", "Day of week", "Leap year", "Month", "Season", "Year digits"]);
    for (const link of links) expect(Math.hypot(link.to.x - link.from.x, link.to.y - link.from.y)).toBeGreaterThan(0);
  });

  it("the year-digit bar leaves the month star, turns one corner and ends at the digit housing's near wall", () => {
    const year = links.find((l) => l.drivenName === "Year digits");
    const month = Object.values(movement.monthComplications)[0];
    expect(year?.fromShaftId).toBe(month?.starShaftId);
    expect(year?.toShaftId).toBeNull();
    expect(year?.path).toHaveLength(3);
    const digitY = Object.values(movement.yearDigitComplications)[0]?.axleOrigin.y ?? 0;
    // It stops short of the digits' own axis (the housing's wall), on the month star's side.
    expect(year?.to.y).toBeLessThan(digitY);
    expect(year?.to.y).toBeGreaterThan(digitY - 2e-3);
  });

  it("joins the right parts: the month star is driven from the date star, leap year and season from the month star", () => {
    const at = (name: string): CalendarLink | undefined => links.find((l) => l.drivenName === name);
    const dateStar = Object.values(movement.dateComplications).find((d) => d.display !== "DAY_OF_WEEK");
    const month = Object.values(movement.monthComplications)[0];
    expect(at("Month")?.fromShaftId).toBe(dateStar?.starShaftId);
    expect(at("Leap year")?.fromShaftId).toBe(month?.starShaftId);
    expect(at("Season")?.fromShaftId).toBe(month?.starShaftId);
    const drive = Object.values(movement.dateComplications).map((d) => d.driveShaftId);
    expect(drive).toContain(at("Date")?.fromShaftId);
    expect(drive).toContain(at("Day of week")?.fromShaftId);
  });

  it("returns nothing when no axis has been solved", () => {
    expect(calendarLinks(movement, new Map())).toEqual([]);
  });

  it("no link arm cuts through a wheel it is not attached to (same height layer)", () => {
    const t = CALENDAR_LINK_VISUALIZATION.thicknessMetres;
    const distanceToSegment = (p: Vec2, a: Vec2, b: Vec2): number => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
    };
    const wheels: { name: string; shaft: string; c: Vec2; r: number; lo: number; hi: number }[] = [];
    for (const g of Object.values(movement.gears)) {
      const c = positions.get(g.shaftId);
      if (c !== undefined) wheels.push({ name: g.name, shaft: g.shaftId, c, r: visualTipRadius(g), lo: gearZRange(g).lo, hi: gearZRange(g).hi });
    }
    const ids = [...Object.keys(movement.moonPhases), ...Object.keys(movement.dateComplications), ...Object.keys(movement.monthComplications), ...Object.keys(movement.leapYearComplications), ...Object.keys(movement.seasonComplications)];
    for (const id of ids) {
      const d = findDiscComplication(movement, id as never);
      if (d?.position.kind !== "SHAFT") continue;
      const c = positions.get(d.position.shaftId);
      if (c !== undefined) wheels.push({ name: d.name, shaft: d.position.shaftId, c, r: d.discRadius, lo: d.zLo, hi: d.zHi });
    }
    for (const link of links) {
      const lo = link.zCentre - t / 2, hi = link.zCentre + t / 2;
      for (const w of wheels) {
        if (w.shaft === link.fromShaftId || w.shaft === link.toShaftId) continue;
        const sameHeight = Math.min(hi, w.hi) - Math.max(lo, w.lo) > 1e-9;
        if (!sameHeight) continue;
        for (let i = 1; i < link.path.length; i += 1) {
          const a = link.path[i - 1], b = link.path[i];
          if (a === undefined || b === undefined) continue;
          expect(distanceToSegment(w.c, a, b), `${link.drivenName} link vs ${w.name}`).toBeGreaterThan(w.r);
        }
      }
    }
  });
});
