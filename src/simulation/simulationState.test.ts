import { describe, expect, it } from "vitest";
import { toDegrees, radians } from "@/units/angle";
import { rpmToRadPerSecond, radiansPerSecond } from "@/units/angularVelocity";
import type { ShaftId } from "@/domain/shaft";
import type { Movement } from "@/domain/movement";
import type { GearTrainSolution } from "@/kinematics/solveGearTrain";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import {
  createSimulationState,
  stepSimulation,
  advanceSimulation,
  NonFiniteSimulationStateError,
} from "./simulationState";

const shaftId = "shaft_1" as ShaftId;
const movement = { shafts: { [shaftId]: {} } } as unknown as Movement;

function solutionAt(rpm: number): GearTrainSolution {
  return {
    shaftAngularVelocity: new Map([[shaftId, rpmToRadPerSecond(rpm)]]),
    unreachableShaftIds: [],
    conflicts: [],
  };
}

describe("stepSimulation", () => {
  it("integrates shaft angle from angular velocity over time", () => {
    // 60 RPM = 360 deg/s; after 0.5 s expect 180 degrees.
    const next = stepSimulation(createSimulationState(movement), solutionAt(60), 0.5);
    expect(toDegrees(next.shaftAngle[shaftId] ?? radians(0))).toBeCloseTo(180, 5);
  });

  it("wraps angle into [0, 360) degrees", () => {
    let state = createSimulationState(movement);
    for (let i = 0; i < 3; i += 1) state = stepSimulation(state, solutionAt(60), 0.5);
    const deg = toDegrees(state.shaftAngle[shaftId] ?? radians(0));
    expect(deg).toBeGreaterThanOrEqual(0);
    expect(deg).toBeLessThan(360);
    expect(deg).toBeCloseTo(180, 5);
  });

  it("refuses to store a non-finite angle (SIM-001)", () => {
    const solution: GearTrainSolution = {
      shaftAngularVelocity: new Map([[shaftId, radiansPerSecond(Number.POSITIVE_INFINITY)]]),
      unreachableShaftIds: [],
      conflicts: [],
    };
    expect(() => stepSimulation(createSimulationState(movement), solution, 0.1)).toThrow(
      NonFiniteSimulationStateError,
    );
  });
});

describe("advanceSimulation (SIM-002 determinism)", () => {
  it("gives identical state for any split of the same elapsed time", () => {
    const solution = solutionAt(6);
    const initial = createSimulationState(movement);

    // Total 0.502 s = 120.48 steps: deliberately not on a step boundary,
    // where float accumulation could legitimately defer one step.
    const oneChunk = advanceSimulation(initial, solution, 0.502);

    let jittery = initial;
    for (const dt of [0.013, 0.021, 0.0167, 0.2, 0.0003, 0.1, 0.151]) {
      jittery = advanceSimulation(jittery, solution, dt);
    }

    expect(jittery.stepCount).toBe(oneChunk.stepCount);
    expect(jittery.shaftAngle[shaftId]).toBe(oneChunk.shaftAngle[shaftId]);
  });

  it("advances in whole fixed steps and carries the remainder", () => {
    const dt = NUMERICAL_PARAMETERS.simulationTimestepSeconds;
    const state = advanceSimulation(createSimulationState(movement), solutionAt(6), dt * 2.5);
    expect(state.stepCount).toBe(2);
    expect(state.pendingSeconds).toBeCloseTo(dt * 0.5, 12);
  });

  it("caps steps per advance instead of taking one large step", () => {
    const state = advanceSimulation(createSimulationState(movement), solutionAt(6), 1000);
    expect(state.stepCount).toBe(NUMERICAL_PARAMETERS.maxSimulationStepsPerAdvance);
    expect(state.pendingSeconds).toBeCloseTo(0, 12);
  });
});
