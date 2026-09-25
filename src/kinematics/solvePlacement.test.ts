import { describe, expect, it } from "vitest";
import { millimetres, toMillimetres } from "@/units/length";
import { degrees } from "@/units/angle";
import { distance } from "@/math/vec2";
import {
  createMovement,
  addShaft,
  addGear,
  addGearMesh,
  updateGear,
  updateShaft,
  type Movement,
} from "@/domain/movement";
import { createShaft, fixedAt, type Shaft, type ShaftPlacement } from "@/domain/shaft";
import { createGear, type Gear } from "@/domain/gear";
import { createGearMesh, type GearMesh } from "@/domain/gearMesh";
import { solvePlacement } from "./solvePlacement";

const MODULE = millimetres(0.2);

interface Train {
  movement: Movement;
  shafts: Shaft[];
  gears: Gear[];
  meshes: GearMesh[];
}

/** Chain of shafts, each with one gear, meshing i -> i+1. */
function chain(teeth: number[]): Train {
  const shafts = teeth.map((_, i) => createShaft(`S${String(i)}`, fixedAt(millimetres(0), millimetres(0))));
  const gears = teeth.map((z, i) => {
    const shaft = shafts[i];
    if (shaft === undefined) throw new Error("shaft");
    return createGear({ name: `G${String(i)}`, toothCount: z, module: MODULE, thickness: MODULE, shaftId: shaft.id });
  });
  const meshes: GearMesh[] = [];
  for (let i = 0; i + 1 < gears.length; i += 1) {
    const a = gears[i];
    const b = gears[i + 1];
    if (a === undefined || b === undefined) throw new Error("gear");
    meshes.push(createGearMesh(a.id, b.id));
  }
  let movement = createMovement("Chain", true);
  for (const s of shafts) movement = addShaft(movement, s);
  for (const g of gears) movement = addGear(movement, g);
  for (const m of meshes) movement = addGearMesh(movement, m);
  return { movement, shafts, gears, meshes };
}

function at<T>(items: T[], i: number): T {
  const item = items[i];
  if (item === undefined) throw new Error(`no item ${String(i)}`);
  return item;
}

function meshPolar(reference: Shaft, mesh: GearMesh, angleDeg: number): ShaftPlacement {
  return { kind: "MESH_POLAR", referenceShaftId: reference.id, meshId: mesh.id, angle: degrees(angleDeg) };
}

describe("solvePlacement", () => {
  it("places a FIXED shaft at its coordinates", () => {
    const { movement, shafts } = chain([60]);
    const pos = solvePlacement(movement).shaftPositions.get(at(shafts, 0).id);
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it("places a MESH_POLAR shaft at the ideal centre distance and angle", () => {
    const t = chain([60, 10]);
    const movement = updateShaft(t.movement, at(t.shafts, 1).id, {
      placement: meshPolar(at(t.shafts, 0), at(t.meshes, 0), 90),
    });
    const pos = solvePlacement(movement).shaftPositions.get(at(t.shafts, 1).id);
    expect(toMillimetres(pos?.x ?? millimetres(Number.NaN))).toBeCloseTo(0, 9);
    expect(toMillimetres(pos?.y ?? millimetres(Number.NaN))).toBeCloseTo(7, 9); // 0.2 × (60 + 10) / 2
  });

  it("resolves chains regardless of declaration order, and follows tooth-count edits", () => {
    const t = chain([60, 10, 40]);
    // Declare the far shaft's constraint against a shaft that is itself constrained.
    let movement = updateShaft(t.movement, at(t.shafts, 2).id, {
      placement: meshPolar(at(t.shafts, 1), at(t.meshes, 1), 0),
    });
    movement = updateShaft(movement, at(t.shafts, 1).id, {
      placement: meshPolar(at(t.shafts, 0), at(t.meshes, 0), 0),
    });
    const before = solvePlacement(movement);
    expect(before.failures).toEqual([]);
    expect(toMillimetres(before.shaftPositions.get(at(t.shafts, 2).id)?.x ?? millimetres(Number.NaN))).toBeCloseTo(7 + 5, 9);

    // Parametric propagation: a new tooth count moves both dependent shafts.
    const edited = updateGear(movement, at(t.gears, 1).id, { toothCount: 20 });
    const after = solvePlacement(edited);
    const p0 = after.shaftPositions.get(at(t.shafts, 0).id);
    const p1 = after.shaftPositions.get(at(t.shafts, 1).id);
    const p2 = after.shaftPositions.get(at(t.shafts, 2).id);
    if (p0 === undefined || p1 === undefined || p2 === undefined) throw new Error("unplaced");
    expect(toMillimetres(distance(p0, p1))).toBeCloseTo(8, 9);
    expect(toMillimetres(distance(p1, p2))).toBeCloseTo(6, 9);
  });

  it("reports a circular constraint instead of guessing", () => {
    const t = chain([60, 10]);
    let movement = updateShaft(t.movement, at(t.shafts, 0).id, {
      placement: meshPolar(at(t.shafts, 1), at(t.meshes, 0), 0),
    });
    movement = updateShaft(movement, at(t.shafts, 1).id, {
      placement: meshPolar(at(t.shafts, 0), at(t.meshes, 0), 0),
    });
    const solution = solvePlacement(movement);
    expect(solution.shaftPositions.size).toBe(0);
    expect(solution.failures.map((f) => f.reason)).toEqual(["CIRCULAR_REFERENCE", "CIRCULAR_REFERENCE"]);
  });

  it("rejects a mesh that does not connect the two shafts", () => {
    const t = chain([60, 10, 40]);
    const movement = updateShaft(t.movement, at(t.shafts, 2).id, {
      placement: meshPolar(at(t.shafts, 0), at(t.meshes, 0), 0),
    });
    const failure = solvePlacement(movement).failures.find((f) => f.shaftId === at(t.shafts, 2).id);
    expect(failure?.reason).toBe("MESH_NOT_BETWEEN_SHAFTS");
  });

  it("cannot place a shaft whose mesh has invalid parameters, and propagates that downstream", () => {
    const t = chain([60, 10, 40]);
    let movement = updateShaft(t.movement, at(t.shafts, 1).id, {
      placement: meshPolar(at(t.shafts, 0), at(t.meshes, 0), 0),
    });
    movement = updateShaft(movement, at(t.shafts, 2).id, {
      placement: meshPolar(at(t.shafts, 1), at(t.meshes, 1), 0),
    });
    movement = updateGear(movement, at(t.gears, 0).id, { toothCount: 0 });
    const reasons = new Map(solvePlacement(movement).failures.map((f) => [f.shaftId, f.reason]));
    expect(reasons.get(at(t.shafts, 1).id)).toBe("INVALID_MESH_PARAMETERS");
    expect(reasons.get(at(t.shafts, 2).id)).toBe("REFERENCE_UNRESOLVED");
  });

  it("reports a non-finite fixed coordinate", () => {
    const t = chain([60]);
    const movement = updateShaft(t.movement, at(t.shafts, 0).id, {
      placement: fixedAt(millimetres(Number.POSITIVE_INFINITY), millimetres(0)),
    });
    expect(solvePlacement(movement).failures[0]?.reason).toBe("NON_FINITE");
  });
});
