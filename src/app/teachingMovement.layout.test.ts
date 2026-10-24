import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "./teachingMovement";
import { analyzeMovement } from "@/analysis/analyzeMovement";
import { solvePlacement } from "@/kinematics/solvePlacement";
import { meshCentreDistance } from "@/math/gearMath";
import { toMillimetres } from "@/units/length";

const movement = createTeachingMovement();
const positions = solvePlacement(movement).shaftPositions;
const at = (name: string): { x: number; y: number } => {
  const shaft = Object.values(movement.shafts).find((s) => s.name === name);
  const p = shaft === undefined ? undefined : positions.get(shaft.id);
  if (p === undefined) throw new Error(`no ${name}`);
  return { x: toMillimetres(p.x), y: toMillimetres(p.y) };
};

describe("teaching movement: seconds hand pivot moved right and down (follow-up 38, ASM-0089)", () => {
  it("puts the seconds hand's pivot at the layout position, 1.1 mm further right on the dial and 2.2 mm lower than before", () => {
    const fourth = at("Fourth arbor");
    expect(fourth.x).toBeCloseTo(8.7, 6);
    expect(fourth.y).toBeCloseTo(-4.9, 6);
    // The original was (9.78, -2.70) mm; the dial's right is -X.
    expect(9.7777 - fourth.x).toBeGreaterThan(1);
    expect(-2.7 - fourth.y).toBeGreaterThan(2);
  });

  it("keeps every gear mesh at its exact ideal centre distance (nothing about a ratio or a tooth count changed)", () => {
    for (const mesh of Object.values(movement.gearMeshes)) {
      const a = movement.gears[mesh.drivingGearId];
      const b = movement.gears[mesh.drivenGearId];
      if (a === undefined || b === undefined) throw new Error("mesh gear missing");
      const pa = positions.get(a.shaftId);
      const pb = positions.get(b.shaftId);
      if (pa === undefined || pb === undefined) continue; // a stem pinion mesh has no plan position here
      const ideal = meshCentreDistance(a.module, a.toothCount, b.toothCount);
      expect(Math.hypot(pa.x - pb.x, pa.y - pb.y)).toBeCloseTo(ideal, 9);
    }
  });

  it("carries the escape arbor, pallet, balance and the balance cock with it, so the balance is still inside its cock", () => {
    const balance = at("Balance staff");
    const pallet = at("Pallet arbor");
    const cock = Object.values(movement.frames).find((f) => f.name === "Balance cock");
    if (cock?.outline.kind !== "POLYGON") throw new Error("no cock");
    const xs = cock.outline.points.map((p) => toMillimetres(p.x));
    const ys = cock.outline.points.map((p) => toMillimetres(p.y));
    for (const p of [balance, pallet]) {
      expect(p.x).toBeGreaterThan(Math.min(...xs));
      expect(p.x).toBeLessThan(Math.max(...xs));
      expect(p.y).toBeGreaterThan(Math.min(...ys));
      expect(p.y).toBeLessThan(Math.max(...ys));
    }
    // The fourth arbor is still inside the train bridge's outline (a point-in-polygon check).
    const bridge = Object.values(movement.frames).find((f) => f.name === "Train bridge");
    if (bridge?.outline.kind !== "POLYGON") throw new Error("no bridge");
    const fourth = at("Fourth arbor");
    const pts = bridge.outline.points.map((p) => ({ x: toMillimetres(p.x), y: toMillimetres(p.y) }));
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const a = pts[i];
      const b = pts[j];
      if (a === undefined || b === undefined) continue;
      if ((a.y > fourth.y) !== (b.y > fourth.y) && fourth.x < ((b.x - a.x) * (fourth.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    expect(inside).toBe(true);
  });

  it("still has no validation error or warning", () => {
    const worse = analyzeMovement(movement).issues.filter((i) => i.severity !== "info");
    expect(worse).toEqual([]);
  });
});
