import type { Angle } from "@/units/angle";
import { normalizeAngle } from "@/units/angle";
import type { AngularVelocity } from "@/units/angularVelocity";

/**
 * Moonphase disc kinematics (ASM-0047). The disc is driven by an
 * ordinary continuous gear-train reduction, exactly like any other
 * shaft in this project — there is no jumper/cam mechanism here (unlike
 * the date/month complications Phase 8 scopes next). Its phase is read
 * directly from its own arbor's solved angle, the same cyclical-reading
 * pattern `readHand` (src/kinematics/timeDisplay.ts) uses for the
 * hands, not from any tracked calendar date: this project has no
 * absolute-date concept, so "today's real moon phase" is not a claim
 * made anywhere here.
 */

const SECONDS_PER_DAY = 86_400;

/**
 * The real synodic month (New Moon to New Moon), NASA/GSFC (SRC-0046):
 * "The mean length of the synodic month is 29.53059 days." Used only to
 * report how far a declared gear train's own implied lunation drifts
 * from the real figure — never to compute the disc's own position,
 * which comes solely from the solved gear train.
 */
export const SYNODIC_MONTH_DAYS = 29.53059;

/**
 * Phase fraction through the current lunation: 0 at new moon, 0.5 at
 * full moon, back to 0 (next new moon) after `windowsPerRevolution`
 * moon images have each passed once. `windowsPerRevolution` is 1
 * (SINGLE) or 2 (DOUBLE, ASM-0047) — see `windowsPerRevolution` in
 * `src/domain/moonPhase.ts`.
 */
export function moonPhaseFraction(shaftAngle: Angle, windowsPerRevolution: number): number {
  const turns = normalizeAngle(shaftAngle) / (2 * Math.PI);
  return (turns * windowsPerRevolution) % 1;
}

/**
 * Days per lunation implied by the disc arbor's own continuous angular
 * velocity: the arbor's full-revolution period, divided by the window
 * count. Null when the arbor isn't turning (not driven, or the drive is
 * stopped) — there is then no implied period to report.
 */
export function impliedLunationDays(shaftAngularVelocity: AngularVelocity, windowsPerRevolution: number): number | null {
  if (!Number.isFinite(shaftAngularVelocity) || shaftAngularVelocity === 0) return null;
  const periodSeconds = (2 * Math.PI) / Math.abs(shaftAngularVelocity);
  return periodSeconds / SECONDS_PER_DAY / windowsPerRevolution;
}

/**
 * Minutes per lunation the implied period drifts from the real synodic
 * month (SRC-0046): positive means the mechanism's lunation is longer
 * than the real one (the displayed phase falls behind over time),
 * negative means shorter (runs ahead). A reported comparison only,
 * never fed back into the model (ASM-0047).
 */
export function lunationDriftMinutes(impliedDays: number): number {
  return (impliedDays - SYNODIC_MONTH_DAYS) * 24 * 60;
}
