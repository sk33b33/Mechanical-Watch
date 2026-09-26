import type { Length } from "@/units/length";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { Movement } from "./movement";

export type ToleranceId = EntityId<"tolerance">;

/**
 * Dimensions that can carry a tolerance. Each is a length the user enters
 * directly. Derived values (pitch diameters, solved axis positions) are not
 * toleranced here: their variation would come from their inputs.
 */
export type TolerancedDimension =
  | "SHAFT_PIVOT_LOWER"
  | "SHAFT_PIVOT_UPPER"
  | "SHAFT_SHOULDER_SPAN"
  | "JEWEL_BORE"
  | "FRAME_Z_BOTTOM"
  | "FRAME_THICKNESS";

export const TOLERANCED_DIMENSION_LABELS: Record<TolerancedDimension, string> = {
  SHAFT_PIVOT_LOWER: "Lower pivot Ø",
  SHAFT_PIVOT_UPPER: "Upper pivot Ø",
  SHAFT_SHOULDER_SPAN: "Shoulder span",
  JEWEL_BORE: "Bore Ø",
  FRAME_Z_BOTTOM: "Axial position (underside)",
  FRAME_THICKNESS: "Thickness",
};

/**
 * Optional distribution per REF-ENG §14. Recorded for documentation only:
 * the analysis is worst-case and does not use it (ASM-0017).
 */
export type ToleranceDistribution = "NOT_STATED" | "UNIFORM" | "NORMAL";

/**
 * A tolerance on one dimension (REF-ENG §14). The nominal is the design
 * model's own value, so it is never stored twice. Limits are held as
 * signed deviations from it: lower limit = nominal + lowerDeviation,
 * upper limit = nominal + upperDeviation.
 *
 * A tolerance is a declared design intent. It does not make a dimension
 * manufacturing-validated (MFG-001, MFG-002).
 */
export interface Tolerance {
  readonly id: ToleranceId;
  readonly type: "Tolerance";
  entityId: EntityId;
  dimension: TolerancedDimension;
  lowerDeviation: Length;
  upperDeviation: Length;
  distribution: ToleranceDistribution;
  /** A source ID from reference/sources/SOURCES.yml, or a citation. Null when no source is given. */
  source: string | null;
  /** What this tolerance has been checked against, in the author's words (e.g. "design intent only"). */
  validationScope: string;
}

export interface CreateToleranceParams {
  entityId: EntityId;
  dimension: TolerancedDimension;
  lowerDeviation: Length;
  upperDeviation: Length;
  distribution?: ToleranceDistribution;
  source?: string | null;
  validationScope?: string;
}

export function createTolerance(params: CreateToleranceParams): Tolerance {
  return {
    id: createId("tolerance"),
    type: "Tolerance",
    entityId: params.entityId,
    dimension: params.dimension,
    lowerDeviation: params.lowerDeviation,
    upperDeviation: params.upperDeviation,
    distribution: params.distribution ?? "NOT_STATED",
    source: params.source ?? null,
    validationScope: params.validationScope ?? "",
  };
}

/** Which dimensions an entity of this kind can carry. */
export function tolerancedDimensionsOf(movement: Movement, entityId: EntityId): TolerancedDimension[] {
  if (entityId in movement.shafts) {
    const shaft = movement.shafts[entityId as keyof Movement["shafts"]];
    // Studs and carried parts have no pivots or shoulders of their own (see couplingRules).
    return shaft?.support.kind === "PIVOTED" ? ["SHAFT_PIVOT_LOWER", "SHAFT_PIVOT_UPPER", "SHAFT_SHOULDER_SPAN"] : [];
  }
  if (entityId in movement.jewels) return ["JEWEL_BORE"];
  if (entityId in movement.frames) return ["FRAME_Z_BOTTOM", "FRAME_THICKNESS"];
  return [];
}

/**
 * The model's nominal value for a toleranced dimension. `undefined` if
 * the entity doesn't exist or doesn't have that dimension; `null` if the
 * dimension exists but is unknown.
 */
export function nominalOf(movement: Movement, entityId: EntityId, dimension: TolerancedDimension): Length | null | undefined {
  switch (dimension) {
    case "SHAFT_PIVOT_LOWER":
    case "SHAFT_PIVOT_UPPER":
    case "SHAFT_SHOULDER_SPAN": {
      const shaft = movement.shafts[entityId as keyof Movement["shafts"]];
      if (shaft === undefined) return undefined;
      if (dimension === "SHAFT_SHOULDER_SPAN") return shaft.shoulderSpan;
      return shaft.pivotDiameter[dimension === "SHAFT_PIVOT_LOWER" ? "LOWER" : "UPPER"];
    }
    case "JEWEL_BORE":
      return movement.jewels[entityId as keyof Movement["jewels"]]?.boreDiameter;
    case "FRAME_Z_BOTTOM":
    case "FRAME_THICKNESS": {
      const frame = movement.frames[entityId as keyof Movement["frames"]];
      if (frame === undefined) return undefined;
      return dimension === "FRAME_Z_BOTTOM" ? frame.zBottom : frame.thickness;
    }
  }
}

/** The tolerance declared on a dimension, if exactly one exists (duplicates are a TOL-001 error). */
export function toleranceFor(movement: Movement, entityId: EntityId, dimension: TolerancedDimension): Tolerance | null {
  const found = Object.values(movement.tolerances).filter((t) => t.entityId === entityId && t.dimension === dimension);
  return found.length === 1 && found[0] !== undefined ? found[0] : null;
}

/** Problems with a tolerance's own definition, independent of any stack-up. */
export function toleranceProblems(tolerance: Tolerance): string[] {
  const problems: string[] = [];
  if (!Number.isFinite(tolerance.lowerDeviation) || !Number.isFinite(tolerance.upperDeviation)) {
    problems.push("both limits must be finite numbers");
  } else if (tolerance.lowerDeviation > tolerance.upperDeviation) {
    problems.push("the lower limit is above the upper limit");
  }
  return problems;
}
