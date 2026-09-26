import type { AngularVelocity } from "@/units/angularVelocity";
import { radiansPerSecond } from "@/units/angularVelocity";
import type { HandFunction } from "@/domain/shaft";

/**
 * One revolution per period for each hand on a conventional 12-hour dial
 * (ASM-0014). These are definitions of reading time from a dial, not
 * watchmaking specifications.
 */
export const HAND_PERIOD_SECONDS: Readonly<Record<HandFunction, number>> = {
  HOURS: 12 * 60 * 60,
  MINUTES: 60 * 60,
  SECONDS: 60,
};

/**
 * Hands turn clockwise seen from the dial. The dial is on the −Z side of
 * the mainplate, so clockwise from the dial is counter-clockwise seen
 * from +Z: a positive angular velocity in movement coordinates.
 */
export function nominalHandAngularVelocity(hand: HandFunction): AngularVelocity {
  return radiansPerSecond((2 * Math.PI) / HAND_PERIOD_SECONDS[hand]);
}

/** Seconds per revolution for a signed angular velocity (Infinity when stationary). */
export function periodSeconds(angularVelocity: AngularVelocity): number {
  return angularVelocity === 0 ? Number.POSITIVE_INFINITY : (2 * Math.PI) / Math.abs(angularVelocity);
}

/** "1 rev per 3.000 h", "1 rev per 60.00 s" — human-readable rotation period. */
export function formatPeriod(angularVelocity: AngularVelocity): string {
  const period = periodSeconds(angularVelocity);
  if (!Number.isFinite(period)) return "stationary";
  if (period >= 2 * 3600) return `1 rev per ${(period / 3600).toFixed(3)} h`;
  if (period >= 120) return `1 rev per ${(period / 60).toFixed(3)} min`;
  return `1 rev per ${period.toFixed(3)} s`;
}

/**
 * Time shown by hand angles (radians, positive = clockwise from the dial),
 * each hand read on its own. Returns hours 0–12, minutes and seconds 0–60.
 */
export function readHand(hand: HandFunction, angle: number): number {
  const turns = (((angle / (2 * Math.PI)) % 1) + 1) % 1;
  return turns * (hand === "HOURS" ? 12 : 60);
}
