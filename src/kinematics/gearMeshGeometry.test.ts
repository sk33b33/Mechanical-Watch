import { describe, expect, it } from "vitest";
import { millimetres, toMillimetres } from "@/units/length";
import { createMovement, addShaft, addGear, addGearMesh } from "@/domain/movement";
import { createShaft } from "@/domain/shaft";
import { createGear } from "@/domain/gear";
import { createGearMesh, type GearMesh } from "@/domain/gearMesh";
import { computeGearMeshGeometry } from "./gearMeshGeometry";
import type { Movement } from "@/domain/movement";

function buildTwoGearMovement(centreDistanceMm: number): { movement: Movement; mesh: GearMesh } {
  const shaftA = createShaft("A", { x: millimetres(0), y: millimetres(0) });
  const shaftB = createShaft("B", { x: millimetres(centreDistanceMm), y: millimetres(0) });
  const gearA = createGear({
    name: "A",
    toothCount: 60,
    module: millimetres(0.2),
    thickness: millimetres(0.2),
    shaftId: shaftA.id,
  });
  const gearB = createGear({
    name: "B",
    toothCount: 10,
    module: millimetres(0.2),
    thickness: millimetres(0.2),
    shaftId: shaftB.id,
  });
  let movement = createMovement("Sandbox", true);
  movement = addShaft(movement, shaftA);
  movement = addShaft(movement, shaftB);
  movement = addGear(movement, gearA);
  movement = addGear(movement, gearB);
  const mesh = createGearMesh(gearA.id, gearB.id);
  movement = addGearMesh(movement, mesh);
  return { movement, mesh };
}

describe("computeGearMeshGeometry", () => {
  it("computes the ideal centre distance from module and tooth counts", () => {
    const { movement, mesh } = buildTwoGearMovement(7);
    const geometry = computeGearMeshGeometry(movement, mesh);
    expect(toMillimetres(geometry.idealCentreDistance)).toBeCloseTo(7);
    expect(toMillimetres(geometry.actualCentreDistance)).toBeCloseTo(7);
    expect(geometry.isAchievable).toBe(true);
  });

  it("flags shaft placement that does not match the ideal centre distance", () => {
    const { movement, mesh } = buildTwoGearMovement(9);
    const geometry = computeGearMeshGeometry(movement, mesh);
    expect(geometry.isAchievable).toBe(false);
  });
});
