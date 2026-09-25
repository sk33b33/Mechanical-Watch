import type { AngularVelocity } from "@/units/angularVelocity";
import { radiansPerSecond } from "@/units/angularVelocity";
import { meshSpeedRatio, isValidToothCount } from "@/math/gearMath";
import type { Movement } from "@/domain/movement";
import type { ShaftId } from "@/domain/shaft";
import type { GearMeshId } from "@/domain/gearMesh";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";

export interface GearTrainConflict {
  shaftId: ShaftId;
  expected: AngularVelocity;
  computedFromMeshId: GearMeshId;
  computed: AngularVelocity;
}

export interface GearTrainSolution {
  /** Angular velocity for every shaft reachable from the driving shaft. */
  shaftAngularVelocity: ReadonlyMap<ShaftId, AngularVelocity>;
  /** Shafts with no path to the driving shaft (unpowered, informational). */
  unreachableShaftIds: readonly ShaftId[];
  /**
   * Two paths through the gear train disagree about a shaft's angular
   * velocity (an over-constrained / physically inconsistent train).
   */
  conflicts: readonly GearTrainConflict[];
}

function nearlyEqual(a: number, b: number): boolean {
  const tolerance = NUMERICAL_PARAMETERS.solverRelativeTolerance;
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Deterministically propagates angular velocity from
 * `movement.drivingShaftId` across every gear mesh, stage by stage
 * (REFERENCE_ENGINEERING.md §5.3, §7). Pure kinematic solve (L2):
 * rigid shafts and ideal meshes (ASM-0001), parallel axes (ASM-0006),
 * prescribed drive velocity (ASM-0007).
 */
export function solveGearTrain(movement: Movement): GearTrainSolution {
  const shaftAngularVelocity = new Map<ShaftId, AngularVelocity>();
  const conflicts: GearTrainConflict[] = [];

  // SIM-001: a non-finite drive is reported by validation, never propagated.
  if (movement.drivingShaftId !== null && Number.isFinite(movement.drivingAngularVelocity)) {
    shaftAngularVelocity.set(movement.drivingShaftId, movement.drivingAngularVelocity);

    const queue: ShaftId[] = [movement.drivingShaftId];
    while (queue.length > 0) {
      const currentShaftId = queue.shift();
      if (currentShaftId === undefined) {
        break;
      }
      const currentVelocity = shaftAngularVelocity.get(currentShaftId);
      if (currentVelocity === undefined) {
        continue;
      }

      for (const mesh of Object.values(movement.gearMeshes)) {
        const drivingGear = movement.gears[mesh.drivingGearId];
        const drivenGear = movement.gears[mesh.drivenGearId];
        if (drivingGear === undefined || drivenGear === undefined) {
          continue;
        }

        const edge =
          drivingGear.shaftId === currentShaftId
            ? { fromTeeth: drivingGear.toothCount, toTeeth: drivenGear.toothCount, toShaftId: drivenGear.shaftId }
            : drivenGear.shaftId === currentShaftId
              ? { fromTeeth: drivenGear.toothCount, toTeeth: drivingGear.toothCount, toShaftId: drivingGear.shaftId }
              : null;
        if (edge === null) {
          continue;
        }
        if (!isValidToothCount(edge.fromTeeth) || !isValidToothCount(edge.toTeeth)) {
          // A gear with invalid parameters (e.g. mid-edit) cannot mesh;
          // the gear-parameters validation rule reports this separately.
          // Treat it as an impassable edge rather than throwing.
          continue;
        }

        const computed = radiansPerSecond(
          currentVelocity * meshSpeedRatio(edge.fromTeeth, edge.toTeeth),
        );

        const existing = shaftAngularVelocity.get(edge.toShaftId);
        if (existing === undefined) {
          shaftAngularVelocity.set(edge.toShaftId, computed);
          queue.push(edge.toShaftId);
        } else if (!nearlyEqual(existing, computed)) {
          conflicts.push({
            shaftId: edge.toShaftId,
            expected: existing,
            computedFromMeshId: mesh.id,
            computed,
          });
        }
      }
    }
  }

  const unreachableShaftIds = Object.keys(movement.shafts).filter(
    (shaftId) => !shaftAngularVelocity.has(shaftId as ShaftId),
  ) as ShaftId[];

  return { shaftAngularVelocity, unreachableShaftIds, conflicts };
}
