import type { Angle } from "@/units/angle";
import { radians, normalizeAngle } from "@/units/angle";
import type { TimeSpan } from "@/units/time";
import { seconds } from "@/units/time";
import type { Movement } from "@/domain/movement";
import type { ShaftId } from "@/domain/shaft";
import { stemBodyId, type StemBodyId } from "@/domain/keyless";
import { mainsprings, type CouplingId } from "@/domain/coupling";
import type { DateComplicationId } from "@/domain/dateComplication";
import type { GearTrainSolution } from "@/kinematics/solveGearTrain";
import { crossesRevolution, dateJumpStepAngle } from "@/kinematics/dateComplication";
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
  /** Rotation of stem bodies about the stem direction (crown, sliding and winding pinions). */
  stemAngle: Readonly<Record<StemBodyId, Angle>>;
  /**
   * State of wind of each mainspring with data, in arbor turns from let-down
   * (ASM-0026). Starts fully wound, an initial condition of the simulation.
   */
  mainspringWind: Readonly<Record<CouplingId, number>>;
  /** Real time received but not yet consumed by a fixed step, in seconds. */
  pendingSeconds: number;
}

export class NonFiniteSimulationStateError extends Error {}

export function createSimulationState(movement: Movement): SimulationState {
  const shaftAngle: Record<ShaftId, Angle> = {};
  for (const shaftId of Object.keys(movement.shafts) as ShaftId[]) {
    shaftAngle[shaftId] = radians(0);
  }
  const stemAngle: Record<StemBodyId, Angle> = {};
  for (const id of Object.keys(movement.keylessWorks) as (keyof Movement["keylessWorks"])[]) {
    stemAngle[stemBodyId(id, "STEM")] = radians(0);
    stemAngle[stemBodyId(id, "WINDING_PINION")] = radians(0);
  }
  const mainspringWind: Record<CouplingId, number> = {};
  for (const link of mainsprings(movement.couplings)) {
    if (link.spring !== null && Number.isFinite(link.spring.usableTurns) && link.spring.usableTurns > 0) {
      mainspringWind[link.id] = link.spring.usableTurns;
    }
  }
  return { stepCount: 0, time: seconds(0), shaftAngle, stemAngle, mainspringWind, pendingSeconds: 0 };
}

/**
 * How a mainspring's wind changes: the arbor turning the drum's running
 * way winds it; the drum running unwinds it (ASM-0018). `sign` is the
 * drum's running direction.
 */
export interface WindTrack {
  id: CouplingId;
  arbor: ShaftId;
  drum: ShaftId;
  sign: 1 | -1;
  maxTurns: number;
}

/**
 * Brings the wind state in line with an edited design: a spring given data
 * starts fully wound; one whose usable turns shrank is clamped; entries for
 * removed springs or springs without data are dropped.
 */
export function reconcileWind(state: SimulationState, movement: Movement): SimulationState {
  const next: Record<CouplingId, number> = {};
  for (const link of mainsprings(movement.couplings)) {
    const max = link.spring?.usableTurns;
    if (max === undefined || !Number.isFinite(max) || max <= 0) continue;
    next[link.id] = Math.min(max, state.mainspringWind[link.id] ?? max);
  }
  const before = state.mainspringWind;
  const same = Object.keys(next).length === Object.keys(before).length
    && (Object.keys(next) as CouplingId[]).every((id) => before[id] === next[id]);
  return same ? state : { ...state, mainspringWind: next };
}

/**
 * A declared date complication (ASM-0048), ready for stepping: which
 * arbor's revolutions trigger the jump, which arbor the jump advances,
 * and by how much. Built fresh whenever the design or its solved train
 * changes, same lifecycle as `WindTrack`.
 */
export interface DateJumpTrack {
  id: DateComplicationId;
  driveShaftId: ShaftId;
  starShaftId: ShaftId;
  stepAngle: Angle;
}

export function dateJumpTracks(movement: Movement): DateJumpTrack[] {
  return Object.values(movement.dateComplications).flatMap((date) => {
    if (!(Number.isInteger(date.starToothCount) && date.starToothCount > 0)) return [];
    return [{ id: date.id, driveShaftId: date.driveShaftId, starShaftId: date.starShaftId, stepAngle: dateJumpStepAngle(date.starToothCount) }];
  });
}

export function windTracks(movement: Movement, running: GearTrainSolution): WindTrack[] {
  return mainsprings(movement.couplings).flatMap((link) => {
    const drumOmega = running.shaftAngularVelocity.get(link.shaftBId);
    if (link.spring === null || drumOmega === undefined || drumOmega === 0 || !(link.spring.usableTurns > 0)) return [];
    return [{ id: link.id, arbor: link.shaftAId, drum: link.shaftBId, sign: drumOmega > 0 ? 1 : -1, maxTurns: link.spring.usableTurns }];
  });
}

/** One fixed step. Throws rather than storing a non-finite angle (SIM-001). */
export function stepSimulation(
  state: SimulationState,
  solution: GearTrainSolution,
  dtSeconds: number = NUMERICAL_PARAMETERS.simulationTimestepSeconds,
  tracks: readonly WindTrack[] = [],
  dateJumps: readonly DateJumpTrack[] = [],
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
  // Date star arbors (ASM-0048) are not continuous gear-train members, so the loop above never
  // touches them; a jump, when the drive arbor crosses its own revolution, advances the star
  // directly by one step instead. Read from the drive arbor's pre-step angle (`state`, never
  // mutated here), forward crossings only (`crossesRevolution`'s own ratchet behaviour).
  for (const track of dateJumps) {
    const driveOmega = solution.shaftAngularVelocity.get(track.driveShaftId);
    if (driveOmega === undefined) continue;
    const previousDriveAngle = state.shaftAngle[track.driveShaftId] ?? radians(0);
    if (!crossesRevolution(previousDriveAngle, driveOmega, dtSeconds)) continue;
    const current = nextShaftAngle[track.starShaftId] ?? radians(0);
    nextShaftAngle[track.starShaftId] = normalizeAngle(radians(current + track.stepAngle));
  }
  const nextStemAngle: Record<StemBodyId, Angle> = { ...state.stemAngle };
  for (const [id, angularVelocity] of solution.stemAngularVelocity) {
    const next = (nextStemAngle[id] ?? radians(0)) + angularVelocity * dtSeconds;
    if (!Number.isFinite(next)) {
      throw new NonFiniteSimulationStateError(`SIM-001: stem body ${id} angle became non-finite`);
    }
    nextStemAngle[id] = normalizeAngle(radians(next));
  }
  const nextWind: Record<CouplingId, number> = { ...state.mainspringWind };
  for (const track of tracks) {
    const current = nextWind[track.id];
    if (current === undefined) continue;
    const arbor = solution.shaftAngularVelocity.get(track.arbor) ?? 0;
    const drum = solution.shaftAngularVelocity.get(track.drum) ?? 0;
    const change = ((arbor - drum) * track.sign * dtSeconds) / (2 * Math.PI);
    // Fully wound stops further winding; let down stops further unwinding.
    nextWind[track.id] = Math.min(track.maxTurns, Math.max(0, current + change));
  }
  const stepCount = state.stepCount + 1;
  return {
    stepCount,
    time: seconds(stepCount * dtSeconds),
    shaftAngle: nextShaftAngle,
    stemAngle: nextStemAngle,
    mainspringWind: nextWind,
    pendingSeconds: state.pendingSeconds,
  };
}

/**
 * The solution to integrate: fixed, or chosen from the state before each
 * step (the going train stops when the mainspring runs down, ASM-0026).
 */
export type SolutionSource = GearTrainSolution | ((state: SimulationState) => GearTrainSolution);

/**
 * Feeds real elapsed time into the fixed-step integrator. Leftover time
 * carries over, so any split of the same total elapsed time gives the
 * same result (up to the step cap, which drops time rather than
 * integrating it with a larger, non-deterministic step). A state-dependent
 * source is consulted before every step, so a stop takes effect at the
 * same step however the time is split.
 */
export function advanceSimulation(
  state: SimulationState,
  source: SolutionSource,
  elapsedRealSeconds: number,
  tracks: readonly WindTrack[] = [],
  dateJumps: readonly DateJumpTrack[] = [],
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
    next = stepSimulation(next, typeof source === "function" ? source(next) : source, dt, tracks, dateJumps);
  }
  return { ...next, pendingSeconds: pending - steps * dt };
}
