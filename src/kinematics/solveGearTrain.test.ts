import { describe, expect, it } from "vitest";
import { millimetres } from "@/units/length";
import { rpmToRadPerSecond, toRpm, radiansPerSecond } from "@/units/angularVelocity";
import { createMovement, addShaft, addGear, addGearMesh, setDrivingShaft } from "@/domain/movement";
import { createShaft } from "@/domain/shaft";
import { createGear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { solveGearTrain } from "./solveGearTrain";

describe("solveGearTrain", () => {
  it("propagates angular velocity across a single mesh with direction reversal", () => {
    const shaftA = createShaft("A", { x: millimetres(0), y: millimetres(0) });
    const shaftB = createShaft("B", { x: millimetres(7), y: millimetres(0) });
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
    movement = addGearMesh(movement, createGearMesh(gearA.id, gearB.id));
    movement = setDrivingShaft(movement, shaftA.id, rpmToRadPerSecond(60));

    const solution = solveGearTrain(movement);

    expect(solution.conflicts).toHaveLength(0);
    expect(solution.unreachableShaftIds).toHaveLength(0);
    const velocityA = solution.shaftAngularVelocity.get(shaftA.id);
    const velocityB = solution.shaftAngularVelocity.get(shaftB.id);
    expect(velocityA).toBeDefined();
    expect(velocityB).toBeDefined();
    expect(toRpm(velocityA ?? radiansPerSecond(0))).toBeCloseTo(60);
    expect(toRpm(velocityB ?? radiansPerSecond(0))).toBeCloseTo(-360);
  });

  it("propagates through a compound train stage by stage", () => {
    const shaft1 = createShaft("S1", { x: millimetres(0), y: millimetres(0) });
    const shaft2 = createShaft("S2", { x: millimetres(7), y: millimetres(0) });
    const shaft3 = createShaft("S3", { x: millimetres(14), y: millimetres(0) });
    const gear1 = createGear({
      name: "G1",
      toothCount: 60,
      module: millimetres(0.2),
      thickness: millimetres(0.2),
      shaftId: shaft1.id,
    });
    const gear2 = createGear({
      name: "G2",
      toothCount: 10,
      module: millimetres(0.2),
      thickness: millimetres(0.2),
      shaftId: shaft2.id,
    });
    const gear3 = createGear({
      name: "G3",
      toothCount: 40,
      module: millimetres(0.2),
      thickness: millimetres(0.2),
      shaftId: shaft3.id,
    });

    let movement = createMovement("Compound", true);
    movement = addShaft(movement, shaft1);
    movement = addShaft(movement, shaft2);
    movement = addShaft(movement, shaft3);
    movement = addGear(movement, gear1);
    movement = addGear(movement, gear2);
    movement = addGear(movement, gear3);
    movement = addGearMesh(movement, createGearMesh(gear1.id, gear2.id));
    movement = addGearMesh(movement, createGearMesh(gear2.id, gear3.id));
    movement = setDrivingShaft(movement, shaft1.id, rpmToRadPerSecond(60));

    const solution = solveGearTrain(movement);
    expect(solution.conflicts).toHaveLength(0);

    const velocityLast = solution.shaftAngularVelocity.get(shaft3.id);
    // stage 1: 60/10 = -6x, stage 2: 10/40 = -0.25x => net 1.5x, same direction (double reversal)
    expect(toRpm(velocityLast ?? radiansPerSecond(0))).toBeCloseTo(90);
  });

  it("flags a conflict when a triangular mesh loop is inconsistent", () => {
    const shaftA = createShaft("A", { x: millimetres(0), y: millimetres(0) });
    const shaftB = createShaft("B", { x: millimetres(7), y: millimetres(0) });
    const shaftC = createShaft("C", { x: millimetres(3.5), y: millimetres(6) });
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
    // Tooth count chosen so the direct A->C ratio disagrees with A->B->C.
    const gearC = createGear({
      name: "C",
      toothCount: 20,
      module: millimetres(0.2),
      thickness: millimetres(0.2),
      shaftId: shaftC.id,
    });

    let movement = createMovement("Loop", true);
    movement = addShaft(movement, shaftA);
    movement = addShaft(movement, shaftB);
    movement = addShaft(movement, shaftC);
    movement = addGear(movement, gearA);
    movement = addGear(movement, gearB);
    movement = addGear(movement, gearC);
    movement = addGearMesh(movement, createGearMesh(gearA.id, gearB.id));
    movement = addGearMesh(movement, createGearMesh(gearB.id, gearC.id));
    movement = addGearMesh(movement, createGearMesh(gearA.id, gearC.id));
    movement = setDrivingShaft(movement, shaftA.id, rpmToRadPerSecond(60));

    const solution = solveGearTrain(movement);
    expect(solution.conflicts.length).toBeGreaterThan(0);
  });

  it("treats a mesh with an invalid tooth count as impassable, without throwing", () => {
    const shaftA = createShaft("A", { x: millimetres(0), y: millimetres(0) });
    const shaftB = createShaft("B", { x: millimetres(7), y: millimetres(0) });
    const gearA = createGear({
      name: "A",
      toothCount: 60,
      module: millimetres(0.2),
      thickness: millimetres(0.2),
      shaftId: shaftA.id,
    });
    // Mid-edit invalid state: below the minimum tooth count.
    const gearB = createGear({
      name: "B",
      toothCount: 2,
      module: millimetres(0.2),
      thickness: millimetres(0.2),
      shaftId: shaftB.id,
    });

    let movement = createMovement("Invalid", true);
    movement = addShaft(movement, shaftA);
    movement = addShaft(movement, shaftB);
    movement = addGear(movement, gearA);
    movement = addGear(movement, gearB);
    movement = addGearMesh(movement, createGearMesh(gearA.id, gearB.id));
    movement = setDrivingShaft(movement, shaftA.id, rpmToRadPerSecond(60));

    expect(() => solveGearTrain(movement)).not.toThrow();
    const solution = solveGearTrain(movement);
    expect(solution.shaftAngularVelocity.has(shaftB.id)).toBe(false);
    expect(solution.unreachableShaftIds).toContain(shaftB.id);
  });

  it("reports shafts with no path from the driving shaft as unreachable", () => {
    const shaftA = createShaft("A", { x: millimetres(0), y: millimetres(0) });
    const shaftIsolated = createShaft("Isolated", { x: millimetres(20), y: millimetres(20) });
    const gearA = createGear({
      name: "A",
      toothCount: 60,
      module: millimetres(0.2),
      thickness: millimetres(0.2),
      shaftId: shaftA.id,
    });

    let movement = createMovement("Disconnected", true);
    movement = addShaft(movement, shaftA);
    movement = addShaft(movement, shaftIsolated);
    movement = addGear(movement, gearA);
    movement = setDrivingShaft(movement, shaftA.id, rpmToRadPerSecond(60));

    const solution = solveGearTrain(movement);
    expect(solution.unreachableShaftIds).toContain(shaftIsolated.id);
  });
});
