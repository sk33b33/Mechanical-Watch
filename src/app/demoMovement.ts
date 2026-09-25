import { millimetres } from "@/units/length";
import { rpmToRadPerSecond } from "@/units/angularVelocity";
import {
  createMovement,
  addShaft,
  addGear,
  addGearMesh,
  setDrivingShaft,
  updateShaft,
} from "@/domain/movement";
import { createShaft, fixedAt } from "@/domain/shaft";
import { degrees } from "@/units/angle";
import { createGear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import type { Movement } from "@/domain/movement";

/**
 * Teaching demo: two meshed gears with a prescribed drive (ASM-0007).
 * Explicitly flagged isTeachingDemo (docs/PRODUCT_SPEC.md) — not a
 * production caliber. Module, tooth counts, thickness and drive speed
 * are illustrative design inputs, not sourced watch specifications
 * (ASM-0009).
 */
export function createTwoGearDemoMovement(): Movement {
  const module = millimetres(0.2);

  const drivingShaft = createShaft("Driving shaft", fixedAt(millimetres(0), millimetres(0)));
  // Placeholder placement; replaced by a mesh constraint once the mesh exists.
  const drivenShaft = createShaft("Driven shaft", fixedAt(millimetres(0), millimetres(0)));

  const drivingGear = createGear({
    name: "Driving gear",
    toothCount: 60,
    module,
    thickness: millimetres(0.2),
    shaftId: drivingShaft.id,
  });
  const drivenGear = createGear({
    name: "Driven gear",
    toothCount: 10,
    module,
    thickness: millimetres(0.2),
    shaftId: drivenShaft.id,
  });
  const mesh = createGearMesh(drivingGear.id, drivenGear.id);

  let movement = createMovement("Two-gear teaching sandbox", true);
  movement = addShaft(movement, drivingShaft);
  movement = addShaft(movement, drivenShaft);
  movement = addGear(movement, drivingGear);
  movement = addGear(movement, drivenGear);
  movement = addGearMesh(movement, mesh);
  movement = updateShaft(movement, drivenShaft.id, {
    placement: { kind: "MESH_POLAR", referenceShaftId: drivingShaft.id, meshId: mesh.id, angle: degrees(0) },
  });
  movement = setDrivingShaft(movement, drivingShaft.id, rpmToRadPerSecond(6));

  return movement;
}
