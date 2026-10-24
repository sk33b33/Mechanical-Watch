import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { addGear, addGearMesh, updateShaft, type Movement } from "@/domain/movement";
import { createGear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { solvePlacement } from "@/kinematics/solvePlacement";
import { millimetres, toMillimetres } from "@/units/length";
import { radians } from "@/units/angle";
import { moveWheelBy, wheelCentre, wheelGroupOf } from "./moveWheel";
const mustMove = (m: Movement, id: string, dx: number, dy: number): Movement => {
  const result = moveWheelBy(m, id as never, dx, dy);
  if (result === null) throw new Error("the wheel cannot be moved");
  return result;
};


const teaching = createTeachingMovement();
const named = <T extends { name: string }>(record: Record<string, T>, name: string): T => {
  const found = Object.values(record).find((e) => e.name === name);
  if (found === undefined) throw new Error(`no ${name}`);
  return found;
};
const date = named(teaching.dateComplications, "Date");
const weekday = named(teaching.dateComplications, "Day of week");
const dateWindow = named(teaching.dialWindows, "Date window");
const mm = (v: number): number => millimetres(v);

describe("moveWheelBy (ASM-0087)", () => {
  it("moves a fixed calendar wheel and its window by the same step, changing nothing else", () => {
    const moved = mustMove(teaching, date.id, mm(2), mm(-1.5));
    const before = solvePlacement(teaching).shaftPositions.get(date.starShaftId);
    const after = solvePlacement(moved).shaftPositions.get(date.starShaftId);
    expect(toMillimetres(after?.x ?? 0 as never) - toMillimetres(before?.x ?? 0 as never)).toBeCloseTo(2, 9);
    expect(toMillimetres(after?.y ?? 0 as never) - toMillimetres(before?.y ?? 0 as never)).toBeCloseTo(-1.5, 9);
    const window = moved.dialWindows[dateWindow.id];
    expect(toMillimetres(window?.centre.x ?? 0 as never) - toMillimetres(dateWindow.centre.x)).toBeCloseTo(2, 9);
    expect(toMillimetres(window?.centre.y ?? 0 as never) - toMillimetres(dateWindow.centre.y)).toBeCloseTo(-1.5, 9);
    // The window is still centred on the wheel's axis, and no other window or wheel moved.
    expect(window?.centre.x).toBeCloseTo(after?.x ?? NaN, 12);
    const other = named(teaching.dialWindows, "Month window");
    expect(moved.dialWindows[other.id]?.centre).toEqual(other.centre);
    expect(solvePlacement(moved).shaftPositions.get(weekday.starShaftId)).toEqual(solvePlacement(teaching).shaftPositions.get(weekday.starShaftId));
  });

  it("changes no dimension, tooth count or other design value, only positions", () => {
    const moved = mustMove(teaching, date.id, mm(1), mm(1));
    expect(moved.dateComplications[date.id]).toEqual(teaching.dateComplications[date.id]);
    expect(moved.gears).toBe(teaching.gears);
    expect(moved.gearMeshes).toBe(teaching.gearMeshes);
  });

  it("moves the whole year display (all four barrels) and its window together", () => {
    const digit = Object.values(teaching.yearDigitComplications)[0];
    if (digit === undefined) throw new Error("no digit");
    const moved = mustMove(teaching, digit.id, mm(1), mm(2));
    for (const d of Object.values(teaching.yearDigitComplications)) {
      const m = moved.yearDigitComplications[d.id];
      expect(toMillimetres(m?.axleOrigin.x ?? 0 as never) - toMillimetres(d.axleOrigin.x)).toBeCloseTo(1, 9);
      expect(toMillimetres(m?.axleOrigin.y ?? 0 as never) - toMillimetres(d.axleOrigin.y)).toBeCloseTo(2, 9);
    }
    const yearWindow = named(teaching.dialWindows, "Year window");
    expect(toMillimetres(moved.dialWindows[yearWindow.id]?.centre.y ?? 0 as never) - toMillimetres(yearWindow.centre.y)).toBeCloseTo(2, 9);
    expect(wheelGroupOf(teaching, digit.id)?.yearDigitIds).toHaveLength(4);
  });

  it("swings a mesh-placed wheel round its partner at the same centre distance, keeping the teeth in contact", () => {
    // Put a gear on the date star's arbor, mesh it with the 24-hour wheel, and place the star by that mesh.
    const twentyFour = named(teaching.shafts, "24-hour arbor");
    const wheel = named(teaching.gears, "24-hour wheel");
    const gear = createGear({ name: "Date drive gear", toothCount: 31, module: wheel.module, thickness: wheel.thickness, zCentre: wheel.zCentre, shaftId: date.starShaftId });
    const mesh = createGearMesh(wheel.id, gear.id);
    let asMeshed = addGearMesh(addGear(teaching, gear), mesh);
    asMeshed = updateShaft(asMeshed, date.starShaftId, { placement: { kind: "MESH_POLAR", referenceShaftId: twentyFour.id, meshId: mesh.id, angle: radians(Math.PI) } });
    const positions = solvePlacement(asMeshed).shaftPositions;
    const partner = positions.get(twentyFour.id);
    const here = positions.get(date.starShaftId);
    if (partner === undefined || here === undefined) throw new Error("unplaced");
    const radius = Math.hypot(here.x - partner.x, here.y - partner.y);
    const moved = mustMove(asMeshed, date.id, mm(1), mm(1));
    const after = solvePlacement(moved).shaftPositions.get(date.starShaftId);
    if (after === undefined) throw new Error("unplaced after");
    expect(Math.hypot(after.x - partner.x, after.y - partner.y)).toBeCloseTo(radius, 12);
    expect(Math.hypot(after.x - here.x, after.y - here.y)).toBeGreaterThan(0);
    // The mesh and tooth counts are untouched, and the window followed the real (arc) step, not the dragged one.
    expect(moved.gearMeshes[mesh.id]).toEqual(mesh);
    expect((moved.dialWindows[dateWindow.id]?.centre.x ?? 0) - dateWindow.centre.x).toBeCloseTo(after.x - here.x, 12);
    expect((moved.dialWindows[dateWindow.id]?.centre.y ?? 0) - dateWindow.centre.y).toBeCloseTo(after.y - here.y, 12);
  });

  it("cannot move a coaxial wheel or a part that is not a movable calendar wheel", () => {
    const moon = Object.values(teaching.moonPhases)[0];
    expect(moveWheelBy(teaching, moon?.id as never, mm(1), 0)).toBeNull();
    expect(wheelGroupOf(teaching, "nope" as never)).toBeNull();
  });

  it("reads a wheel's own centre", () => {
    const at = wheelCentre(teaching, date.id);
    expect(at).toEqual(solvePlacement(teaching).shaftPositions.get(date.starShaftId));
  });
});
