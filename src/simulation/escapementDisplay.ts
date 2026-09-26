import type { Movement } from "@/domain/movement";
import type { ShaftId } from "@/domain/shaft";
import type { Escapement } from "@/domain/escapement";
import type { Angle } from "@/units/angle";
import type { Frequency } from "@/units/frequency";
import { isValidToothCount } from "@/math/gearMath";
import { beatFrequency, escapementMotion } from "@/kinematics/escapement";
import type { GearTrainSolution } from "@/kinematics/solveGearTrain";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";

/**
 * How the escapement shows on top of the continuous kinematic simulation
 * (ASM-0023). The simulation state keeps the train's average motion; this
 * derives, for display, the balance and fork angles and how far each
 * escapement-governed shaft is held back between beats. Shafts turned by
 * something else (hands being set, the crown winding) are not held back.
 */
export interface EscapementDisplay {
  escapement: Escapement;
  beatFrequency: Frequency | null;
  balanceAngle: Angle;
  forkAngle: Angle;
  /** Radians to add to each governed shaft's simulated angle. */
  shaftAngleOffset: ReadonlyMap<ShaftId, number>;
}

function same(a: number, b: number): boolean {
  return Math.abs(a - b) <= NUMERICAL_PARAMETERS.solverRelativeTolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

/** The movement's escapement (validation reports more than one, ESC-101). */
export function primaryEscapement(movement: Movement): Escapement | null {
  return Object.values(movement.escapements)[0] ?? null;
}

/**
 * `amplitude` overrides the declared amplitude (the energy model's
 * prediction, ASM-0026); `stopped` shows a run-down movement: the balance
 * at rest, the fork against a banking, nothing released.
 */
export interface EscapementDisplayOptions {
  amplitude?: Angle | null;
  stopped?: boolean;
}

export function escapementDisplay(
  movement: Movement,
  running: GearTrainSolution,
  current: GearTrainSolution,
  time: number,
  options: EscapementDisplayOptions = {},
): EscapementDisplay | null {
  const escapement = primaryEscapement(movement);
  if (escapement === null) return null;
  const at = (balanceAngle: number, forkAngle: number, beats: Frequency | null, offsets = new Map<ShaftId, number>()): EscapementDisplay => ({
    escapement,
    beatFrequency: beats,
    balanceAngle: balanceAngle as Angle,
    forkAngle: forkAngle as Angle,
    shaftAngleOffset: offsets,
  });
  if (options.stopped === true) return at(0, Number.isFinite(escapement.leverAngle) ? (0 - escapement.leverAngle) / 2 : 0, null);
  const omega = running.shaftAngularVelocity.get(escapement.escapeArborShaftId);
  if (omega === undefined || omega === 0 || !isValidToothCount(escapement.escapeWheel.toothCount)) return at(0, 0, null);
  const beats = beatFrequency(omega, escapement.escapeWheel.toothCount);
  const motion = escapementMotion(
    { beatFrequency: beats, amplitude: options.amplitude ?? escapement.balance.amplitude, liftAngle: escapement.balance.liftAngle, leverAngle: escapement.leverAngle },
    time,
  );
  if (motion === null) return at(0, 0, beats);
  const offsets = new Map<ShaftId, number>();
  for (const [id, w] of current.shaftAngularVelocity) {
    const runningW = running.shaftAngularVelocity.get(id);
    // Governed: turning at its running-train speed, which the escapement releases beat by beat.
    if (w !== 0 && runningW !== undefined && same(w, runningW)) offsets.set(id, w * (motion.effectiveTime - time));
  }
  return at(motion.balanceAngle, motion.forkAngle, beats, offsets);
}
