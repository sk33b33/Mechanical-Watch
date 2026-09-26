import type { Length } from "@/units/length";
import { metres } from "@/units/length";
import type { EntityId } from "@/domain/ids";
import type { Movement } from "@/domain/movement";
import type { Jewel } from "@/domain/jewel";
import type { GearMesh } from "@/domain/gearMesh";
import type { Shaft, ShaftEnd } from "@/domain/shaft";
import {
  nominalOf,
  toleranceFor,
  toleranceProblems,
  TOLERANCED_DIMENSION_LABELS,
  type TolerancedDimension,
} from "@/domain/tolerance";
import { isValidModule, isValidToothCount } from "@/math/gearMath";
import type { PlacementSolution } from "@/kinematics/solvePlacement";
import { endshake, sideShake, type ShaftSupport } from "./assemblyGeometry";

/**
 * Worst-case (arithmetic) tolerance stacks for the clearances the model
 * computes. Every input is taken at whichever declared limit makes the
 * result smallest (for the minimum) or largest (for the maximum). Inputs
 * without a tolerance are taken at nominal, and the result says so: it is
 * never presented as covering variation that wasn't declared (MFG-001,
 * ASM-0017). Distributions are not used.
 */

/**
 * One dimension in a stack: result = Σ coefficient × dimension, where
 * coefficient = sign × (scale ?? 1). `scale` defaults to 1 (a plain
 * signed sum, as side shake and endshake use); a mesh centre-distance
 * stack instead needs a non-unit, possibly negative coefficient (a
 * direction cosine, or teeth/2 for a module), so it sets `scale` directly
 * and leaves `sign` at 1.
 */
export interface StackTerm {
  entityId: EntityId;
  entityName: string;
  dimension: TolerancedDimension;
  sign: 1 | -1;
  scale?: number;
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
  return `${term.entityName}: ${TOLERANCED_DIMENSION_LABELS[term.dimension]}`;
}

/** A term's coefficient: how much a unit change in its dimension changes the stack's result. */
function coefficientOf(term: StackTerm): number {
  return term.sign * (term.scale ?? 1);
}

/** Builds one `StackInput` per term, or says which are missing or invalid. Shared by every stack below. */
function buildInputs(movement: Movement, terms: StackTerm[]): { inputs: StackInput[] } | StackResult {
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
  return { inputs };
}

function coverageOf(inputs: StackInput[]): ToleranceCoverage {
  const toleranced = inputs.filter((i) => i.toleranced).length;
  return toleranced === 0 ? "NONE" : toleranced === inputs.length ? "COMPLETE" : "PARTIAL";
}

/** Evaluates Σ coefficient × dimension (each dimension's own absolute value) at nominal and at its worst-case limits. */
export function evaluateStack(movement: Movement, terms: StackTerm[]): StackResult {
  const built = buildInputs(movement, terms);
  if ("status" in built) return built;
  const { inputs } = built;

  let nominal = 0;
  let min = 0;
  let max = 0;
  for (const input of inputs) {
    const coefficient = coefficientOf(input);
    nominal += coefficient * input.nominal;
    // A negative coefficient flips which declared limit is the worst case for the minimum vs the maximum.
    min += coefficient >= 0 ? coefficient * input.lowerLimit : coefficient * input.upperLimit;
    max += coefficient >= 0 ? coefficient * input.upperLimit : coefficient * input.lowerLimit;
  }
  return {
    status: "KNOWN",
    stack: { nominal: metres(nominal), min: metres(min), max: metres(max), inputs, coverage: coverageOf(inputs) },
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

/**
 * Worst-case actual centre distance for a gear mesh, over declared
 * tolerances on the driving gear's module and either shaft's own FIXED
 * position. Unlike `evaluateStack`'s stacks, this is not a sum of
 * independent absolute lengths: it is a first-order (Taylor) expansion of
 * the distance formula around the placement solver's own result, so the
 * reported nominal is always exactly the placed distance, whatever the
 * mesh's tooth/module inputs alone would give (ASM-0027). Each term's
 * contribution is its partial derivative — teeth/2 for the shared module,
 * a direction cosine for a position coordinate — times how far that
 * dimension is taken from its own nominal; distance is exactly linear in
 * the module (so that term is exact), and the position terms are a
 * first-order approximation, matching the linear worst-case approach
 * REF-ENG §14 already uses for side shake and endshake.
 *
 * A mesh's two gears must share one module (GEAR-003), so only the
 * driving gear's module tolerance is read; the driven gear is assumed
 * manufactured to the same tolerance. A shaft's position is only an
 * entered dimension when its placement is FIXED (see
 * `TolerancedDimension`); MESH_POLAR and COAXIAL shafts contribute
 * nothing extra here — their variation would have to come through
 * whatever they are placed from, which this does not chain into.
 */
export function meshCentreDistanceStack(movement: Movement, mesh: GearMesh, placement: PlacementSolution): StackResult {
  const driving = movement.gears[mesh.drivingGearId];
  const driven = movement.gears[mesh.drivenGearId];
  if (driving === undefined || driven === undefined) return { status: "UNKNOWN", missing: ["both gears"] };
  if (!isValidToothCount(driving.toothCount) || !isValidToothCount(driven.toothCount)) {
    return { status: "UNKNOWN", missing: ["valid tooth counts"] };
  }
  if (!isValidModule(driving.module) || driving.module !== driven.module) {
    return { status: "UNKNOWN", missing: ["a shared, valid module"] };
  }
  const a = placement.shaftPositions.get(driving.shaftId);
  const b = placement.shaftPositions.get(driven.shaftId);
  if (a === undefined || b === undefined) return { status: "UNKNOWN", missing: ["both arbors placed"] };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (!(d > 0)) return { status: "INVALID_INPUT", reason: "the two arbors are at the same position" };
  const ux = dx / d;
  const uy = dy / d;

  const terms: StackTerm[] = [
    { entityId: driving.id, entityName: driving.name, dimension: "GEAR_MODULE", sign: 1, scale: (driving.toothCount + driven.toothCount) / 2 },
  ];
  const shaftOf = (shaft: Shaft, coeff: { x: number; y: number }): void => {
    if (shaft.placement.kind !== "FIXED") return;
    terms.push(
      { entityId: shaft.id, entityName: shaft.name, dimension: "SHAFT_POSITION_X", sign: 1, scale: coeff.x },
      { entityId: shaft.id, entityName: shaft.name, dimension: "SHAFT_POSITION_Y", sign: 1, scale: coeff.y },
    );
  };
  const drivingShaft = movement.shafts[driving.shaftId];
  const drivenShaft = movement.shafts[driven.shaftId];
  if (drivingShaft !== undefined) shaftOf(drivingShaft, { x: -ux, y: -uy });
  if (drivenShaft !== undefined) shaftOf(drivenShaft, { x: ux, y: uy });

  const built = buildInputs(movement, terms);
  if ("status" in built) return built;
  const { inputs } = built;

  // Anchored at the placement solver's own distance; each term adds its coefficient times the deviation
  // from ITS OWN nominal (0 when untoleranced), never the term's absolute value (see the doc comment above).
  let minDelta = 0;
  let maxDelta = 0;
  for (const input of inputs) {
    const coefficient = coefficientOf(input);
    const lowerDelta = coefficient * (input.lowerLimit - input.nominal);
    const upperDelta = coefficient * (input.upperLimit - input.nominal);
    minDelta += Math.min(lowerDelta, upperDelta);
    maxDelta += Math.max(lowerDelta, upperDelta);
  }
  return {
    status: "KNOWN",
    stack: {
      nominal: metres(d),
      min: metres(d + minDelta),
      max: metres(d + maxDelta),
      inputs,
      coverage: coverageOf(inputs),
    },
  };
}

export const COVERAGE_LABELS: Record<ToleranceCoverage, string> = {
  NONE: "nominal only: no input is toleranced",
  PARTIAL: "partial: some inputs are taken at nominal",
  COMPLETE: "all inputs toleranced",
};
