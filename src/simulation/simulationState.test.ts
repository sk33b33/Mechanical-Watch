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
  reconcileWind,
  type DateJumpTrack,
  type WindTrack,
} from "./simulationState";
import type { CouplingId } from "@/domain/coupling";
import { newtonMillimetres } from "@/units/torque";
import type { DateComplicationId } from "@/domain/dateComplication";
import { dateJumpStepAngle } from "@/kinematics/dateComplication";

const shaftId = "shaft_1" as ShaftId;
const movement = { shafts: { [shaftId]: {} }, keylessWorks: {}, couplings: {} } as unknown as Movement;

function solutionAt(rpm: number): GearTrainSolution {
  return {
    shaftAngularVelocity: new Map([[shaftId, rpmToRadPerSecond(rpm)]]),
    unreachableShaftIds: [],
    conflicts: [],
    mode: "RUNNING",
    setting: { status: "NOT_APPLICABLE" },
    stemAngularVelocity: new Map(),
    winding: { status: "NOT_APPLICABLE" },
    stemPosition: "WINDING",
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
      mode: "RUNNING",
      setting: { status: "NOT_APPLICABLE" },
      stemAngularVelocity: new Map(),
      winding: { status: "NOT_APPLICABLE" },
      stemPosition: "WINDING",
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

describe("mainspring wind (ASM-0026)", () => {
  const arbor = "shaft_arbor" as ShaftId;
  const drum = "shaft_drum" as ShaftId;
  const springId = "coupling_1" as CouplingId;
  const spec = { usableTurns: 6.5, fullyWoundTorque: newtonMillimetres(10), letDownTorque: newtonMillimetres(6), trainEfficiency: null };
  const withSpring = {
    shafts: { [arbor]: {}, [drum]: {} },
    keylessWorks: {},
    couplings: { [springId]: { id: springId, kind: "MAINSPRING", shaftAId: arbor, shaftBId: drum, spring: spec } },
  } as unknown as Movement;
  // The drum runs negative (clockwise) in this fixture, so the arbor winds by turning negative too.
  const track: WindTrack = { id: springId, arbor, drum, sign: -1, maxTurns: 6.5 };
  const turning = (arborRevPerSecond: number, drumRevPerSecond: number): GearTrainSolution => ({
    ...solutionAt(0),
    shaftAngularVelocity: new Map([
      [arbor, radiansPerSecond(arborRevPerSecond * 2 * Math.PI)],
      [drum, radiansPerSecond(drumRevPerSecond * 2 * Math.PI)],
    ]),
  });

  it("starts fully wound", () => {
    expect(createSimulationState(withSpring).mainspringWind[springId]).toBe(6.5);
  });

  it("the running drum unwinds it and the arbor turning the drum's way winds it, within let-down and fully wound", () => {
    const start = createSimulationState(withSpring);
    const unwound = stepSimulation(start, turning(0, -0.5), 1, [track]);
    expect(unwound.mainspringWind[springId]).toBeCloseTo(6, 12);
    const wound = stepSimulation(unwound, turning(-0.25, 0), 1, [track]);
    expect(wound.mainspringWind[springId]).toBeCloseTo(6.25, 12);
    expect(stepSimulation(start, turning(-3, 0), 1, [track]).mainspringWind[springId]).toBe(6.5);
    expect(stepSimulation(start, turning(0, -10), 1, [track]).mainspringWind[springId]).toBe(0);
  });

  it("a state-dependent source is consulted before every step", () => {
    const start = { ...createSimulationState(withSpring), mainspringWind: { [springId]: 0.01 } };
    // Stops once the wind reaches zero, whatever the tick size.
    const source = (s: typeof start): GearTrainSolution => ((s.mainspringWind[springId] ?? 0) > 0 ? turning(0, -1) : turning(0, 0));
    const dt = NUMERICAL_PARAMETERS.simulationTimestepSeconds;
    const one = advanceSimulation(start, source, 200 * dt, [track]);
    let many = start;
    for (let i = 0; i < 8; i += 1) many = advanceSimulation(many, source, 25 * dt, [track]);
    expect(one.shaftAngle).toEqual(many.shaftAngle);
    expect(one.mainspringWind[springId]).toBe(0);
  });

  it("reconciles with an edited design: new data starts wound, fewer turns clamp, removed springs drop", () => {
    const state = { ...createSimulationState(withSpring), mainspringWind: { [springId]: 5 } };
    expect(reconcileWind(state, withSpring)).toBe(state);
    const fewer = { ...withSpring, couplings: { [springId]: { ...withSpring.couplings[springId], spring: { ...spec, usableTurns: 4 } } } } as Movement;
    expect(reconcileWind(state, fewer).mainspringWind[springId]).toBe(4);
    expect(reconcileWind(state, { ...withSpring, couplings: {} }).mainspringWind).toEqual({});
    expect(reconcileWind({ ...state, mainspringWind: {} }, withSpring).mainspringWind[springId]).toBe(6.5);
  });
});

describe("date jump (ASM-0048)", () => {
  const driveShaftId = "shaft_drive" as ShaftId;
  const starShaftId = "shaft_star" as ShaftId;
  const dateId = "dateComplication_1" as DateComplicationId;
  const starToothCount = 31;
  const track: DateJumpTrack = { id: dateId, driveShaftId, starShaftId, stepAngle: dateJumpStepAngle(starToothCount) };
  const withDate = { shafts: { [driveShaftId]: {}, [starShaftId]: {} }, keylessWorks: {}, couplings: {} } as unknown as Movement;
  const driveSolution = (revPerSecond: number): GearTrainSolution => ({
    ...solutionAt(0),
    shaftAngularVelocity: new Map([[driveShaftId, radiansPerSecond(revPerSecond * 2 * Math.PI)]]),
  });

  it("the star does not move mid-revolution", () => {
    // 0.25 Hz drive over 0.5 s = 1/8 turn: nowhere near a full revolution.
    const next = stepSimulation(createSimulationState(withDate), driveSolution(0.25), 0.5, [], [track]);
    expect(next.shaftAngle[starShaftId] ?? radians(0)).toBe(0);
  });

  it("one full drive revolution advances the star by exactly one step", () => {
    // 1 Hz drive over 1 s = exactly one revolution.
    const next = stepSimulation(createSimulationState(withDate), driveSolution(1), 1, [], [track]);
    expect(toDegrees(next.shaftAngle[starShaftId] ?? radians(0))).toBeCloseTo(360 / starToothCount, 9);
  });

  it("many revolutions advance many steps, wrapping at the tooth count", () => {
    let state = createSimulationState(withDate);
    // 33 one-second steps at 1 Hz = 33 revolutions; the star has only 31 positions.
    for (let i = 0; i < 33; i += 1) state = stepSimulation(state, driveSolution(1), 1, [], [track]);
    const expectedSteps = 33 % starToothCount;
    expect(toDegrees(state.shaftAngle[starShaftId] ?? radians(0))).toBeCloseTo((360 / starToothCount) * expectedSteps, 6);
  });

  it("a stationary or reversed drive never advances the star (ratchet, one-way only)", () => {
    const stationary = stepSimulation(createSimulationState(withDate), driveSolution(0), 1, [], [track]);
    expect(stationary.shaftAngle[starShaftId] ?? radians(0)).toBe(0);
    // Start partway through a revolution, then reverse past the same angle: still no jump.
    let state = stepSimulation(createSimulationState(withDate), driveSolution(0.1), 1, [], [track]);
    state = stepSimulation(state, driveSolution(-0.1), 1, [], [track]);
    expect(state.shaftAngle[starShaftId] ?? radians(0)).toBe(0);
  });

  it("drive revolutions do not advance the star if no date jump is declared", () => {
    const next = stepSimulation(createSimulationState(withDate), driveSolution(1), 1);
    expect(next.shaftAngle[starShaftId] ?? radians(0)).toBe(0);
  });
});
