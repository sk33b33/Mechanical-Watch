import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { updateDialWindow, type Movement } from "@/domain/movement";
import { solvePlacement } from "@/kinematics/solvePlacement";
import { millimetres } from "@/units/length";
import { CHAIN_FIX, planChainFix } from "./fixChain";
import { moveWheelBy } from "./moveWheel";
const mustMove = (m: Movement, id: string, dx: number, dy: number): Movement => {
  const result = moveWheelBy(m, id as never, dx, dy);
  if (result === null) throw new Error("the wheel cannot be moved");
  return result;
};

import { findDiscComplication } from "@/domain/discComplication";

const teaching = createTeachingMovement();
const named = <T extends { name: string }>(record: Record<string, T>, name: string): T => {
  const found = Object.values(record).find((e) => e.name === name);
  if (found === undefined) throw new Error(`no ${name}`);
  return found;
};
const date = named(teaching.dateComplications, "Date");
const month = named(teaching.monthComplications, "Month");
const mm = (v: number): number => millimetres(v);

const gap = (m: Movement, aId: string, bId: string): number => {
  const a = findDiscComplication(m, aId as never);
  const b = findDiscComplication(m, bId as never);
  if (a === undefined || b === undefined || a.position.kind !== "SHAFT" || b.position.kind !== "SHAFT") throw new Error("no disc");
  const p = solvePlacement(m).shaftPositions;
  const pa = p.get(a.position.shaftId);
  const pb = p.get(b.position.shaftId);
  if (pa === undefined || pb === undefined) throw new Error("unplaced");
  return Math.hypot(pa.x - pb.x, pa.y - pb.y) - a.discRadius - b.discRadius;
};

describe("planChainFix (ASM-0087)", () => {
  it("leaves a tidy design alone: no changes, the same design", () => {
    const plan = planChainFix(teaching);
    expect(plan.changes).toEqual([]);
    expect(plan.unresolved).toEqual([]);
  });

  it("pushes an overlapping wheel apart to the clearance gap, moving the last-moved wheel and its window", () => {
    // Drag the month wheel on top of the date wheel.
    const dateAt = solvePlacement(teaching).shaftPositions.get(date.starShaftId);
    const monthAt = solvePlacement(teaching).shaftPositions.get(month.starShaftId);
    if (dateAt === undefined || monthAt === undefined) throw new Error("unplaced");
    const messy = mustMove(teaching, month.id, dateAt.x - monthAt.x + mm(0.5), dateAt.y - monthAt.y);
    expect(gap(messy, date.id, month.id)).toBeLessThan(0);
    const plan = planChainFix(messy, month.id);
    expect(gap(plan.movement, date.id, month.id)).toBeGreaterThanOrEqual(CHAIN_FIX.clearanceGapMetres - 1e-9);
    expect(plan.changes.some((c) => c.kind === "SEPARATE_WHEELS" && c.partName === "Month")).toBe(true);
    expect(plan.changes.some((c) => c.partName === "Date")).toBe(false);
    // Its window moved with it, so it is still centred on the wheel.
    const w = plan.movement.dialWindows[named(teaching.dialWindows, "Month window").id];
    const axis = solvePlacement(plan.movement).shaftPositions.get(month.starShaftId);
    expect(w?.centre.x).toBeCloseTo(axis?.x ?? NaN, 12);
    expect(plan.unresolved).toEqual([]);
  });

  it("re-centres a whole-wheel window that has drifted off its wheel, and says by how much", () => {
    const w = named(teaching.dialWindows, "Date window");
    const drifted = updateDialWindow(teaching, w.id, { centre: { x: (w.centre.x + mm(0.8)) as never, y: w.centre.y } });
    const plan = planChainFix(drifted);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]?.kind).toBe("RECENTRE_WINDOW");
    expect(plan.changes[0]?.distanceMillimetres).toBeCloseTo(0.8, 6);
    expect(plan.movement.dialWindows[w.id]?.centre).toEqual(w.centre);
  });

  it("pulls a wheel that was dragged beyond the dial's edge back inside, leaving the gap", () => {
    const outside = mustMove(teaching, date.id, mm(30), 0);
    const plan = planChainFix(outside, date.id);
    const dial = Object.values(plan.movement.dials)[0];
    if (dial === undefined) throw new Error("no dial");
    const p = solvePlacement(plan.movement).shaftPositions;
    const centre = p.get(dial.centreShaftId);
    const at = p.get(date.starShaftId);
    if (centre === undefined || at === undefined) throw new Error("unplaced");
    const ref = findDiscComplication(plan.movement, date.id);
    expect(Math.hypot(at.x - centre.x, at.y - centre.y) + (ref?.discRadius ?? 0)).toBeLessThanOrEqual(dial.diameter / 2 - CHAIN_FIX.clearanceGapMetres + 1e-9);
    expect(plan.changes.some((c) => c.kind === "KEEP_INSIDE_DIAL" && c.partName === "Date")).toBe(true);
  });

  it("never changes dimensions, only positions, and the plan is a separate design (the input is untouched)", () => {
    const messy = mustMove(teaching, month.id, mm(-6) - mm(0), mm(0));
    const plan = planChainFix(messy, month.id);
    expect(plan.movement.gears).toBe(messy.gears);
    expect(plan.movement.monthComplications[month.id]).toEqual(messy.monthComplications[month.id]);
    expect(messy.shafts).not.toBe(plan.movement.shafts);
  });
});
