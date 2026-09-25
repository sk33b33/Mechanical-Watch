import type { Length } from "@/units/length";
import { metres } from "@/units/length";
import type { AngularVelocity } from "@/units/angularVelocity";
import { radiansPerSecond } from "@/units/angularVelocity";
import type { Torque } from "@/units/torque";
import { newtonMetres } from "@/units/torque";

/**
 * Parametric gear mathematics.
 *
 * Assumptions (see docs/ENGINEERING_RULES.md and
 * .claude/skills/watch-engineering/SKILL.md):
 * - ideal involute gear approximation, no tooth-profile or backlash model;
 * - pitch diameter = module * tooth count;
 * - ideal centre distance = (pitch diameter A + pitch diameter B) / 2;
 * - speed relationship for an external mesh = -teeth A / teeth B
 *   (external meshes reverse rotational direction);
 * - torque propagation assumes a frictionless, rigid, lossless mesh
 *   (DYNAMIC_SIMPLIFIED — see docs/MASTER_BUILD_PROMPT.md "Validation levels").
 *
 * None of this implies manufacturability, correct tooth profile or
 * physical validation.
 */

export class InvalidGearParameterError extends Error {}

export const MIN_TOOTH_COUNT = 4;

export function isValidToothCount(toothCount: number): boolean {
  return Number.isInteger(toothCount) && toothCount >= MIN_TOOTH_COUNT;
}

export function isValidModule(module: Length): boolean {
  return Number.isFinite(module) && module > 0;
}

export function assertValidToothCount(toothCount: number): void {
  if (!isValidToothCount(toothCount)) {
    throw new InvalidGearParameterError(
      `Tooth count must be an integer >= ${String(MIN_TOOTH_COUNT)}, got ${String(toothCount)}`,
    );
  }
}

export function assertValidModule(module: Length): void {
  if (!isValidModule(module)) {
    throw new InvalidGearParameterError(
      `Module must be a positive finite length, got ${String(module)}`,
    );
  }
}

/** pitchDiameter = module * toothCount */
export function pitchDiameter(module: Length, toothCount: number): Length {
  assertValidModule(module);
  assertValidToothCount(toothCount);
  return metres(module * toothCount);
}

/** idealCentreDistance = (pitchDiameterA + pitchDiameterB) / 2 */
export function idealCentreDistance(pitchDiameterA: Length, pitchDiameterB: Length): Length {
  return metres((pitchDiameterA + pitchDiameterB) / 2);
}

/** Convenience: centre distance directly from module and tooth counts of a mesh. */
export function meshCentreDistance(module: Length, teethA: number, teethB: number): Length {
  return idealCentreDistance(pitchDiameter(module, teethA), pitchDiameter(module, teethB));
}

const CENTRE_DISTANCE_TOLERANCE_M = 1e-9;

/**
 * Checks whether an actual (e.g. constrained-by-assembly) centre distance
 * is achievable for the given module and tooth counts, within tolerance.
 * An "impossible" centre distance is one that does not match the ideal
 * value computed from module and tooth counts.
 */
export function isCentreDistanceAchievable(
  module: Length,
  teethA: number,
  teethB: number,
  actualCentreDistance: Length,
  toleranceMetres: number = CENTRE_DISTANCE_TOLERANCE_M,
): boolean {
  const ideal = meshCentreDistance(module, teethA, teethB);
  return Math.abs(ideal - actualCentreDistance) <= toleranceMetres;
}

/**
 * Signed angular-velocity ratio for a single external gear mesh:
 * drivenAngularVelocity = drivingAngularVelocity * ratio.
 * Negative because an external mesh reverses rotational direction.
 */
export function meshSpeedRatio(drivingTeeth: number, drivenTeeth: number): number {
  assertValidToothCount(drivingTeeth);
  assertValidToothCount(drivenTeeth);
  return -drivingTeeth / drivenTeeth;
}

export function drivenAngularVelocity(
  drivingAngularVelocity: AngularVelocity,
  drivingTeeth: number,
  drivenTeeth: number,
): AngularVelocity {
  return radiansPerSecond(drivingAngularVelocity * meshSpeedRatio(drivingTeeth, drivenTeeth));
}

/**
 * Compound train ratio: product of each stage's signed speed ratio, in
 * driving -> driven order. Each stage's drivenTeeth becomes the next
 * stage's driving shaft (identity of the intermediate shaft is the
 * caller's responsibility, per docs/ENGINEERING_RULES.md "Compound trains").
 */
export function compoundSpeedRatio(
  stages: readonly { drivingTeeth: number; drivenTeeth: number }[],
): number {
  if (stages.length === 0) {
    throw new InvalidGearParameterError("Compound train requires at least one stage");
  }
  return stages.reduce(
    (ratio, stage) => ratio * meshSpeedRatio(stage.drivingTeeth, stage.drivenTeeth),
    1,
  );
}

/**
 * Ideal (frictionless, lossless) torque propagation across a single mesh.
 * Torque scales inversely with the speed ratio magnitude; sign follows
 * the direction reversal of the speed ratio.
 *
 * This is a DYNAMIC_SIMPLIFIED approximation: it ignores friction,
 * efficiency losses, and elastic effects.
 */
export function drivenTorque(
  drivingTorque: Torque,
  drivingTeeth: number,
  drivenTeeth: number,
): Torque {
  const ratio = meshSpeedRatio(drivingTeeth, drivenTeeth);
  return newtonMetres(drivingTorque / ratio);
}
