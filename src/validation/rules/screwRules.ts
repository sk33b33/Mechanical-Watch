import { outlineContains } from "@/assembly/assemblyGeometry";
import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

/**
 * SCREW-001 (dimensions and references) and SCREW-002 (a screw's hole
 * must actually fall within its own frame's outline, or it punches
 * through nothing — ASM-0056).
 */
export const screwRules: Rule = ({ movement }) => {
  const issues: ValidationIssue[] = [];
  for (const screw of Object.values(movement.screws)) {
    const frame = movement.frames[screw.frameId];
    const problems: string[] = [];
    if (!(Number.isFinite(screw.position.x) && Number.isFinite(screw.position.y))) problems.push("its position must be finite");
    if (!(Number.isFinite(screw.diameter) && screw.diameter > 0)) problems.push("its diameter must be a positive length");
    if (frame === undefined) problems.push("it does not reference an existing frame");
    for (const problem of problems) {
      issues.push(issue("SCREW-001", problem, "error", "L1_GEOMETRIC", [screw.id], `${screw.name}: ${problem}.`, ["ASM-0056"]));
    }

    if (frame !== undefined && Number.isFinite(screw.position.x) && Number.isFinite(screw.position.y)
      && !outlineContains(frame.outline, screw.position)) {
      issues.push(
        issue("SCREW-002", "outside-outline", "error", "L1_GEOMETRIC", [screw.id, frame.id],
          `${screw.name}: falls outside ${frame.name}'s own outline — it would not punch through the plate.`,
          ["ASM-0056"]),
      );
    }
  }
  return issues;
};
