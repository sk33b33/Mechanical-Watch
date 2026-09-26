import { isFiniteVec2, polarOffset, type Vec2 } from "@/math/vec2";
import { isValidModule, isValidToothCount, meshCentreDistance } from "@/math/gearMath";
import type { Movement } from "@/domain/movement";
import type { Shaft, ShaftId } from "@/domain/shaft";

export type PlacementFailureReason =
  | "NON_FINITE"
  | "MISSING_REFERENCE"
  | "MESH_NOT_BETWEEN_SHAFTS"
  | "INVALID_MESH_PARAMETERS"
  | "REFERENCE_UNRESOLVED"
  | "CIRCULAR_REFERENCE";

export interface PlacementFailure {
  shaftId: ShaftId;
  reason: PlacementFailureReason;
}

export interface PlacementSolution {
  shaftPositions: ReadonlyMap<ShaftId, Vec2>;
  failures: readonly PlacementFailure[];
}

type Attempt = { status: "placed"; position: Vec2 } | { status: "waiting" } | { status: "failed"; reason: PlacementFailureReason };

function attempt(
  movement: Movement,
  shaft: Shaft,
  placed: ReadonlyMap<ShaftId, Vec2>,
  failed: ReadonlySet<ShaftId>,
): Attempt {
  const placement = shaft.placement;
  if (placement.kind === "FIXED") {
    return isFiniteVec2(placement.position)
      ? { status: "placed", position: placement.position }
      : { status: "failed", reason: "NON_FINITE" };
  }

  if (movement.shafts[placement.referenceShaftId] === undefined) {
    return { status: "failed", reason: "MISSING_REFERENCE" };
  }
  if (placement.kind === "COAXIAL") {
    if (placement.referenceShaftId === shaft.id) return { status: "failed", reason: "CIRCULAR_REFERENCE" };
    if (failed.has(placement.referenceShaftId)) return { status: "failed", reason: "REFERENCE_UNRESOLVED" };
    const axis = placed.get(placement.referenceShaftId);
    return axis === undefined ? { status: "waiting" } : { status: "placed", position: axis };
  }
  const mesh = movement.gearMeshes[placement.meshId];
  const gearA = mesh === undefined ? undefined : movement.gears[mesh.drivingGearId];
  const gearB = mesh === undefined ? undefined : movement.gears[mesh.drivenGearId];
  const shaftsOfMesh = new Set([gearA?.shaftId, gearB?.shaftId]);
  if (
    gearA === undefined ||
    gearB === undefined ||
    !shaftsOfMesh.has(shaft.id) ||
    !shaftsOfMesh.has(placement.referenceShaftId) ||
    shaft.id === placement.referenceShaftId
  ) {
    return { status: "failed", reason: "MESH_NOT_BETWEEN_SHAFTS" };
  }
  if (
    !isValidToothCount(gearA.toothCount) ||
    !isValidToothCount(gearB.toothCount) ||
    !isValidModule(gearA.module) ||
    gearA.module !== gearB.module
  ) {
    return { status: "failed", reason: "INVALID_MESH_PARAMETERS" };
  }
  if (!Number.isFinite(placement.angle)) {
    return { status: "failed", reason: "NON_FINITE" };
  }
  if (failed.has(placement.referenceShaftId)) {
    return { status: "failed", reason: "REFERENCE_UNRESOLVED" };
  }
  const origin = placed.get(placement.referenceShaftId);
  if (origin === undefined) {
    return { status: "waiting" };
  }
  const centreDistance = meshCentreDistance(gearA.module, gearA.toothCount, gearB.toothCount);
  return { status: "placed", position: polarOffset(origin, centreDistance, placement.angle) };
}

/**
 * Resolves every shaft's axis position from its placement constraint,
 * in dependency order. Deterministic: shafts are visited in insertion
 * order, and the result depends only on the design. Shafts that can't
 * be placed are reported, never guessed.
 */
export function solvePlacement(movement: Movement): PlacementSolution {
  const placed = new Map<ShaftId, Vec2>();
  const failures: PlacementFailure[] = [];
  const failed = new Set<ShaftId>();
  let pending = Object.values(movement.shafts);

  let progress = true;
  while (pending.length > 0 && progress) {
    progress = false;
    const stillPending: Shaft[] = [];
    for (const shaft of pending) {
      const result = attempt(movement, shaft, placed, failed);
      if (result.status === "placed") {
        placed.set(shaft.id, result.position);
        progress = true;
      } else if (result.status === "failed") {
        failures.push({ shaftId: shaft.id, reason: result.reason });
        failed.add(shaft.id);
        progress = true;
      } else {
        stillPending.push(shaft);
      }
    }
    pending = stillPending;
  }

  for (const shaft of pending) {
    failures.push({ shaftId: shaft.id, reason: "CIRCULAR_REFERENCE" });
  }

  return { shaftPositions: placed, failures };
}
