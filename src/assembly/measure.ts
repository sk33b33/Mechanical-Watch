import { metres, type Length } from "@/units/length";
import { distance, type Vec2 } from "@/math/vec2";
import type { Movement } from "@/domain/movement";
import type { EntityId } from "@/domain/ids";
import { findEntity, type SelectableEntity } from "@/domain/lookup";
import { gearPitchDiameter, type Gear } from "@/domain/gear";
import { isValidModule, isValidToothCount, meshCentreDistance } from "@/math/gearMath";
import { visualTipRadius } from "@/geometry/gearOutline";
import type { PlacementSolution } from "@/kinematics/solvePlacement";
import type { ReferenceId, ValidationLevel } from "@/validation/validationIssue";
import { arborZRange, frameZRange, isCompleteFrame, type ZRange } from "./assemblyGeometry";

/** A point in 3D movement space (metres), e.g. one picked on the rendered geometry. */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface MeasurementRow {
  label: string;
  /** Null when an input is missing or unresolved; `note` says why. */
  value: Length | null;
  note: string;
  /** The level of model the value comes from (e.g. L0 for visual tooth tips). */
  level: ValidationLevel;
  references: ReferenceId[];
}

export interface Measurement {
  a: SelectableEntity;
  b: SelectableEntity;
  rows: MeasurementRow[];
}

/** Plan position of an entity's rotation axis, if it has one and it is resolved. */
function axisOf(placement: PlacementSolution, entity: SelectableEntity): Vec2 | null | "none" {
  switch (entity.type) {
    case "Shaft":
      return placement.shaftPositions.get(entity.id) ?? null;
    case "Gear":
    case "Jewel":
      return placement.shaftPositions.get(entity.shaftId) ?? null;
    case "Dial":
      return placement.shaftPositions.get(entity.centreShaftId) ?? null;
    case "Escapement":
      return placement.shaftPositions.get(entity.escapeArborShaftId) ?? null;
    case "MoonPhase":
      return placement.shaftPositions.get(entity.shaftId) ?? null;
    case "Frame":
    case "KeylessWorks":
      return "none";
  }
}

/** Axial extent of an entity, or null if it is not fully defined. */
function zRangeOf(movement: Movement, entity: SelectableEntity): ZRange | null {
  switch (entity.type) {
    case "Gear":
      return Number.isFinite(entity.zCentre) && Number.isFinite(entity.thickness) && entity.thickness > 0
        ? { lo: entity.zCentre - entity.thickness / 2, hi: entity.zCentre + entity.thickness / 2 }
        : null;
    case "Frame":
      return isCompleteFrame(entity) ? frameZRange(entity) : null;
    case "Jewel": {
      const frame = movement.frames[entity.frameId];
      return frame !== undefined && isCompleteFrame(frame) ? frameZRange(frame) : null;
    }
    case "Shaft":
      return arborZRange(movement, entity.id);
    case "Dial":
      return Number.isFinite(entity.faceHeight) && Number.isFinite(entity.thickness) && entity.thickness > 0
        ? { lo: entity.faceHeight, hi: entity.faceHeight + entity.thickness }
        : null;
    case "Escapement": {
      const w = entity.escapeWheel;
      return Number.isFinite(w.zCentre) && Number.isFinite(w.thickness) && w.thickness > 0
        ? { lo: w.zCentre - w.thickness / 2, hi: w.zCentre + w.thickness / 2 }
        : null;
    }
    case "KeylessWorks":
      // The stem axis height: a line, so the range has no thickness.
      return Number.isFinite(entity.stemHeight) ? { lo: entity.stemHeight, hi: entity.stemHeight } : null;
    case "MoonPhase":
      return Number.isFinite(entity.faceHeight) && Number.isFinite(entity.thickness) && entity.thickness > 0
        ? { lo: entity.faceHeight, hi: entity.faceHeight + entity.thickness }
        : null;
  }
}

function gearIsDefined(gear: Gear): boolean {
  return isValidToothCount(gear.toothCount) && isValidModule(gear.module);
}

function row(label: string, value: number | null, note: string, level: ValidationLevel, references: ReferenceId[] = []): MeasurementRow {
  return { label, value: value === null ? null : metres(value), note, level, references };
}

/**
 * Measurements between two parts, computed from the domain model and the
 * solved placement, never from rendered meshes. Each value states the
 * model level it comes from. Exploded and section views don't affect it.
 */
export function measureBetween(
  movement: Movement,
  placement: PlacementSolution,
  idA: EntityId,
  idB: EntityId,
): Measurement | null {
  const a = findEntity(movement, idA);
  const b = findEntity(movement, idB);
  if (a === undefined || b === undefined) return null;
  const rows: MeasurementRow[] = [];

  const axisA = axisOf(placement, a);
  const axisB = axisOf(placement, b);
  let planDistance: number | null = null;
  if (axisA !== "none" && axisB !== "none") {
    if (axisA === null || axisB === null) {
      rows.push(row("Axis distance (plan)", null, "an axis is unresolved", "L1_GEOMETRIC"));
    } else {
      planDistance = distance(axisA, axisB);
      rows.push(row("Axis distance (plan)", planDistance,
        planDistance === 0 ? "coaxial" : "between rotation axes", "L1_GEOMETRIC", ["ASM-0006"]));
    }
  }

  const zA = zRangeOf(movement, a);
  const zB = zRangeOf(movement, b);
  if (zA === null || zB === null) {
    rows.push(row("Axial gap", null, "a height or thickness is not defined", "L1_GEOMETRIC"));
  } else {
    // Positive: height the two parts share. Negative: clear space between them.
    const overlap = Math.min(zA.hi, zB.hi) - Math.max(zA.lo, zB.lo);
    rows.push(row(overlap > 0 ? "Axial overlap" : "Axial gap", Math.abs(overlap),
      overlap > 0 ? "the parts share this much height" : overlap === 0 ? "faces touch" : "clear space between faces",
      "L1_GEOMETRIC", a.type === "Frame" || b.type === "Frame" ? ["ASM-0010"] : []));
  }

  if (a.type === "Gear" && b.type === "Gear" && a.id !== b.id) {
    if (!gearIsDefined(a) || !gearIsDefined(b) || planDistance === null) {
      rows.push(row("Pitch-circle clearance (plan)", null, "needs tooth counts, modules and resolved axes", "L1_GEOMETRIC"));
    } else {
      const pitchClearance = planDistance - (gearPitchDiameter(a) + gearPitchDiameter(b)) / 2;
      rows.push(row(pitchClearance < 0 ? "Pitch-circle overlap (plan)" : "Pitch-circle clearance (plan)",
        Math.abs(pitchClearance), "pitch model; not a tooth-profile clearance", "L1_GEOMETRIC", ["REF-ENG §5.2", "REF-ENG §6"]));
      const meshed = Object.values(movement.gearMeshes).some(
        (m) => (m.drivingGearId === a.id && m.drivenGearId === b.id) || (m.drivingGearId === b.id && m.drivenGearId === a.id),
      );
      // For a meshed pair the drawn tips always interpenetrate (that is the mesh), so the row would only mislead.
      if (!meshed) {
        const tipClearance = planDistance - visualTipRadius(a) - visualTipRadius(b);
        rows.push(row(tipClearance < 0 ? "Drawn tip overlap (plan)" : "Drawn tip clearance (plan)", Math.abs(tipClearance),
          "visual tooth proportions only; real tip clearance is unknown", "L0_VISUAL", ["ASM-0005"]));
      }
      if (meshed && a.module === b.module) {
        const ideal = meshCentreDistance(a.module, a.toothCount, b.toothCount);
        rows.push(row("Ideal centre distance", ideal, "m (z1 + z2) / 2 for this mesh", "L1_GEOMETRIC", ["REF-ENG §5.2"]));
        rows.push(row("Deviation from ideal", Math.abs(planDistance - ideal),
          planDistance === ideal ? "placed exactly at the ideal distance" : "compared with the GEAR-004 tolerance (ASM-0008)",
          "L1_GEOMETRIC", ["REF-ENG §5.2", "ASM-0008"]));
      }
    }
  }

  return { a, b, rows };
}

/**
 * A representative 3D point for a part: its axis at mid-height, or a
 * frame's outline centre at mid-thickness. Used to draw indicators; the
 * measured values come from measureBetween.
 */
export function partReferencePoint(movement: Movement, placement: PlacementSolution, id: EntityId): Point3 | null {
  const entity = findEntity(movement, id);
  if (entity === undefined) return null;
  const z = zRangeOf(movement, entity);
  if (z === null) return null;
  const midZ = (z.lo + z.hi) / 2;
  if (entity.type === "Frame") {
    const o = entity.outline;
    if (o.kind === "CIRCLE") return { x: o.centre.x, y: o.centre.y, z: midZ };
    if (o.points.length === 0) return null;
    const sum = o.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / o.points.length, y: sum.y / o.points.length, z: midZ };
  }
  const axis = axisOf(placement, entity);
  return axis === null || axis === "none" ? null : { x: axis.x, y: axis.y, z: midZ };
}

/**
 * Straight-line distance between two points picked on the rendered
 * geometry — not a domain-model quantity like measureBetween's rows, so
 * it carries no formula, assumption or reference: it is the exact
 * surfaces as drawn, including visual-only proportions (tooth form
 * ASM-0005, jewel/arbor placeholder sizes ASM-0012, etc.) that may not
 * match a real part. Always L0_VISUAL. A quick on-screen ruler, not an
 * engineering measurement.
 */
export function pointToPointRow(a: Point3 | null, b: Point3 | null): MeasurementRow {
  if (a === null || b === null) {
    return row("Picked-point distance", null, "pick two points on the rendered geometry", "L0_VISUAL");
  }
  const distance3 = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  return row(
    "Picked-point distance",
    distance3,
    "the exact points picked on the rendered (visual) geometry, not a domain-model quantity",
    "L0_VISUAL",
    ["ASM-0004"],
  );
}
