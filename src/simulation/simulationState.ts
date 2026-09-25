import type { Angle } from "@/units/angle";
import { radians, normalizeAngle } from "@/units/angle";
import type { TimeSpan } from "@/units/time";
import { seconds } from "@/units/time";
import type { Movement } from "@/domain/movement";
import type { ShaftId } from "@/domain/shaft";
import type { GearTrainSolution } from "@/kinematics/solveGearTrain";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";

/**
 * Kinematic (L2) simulation state: accumulated rotation of each shaft,
 * driven exclusively by the gear-train solver. Deterministic (SIM-002):
 * it advances in fixed steps, so the state depends only on the design,
 * the initial conditions and the number of steps, never on frame timing.
 */
export interface SimulationState {
  stepCount: number;
  time: TimeSpan;
  shaftAngle: Readonly<Record<ShaftId, Angle>>;
  /** Real time received but not yet consumed by a fixed step, in seconds. */
  pendingSeconds: number;
}

export class NonFiniteSimulationStateError extends Error {}

export function createSimulationState(movement: Movement): SimulationState {
  const shaftAngle: Record<ShaftId, Angle> = {};
  for (const shaftId of Object.keys(movement.shafts) as ShaftId[]) {
    shaftAngle[shaftId] = radians(0);
  }
  return { stepCount: 0, time: seconds(0), shaftAngle, pendingSeconds: 0 };
}

/** One fixed step. Throws rather than storing a non-finite angle (SIM-001). */
export function stepSimulation(
  state: SimulationState,
  solution: GearTrainSolution,
  dtSeconds: number = NUMERICAL_PARAMETERS.simulationTimestepSeconds,
): SimulationState {
  const nextShaftAngle: Record<ShaftId, Angle> = { ...state.shaftAngle };
  for (const [shaftId, angularVelocity] of solution.shaftAngularVelocity) {
    const previous = nextShaftAngle[shaftId] ?? radians(0);
    const next = previous + angularVelocity * dtSeconds;
    if (!Number.isFinite(next)) {
      throw new NonFiniteSimulationStateError(`SIM-001: shaft ${shaftId} angle became non-finite`);
    }
    nextShaftAngle[shaftId] = normalizeAngle(radians(next));
  }
  const stepCount = state.stepCount + 1;
  return {
    stepCount,
    time: seconds(stepCount * dtSeconds),
    shaftAngle: nextShaftAngle,
    pendingSeconds: state.pendingSeconds,
  };
}

/**
 * Feeds real elapsed time into the fixed-step integrator. Leftover time
 * carries over, so any split of the same total elapsed time gives the
 * same result (up to the step cap, which drops time rather than
 * integrating it with a larger, non-deterministic step).
 */
export function advanceSimulation(
  state: SimulationState,
  solution: GearTrainSolution,
  elapsedRealSeconds: number,
): SimulationState {
  const dt = NUMERICAL_PARAMETERS.simulationTimestepSeconds;
  let pending = state.pendingSeconds + Math.max(0, elapsedRealSeconds);
  let steps = Math.floor(pending / dt);
  if (steps > NUMERICAL_PARAMETERS.maxSimulationStepsPerAdvance) {
    steps = NUMERICAL_PARAMETERS.maxSimulationStepsPerAdvance;
    pending = steps * dt;
  }

  let next = state;
  for (let i = 0; i < steps; i += 1) {
    next = stepSimulation(next, solution, dt);
  }
  return { ...next, pendingSeconds: pending - steps * dt };
}
