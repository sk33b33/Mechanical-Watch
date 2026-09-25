import { describe, expect, it } from "vitest";
import { millimetres } from "@/units/length";
import { rpmToRadPerSecond } from "@/units/angularVelocity";
import { createMovement, addShaft, addGear, addGearMesh, setDrivingShaft } from "@/domain/movement";
import { createShaft } from "@/domain/shaft";
import { createGear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { validateMovement } from "./validateMovement";
import type { Movement } from "@/domain/movement";

function twoGearMesh(centreDistanceMm: number, moduleB = 0.2): Movement {
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
    module: millimetres(moduleB),
    thickness: millimetres(0.2),
    shaftId: shaftB.id,
  });
  let movement = createMovement("Sandbox", true);
  movement = addShaft(movement, shaftA);
  movement = addShaft(movement, shaftB);
  movement = addGear(movement, gearA);
  movement = addGear(movement, gearB);
  movement = addGearMesh(movement, createGearMesh(gearA.id, gearB.id));
  movement = setDrivingShaft(movement, shaftA.id, rpmToRadPerSecond(60));
  return movement;
}

describe("validateMovement", () => {
  it("reports no errors for a correctly meshed, correctly placed pair", () => {
    const movement = twoGearMesh(7);
    const issues = validateMovement(movement);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("flags an incorrect centre distance", () => {
    const movement = twoGearMesh(9);
    const issues = validateMovement(movement);
    expect(issues.some((i) => i.rule === "achievable-centre-distance")).toBe(true);
  });

  it("flags incompatible module between meshed gears", () => {
    const movement = twoGearMesh(7, 0.3);
    const issues = validateMovement(movement);
    expect(issues.some((i) => i.rule === "compatible-module")).toBe(true);
  });

  it("flags interference between unmeshed, overlapping gears", () => {
    const shaftA = createShaft("A", { x: millimetres(0), y: millimetres(0) });
    const shaftB = createShaft("B", { x: millimetres(1), y: millimetres(0) });
    const gearA = createGear({
      name: "A",
      toothCount: 60,
      module: millimetres(0.2),
      thickness: millimetres(0.2),
      shaftId: shaftA.id,
    });
    const gearB = createGear({
      name: "B",
      toothCount: 60,
      module: millimetres(0.2),
      thickness: millimetres(0.2),
      shaftId: shaftB.id,
    });
    let movement = createMovement("Sandbox", true);
    movement = addShaft(movement, shaftA);
    movement = addShaft(movement, shaftB);
    movement = addGear(movement, gearA);
    movement = addGear(movement, gearB);

    const issues = validateMovement(movement);
    expect(issues.some((i) => i.rule === "no-unintended-interference")).toBe(true);
  });

  it("warns about shafts unreachable from the driving shaft", () => {
    const movement = twoGearMesh(7);
    const shaftC = createShaft("C", { x: millimetres(50), y: millimetres(50) });
    const withExtra = addShaft(movement, shaftC);
    const issues = validateMovement(withExtra);
    expect(
      issues.some((i) => i.rule === "connected-to-drive" && i.severity === "warning"),
    ).toBe(true);
  });
});
