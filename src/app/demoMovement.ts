import { millimetres } from "@/units/length";
import { rpmToRadPerSecond } from "@/units/angularVelocity";
import {
  createMovement,
  addShaft,
  addGear,
  addGearMesh,
  setDrivingShaft,
} from "@/domain/movement";
import { createShaft } from "@/domain/shaft";
import { createGear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { meshCentreDistance } from "@/math/gearMath";
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
  const drivingTeeth = 60;
  const drivenTeeth = 10;
  const centreDistance = meshCentreDistance(module, drivingTeeth, drivenTeeth);

  const drivingShaft = createShaft("Driving shaft", {
    x: millimetres(0),
    y: millimetres(0),
  });
  const drivenShaft = createShaft("Driven shaft", {
    x: centreDistance,
    y: millimetres(0),
  });

  const drivingGear = createGear({
    name: "Driving gear",
    toothCount: drivingTeeth,
    module,
    thickness: millimetres(0.2),
    shaftId: drivingShaft.id,
  });
  const drivenGear = createGear({
    name: "Driven gear",
    toothCount: drivenTeeth,
    module,
    thickness: millimetres(0.2),
    shaftId: drivenShaft.id,
  });

  let movement = createMovement("Two-gear teaching sandbox", true);
  movement = addShaft(movement, drivingShaft);
  movement = addShaft(movement, drivenShaft);
  movement = addGear(movement, drivingGear);
  movement = addGear(movement, drivenGear);
  movement = addGearMesh(movement, createGearMesh(drivingGear.id, drivenGear.id));
  movement = setDrivingShaft(movement, drivingShaft.id, rpmToRadPerSecond(6));

  return movement;
}
