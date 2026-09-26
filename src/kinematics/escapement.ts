import type { Angle } from "@/units/angle";
import { radians } from "@/units/angle";
import type { AngularVelocity } from "@/units/angularVelocity";
import { hertz, type Frequency } from "@/units/frequency";
import { assertValidToothCount } from "@/math/gearMath";

/**
 * SIMPLIFIED ESCAPEMENT MODEL, kinematic (L2). See src/domain/escapement.ts
 * for scope. Nothing here models forces, contact or the balance's dynamics.
 */

/**
 * Beats per escape-wheel tooth (ASM-0021): each tooth gives one impulse at
 * the entry pallet and one at the exit pallet. Source pending; accepted as
 * a declared assumption for the simplified model.
 */
export const BEATS_PER_ESCAPE_TOOTH = 2;

/** Beats per balance period: a beat is one swing, half an oscillation (ASM-0021). */
export const BEATS_PER_BALANCE_PERIOD = 2;

export function beatsPerEscapeRevolution(escapeTeeth: number): number {
  assertValidToothCount(escapeTeeth);
  return BEATS_PER_ESCAPE_TOOTH * escapeTeeth;
}

/** Beat rate implied by the escape arbor's speed: |ω| / 2π revolutions per second × beats per revolution. */
export function beatFrequency(escapeAngularVelocity: AngularVelocity, escapeTeeth: number): Frequency {
  return hertz((Math.abs(escapeAngularVelocity) / (2 * Math.PI)) * beatsPerEscapeRevolution(escapeTeeth));
}

/** The balance frequency the train requires: beats per second / beats per period (ASM-0021). */
export function balanceFrequency(beats: Frequency): Frequency {
  return hertz(beats / BEATS_PER_BALANCE_PERIOD);
}

/**
 * Fraction of each beat the escapement acts (the impulse window), under the
 * sinusoidal balance of ASM-0022: the balance is within ±λ/2 of its dead
 * point for a fraction (2/π)·asin(λ / 2A) of each half period. Null when
 * the inputs are invalid or the amplitude does not exceed half the lift
 * angle (the balance would never leave the escapement, ESC-101).
 */
export function impulseFraction(amplitude: Angle, liftAngle: Angle): number | null {
  if (!(Number.isFinite(amplitude) && Number.isFinite(liftAngle) && liftAngle > 0 && amplitude > liftAngle / 2)) return null;
  return (2 / Math.PI) * Math.asin(liftAngle / (2 * amplitude));
}

export interface EscapementInputs {
  beatFrequency: Frequency;
  amplitude: Angle;
  liftAngle: Angle;
  leverAngle: Angle;
}

export interface EscapementMotion {
  /** θ_b = A sin(2π f_b t) (ASM-0022). Zero crossings are the dead points, one per beat. */
  balanceAngle: Angle;
  /** Between the bankings ±L/2; crosses during each impulse window (ASM-0023). */
  forkAngle: Angle;
  /**
   * The time at which the train's continuous motion is shown: it stands
   * still between beats and catches up during each impulse window, so it
   * never drifts from real time by more than half a beat.
   */
  effectiveTime: number;
  beatIndex: number;
}

/** Escapement state at time t (seconds). Null when the inputs are not valid. */
export function escapementMotion(inputs: EscapementInputs, t: number): EscapementMotion | null {
  const fraction = impulseFraction(inputs.amplitude, inputs.liftAngle);
  if (fraction === null || !(inputs.beatFrequency > 0) || !Number.isFinite(inputs.leverAngle)) return null;
  const beatPeriod = 1 / inputs.beatFrequency;
  const window = fraction * beatPeriod;
  // Beat k is centred on the dead point at t = kT.
  const k = Math.floor((t + beatPeriod / 2) / beatPeriod);
  const s = Math.min(1, Math.max(0, (t - (k * beatPeriod - window / 2)) / window));
  const balanceFreq = balanceFrequency(inputs.beatFrequency);
  const side = k % 2 === 0 ? 1 : -1; // the banking the fork moves toward during beat k
  return {
    balanceAngle: radians(inputs.amplitude * Math.sin(2 * Math.PI * balanceFreq * t)),
    forkAngle: radians(side * (inputs.leverAngle / 2) * (2 * s - 1)),
    effectiveTime: beatPeriod * (k - 0.5 + s),
    beatIndex: k,
  };
}
