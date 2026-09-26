import { millimetres, type Length } from "@/units/length";
import { degrees } from "@/units/angle";
import { vec2 } from "@/math/vec2";
import {
  addCoupling,
  addFrame,
  addGear,
  addGearMesh,
  addJewel,
  addShaft,
  createMovement,
  setNominalTimeDrive,
  updateShaft,
  type Movement,
} from "@/domain/movement";
import { createShaft, fixedAt, type HandFunction, type Shaft, type ShaftSupport } from "@/domain/shaft";
import { createGear, type Gear } from "@/domain/gear";
import { createGearMesh, type GearMesh } from "@/domain/gearMesh";
import { createFrame } from "@/domain/frame";
import { createJewel } from "@/domain/jewel";
import { createFrictionClutch } from "@/domain/coupling";

const mm = millimetres;

/**
 * Teaching movement: a going train (barrel → centre → third → fourth →
 * escape pinion) and separate motion works (cannon pinion on a friction
 * clutch, minute wheel on a stud, hour wheel), driven at nominal time.
 * Explicitly flagged isTeachingDemo. It is not a production caliber.
 *
 * Every dimension and tooth count is an illustrative design input
 * (ASM-0009), chosen so the ratios meet the 12-hour-dial definitions
 * (ASM-0014):
 * - centre 1 rev/h → third 80/10 → fourth 75/10 → 60 rev/h = 1 rev/min;
 * - motion works (10/30)·(8/32) = 1/12, with 10 + 30 = 8 + 32 so both
 *   meshes share one centre distance around the coaxial cannon pinion
 *   and hour wheel.
 * The escape wheel is not modeled: it is not a gear and has no module
 * (escapement is Phase 5). Jewel bores, pivots and shoulder spans are
 * left unknown on purpose.
 */
export function createTeachingMovement(): Movement {
  const trainModule = mm(0.12);
  const motionModule = mm(0.1);

  const mainplate = createFrame({
    kind: "MAINPLATE",
    name: "Mainplate",
    outline: { kind: "CIRCLE", centre: vec2(mm(2.5), mm(0)), radius: mm(15) },
    zBottom: mm(0),
    thickness: mm(1),
  });
  const bridge = createFrame({
    kind: "BRIDGE",
    name: "Train bridge",
    outline: {
      kind: "POLYGON",
      points: [vec2(mm(-8), mm(-5)), vec2(mm(13), mm(-6)), vec2(mm(13), mm(5)), vec2(mm(-8), mm(4))],
    },
    zBottom: mm(4),
    thickness: mm(0.8),
  });

  const placeholder = fixedAt(mm(0), mm(0));
  const shaft = (name: string, hand: HandFunction | null = null, support?: ShaftSupport): Shaft => ({
    ...createShaft(name, placeholder, support),
    hand,
  });

  const barrel = shaft("Barrel");
  const centre = shaft("Centre arbor");
  const third = shaft("Third arbor");
  const fourth = shaft("Fourth arbor", "SECONDS");
  const escape = shaft("Escape arbor");
  const cannon = shaft("Cannon pinion", "MINUTES", { kind: "CARRIED" });
  const minuteWheel = shaft("Minute wheel", null, { kind: "STUD", frameId: mainplate.id });
  const hourWheel = shaft("Hour wheel", "HOURS", { kind: "CARRIED" });

  const gear = (name: string, s: Shaft, toothCount: number, module: Length, zCentre: number, thickness: number): Gear =>
    createGear({ name, toothCount, module, shaftId: s.id, zCentre: mm(zCentre), thickness: mm(thickness) });

  // Going train, between the mainplate (top at 1.0 mm) and the bridge (underside at 4.0 mm).
  const barrelDrum = gear("Barrel drum", barrel, 72, trainModule, 1.4, 0.3);
  const centrePinion = gear("Centre pinion", centre, 12, trainModule, 1.4, 0.5);
  const centreWheel = gear("Centre wheel", centre, 80, trainModule, 2.0, 0.2);
  const thirdPinion = gear("Third pinion", third, 10, trainModule, 2.0, 0.5);
  const thirdWheel = gear("Third wheel", third, 75, trainModule, 2.6, 0.2);
  const fourthPinion = gear("Fourth pinion", fourth, 10, trainModule, 2.6, 0.5);
  const fourthWheel = gear("Fourth wheel", fourth, 80, trainModule, 3.2, 0.2);
  const escapePinion = gear("Escape pinion", escape, 8, trainModule, 3.2, 0.5);

  // Motion works, on the dial side (below the mainplate, z < 0).
  const cannonPinion = gear("Cannon pinion", cannon, 10, motionModule, -0.6, 0.4);
  const minuteWheelGear = gear("Minute wheel", minuteWheel, 30, motionModule, -0.6, 0.2);
  const minutePinion = gear("Minute pinion", minuteWheel, 8, motionModule, -1.0, 0.4);
  const hourWheelGear = gear("Hour wheel", hourWheel, 32, motionModule, -1.0, 0.2);

  const mesh = (a: Gear, b: Gear): GearMesh => createGearMesh(a.id, b.id);
  const barrelToCentre = mesh(barrelDrum, centrePinion);
  const centreToThird = mesh(centreWheel, thirdPinion);
  const thirdToFourth = mesh(thirdWheel, fourthPinion);
  const fourthToEscape = mesh(fourthWheel, escapePinion);
  const cannonToMinute = mesh(cannonPinion, minuteWheelGear);
  const minuteToHour = mesh(minutePinion, hourWheelGear);

  let m = createMovement("Teaching movement: going train and motion works", true);
  m = addFrame(m, mainplate);
  m = addFrame(m, bridge);
  for (const s of [barrel, centre, third, fourth, escape, cannon, minuteWheel, hourWheel]) m = addShaft(m, s);
  for (const g of [
    barrelDrum, centrePinion, centreWheel, thirdPinion, thirdWheel, fourthPinion, fourthWheel, escapePinion,
    cannonPinion, minuteWheelGear, minutePinion, hourWheelGear,
  ]) m = addGear(m, g);
  for (const g of [barrelToCentre, centreToThird, thirdToFourth, fourthToEscape, cannonToMinute, minuteToHour]) {
    m = addGearMesh(m, g);
  }
  for (const s of [barrel, centre, third, fourth, escape]) {
    m = addJewel(m, createJewel({ name: `${s.name} lower jewel`, kind: "HOLE_JEWEL", frameId: mainplate.id, shaftId: s.id, end: "LOWER" }));
    m = addJewel(m, createJewel({ name: `${s.name} upper jewel`, kind: "HOLE_JEWEL", frameId: bridge.id, shaftId: s.id, end: "UPPER" }));
  }
  m = addCoupling(m, createFrictionClutch("Cannon pinion clutch", cannon.id, centre.id));

  const polar = (s: Shaft, from: Shaft, via: GearMesh, angle: number): void => {
    m = updateShaft(m, s.id, {
      placement: { kind: "MESH_POLAR", referenceShaftId: from.id, meshId: via.id, angle: degrees(angle) },
    });
  };
  polar(barrel, centre, barrelToCentre, 200);
  polar(third, centre, centreToThird, 330);
  polar(fourth, third, thirdToFourth, 0);
  polar(escape, fourth, fourthToEscape, 90);
  m = updateShaft(m, cannon.id, { placement: { kind: "COAXIAL", referenceShaftId: centre.id } });
  m = updateShaft(m, hourWheel.id, { placement: { kind: "COAXIAL", referenceShaftId: centre.id } });
  polar(minuteWheel, cannon, cannonToMinute, 135);

  return setNominalTimeDrive(m);
}
