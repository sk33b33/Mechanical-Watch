import type { Length } from "@/units/length";
import { metres } from "@/units/length";
import type { AngularVelocity } from "@/units/angularVelocity";
import { radiansPerSecond } from "@/units/angularVelocity";
import type { Torque } from "@/units/torque";
import { newtonMetres } from "@/units/torque";
import type { LinearVelocity } from "@/units/linearVelocity";
import { metresPerSecond } from "@/units/linearVelocity";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import type { AssumptionId } from "@/reference/assumptions";

/**
 * Parametric gear mathematics — equations from
 * reference/REFERENCE_ENGINEERING.md §5 (traceability:
 * reference/TRACEABILITY.md). External standard citation for these
 * relationships is not yet recorded.
 *
 * Assumptions: ASM-0001 (ideal rigid gears). These relationships do not
 * establish tooth-profile engagement, backlash, material suitability or
 * manufacturability (§5.2, ASM-0004).
 */

export class InvalidGearParameterError extends Error {}

/** GEAR-001: tooth count must be a positive integer. */
export function isValidToothCount(toothCount: number): boolean {
  return Number.isInteger(toothCount) && toothCount > 0;
}

/** GEAR-002: module must be a positive, finite length. */
export function isValidModule(module: Length): boolean {
  return Number.isFinite(module) && module > 0;
}

export function assertValidToothCount(toothCount: number): void {
  if (!isValidToothCount(toothCount)) {
    throw new InvalidGearParameterError(
      `GEAR-001: tooth count must be a positive integer, got ${String(toothCount)}`,
    );
  }
}

export function assertValidModule(module: Length): void {
  if (!isValidModule(module)) {
    throw new InvalidGearParameterError(
      `GEAR-002: module must be a positive finite length, got ${String(module)}`,
    );
  }
}

/** §5.1: d = m z */
export function pitchDiameter(module: Length, toothCount: number): Length {
  assertValidModule(module);
  assertValidToothCount(toothCount);
  return metres(module * toothCount);
}

/** §5.2: a = (d1 + d2) / 2 */
export function idealCentreDistance(pitchDiameterA: Length, pitchDiameterB: Length): Length {
  return metres((pitchDiameterA + pitchDiameterB) / 2);
}

/** §5.2: a = m (z1 + z2) / 2 */
export function meshCentreDistance(module: Length, teethA: number, teethB: number): Length {
  return idealCentreDistance(pitchDiameter(module, teethA), pitchDiameter(module, teethB));
}

/**
 * GEAR-004: does a placed centre distance match the ideal model? The
 * tolerance is a floating-point comparison tolerance (ASM-0008), not a
 * manufacturing tolerance.
 */
export function isCentreDistanceAchievable(
  module: Length,
  teethA: number,
  teethB: number,
  actualCentreDistance: Length,
  toleranceMetres: number = NUMERICAL_PARAMETERS.centreDistanceToleranceMetres,
): boolean {
  const ideal = meshCentreDistance(module, teethA, teethB);
  return Math.abs(ideal - actualCentreDistance) <= toleranceMetres;
}

/**
 * §5.3: ω2 / ω1 = -z1 / z2 for an external mesh. The sign encodes the
 * direction reversal (GEAR-006).
 */
export function meshSpeedRatio(drivingTeeth: number, drivenTeeth: number): number {
  assertValidToothCount(drivingTeeth);
  assertValidToothCount(drivenTeeth);
  return -drivingTeeth / drivenTeeth;
}

/**
 * Right-angle mesh between a pinion on the stem and a wheel whose axis is
 * perpendicular to it (the axes intersect), modeled as rolling pitch
 * circles (ASM-0019). Teeth pass the contact at the same rate, so
 * |ω_driven| z_driven = |ω_driving| z_driving. Unlike a parallel mesh,
 * the direction is not fixed by the tooth counts: `sense` (±1) comes
 * from the layout (see src/kinematics/keylessGeometry.ts).
 * Cited: SRC-0010 (Nie et al. 2026, JSME, peer-reviewed) states the same
 * relation for a bevel gear pair (i12 = z_pinion / z_gear), closing the
 * crossed-axis citation; SRC-0009 (Wikipedia) supports the general
 * spur-gear principle. Like SRC-0007/SRC-0008 (recorded but unread,
 * superseded here), it covers generic machine bevel gears, not
 * horological contrate or winding tooth forms.
 */
export function crossedMeshSpeedRatio(drivingTeeth: number, drivenTeeth: number, sense: 1 | -1): number {
  assertValidToothCount(drivingTeeth);
  assertValidToothCount(drivenTeeth);
  return (sense * drivingTeeth) / drivenTeeth;
}

export function drivenAngularVelocity(
  drivingAngularVelocity: AngularVelocity,
  drivingTeeth: number,
  drivenTeeth: number,
): AngularVelocity {
  return radiansPerSecond(drivingAngularVelocity * meshSpeedRatio(drivingTeeth, drivenTeeth));
}

/**
 * §5.3: compound train ratio, calculated stage by stage. Identity of each
 * intermediate shaft is the caller's responsibility (ENGINEERING_RULES.md
 * "Compound trains").
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
 * An efficiency term may only be used when explicitly configured and
 * traceable to a source or recorded assumption (§5.4, ASM-0002).
 */
export interface MeshEfficiency {
  value: number;
  reference: AssumptionId | `SRC-${string}`;
}

/**
 * §5.4: T2 = η T1 (z2 / z1). With no efficiency supplied this is the
 * ideal lossless relation (ASM-0001) — no default η is ever assumed.
 * Sign follows the direction reversal of the mesh.
 */
export function drivenTorque(
  drivingTorque: Torque,
  drivingTeeth: number,
  drivenTeeth: number,
  efficiency?: MeshEfficiency,
): Torque {
  const ratio = meshSpeedRatio(drivingTeeth, drivenTeeth);
  let eta = 1;
  if (efficiency !== undefined) {
    if (!Number.isFinite(efficiency.value) || efficiency.value <= 0 || efficiency.value > 1) {
      throw new InvalidGearParameterError(
        `Mesh efficiency must be in (0, 1], got ${String(efficiency.value)}`,
      );
    }
    eta = efficiency.value;
  }
  return newtonMetres((eta * drivingTorque) / ratio);
}

/** §5.5: v = ω r, with r = d / 2. Returns the pitch-line speed (magnitude). */
export function pitchLineVelocity(
  angularVelocity: AngularVelocity,
  pitchDiameterValue: Length,
): LinearVelocity {
  return metresPerSecond(Math.abs(angularVelocity) * (pitchDiameterValue / 2));
}
