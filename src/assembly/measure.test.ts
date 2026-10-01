import { describe, expect, it } from "vitest";
import { millimetres as mm, toMillimetres } from "@/units/length";
import { updateGear, type Movement } from "@/domain/movement";
import type { EntityId } from "@/domain/ids";
import { createTeachingMovement } from "@/app/teachingMovement";
import { solvePlacement } from "@/kinematics/solvePlacement";
import { measureBetween, pointToPointRow } from "./measure";

const movement = createTeachingMovement();
const idOf = (m: Movement, name: string): EntityId => {
  const all = [...Object.values(m.shafts), ...Object.values(m.gears), ...Object.values(m.frames), ...Object.values(m.jewels)];
  const found = all.find((e) => e.name === name);
  if (found === undefined) throw new Error(name);
  return found.id;
};
const measure = (m: Movement, a: string, b: string): Record<string, number | null> => {
  const result = measureBetween(m, solvePlacement(m), idOf(m, a), idOf(m, b));
  if (result === null) throw new Error("no measurement");
  return Object.fromEntries(result.rows.map((r) => [r.label, r.value === null ? null : toMillimetres(r.value)]));
};

describe("measureBetween (domain-derived)", () => {
  it("between meshed gears: plan distance equals the ideal centre distance, deviation 0", () => {
    const r = measure(movement, "Centre wheel", "Third pinion");
    expect(r["Axis distance (plan)"]).toBeCloseTo(5.4, 9); // 0.12 × (80 + 10) / 2
    expect(r["Ideal centre distance"]).toBeCloseTo(5.4, 9);
    expect(r["Deviation from ideal"]).toBeCloseTo(0, 9);
    expect(r["Pitch-circle clearance (plan)"]).toBeCloseTo(0, 9);
    expect(r["Axial overlap"]).toBeCloseTo(0.2, 9); // wheel 1.9–2.1 inside pinion 1.75–2.25
  });

  it("reports drawn tips separately from the pitch model (ASM-0005), and not for a meshed pair", () => {
    const placement = solvePlacement(movement);
    const unmeshed = measureBetween(movement, placement, idOf(movement, "Centre wheel"), idOf(movement, "Barrel drum"));
    const tip = unmeshed?.rows.find((r) => r.label.startsWith("Drawn tip"));
    expect(tip?.level).toBe("L0_VISUAL");
    expect(tip?.references).toContain("ASM-0005");
    const meshed = measureBetween(movement, placement, idOf(movement, "Centre wheel"), idOf(movement, "Third pinion"));
    expect(meshed?.rows.some((r) => r.label.startsWith("Drawn tip"))).toBe(false);
  });

  it("between frames: the axial space between mainplate top and bridge underside", () => {
    const r = measure(movement, "Mainplate", "Train bridge");
    expect(r["Axial gap"]).toBeCloseTo(3, 9);
    expect("Axis distance (plan)" in r).toBe(false);
  });

  it("between coaxial parts: axis distance 0", () => {
    const r = measure(movement, "Cannon pinion", "Hour wheel");
    expect(r["Axis distance (plan)"]).toBe(0);
  });

  it("between unmeshed gears at different heights: plan overlap with an axial gap", () => {
    // Centre wheel (1.9–2.1 mm) and the barrel drum (1.25–1.55 mm) overlap in plan but not in height.
    const r = measure(movement, "Centre wheel", "Barrel drum");
    expect(r["Pitch-circle overlap (plan)"]).toBeGreaterThan(0);
    expect(r["Axial gap"]).toBeCloseTo(0.35, 9);
  });

  it("reports missing inputs instead of guessing", () => {
    const m = updateGear(movement, idOf(movement, "Third pinion") as never, { toothCount: Number.NaN, zCentre: mm(Number.NaN) });
    const r = measure(m, "Centre wheel", "Third pinion");
    expect(r["Pitch-circle clearance (plan)"]).toBeNull();
    expect(r["Axial gap"]).toBeNull();
  });

  it("returns null for an unknown part", () => {
    expect(measureBetween(movement, solvePlacement(movement), "gear_nope" as EntityId, idOf(movement, "Centre wheel"))).toBeNull();
  });
});

describe("pointToPointRow (picked-point ruler, not a domain quantity)", () => {
  it("computes straight-line 3D distance between two picked points", () => {
    const row = pointToPointRow({ x: 0, y: 0, z: 0 }, { x: 3e-3, y: 4e-3, z: 0 });
    expect(row.value).toBeCloseTo(5e-3, 12); // 3-4-5 triangle, in metres
    expect(row.level).toBe("L0_VISUAL");
  });

  it("includes the z component, not just the plan distance", () => {
    const row = pointToPointRow({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2e-3 });
    expect(row.value).toBeCloseTo(2e-3, 12);
  });

  it("reports null, not a guess, when either point is missing", () => {
    expect(pointToPointRow(null, { x: 0, y: 0, z: 0 }).value).toBeNull();
    expect(pointToPointRow({ x: 0, y: 0, z: 0 }, null).value).toBeNull();
    expect(pointToPointRow(null, null).value).toBeNull();
  });

  it("is zero for the same point picked twice", () => {
    const p = { x: 1e-3, y: 2e-3, z: 3e-3 };
    expect(pointToPointRow(p, p).value).toBe(0);
  });
});
