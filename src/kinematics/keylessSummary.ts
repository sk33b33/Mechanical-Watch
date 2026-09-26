import { radiansPerSecond } from "@/units/angularVelocity";
import type { Angle } from "@/units/angle";
import type { Movement } from "@/domain/movement";
import { minutesHandShaftId } from "@/domain/movement";
import type { KeylessWorks } from "@/domain/keyless";
import type { PlacementSolution } from "./solvePlacement";
import { stemEngagement, stemLine, type StemEngagement, type StemLine } from "./keylessGeometry";
import {
  crownSettingState,
  solveGearTrain,
  windingCrownSense,
  handsForwardCrownSense,
  type SettingState,
  type WindingState,
} from "./solveGearTrain";

/**
 * What the keyless works does, derived from the model: engagement
 * geometry, which way the crown winds, and the crown-to-ratchet and
 * crown-to-hands ratios. Kinematic (L2) only: no winding torque, spring
 * state or setting friction is modeled (ASM-0007, ASM-0015, ASM-0019).
 */
export interface KeylessSummary {
  keyless: KeylessWorks;
  line: StemLine | null;
  winding: StemEngagement | null;
  setting: StemEngagement | null;
  /** Crown sense (about the stem direction, toward the crown) that winds; null if not derivable. */
  windingSense: 1 | -1 | null;
  windingUnavailable: Extract<WindingState, { status: "UNAVAILABLE" }>["reason"] | null;
  /** Ratchet revolutions per crown revolution while winding. */
  ratchetPerCrown: number | null;
  handsForwardSense: 1 | -1 | null;
  settingState: Exclude<SettingState, { status: "NOT_APPLICABLE" }>;
  /** Minutes-hand revolutions per crown revolution while setting. */
  minutesPerCrown: number | null;
}

export function summarizeKeyless(movement: Movement, keyless: KeylessWorks, placement: PlacementSolution): KeylessSummary {
  const line = stemLine(movement, keyless, placement);
  const crownWheel = movement.gears[keyless.crownWheelGearId];
  const settingWheel = movement.gears[keyless.settingWheelGearId];
  const engage = (pinion: KeylessWorks["windingPinion"], wheel: typeof crownWheel): StemEngagement | null =>
    line === null || wheel === undefined ? null : stemEngagement(line, keyless.stemHeight, pinion, wheel, placement);

  const windingSense = windingCrownSense(movement);
  let windingUnavailable: KeylessSummary["windingUnavailable"] = null;
  let ratchetPerCrown: number | null = null;
  const ratchet = movement.gears[keyless.ratchetGearId];
  if (windingSense === null) {
    const probe = solveGearTrain(movement, { mode: "WINDING", crownAngularVelocity: radiansPerSecond(1) });
    windingUnavailable = probe.winding.status === "UNAVAILABLE" ? probe.winding.reason : null;
  } else if (ratchet !== undefined) {
    const probe = solveGearTrain(movement, { mode: "WINDING", crownAngularVelocity: radiansPerSecond(windingSense) });
    const omega = probe.shaftAngularVelocity.get(ratchet.shaftId);
    ratchetPerCrown = omega === undefined ? null : Math.abs(omega);
  }

  const handsForwardSense = handsForwardCrownSense(movement);
  let minutesPerCrown: number | null = null;
  const minutes = minutesHandShaftId(movement);
  if (handsForwardSense !== null && minutes !== null) {
    const probe = solveGearTrain(movement, { mode: "CROWN_SETTING", crownAngularVelocity: radiansPerSecond(1) });
    const omega = probe.shaftAngularVelocity.get(minutes);
    minutesPerCrown = omega === undefined ? null : Math.abs(omega);
  }

  return {
    keyless,
    line,
    winding: engage(keyless.windingPinion, crownWheel),
    setting: engage(keyless.slidingPinion, settingWheel),
    windingSense,
    windingUnavailable,
    ratchetPerCrown,
    handsForwardSense,
    settingState: crownSettingState(movement),
    minutesPerCrown,
  };
}

/** A crown sense as the watch wearer sees it, looking at the crown end of the stem. */
export function crownSenseText(sense: 1 | -1): string {
  // Positive rotation about the outward stem direction looks counter-clockwise from its tip (the crown).
  return sense > 0 ? "counter-clockwise seen from the crown" : "clockwise seen from the crown";
}

/**
 * Clock position of a plan direction as seen from the dial (ASM-0014):
 * the dial side mirrors x, and 12 o'clock is +Y.
 */
export function clockPositionFromDial(direction: Angle): number {
  const clockwiseFromTwelve = Math.atan2(-Math.cos(direction), Math.sin(direction));
  return ((((clockwiseFromTwelve / (2 * Math.PI)) * 12) % 12) + 12) % 12;
}

export const WINDING_UNAVAILABLE_TEXT: Record<NonNullable<KeylessSummary["windingUnavailable"]>, string> = {
  NO_KEYLESS_WORKS: "no keyless works",
  NO_MAINSPRING: "the ratchet's arbor has no declared mainspring to a barrel drum",
  DRUM_NOT_RUNNING: "the barrel drum does not turn under the running drive, so the winding direction is unknown",
  RATCHET_NOT_CONNECTED: "the winding pinion does not reach the ratchet wheel",
};

export const SETTING_UNAVAILABLE_TEXT: Record<Extract<SettingState, { status: "UNAVAILABLE" }>["reason"], string> = {
  NO_MINUTES_HAND: "no arbor carries the minutes hand",
  NO_ISOLATING_CLUTCH: "no friction clutch separates the hands from the going train",
  WOULD_TURN_DRIVE: "the hands' group contains the prescribed drive arbor",
  NO_KEYLESS_WORKS: "no keyless works",
  CROWN_NOT_CONNECTED: "the sliding pinion's setting train does not reach the minutes hand",
};
