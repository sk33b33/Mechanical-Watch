import type { AngularVelocity } from "@/units/angularVelocity";
import { radiansPerSecond } from "@/units/angularVelocity";
import { meshSpeedRatio, isValidToothCount } from "@/math/gearMath";
import type { Movement } from "@/domain/movement";
import type { ShaftId } from "@/domain/shaft";
import type { GearMeshId } from "@/domain/gearMesh";

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

const RELATIVE_TOLERANCE = 1e-6;

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= RELATIVE_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Deterministically propagates angular velocity from
 * `movement.drivingShaftId` across every gear mesh, stage by stage,
 * per docs/ENGINEERING_RULES.md "Compound trains". This is a pure,
 * kinematic (not dynamic) solve: it assumes rigid shafts and ideal,
 * lossless meshes.
 */
export function solveGearTrain(movement: Movement): GearTrainSolution {
  const shaftAngularVelocity = new Map<ShaftId, AngularVelocity>();
  const conflicts: GearTrainConflict[] = [];

  if (movement.drivingShaftId !== null) {
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
