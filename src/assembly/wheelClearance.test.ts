import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { solvePlacement } from "@/kinematics/solvePlacement";
import { findDiscComplication } from "@/domain/discComplication";
import { visualTipRadius } from "@/geometry/gearOutline";
import type { Vec2 } from "@/math/vec2";
import { CHAIN_FIX } from "./fixChain";
import { frameZRange, gearZRange, isCompleteFrame, outlineOverlapsCircle } from "./assemblyGeometry";

/**
 * A 3D audit of the teaching movement (follow-up 43, ASM-0091): no two wheels that are not meshed and not on one
 * arbor may touch, in plan, at a height they share. The gear-only rule (ASSY-002) never looked at the calendar
 * wheels, and this audit found Moon wheel 1 cutting through the date and month wheels and the minute pinion
 * 0.03 mm from the 24-hour wheel. The gap asked for is the Fix chain tidy-up gap (a declared choice, ASM-0087).
 */
interface Solid { name: string; shaft: string; centre: Vec2; radius: number; lo: number; hi: number }

const movement = createTeachingMovement();
const positions = solvePlacement(movement).shaftPositions;

function solids(): Solid[] {
  const list: Solid[] = [];
  for (const g of Object.values(movement.gears)) {
    const centre = positions.get(g.shaftId);
    if (centre !== undefined) list.push({ name: g.name, shaft: g.shaftId, centre, radius: visualTipRadius(g), lo: gearZRange(g).lo, hi: gearZRange(g).hi });
  }
  // The year digit barrels sit side by side inside one housing on purpose, so they are not wheels in this audit.
  const ids = [...Object.keys(movement.moonPhases), ...Object.keys(movement.dateComplications), ...Object.keys(movement.monthComplications), ...Object.keys(movement.leapYearComplications), ...Object.keys(movement.seasonComplications)];
  for (const id of ids) {
    const d = findDiscComplication(movement, id as never);
    if (d?.position.kind !== "SHAFT") continue;
    const centre = positions.get(d.position.shaftId);
    if (centre !== undefined) list.push({ name: d.name, shaft: d.position.shaftId, centre, radius: d.discRadius, lo: d.zLo, hi: d.zHi });
  }
  for (const e of Object.values(movement.escapements)) {
    const escape = positions.get(e.escapeArborShaftId);
    const balance = positions.get(e.balanceShaftId);
    if (escape !== undefined) list.push({ name: "Escape wheel", shaft: e.escapeArborShaftId, centre: escape, radius: e.escapeWheel.tipDiameter / 2, lo: e.escapeWheel.zCentre - e.escapeWheel.thickness / 2, hi: e.escapeWheel.zCentre + e.escapeWheel.thickness / 2 });
    if (balance !== undefined) list.push({ name: "Balance", shaft: e.balanceShaftId, centre: balance, radius: e.balance.diameter / 2, lo: e.balance.zCentre - e.balance.thickness / 2, hi: e.balance.zCentre + e.balance.thickness / 2 });
  }
  return list;
}

describe("wheel clearance in the teaching movement (3D audit)", () => {
  const all = solids();
  const meshedNames = new Set(
    Object.values(movement.gearMeshes).map((mesh) => [movement.gears[mesh.drivingGearId]?.name, movement.gears[mesh.drivenGearId]?.name].sort().join("|")),
  );

  it("audits every gear and calendar wheel", () => {
    expect(all.length).toBeGreaterThanOrEqual(25);
  });

  it("no unmeshed pair of wheels on different arbors touches at a shared height", () => {
    const problems: string[] = [];
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = all[i];
        const b = all[j];
        if (a === undefined || b === undefined || a.shaft === b.shaft) continue;
        if (Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) <= 1e-9) continue;
        if (meshedNames.has([a.name, b.name].sort().join("|"))) continue;
        const gap = Math.hypot(a.centre.x - b.centre.x, a.centre.y - b.centre.y) - a.radius - b.radius;
        if (gap < CHAIN_FIX.clearanceGapMetres) problems.push(`${a.name} and ${b.name}: gap ${(gap * 1000).toFixed(3)} mm`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("no wheel passes through a frame's slab at its own height outside the frame's outline holes it is meant to use", () => {
    // Every wheel here lives between the mainplate and the dial or between the mainplate and the bridges, never inside a slab.
    for (const s of all) {
      for (const frame of Object.values(movement.frames)) {
        if (!isCompleteFrame(frame)) continue;
        const z = frameZRange(frame);
        const inside = Math.min(s.hi, z.hi) - Math.max(s.lo, z.lo) > 1e-9;
        expect(inside && outlineOverlapsCircle(frame.outline, s.centre, s.radius), `${s.name} inside ${frame.name}`).toBe(false);
      }
    }
  });
});
