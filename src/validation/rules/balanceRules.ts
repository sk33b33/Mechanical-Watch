import { toMicronewtonMillimetresPerRadian } from "@/units/rotational";
import { isValidToothCount } from "@/math/gearMath";
import type { Escapement } from "@/domain/escapement";
import { summarizeBalance, type BalanceSummary } from "@/kinematics/balanceSummary";
import { isochronismAdjustedRate, MIDDLE_TEMPERATURE_CELSIUS, temperatureAdjustedRate, USUAL_TEMPERATURE_RANGE_CELSIUS } from "@/kinematics/balance";
import { summarizeEnergy } from "@/kinematics/energySummary";
import type { Movement } from "@/domain/movement";
import type { GearTrainSolution } from "@/kinematics/solveGearTrain";
import type { ReferenceId, ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

/**
 * Sentence fragment for BAL-002 applying a declared isochronism coefficient
 * (ASM-0034) to the predicted amplitude, when both exist; "" otherwise
 * (the baseline isochronous rate then stands unqualified).
 */
function isochronismSentence(movement: Movement, train: GearTrainSolution, escapement: Escapement, s: BalanceSummary): string {
  const coefficient = escapement.balance.isochronismCoefficient;
  if (coefficient === null || s.dailyRate === null) return "";
  const energy = summarizeEnergy(movement, train);
  const en = energy?.escapement?.id === escapement.id ? energy : null;
  if (en?.amplitudeFull == null || en.amplitudeLetDown === null) {
    const missing = en?.missingForAmplitude.join(", ") ?? "mainspring data";
    return ` An isochronism coefficient is declared (ASM-0034), but no amplitude is predicted to apply it to (needs ${missing}).`;
  }
  const reference = escapement.balance.amplitude;
  const full = isochronismAdjustedRate(s.dailyRate, coefficient, en.amplitudeFull, reference);
  const letDown = isochronismAdjustedRate(s.dailyRate, coefficient, en.amplitudeLetDown, reference);
  return ` With the declared isochronism coefficient (ASM-0034) applied at the predicted amplitude, the rate is instead ${full >= 0 ? "+" : ""}${full.toFixed(1)} s/day fully wound, ${letDown >= 0 ? "+" : ""}${letDown.toFixed(1)} s/day let down.`;
}

/**
 * Sentence fragment for BAL-002 applying a declared temperature
 * coefficient (ASM-0046) at the cited usual temperature range (5°C-35°C,
 * SRC-0040) relative to the conventional 20°C middle-temperature baseline;
 * "" when no coefficient is declared or no rate is predicted.
 */
function temperatureSentence(coefficient: number | null, dailyRate: number | null): string {
  if (coefficient === null || dailyRate === null) return "";
  const { low, high } = USUAL_TEMPERATURE_RANGE_CELSIUS;
  const atLow = temperatureAdjustedRate(dailyRate, coefficient, low);
  const atHigh = temperatureAdjustedRate(dailyRate, coefficient, high);
  return ` With the declared temperature coefficient (ASM-0046) applied across the usual ${String(low)}°C-${String(high)}°C range (relative to the ${String(MIDDLE_TEMPERATURE_CELSIUS)}°C middle temperature, SRC-0040), the rate is instead ${atLow >= 0 ? "+" : ""}${atLow.toFixed(1)} s/day at ${String(low)}°C, ${atHigh >= 0 ? "+" : ""}${atHigh.toFixed(1)} s/day at ${String(high)}°C.`;
}

/** BAL-001 (inputs and the balance-governed drive) and BAL-002 (what the simplified dynamic model predicts). */
export const balanceRules: Rule = ({ movement, train }) => {
  const issues: ValidationIssue[] = [];
  const escapement = Object.values(movement.escapements)[0];

  for (const esc of Object.values(movement.escapements)) {
    const { inertia, hairspringStiffness, isochronismCoefficient, temperatureCoefficient } = esc.balance;
    if (inertia !== null && !(Number.isFinite(inertia) && inertia > 0)) {
      issues.push(issue("BAL-001", "inertia", "error", "L3_SIMPLIFIED_DYNAMIC", [esc.id], `${esc.name}: the balance inertia must be positive, or left empty (unknown).`, ["ASM-0024"]));
    }
    if (hairspringStiffness !== null && !(Number.isFinite(hairspringStiffness) && hairspringStiffness > 0)) {
      issues.push(issue("BAL-001", "stiffness", "error", "L3_SIMPLIFIED_DYNAMIC", [esc.id], `${esc.name}: the hairspring stiffness must be positive, or left empty (unknown).`, ["ASM-0024"]));
    }
    if (isochronismCoefficient !== null && !Number.isFinite(isochronismCoefficient)) {
      issues.push(issue("BAL-001", "isochronism-coefficient", "error", "L3_SIMPLIFIED_DYNAMIC", [esc.id], `${esc.name}: the isochronism coefficient must be a finite number, or left empty (unknown).`, ["ASM-0034"]));
    }
    if (temperatureCoefficient !== null && !Number.isFinite(temperatureCoefficient)) {
      issues.push(issue("BAL-001", "temperature-coefficient", "error", "L3_SIMPLIFIED_DYNAMIC", [esc.id], `${esc.name}: the temperature coefficient must be a finite number, or left empty (unknown).`, ["ASM-0046"]));
    }
  }

  if (movement.drive?.kind === "BALANCE") {
    const reason =
      escapement === undefined ? "the movement has no escapement"
      : !(escapement.escapeArborShaftId in movement.shafts) ? "the escapement has no escape arbor"
      : !isValidToothCount(escapement.escapeWheel.toothCount) ? "the escape wheel has no valid tooth count"
      : summarizeBalance(movement, escapement).freeFrequency === null ? "the balance inertia and hairspring stiffness must both be entered and positive"
      : null;
    if (reason !== null) {
      issues.push(
        issue("BAL-001", "cannot-govern", "error", "L2_KINEMATIC", escapement === undefined ? [] : [escapement.id],
          `The drive is set to the balance, but ${reason}, so nothing is driven.`, ["ASM-0024"]),
      );
    }
  }

  if (escapement !== undefined) {
    const s = summarizeBalance(movement, escapement);
    if (s.freeFrequency !== null) {
      const governing = movement.drive?.kind === "BALANCE";
      const nominal = s.nominalFrequency === null
        ? " Nominal time is not derivable here (it needs one minutes-hand arbor in the train), so no rate is predicted."
        : ` Nominal time needs ${s.nominalFrequency.toFixed(4)} Hz (a hairspring of ${s.stiffnessForNominal === null ? "—" : toMicronewtonMillimetresPerRadian(s.stiffnessForNominal).toFixed(2)} µN·mm/rad for this inertia). ${governing ? "Governed by the balance, the model predicts" : "If the balance governed, the model would predict"} ${(s.dailyRate ?? 0) >= 0 ? "+" : ""}${(s.dailyRate ?? 0).toFixed(1)} s/day.`;

      const coefficient = escapement.balance.isochronismCoefficient;
      const isochronism = isochronismSentence(movement, train, escapement, s);
      const tempCoefficient = escapement.balance.temperatureCoefficient;
      const temperature = temperatureSentence(tempCoefficient, s.dailyRate);
      const undeclared = [
        coefficient === null ? "amplitude dependence" : null,
        tempCoefficient === null ? "temperature dependence" : null,
      ].filter((v): v is string => v !== null);
      const references: ReferenceId[] = [
        "REF-ENG §10", "ASM-0024", "ASM-0021",
        ...(coefficient === null ? [] : (["ASM-0034"] as const)),
        ...(tempCoefficient === null ? [] : (["ASM-0046"] as const)),
      ];

      issues.push(
        issue("BAL-002", "prediction", "info", "L3_SIMPLIFIED_DYNAMIC", [escapement.id],
          `${escapement.name}: simplified dynamic balance (linear, undamped, isochronous): free frequency ${s.freeFrequency.toFixed(4)} Hz.${nominal}${isochronism}${temperature} Escapement and position effects are not modeled${undeclared.length === 0 ? "" : `, and ${undeclared.join(" and ")} ${undeclared.length === 1 ? "is" : "are"} not declared (${undeclared.map((d) => d === "amplitude dependence" ? "ASM-0034" : "ASM-0046").join(", ")})`}; this is not a rate-accuracy claim and requires physical validation.`,
          references),
      );
    }
  }
  return issues;
};
