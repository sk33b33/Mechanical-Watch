import { distance } from "@/math/vec2";
import { isCompleteFrame, outlineContains } from "@/assembly/assemblyGeometry";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import type { ValidationIssue } from "../validationIssue";
import { COUPLING_KIND_LABELS } from "@/domain/coupling";
import { issue, type Rule } from "./context";

/**
 * CPL-001: a friction clutch or mainspring joins two different, existing,
 * coaxial shafts. SUP-001: a CARRIED shaft rides coaxially on another shaft.
 * SUP-002: a STUD-mounted shaft's axis lies within its frame.
 */
export const couplingRules: Rule = ({ movement, placement }) => {
  const issues: ValidationIssue[] = [];

  for (const coupling of Object.values(movement.couplings)) {
    const a = movement.shafts[coupling.shaftAId];
    const b = movement.shafts[coupling.shaftBId];
    if (a === undefined || b === undefined) {
      issues.push(
        issue("ASSY-001", "coupling-refs", "error", "L1_GEOMETRIC", [coupling.id],
          `${coupling.name}: refers to a shaft that does not exist.`, []),
      );
      continue;
    }
    if (a.id === b.id) {
      issues.push(
        issue("CPL-001", "same-shaft", "error", "L1_GEOMETRIC", [coupling.id, a.id],
          `${coupling.name}: couples ${a.name} to itself.`, ["REF-ENG §8"]),
      );
      continue;
    }
    const pa = placement.shaftPositions.get(a.id);
    const pb = placement.shaftPositions.get(b.id);
    if (pa !== undefined && pb !== undefined && distance(pa, pb) > NUMERICAL_PARAMETERS.centreDistanceToleranceMetres) {
      issues.push(
        issue("CPL-001", "not-coaxial", "error", "L1_GEOMETRIC", [coupling.id, a.id, b.id],
          `${coupling.name}: ${a.name} and ${b.name} are not on the same axis, so a ${COUPLING_KIND_LABELS[coupling.kind]} cannot join them.`,
          [coupling.kind === "MAINSPRING" ? "REF-ENG §11" : "REF-ENG §8"]),
      );
    }
  }

  for (const shaft of Object.values(movement.shafts)) {
    const support = shaft.support;
    if (support.kind === "CARRIED" && shaft.placement.kind !== "COAXIAL") {
      issues.push(
        issue("SUP-001", "carried-not-coaxial", "error", "L1_GEOMETRIC", [shaft.id],
          `${shaft.name}: a carried part must be placed coaxially on the shaft that carries it.`, ["REF-ENG §12"]),
      );
    }
    if (support.kind === "STUD") {
      const frame = movement.frames[support.frameId];
      const axis = placement.shaftPositions.get(shaft.id);
      if (frame === undefined) {
        issues.push(
          issue("ASSY-001", "stud-frame", "error", "L1_GEOMETRIC", [shaft.id],
            `${shaft.name}: its stud is in a frame that does not exist.`, []),
        );
      } else if (axis !== undefined && isCompleteFrame(frame) && !outlineContains(frame.outline, axis)) {
        issues.push(
          issue("SUP-002", "stud-outside", "error", "L1_GEOMETRIC", [shaft.id, frame.id],
            `${shaft.name}: its stud lies outside ${frame.name}.`, ["REF-ENG §12"]),
        );
      }
    }
  }
  return issues;
};
