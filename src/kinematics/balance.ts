import { hertz, type Frequency } from "@/units/frequency";
import { radiansPerSecond, type AngularVelocity } from "@/units/angularVelocity";
import { newtonMetresPerRadian, type MomentOfInertia, type TorsionalStiffness } from "@/units/rotational";
import { assertValidToothCount } from "@/math/gearMath";
import { BEATS_PER_BALANCE_PERIOD, BEATS_PER_ESCAPE_TOOTH } from "./escapement";

/**
 * SIMPLIFIED DYNAMIC balance model (L3, ASM-0024). The balance and
 * hairspring are a linear, undamped torsional oscillator:
 *   I θ'' = −k θ   ⇒   ω₀ = √(k / I),  f = ω₀ / 2π.
 * It is isochronous by construction: amplitude, escapement disturbance,
 * damping, position, temperature and the hairspring's own inertia and
 * geometry are not modeled, so it is not a complete regulator model
 * (reference/sources/04-balance-and-hairspring/README.md).
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
