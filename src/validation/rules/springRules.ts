import { toDegrees } from "@/units/angle";
import { toMicrojoules } from "@/units/energy";
import { toNewtonMillimetres } from "@/units/torque";
import { mainsprings } from "@/domain/coupling";
import { summarizeEnergy } from "@/kinematics/energySummary";
import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

const inUnitInterval = (v: number): boolean => Number.isFinite(v) && v > 0 && v <= 1;
const hours = (s: number): string => `${(s / 3600).toFixed(1)} h`;

/** SPR-001…003: mainspring data and the simplified energy model (ASM-0026). */
export const springRules: Rule = ({ movement, train }) => {
  const issues: ValidationIssue[] = [];

  for (const link of mainsprings(movement.couplings)) {
    const spec = link.spring;
    if (spec === null) continue;
    const problems = [
      ...(Number.isFinite(spec.usableTurns) && spec.usableTurns > 0 ? [] : ["usable turns must be positive"]),
      ...(spec.fullyWoundTorque > 0 && spec.letDownTorque > 0 ? [] : ["both torques must be positive"]),
      ...(spec.fullyWoundTorque >= spec.letDownTorque ? [] : ["the fully-wound torque must not be below the let-down torque"]),
      ...(spec.trainEfficiency === null || inUnitInterval(spec.trainEfficiency) ? [] : ["the train efficiency must be in (0, 1]"]),
    ];
    for (const problem of problems) {
      issues.push(issue("SPR-001", problem, "error", "L3_SIMPLIFIED_DYNAMIC", [link.id], `${link.name}: ${problem}.`, ["REF-ENG §11", "ASM-0026"]));
    }
  }
  for (const esc of Object.values(movement.escapements)) {
    if (esc.escapementEfficiency !== null && !inUnitInterval(esc.escapementEfficiency)) {
      issues.push(issue("SPR-001", "escapement-efficiency", "error", "L3_SIMPLIFIED_DYNAMIC", [esc.id], `${esc.name}: the escapement efficiency must be in (0, 1].`, ["ASM-0026"]));
    }
    const q = esc.balance.qualityFactor;
    if (q !== null && !(Number.isFinite(q) && q > 0)) {
      issues.push(issue("SPR-001", "quality-factor", "error", "L3_SIMPLIFIED_DYNAMIC", [esc.id], `${esc.name}: the balance quality factor must be positive.`, ["ASM-0026"]));
    }
  }

  const energy = summarizeEnergy(movement, train);
  if (energy?.spec == null) return issues;
  const parts: string[] = [];
  if (energy.reserveSeconds !== null) parts.push(`power reserve ${hours(energy.reserveSeconds)} from fully wound to let down`);
  if (energy.escapeTorqueFull !== null && energy.escapeTorqueLetDown !== null) {
    parts.push(`escape-wheel torque ${toNewtonMillimetres(energy.escapeTorqueFull).toExponential(3)} to ${toNewtonMillimetres(energy.escapeTorqueLetDown).toExponential(3)} N·mm${energy.lossless ? " (lossless upper bound: no train efficiency configured)" : ""}`);
  }
  if (energy.deliveredPerBeatFull !== null && energy.deliveredPerBeatLetDown !== null) {
    parts.push(`${toMicrojoules(energy.deliveredPerBeatFull).toFixed(4)} to ${toMicrojoules(energy.deliveredPerBeatLetDown).toFixed(4)} µJ per beat reaching the balance`);
  }
  if (energy.amplitudeFull !== null && energy.amplitudeLetDown !== null) {
    parts.push(`predicted amplitude ${toDegrees(energy.amplitudeFull).toFixed(0)}° fully wound to ${toDegrees(energy.amplitudeLetDown).toFixed(0)}° let down`);
  } else if (energy.missingForAmplitude.length > 0) {
    parts.push(`no amplitude predicted (needs ${energy.missingForAmplitude.join(", ")})`);
  }
  issues.push(
    issue("SPR-002", "energy", "info", "L3_SIMPLIFIED_DYNAMIC", [energy.spring.id],
      `Simplified energy model: ${parts.join("; ")}. Steady-state averages; the balance stays isochronous; requires physical validation.`,
      ["REF-ENG §11", "ASM-0026", "ASM-0021"]),
  );

  const esc = energy.escapement;
  if (esc !== null && energy.stopWindTurns !== null && energy.stopWindTurns > 0 && energy.amplitudeFull !== null) {
    const never = energy.stopWindTurns >= energy.spec.usableTurns;
    issues.push(
      issue("SPR-003", never ? "never-unlocks" : "stops-early", never ? "error" : "warning", "L3_SIMPLIFIED_DYNAMIC", [esc.id, energy.spring.id],
        never
          ? `${esc.name}: even fully wound the predicted amplitude (${toDegrees(energy.amplitudeFull).toFixed(0)}°) does not exceed half the lift angle, so the balance cannot unlock the escapement.`
          : `${esc.name}: the balance stops unlocking below ${energy.stopWindTurns.toFixed(2)} turns of wind, so the running reserve is ${energy.runningReserveSeconds === null ? "—" : hours(energy.runningReserveSeconds)}, not the full ${energy.reserveSeconds === null ? "—" : hours(energy.reserveSeconds)}.`,
        ["ASM-0026", "ASM-0023"]),
    );
  }
  return issues;
};
