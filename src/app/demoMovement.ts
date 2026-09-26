import { millimetres, type Length } from "@/units/length";
import { degrees } from "@/units/angle";
import { rpmToRadPerSecond } from "@/units/angularVelocity";
import { vec2 } from "@/math/vec2";
import {
  addFrame,
  addGear,
  addGearMesh,
  addJewel,
  addShaft,
  createMovement,
  setPrescribedDrive,
  updateShaft,
  type Movement,
} from "@/domain/movement";
import { createShaft, fixedAt, type Shaft } from "@/domain/shaft";
import { createGear, type Gear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { createFrame } from "@/domain/frame";
import { createJewel } from "@/domain/jewel";

const mm = millimetres;

/**
 * Teaching demo: a three-arbor compound train between a mainplate and
 * one bridge, with a prescribed drive (ASM-0007). Explicitly flagged
 * isTeachingDemo (docs/PRODUCT_SPEC.md). It is not a production caliber
 * and not a going train.
 *
 * Every dimension here is an illustrative design input, not a sourced
 * watch specification (ASM-0009). Jewel bores, pivot diameters and
 * shoulder spans are left unknown (null) on purpose. The app reports
 * them as unknown instead of inventing values.
 */
export function createDemoMovement(): Movement {
  const module = mm(0.15);

  const mainplate = createFrame({
    kind: "MAINPLATE",
    name: "Mainplate",
    outline: { kind: "CIRCLE", centre: vec2(mm(0), mm(0)), radius: mm(13) },
    zBottom: mm(0),
    thickness: mm(1),
  });
  const bridge = createFrame({
    kind: "BRIDGE",
    name: "Train bridge",
    outline: {
      kind: "POLYGON",
      points: [vec2(mm(-5), mm(-4)), vec2(mm(3.5), mm(-1.5)), vec2(mm(3), mm(6.5)), vec2(mm(-1), mm(6.5)), vec2(mm(-5), mm(1))],
    },
    zBottom: mm(3),
    thickness: mm(0.8),
  });

  // Arbors B and C are placed by mesh constraints below; these are placeholders.
  const arborA = createShaft("Arbor A", fixedAt(mm(-3), mm(-2)));
  const arborB = createShaft("Arbor B", fixedAt(mm(0), mm(0)));
  const arborC = createShaft("Arbor C", fixedAt(mm(0), mm(0)));

  const gear = (name: string, toothCount: number, shaft: Shaft, zCentre: Length, thickness: Length): Gear =>
    createGear({ name, toothCount, module, thickness, zCentre, shaftId: shaft.id });
  const wheelA = gear("Wheel A", 60, arborA, mm(1.4), mm(0.2));
  const pinionB = gear("Pinion B", 10, arborB, mm(1.4), mm(0.4));
  const wheelB = gear("Wheel B", 48, arborB, mm(2.0), mm(0.2));
  const pinionC = gear("Pinion C", 8, arborC, mm(2.0), mm(0.4));
  const wheelC = gear("Wheel C", 40, arborC, mm(2.6), mm(0.2));

  const meshAB = createGearMesh(wheelA.id, pinionB.id);
  const meshBC = createGearMesh(wheelB.id, pinionC.id);

  let movement = createMovement("Three-arbor teaching train", true);
  movement = addFrame(movement, mainplate);
  movement = addFrame(movement, bridge);
  for (const shaft of [arborA, arborB, arborC]) {
    movement = addShaft(movement, shaft);
    movement = addJewel(movement, createJewel({
      name: `${shaft.name} lower jewel`, kind: "HOLE_JEWEL", frameId: mainplate.id, shaftId: shaft.id, end: "LOWER",
    }));
    movement = addJewel(movement, createJewel({
      name: `${shaft.name} upper jewel`, kind: "HOLE_JEWEL", frameId: bridge.id, shaftId: shaft.id, end: "UPPER",
    }));
  }
  for (const g of [wheelA, pinionB, wheelB, pinionC, wheelC]) movement = addGear(movement, g);
  movement = addGearMesh(movement, meshAB);
  movement = addGearMesh(movement, meshBC);

  movement = updateShaft(movement, arborB.id, {
    placement: { kind: "MESH_POLAR", referenceShaftId: arborA.id, meshId: meshAB.id, angle: degrees(30) },
  });
  movement = updateShaft(movement, arborC.id, {
    placement: { kind: "MESH_POLAR", referenceShaftId: arborB.id, meshId: meshBC.id, angle: degrees(100) },
  });
  return setPrescribedDrive(movement, arborA.id, rpmToRadPerSecond(1));
}
