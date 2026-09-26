import type { Length } from "@/units/length";
import { metres } from "@/units/length";
import type { EntityId } from "@/domain/ids";
import type { Movement } from "@/domain/movement";
import type { Jewel } from "@/domain/jewel";
import type { Shaft, ShaftEnd } from "@/domain/shaft";
import {
  nominalOf,
  toleranceFor,
  toleranceProblems,
  TOLERANCED_DIMENSION_LABELS,
  type TolerancedDimension,
} from "@/domain/tolerance";
import { endshake, sideShake, type ShaftSupport } from "./assemblyGeometry";

/**
 * Worst-case (arithmetic) tolerance stacks for the clearances the model
 * computes. Every input is taken at whichever declared limit makes the
 * result smallest (for the minimum) or largest (for the maximum). Inputs
 * without a tolerance are taken at nominal, and the result says so: it is
 * never presented as covering variation that wasn't declared (MFG-001,
 * ASM-0017). Distributions are not used.
 */

/** One dimension in a stack: result = Σ sign × dimension. */
export interface StackTerm {
  entityId: EntityId;
  entityName: string;
  dimension: TolerancedDimension;
  sign: 1 | -1;
}

export interface StackInput extends StackTerm {
  nominal: Length;
  /** Limits actually used; equal to the nominal when the dimension has no tolerance. */
  lowerLimit: Length;
  upperLimit: Length;
  toleranced: boolean;
}

/** How many of the stack's inputs carry a declared tolerance. */
export type ToleranceCoverage = "NONE" | "PARTIAL" | "COMPLETE";

export interface ToleranceStack {
  nominal: Length;
  min: Length;
  max: Length;
  inputs: StackInput[];
  coverage: ToleranceCoverage;
}

export type StackResult =
  | { status: "KNOWN"; stack: ToleranceStack }
  | { status: "UNKNOWN"; missing: string[] }
  | { status: "INVALID_INPUT"; reason: string };

export function termLabel(term: StackTerm): string {
  return `${term.entityName} ${TOLERANCED_DIMENSION_LABELS[term.dimension].toLowerCase()}`;
}

/** Evaluates Σ sign × dimension at nominal and at its worst-case limits. */
export function evaluateStack(movement: Movement, terms: StackTerm[]): StackResult {
  const inputs: StackInput[] = [];
  const missing: string[] = [];
  for (const term of terms) {
    const nominal = nominalOf(movement, term.entityId, term.dimension);
    if (nominal === undefined || nominal === null) {
      missing.push(termLabel(term));
      continue;
    }
    if (!Number.isFinite(nominal)) return { status: "INVALID_INPUT", reason: `${termLabel(term)} is not a finite length` };
    const tolerance = toleranceFor(movement, term.entityId, term.dimension);
    if (tolerance !== null && toleranceProblems(tolerance).length > 0) {
      return { status: "INVALID_INPUT", reason: `the tolerance on ${termLabel(term)} is invalid` };
    }
    inputs.push({
      ...term,
      nominal,
      lowerLimit: metres(nominal + (tolerance?.lowerDeviation ?? 0)),
      upperLimit: metres(nominal + (tolerance?.upperDeviation ?? 0)),
      toleranced: tolerance !== null,
    });
  }
  if (missing.length > 0) return { status: "UNKNOWN", missing };

  let nominal = 0;
  let min = 0;
  let max = 0;
  for (const input of inputs) {
    nominal += input.sign * input.nominal;
    min += input.sign > 0 ? input.lowerLimit : 0 - input.upperLimit;
    max += input.sign > 0 ? input.upperLimit : 0 - input.lowerLimit;
  }
  const toleranced = inputs.filter((i) => i.toleranced).length;
  return {
    status: "KNOWN",
    stack: {
      nominal: metres(nominal),
      min: metres(min),
      max: metres(max),
      inputs,
      coverage: toleranced === 0 ? "NONE" : toleranced === inputs.length ? "COMPLETE" : "PARTIAL",
    },
  };
}

/** Side shake (bore − pivot diameter, ASM-0013) over declared tolerances. */
export function sideShakeStack(movement: Movement, shaft: Shaft, end: ShaftEnd, jewel: Jewel | null): StackResult {
  const nominal = sideShake(shaft, end, jewel);
  if (nominal.status !== "KNOWN" || jewel === null) {
    return nominal.status === "KNOWN" ? { status: "UNKNOWN", missing: ["bearing"] } : nominal;
  }
  return evaluateStack(movement, [
    { entityId: jewel.id, entityName: jewel.name, dimension: "JEWEL_BORE", sign: 1 },
    { entityId: shaft.id, entityName: shaft.name, dimension: end === "LOWER" ? "SHAFT_PIVOT_LOWER" : "SHAFT_PIVOT_UPPER", sign: -1 },
  ]);
}

/**
 * Endshake (upper frame underside − lower frame top − shoulder span,
 * ASM-0011) over declared tolerances. Frame positions and thicknesses
 * are independent inputs, so a tolerance on a bridge's axial position
 * stands for the variation of whatever locates it (pillars are not
 * modeled, ASM-0010).
 */
export function endshakeStack(movement: Movement, shaft: Shaft, support: ShaftSupport): StackResult {
  const nominal = endshake(movement, shaft, support);
  if (nominal.status !== "KNOWN") return nominal;
  const lowerFrame = support.lower === null ? undefined : movement.frames[support.lower.frameId];
  const upperFrame = support.upper === null ? undefined : movement.frames[support.upper.frameId];
  if (lowerFrame === undefined || upperFrame === undefined) return { status: "UNKNOWN", missing: ["bearing frames"] };
  if (lowerFrame.id === upperFrame.id) return { status: "INVALID_INPUT", reason: "both bearings are in the same frame" };
  return evaluateStack(movement, [
    { entityId: upperFrame.id, entityName: upperFrame.name, dimension: "FRAME_Z_BOTTOM", sign: 1 },
    { entityId: lowerFrame.id, entityName: lowerFrame.name, dimension: "FRAME_Z_BOTTOM", sign: -1 },
    { entityId: lowerFrame.id, entityName: lowerFrame.name, dimension: "FRAME_THICKNESS", sign: -1 },
    { entityId: shaft.id, entityName: shaft.name, dimension: "SHAFT_SHOULDER_SPAN", sign: -1 },
  ]);
}

export const COVERAGE_LABELS: Record<ToleranceCoverage, string> = {
  NONE: "nominal only: no input is toleranced",
  PARTIAL: "partial: some inputs are taken at nominal",
  COMPLETE: "all inputs toleranced",
};
