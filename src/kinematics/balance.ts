import type { Angle } from "@/units/angle";
import { hertz, type Frequency } from "@/units/frequency";
import { radiansPerSecond, type AngularVelocity } from "@/units/angularVelocity";
import { newtonMetresPerRadian, type MomentOfInertia, type TorsionalStiffness } from "@/units/rotational";
import { assertValidToothCount } from "@/math/gearMath";
import { BEATS_PER_BALANCE_PERIOD, BEATS_PER_ESCAPE_TOOTH } from "./escapement";

/**
 * SIMPLIFIED DYNAMIC balance model (L3, ASM-0024). The balance and
 * hairspring are a linear, undamped torsional oscillator:
 *   I θ'' = −k θ   ⇒   ω₀ = √(k / I),  f = ω₀ / 2π.
 * It is isochronous by construction: escapement disturbance, damping,
 * position and the hairspring's own inertia and geometry are not modeled,
 * so it is not a complete regulator model (reference/sources/
 * 04-balance-and-hairspring/README.md). Amplitude dependence ("circular
 * error", REF-ENG §10) and temperature dependence each have an optional
 * first-order correction, ASM-0034 and ASM-0046 below — both stay
 * unmodeled until their own coefficient is declared. Position remains
 * entirely unmodeled (REF-ENG §10's "Physical model," Phase 7.6: no
 * single scalar coefficient captures a watch's own rate spread across
 * the (at least three) axes of orientation, unlike amplitude/temperature).
 */

const SECONDS_PER_DAY = 86_400;

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Free frequency of the balance, or null if either input is missing or not positive. */
export function naturalFrequency(inertia: MomentOfInertia | null, stiffness: TorsionalStiffness | null): Frequency | null {
  if (inertia === null || stiffness === null || !positiveFinite(inertia) || !positiveFinite(stiffness)) return null;
  return hertz(Math.sqrt(stiffness / inertia) / (2 * Math.PI));
}

/** The hairspring stiffness that gives frequency f with inertia I: k = I (2π f)². */
export function stiffnessForFrequency(inertia: MomentOfInertia, frequency: Frequency): TorsionalStiffness {
  return newtonMetresPerRadian(inertia * (2 * Math.PI * frequency) ** 2);
}

/**
 * Escape arbor speed when the balance governs: 2 beats per period and
 * 2 beats per escape tooth (ASM-0021), so the escape wheel advances one
 * tooth per balance period: |ω| = 2π f / z. Unsigned; the train sets the
 * direction.
 */
export function escapeSpeedFromBalance(balanceFrequency: Frequency, escapeTeeth: number): AngularVelocity {
  assertValidToothCount(escapeTeeth);
  const beats = balanceFrequency * BEATS_PER_BALANCE_PERIOD;
  return radiansPerSecond((2 * Math.PI * beats) / (BEATS_PER_ESCAPE_TOOTH * escapeTeeth));
}

/**
 * Daily rate relative to a reference frequency, in seconds per day: the
 * train's speed is proportional to the balance frequency, so a balance
 * running fast by the ratio r gains (r − 1) × 86 400 s a day. Positive is
 * fast (gaining).
 */
export function dailyRateSeconds(actual: Frequency, reference: Frequency): number {
  return (actual / reference - 1) * SECONDS_PER_DAY;
}

/**
 * Daily rate adjusted for a declared isochronism coefficient (L3,
 * ASM-0034): a first-order (local) linearization of the balance's true,
 * generally nonlinear amplitude dependence ("circular error", REF-ENG §10)
 * around its own declared reference amplitude (`Balance.amplitude`). A
 * real spring's amplitude dependence comes from its own terminal-curve
 * geometry (Phillips 1861, SRC-0033, cited via SRC-0032) and has no
 * universal value — it must be measured or sourced per movement, never
 * invented (CLAUDE_REFERENCE_INSTRUCTIONS.md rule 9). `isochronismCoefficient`
 * is null when unmeasured/unsourced, in which case the isochronous baseline
 * (ASM-0024, `baselineDailyRateSeconds` unchanged) stands.
 */
export function isochronismAdjustedRate(
  baselineDailyRateSeconds: number,
  isochronismCoefficient: number | null,
  amplitude: Angle,
  referenceAmplitude: Angle,
): number {
  if (isochronismCoefficient === null) return baselineDailyRateSeconds;
  return baselineDailyRateSeconds + isochronismCoefficient * (amplitude - referenceAmplitude);
}

/**
 * Conventional reference point for a declared temperature coefficient
 * (ASM-0046, SRC-0040, Gould 1934): "considerable difference between the
 * middle temperature (20 C) rate and those at the high (35 C) and low
 * (5 C) temperatures" — the "middle temperature" is the cited baseline,
 * and 5 °C/35 °C the cited "usual temperature range" bookends reported
 * against it.
 */
export const MIDDLE_TEMPERATURE_CELSIUS = 20;
export const USUAL_TEMPERATURE_RANGE_CELSIUS = { low: 5, high: 35 } as const;

/**
 * Daily rate adjusted for a declared temperature coefficient (L3,
 * ASM-0046): the same first-order (local) linearization pattern as
 * `isochronismAdjustedRate`, around the conventional 20 °C middle
 * temperature (SRC-0040). A real balance's temperature dependence comes
 * from its hairspring's own thermoelastic coefficient and any mechanical
 * compensation (a cut bimetallic rim, or a low-thermoelastic-coefficient
 * material such as elinvar) and has no universal value — it must be
 * measured or sourced per movement, never invented. `temperatureCoefficient`
 * is null when unmeasured/unsourced, in which case the temperature-
 * independent baseline (ASM-0024, `baselineDailyRateSeconds` unchanged)
 * stands.
 */
export function temperatureAdjustedRate(
  baselineDailyRateSeconds: number,
  temperatureCoefficient: number | null,
  temperatureCelsius: number,
  referenceTemperatureCelsius: number = MIDDLE_TEMPERATURE_CELSIUS,
): number {
  if (temperatureCoefficient === null) return baselineDailyRateSeconds;
  return baselineDailyRateSeconds + temperatureCoefficient * (temperatureCelsius - referenceTemperatureCelsius);
}
