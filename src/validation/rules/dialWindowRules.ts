import { distance } from "@/math/vec2";
import { findDiscComplication } from "@/domain/discComplication";
import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

/**
 * DIALWIN-001 (dimensions and references) and DIALWIN-002 (the window
 * must actually overlap its complication's own disc, in plan, or
 * nothing is visible through it — ASM-0051).
 */
export const dialWindowRules: Rule = ({ movement, placement }) => {
  const issues: ValidationIssue[] = [];
  for (const win of Object.values(movement.dialWindows)) {
    const dial = movement.dials[win.dialId];
    const complication = findDiscComplication(movement, win.complicationId);
    const problems: string[] = [];
    if (!(Number.isFinite(win.radius) && win.radius > 0)) problems.push("its radius must be a positive length");
    if (!(Number.isFinite(win.centre.x) && Number.isFinite(win.centre.y))) problems.push("its centre must be finite");
    if (dial === undefined) problems.push("it does not reference an existing dial");
    if (complication === undefined) problems.push("it does not reference an existing complication");
    for (const problem of problems) {
      issues.push(issue("DIALWIN-001", problem, "error", "L1_GEOMETRIC", [win.id], `${win.name}: ${problem}.`, ["ASM-0051"]));
    }

    if (dial !== undefined && complication !== undefined && Number.isFinite(win.radius) && win.radius > 0
      && Number.isFinite(win.centre.x) && Number.isFinite(win.centre.y)) {
      const discCentre = placement.shaftPositions.get(complication.shaftId);
      if (discCentre === undefined) {
        issues.push(
          issue("DIALWIN-002", "disc-unresolved", "warning", "L1_GEOMETRIC", [win.id, complication.id],
            `${win.name}: ${complication.name}'s own arbor position is not resolved, so whether this window actually overlaps it cannot be checked yet.`,
            ["ASM-0051"]),
        );
      } else if (distance(win.centre, discCentre) >= win.radius + complication.discRadius) {
        issues.push(
          issue("DIALWIN-002", "no-overlap", "error", "L1_GEOMETRIC", [win.id, complication.id],
            `${win.name}: does not overlap ${complication.name}'s own disc — move the window or the disc, or widen the window, or nothing will be visible through it.`,
            ["ASM-0051"]),
        );
      }
    }
  }
  return issues;
};
