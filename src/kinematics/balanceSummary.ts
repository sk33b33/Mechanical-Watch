import type { Movement } from "@/domain/movement";
import { setNominalTimeDrive } from "@/domain/movement";
import type { Escapement } from "@/domain/escapement";
import type { Frequency } from "@/units/frequency";
import type { TorsionalStiffness } from "@/units/rotational";
import { isValidToothCount } from "@/math/gearMath";
import { balanceFrequency, beatFrequency } from "./escapement";
import { dailyRateSeconds, naturalFrequency, stiffnessForFrequency } from "./balance";
import { solveGearTrain } from "./solveGearTrain";

/**
 * The simplified dynamic balance (L3, ASM-0024) compared with what the
 * train needs to show nominal time. Used by validation, the inspector and
 * outputs so they all report the same derived values.
 */
export interface BalanceSummary {
  /** Free frequency from inertia and stiffness, or null if either is unknown or invalid. */
  freeFrequency: Frequency | null;
  /** The balance frequency the train needs to run at nominal time, or null if nominal time is not derivable. */
  nominalFrequency: Frequency | null;
  /** Hairspring stiffness that would give the nominal frequency with the entered inertia. */
  stiffnessForNominal: TorsionalStiffness | null;
  /** Predicted rate if the balance governs, s/day (positive = gaining). */
  dailyRate: number | null;
}

export function summarizeBalance(movement: Movement, escapement: Escapement): BalanceSummary {
  const freeFrequency = naturalFrequency(escapement.balance.inertia, escapement.balance.hairspringStiffness);
  let nominalFrequency: Frequency | null = null;
  if (isValidToothCount(escapement.escapeWheel.toothCount)) {
    const nominal = solveGearTrain(setNominalTimeDrive(movement));
    const omega = nominal.shaftAngularVelocity.get(escapement.escapeArborShaftId);
    if (omega !== undefined && omega !== 0) {
      nominalFrequency = balanceFrequency(beatFrequency(omega, escapement.escapeWheel.toothCount));
    }
  }
  const inertia = escapement.balance.inertia;
  return {
    freeFrequency,
    nominalFrequency,
    stiffnessForNominal: nominalFrequency !== null && inertia !== null && inertia > 0 ? stiffnessForFrequency(inertia, nominalFrequency) : null,
    dailyRate: freeFrequency !== null && nominalFrequency !== null ? dailyRateSeconds(freeFrequency, nominalFrequency) : null,
  };
}
