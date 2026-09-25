import type { Angle } from "@/units/angle";
import { radians, normalizeAngle } from "@/units/angle";
import type { TimeSpan } from "@/units/time";
import { seconds } from "@/units/time";
import type { Movement } from "@/domain/movement";
import type { ShaftId } from "@/domain/shaft";
import type { GearTrainSolution } from "@/kinematics/solveGearTrain";

/**
 * Transient kinematic simulation state: the accumulated rotation of each
 * shaft over time. This is driven exclusively by the gear-train solver's
 * angular velocities (see docs/MASTER_BUILD_PROMPT.md "First milestone":
 * "the viewport must derive its geometry and animation from the domain
 * model"). It never sets shaft rotation directly from the renderer.
 *
 * Validation level: KINEMATIC (rigid-body, lossless propagation of a
 * user-specified driving angular velocity — no torque/dynamics solved).
 */
export interface SimulationState {
  time: TimeSpan;
  isRunning: boolean;
  shaftAngle: Readonly<Record<ShaftId, Angle>>;
}

export function createSimulationState(movement: Movement): SimulationState {
  const shaftAngle: Record<ShaftId, Angle> = {};
  for (const shaftId of Object.keys(movement.shafts) as ShaftId[]) {
    shaftAngle[shaftId] = radians(0);
  }
  return { time: seconds(0), isRunning: false, shaftAngle };
}

export function stepSimulation(
  state: SimulationState,
  solution: GearTrainSolution,
  dtSeconds: number,
): SimulationState {
  const nextShaftAngle: Record<ShaftId, Angle> = { ...state.shaftAngle };
  for (const [shaftId, angularVelocity] of solution.shaftAngularVelocity) {
    const previous = nextShaftAngle[shaftId] ?? radians(0);
    nextShaftAngle[shaftId] = normalizeAngle(radians(previous + angularVelocity * dtSeconds));
  }
  return {
    time: seconds(state.time + dtSeconds),
    isRunning: state.isRunning,
    shaftAngle: nextShaftAngle,
  };
}
