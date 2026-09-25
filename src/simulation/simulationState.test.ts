import { describe, expect, it } from "vitest";
import { toDegrees, radians } from "@/units/angle";
import { rpmToRadPerSecond } from "@/units/angularVelocity";
import type { ShaftId } from "@/domain/shaft";
import type { GearTrainSolution } from "@/kinematics/solveGearTrain";
import { createSimulationState, stepSimulation } from "./simulationState";
import type { Movement } from "@/domain/movement";

describe("stepSimulation", () => {
  it("integrates shaft angle from angular velocity over time", () => {
    const shaftId = "shaft_1" as ShaftId;
    const movement = { shafts: { [shaftId]: {} } } as unknown as Movement;
    const state = createSimulationState(movement);

    const solution: GearTrainSolution = {
      shaftAngularVelocity: new Map([[shaftId, rpmToRadPerSecond(60)]]),
      unreachableShaftIds: [],
      conflicts: [],
    };

    // 60 RPM = 360 deg/s; after 0.5s expect 180 degrees.
    const next = stepSimulation(state, solution, 0.5);
    expect(toDegrees(next.shaftAngle[shaftId] ?? radians(0))).toBeCloseTo(180, 5);
  });

  it("wraps angle into [0, 360) degrees", () => {
    const shaftId = "shaft_1" as ShaftId;
    const movement = { shafts: { [shaftId]: {} } } as unknown as Movement;
    let state = createSimulationState(movement);
    const solution: GearTrainSolution = {
      shaftAngularVelocity: new Map([[shaftId, rpmToRadPerSecond(60)]]),
      unreachableShaftIds: [],
      conflicts: [],
    };
    for (let i = 0; i < 3; i += 1) {
      state = stepSimulation(state, solution, 0.5);
    }
    const deg = toDegrees(state.shaftAngle[shaftId] ?? radians(0));
    expect(deg).toBeGreaterThanOrEqual(0);
    expect(deg).toBeLessThan(360);
    expect(deg).toBeCloseTo(180, 5);
  });
});
