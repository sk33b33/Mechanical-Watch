import type { Angle } from "@/units/angle";
import { radians } from "@/units/angle";
import type { AngularVelocity } from "@/units/angularVelocity";
import { joules, type Energy } from "@/units/energy";
import { newtonMetres, type Torque } from "@/units/torque";
import type { TorsionalStiffness } from "@/units/rotational";
import type { MainspringSpec } from "@/domain/coupling";
import { assertValidToothCount } from "@/math/gearMath";
import { BEATS_PER_BALANCE_PERIOD, BEATS_PER_ESCAPE_TOOTH } from "./escapement";

/**
 * SIMPLIFIED ENERGY MODEL (L3, ASM-0026). Steady-state averages only: no
 * transient, no impact losses beyond the declared efficiencies, and no
 * effect of amplitude on rate (the balance stays isochronous, ASM-0024).
 */

/** Spring torque at a state of wind (turns from let-down), linear between the entered end values. */
export function springTorque(spec: MainspringSpec, windTurns: number): Torque {
  const w = Math.min(Math.max(windTurns, 0), spec.usableTurns);
  const fraction = spec.usableTurns > 0 ? w / spec.usableTurns : 0;
  return newtonMetres(spec.letDownTorque + (spec.fullyWoundTorque - spec.letDownTorque) * fraction);
}

/** Seconds from fully wound to let down at the drum's running speed: turns ÷ (|ω| / 2π). */
export function powerReserveSeconds(usableTurns: number, drumAngularVelocity: AngularVelocity): number | null {
  const revsPerSecond = Math.abs(drumAngularVelocity) / (2 * Math.PI);
  return revsPerSecond > 0 && usableTurns > 0 ? usableTurns / revsPerSecond : null;
}

/**
 * Torque at the escape wheel from power balance through the train:
 * T_e |ω_e| = η T_d |ω_d| (ASM-0002 when η is configured; η = 1, the
 * lossless upper bound, when it is not).
 */
export function escapeTorque(drumTorque: Torque, drumOmega: AngularVelocity, escapeOmega: AngularVelocity, trainEfficiency: number | null): Torque {
  return newtonMetres(drumTorque * Math.abs(drumOmega / escapeOmega) * (trainEfficiency ?? 1));
}

/** Escape wheel rotation per beat: half a pitch, π / z (two beats per tooth, ASM-0021). */
export function escapeRotationPerBeat(escapeTeeth: number): Angle {
  assertValidToothCount(escapeTeeth);
  return radians((2 * Math.PI) / (escapeTeeth * BEATS_PER_ESCAPE_TOOTH));
}

/** Energy the escape wheel gives up per beat, times the escapement efficiency when one is given. */
export function energyPerBeat(escapeWheelTorque: Torque, escapeTeeth: number, escapementEfficiency: number | null): Energy {
  return joules(escapeWheelTorque * escapeRotationPerBeat(escapeTeeth) * (escapementEfficiency ?? 1));
}

/** Energy of the balance swinging at amplitude A: ½ k A². */
export function balanceEnergy(stiffness: TorsionalStiffness, amplitude: Angle): Energy {
  return joules(0.5 * stiffness * amplitude * amplitude);
}

/**
 * Steady amplitude where the energy delivered per period balances the
 * loss per period (ASM-0026): 2 E_beat = 2π (½ k A²) / Q, so
 * A = √(2 Q E_beat / (π k)). `deliveredPerBeat` must already include the
 * escapement efficiency.
 */
export function steadyAmplitude(deliveredPerBeat: Energy, qualityFactor: number, stiffness: TorsionalStiffness): Angle | null {
  if (!(deliveredPerBeat > 0 && qualityFactor > 0 && stiffness > 0)) return null;
  const inPerPeriod = BEATS_PER_BALANCE_PERIOD * deliveredPerBeat;
  return radians(Math.sqrt((inPerPeriod * qualityFactor) / (Math.PI * stiffness)));
}
