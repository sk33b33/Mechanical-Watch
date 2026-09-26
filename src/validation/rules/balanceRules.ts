import { toMicronewtonMillimetresPerRadian } from "@/units/rotational";
import { isValidToothCount } from "@/math/gearMath";
import { summarizeBalance } from "@/kinematics/balanceSummary";
import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

/** BAL-001 (inputs and the balance-governed drive) and BAL-002 (what the simplified dynamic model predicts). */
export const balanceRules: Rule = ({ movement }) => {
  const issues: ValidationIssue[] = [];
  const escapement = Object.values(movement.escapements)[0];

  for (const esc of Object.values(movement.escapements)) {
    const { inertia, hairspringStiffness } = esc.balance;
    if (inertia !== null && !(Number.isFinite(inertia) && inertia > 0)) {
      issues.push(issue("BAL-001", "inertia", "error", "L3_SIMPLIFIED_DYNAMIC", [esc.id], `${esc.name}: the balance inertia must be positive, or left empty (unknown).`, ["ASM-0024"]));
    }
    if (hairspringStiffness !== null && !(Number.isFinite(hairspringStiffness) && hairspringStiffness > 0)) {
      issues.push(issue("BAL-001", "stiffness", "error", "L3_SIMPLIFIED_DYNAMIC", [esc.id], `${esc.name}: the hairspring stiffness must be positive, or left empty (unknown).`, ["ASM-0024"]));
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
      issues.push(
        issue("BAL-002", "prediction", "info", "L3_SIMPLIFIED_DYNAMIC", [escapement.id],
          `${escapement.name}: simplified dynamic balance (linear, undamped, isochronous): free frequency ${s.freeFrequency.toFixed(4)} Hz.${nominal} Amplitude, escapement, position and temperature effects are not modeled; this is not a rate-accuracy claim and requires physical validation.`,
          ["REF-ENG §10", "ASM-0024", "ASM-0021"]),
      );
    }
  }
  return issues;
};
