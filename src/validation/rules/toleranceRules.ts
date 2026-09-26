import { shaftSupport } from "@/assembly/assemblyGeometry";
import { COVERAGE_LABELS, endshakeStack, sideShakeStack, type StackResult } from "@/assembly/toleranceAnalysis";
import type { EntityId } from "@/domain/ids";
import { nominalOf, toleranceProblems, TOLERANCED_DIMENSION_LABELS, tolerancedDimensionsOf } from "@/domain/tolerance";
import { findEntity } from "@/domain/lookup";
import type { ShaftEnd } from "@/domain/shaft";
import type { ValidationIssue } from "../validationIssue";
import { issue, mm, type Rule } from "./context";

/** Dimensions that are sizes, so their lower limit must stay positive. An axial position may be any value. */
const POSITIVE_DIMENSIONS = new Set(["SHAFT_PIVOT_LOWER", "SHAFT_PIVOT_UPPER", "SHAFT_SHOULDER_SPAN", "JEWEL_BORE", "FRAME_THICKNESS"]);

/**
 * TOL-001: each declared tolerance must be well formed and apply to a
 * dimension that exists. TOL-002: a clearance that is positive at nominal
 * must stay positive at its worst-case declared limits. MFG-001: a
 * summary reminding that tolerances are declared intent, and anything
 * untoleranced is nominal only.
 */
export const toleranceRules: Rule = ({ movement }) => {
  const issues: ValidationIssue[] = [];
  const tolerances = Object.values(movement.tolerances);
  const seen = new Map<string, number>();

  for (const tolerance of tolerances) {
    const target = findEntity(movement, tolerance.entityId);
    const label = `${target?.name ?? "missing part"}: ${TOLERANCED_DIMENSION_LABELS[tolerance.dimension]}`;
    if (target === undefined || !tolerancedDimensionsOf(movement, tolerance.entityId).includes(tolerance.dimension)) {
      issues.push(
        issue("TOL-001", "target", "error", "L1_GEOMETRIC", [tolerance.id, tolerance.entityId],
          `Tolerance on ${label}: that part does not exist or has no such dimension.`, ["REF-ENG §14"]),
      );
      continue;
    }
    const key = `${tolerance.entityId}/${tolerance.dimension}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    for (const problem of toleranceProblems(tolerance)) {
      issues.push(
        issue("TOL-001", "limits", "error", "L1_GEOMETRIC", [tolerance.entityId, tolerance.id],
          `Tolerance on ${label}: ${problem}.`, ["REF-ENG §14"]),
      );
    }
    const nominal = nominalOf(movement, tolerance.entityId, tolerance.dimension);
    if (nominal === null || nominal === undefined) {
      issues.push(
        issue("TOL-001", "no-nominal", "warning", "L1_GEOMETRIC", [tolerance.entityId, tolerance.id],
          `Tolerance on ${label}: the dimension itself is unknown, so the tolerance has no effect.`, ["REF-ENG §14"]),
      );
    } else if (
      POSITIVE_DIMENSIONS.has(tolerance.dimension) &&
      Number.isFinite(nominal + tolerance.lowerDeviation) &&
      nominal + tolerance.lowerDeviation <= 0
    ) {
      issues.push(
        issue("TOL-001", "non-positive-limit", "error", "L1_GEOMETRIC", [tolerance.entityId, tolerance.id],
          `Tolerance on ${label}: the lower limit (${mm(nominal + tolerance.lowerDeviation)}) is not a positive size.`,
          ["REF-ENG §14"]),
      );
    }
  }
  for (const [key, count] of seen) {
    if (count > 1) {
      const [entityId] = key.split("/") as [EntityId];
      issues.push(
        issue("TOL-001", `duplicate-${key.split("/")[1] ?? ""}`, "error", "L1_GEOMETRIC", [entityId],
          `${findEntity(movement, entityId)?.name ?? "A part"} has ${String(count)} tolerances on the same dimension; keep one.`,
          ["REF-ENG §14"]),
      );
    }
  }

  const checkStack = (result: StackResult, what: string, entityIds: EntityId[], variant: string): void => {
    if (result.status !== "KNOWN") return;
    const { stack } = result;
    if (stack.coverage === "NONE" || stack.nominal <= 0 || stack.min > 0) return;
    issues.push(
      issue("TOL-002", variant, "warning", "L1_GEOMETRIC", entityIds,
        `${what}: nominal ${mm(stack.nominal)}, but the worst case within declared tolerances is ${mm(stack.min)} (${COVERAGE_LABELS[stack.coverage]}).`,
        ["REF-ENG §14", "ASM-0017"]),
    );
  };
  for (const shaft of Object.values(movement.shafts)) {
    if (shaft.support.kind !== "PIVOTED") continue;
    const support = shaftSupport(movement, shaft.id);
    for (const end of ["LOWER", "UPPER"] as ShaftEnd[]) {
      const jewel = end === "LOWER" ? support.lower : support.upper;
      checkStack(sideShakeStack(movement, shaft, end, jewel), `${shaft.name} ${end.toLowerCase()} side shake`,
        [shaft.id, ...(jewel === null ? [] : [jewel.id])], `side-shake-${end}`);
    }
    checkStack(endshakeStack(movement, shaft, support), `${shaft.name} endshake`, [shaft.id], "endshake");
  }

  if (tolerances.length > 0) {
    const sourced = tolerances.filter((t) => t.source !== null && t.source.trim() !== "").length;
    issues.push(
      issue("MFG-001", "summary", "info", "L1_GEOMETRIC", [],
        `${String(tolerances.length)} toleranced dimension${tolerances.length === 1 ? "" : "s"} (${String(sourced)} cite a source). Worst-case stacks cover side shake and endshake; untoleranced inputs are taken at nominal. Declared tolerances are design intent, not manufacturing validation (MFG-002).`,
        ["REF-ENG §14", "ASM-0017"]),
    );
  }
  return issues;
};
