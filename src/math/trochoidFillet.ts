import type { Angle } from "@/units/angle";

/**
 * Building block toward the gear's root fillet: the trochoid traced by
 * the center of a rack-type cutter's rounded tooth-tip corner as the
 * cutter rolls on the gear's pitch circle (SRC-0025, ASM-0030; method
 * per Lynwander 1983 / Mitchiner & Mabie 1982 as cited there).
 *
 * Only the corner's position in the cutter's own frame is implemented
 * here so far. Tracing the trochoid itself and offsetting it by the
 * fillet radius to get the actual cut boundary (the envelope-of-circles
 * step) is NOT yet implemented: an independent Cartesian derivation was
 * attempted and its rolling kinematics were confirmed correct (a fixed
 * rack point's distance from the gear centre, simulated across a
 * rotation, matches the pure-rolling invariant exactly), but the
 * resulting curve did not connect to the involute flank at the base
 * circle in cross-checks, and the sign/orientation error was not found
 * in the time available. Shipping that geometry anyway would be
 * exactly what CLAUDE_REFERENCE_INSTRUCTIONS.md rule 11 warns against
 * (a plausible-looking but unverified curve). ASM-0030's straight-line
 * dedendum approximation therefore still stands; see SOURCES.yml.
 */

export interface CutterCorner {
  /** Lateral offset of the corner circle's center from the tooth centerline, at the rack's own pitch line (m). */
  readonly xi: number;
  /** Depth of the corner circle's center below the rack's pitch line, toward the gear centre (m). */
  readonly v: number;
}

/**
 * Where the cutter's rounded tip corner sits in the cutter's own frame:
 * tangent to the flat crest (which cuts the root circle, at depth
 * `dedendum`) and tangent to the straight flank (which cuts the
 * involute, at `pressureAngle`). SRC-0025 eq. 19-20.
 */
export function cutterCornerCenter(
  dedendum: number,
  filletRadius: number,
  pressureAngle: Angle,
  halfToothThicknessAtPitch: number,
): CutterCorner {
  const v = dedendum - filletRadius;
  const xi = halfToothThicknessAtPitch - v * Math.tan(pressureAngle) - filletRadius / Math.cos(pressureAngle);
  return { xi, v };
}
