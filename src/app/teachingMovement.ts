import { metres, millimetres, type Length } from "@/units/length";
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
  updateShaft,
  type Movement,
} from "@/domain/movement";
import { createShaft, fixedAt, type HandFunction, type Shaft, type ShaftSupport } from "@/domain/shaft";
import { createGear, type Gear } from "@/domain/gear";
import { createGearMesh, type GearMesh } from "@/domain/gearMesh";
import { createFrame } from "@/domain/frame";
import { createJewel } from "@/domain/jewel";
import { createFrictionClutch, createMainspring } from "@/domain/coupling";
import { createKeylessWorks } from "@/domain/keyless";
import { createDial } from "@/domain/dial";
import { addDial, addEscapement, addKeylessWorks, setBalanceDrive } from "@/domain/movement";
import { micronewtonMillimetresPerRadian, milligramSquareCentimetres } from "@/units/rotational";
import { newtonMillimetres } from "@/units/torque";
import { spanAngle, tangentialCentreDistance } from "@/kinematics/palletGeometry";
import { createEscapement } from "@/domain/escapement";
import { meshCentreDistance } from "@/math/gearMath";

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
 *
 * Keyless works and dial (ASM-0019, ASM-0020):
 * - the stem runs through the mainplate (z = 0.4 mm; the groove is not
 *   modeled, ASM-0010) and points to 3 o'clock seen from the dial (−X);
 * - a barrel arbor, coaxial with the barrel drum and joined to it by a
 *   mainspring (no energy modeled, ASM-0018), carries the ratchet wheel
 *   on the bridge side, just above the mainplate;
 * - the crown wheel (on a stud) meshes the ratchet at the same height. It
 *   lies above the stem, so the winding pinion engages it from below;
 * - the setting wheel (on a stud) meshes the minute wheel on the dial
 *   side, below the stem; the sliding pinion engages it when the stem is
 *   pulled out;
 * - the crown wheel and setting wheel are placed on the stem's line, and
 *   the stem is one pinion pitch radius from each wheel's mid-plane, so
 *   both right-angle meshes engage (KEY-002);
 * - with the crown wheel above the stem, the derived winding direction is
 *   clockwise seen from the crown (ASM-0018, ASM-0019);
 * - a dial below everything, centred on the centre arbor.
 *
 * Escapement (SIMPLIFIED ESCAPEMENT MODEL, ASM-0021…0023): a 15-tooth
 * escape wheel on the escape arbor, a pallet arbor and balance staff under
 * a balance cock. At nominal time the escape arbor would turn at 10 rev/min
 * (18 000 beats per hour, a 2.5 Hz balance). The movement is governed by
 * the balance (ASM-0024): 10 mg·cm² and 246.7 µN·mm/rad give 2.4999 Hz, so
 * the model predicts it runs about 7 s a day slow.
 * Amplitude, lift, lever and pallet angles are illustrative inputs, not
 * measured or sourced values (ASM-0009). The pallets span 3½ teeth with
 * tangential locking (ASM-0025). The mainspring (6.5 turns, 10 → 6 N·mm)
 * gives the power reserve and escape-wheel torque; the balance's Q and the
 * escapement efficiency are loss properties left unknown, so the energy
 * model does not predict an amplitude here (ASM-0026).
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
  const barrelArbor = shaft("Barrel arbor", null, { kind: "CARRIED" });
  const palletArbor = shaft("Pallet arbor");
  const balanceStaff = shaft("Balance staff");
  const crownWheelArbor = shaft("Crown wheel", null, { kind: "STUD", frameId: mainplate.id });
  const settingWheelArbor = shaft("Setting wheel", null, { kind: "STUD", frameId: mainplate.id });

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

  // Keyless works. Ratchet and crown wheel just above the mainplate (its top face is at 1.0 mm).
  const keylessModule = mm(0.1);
  const ratchetWheel = gear("Ratchet wheel", barrelArbor, 40, keylessModule, 1.1, 0.2);
  const crownWheel = gear("Crown wheel", crownWheelArbor, 20, keylessModule, 1.1, 0.2);
  const settingWheel = gear("Setting wheel", settingWheelArbor, 16, keylessModule, -0.6, 0.2);

  const mesh = (a: Gear, b: Gear): GearMesh => createGearMesh(a.id, b.id);
  const barrelToCentre = mesh(barrelDrum, centrePinion);
  const centreToThird = mesh(centreWheel, thirdPinion);
  const thirdToFourth = mesh(thirdWheel, fourthPinion);
  const fourthToEscape = mesh(fourthWheel, escapePinion);
  const cannonToMinute = mesh(cannonPinion, minuteWheelGear);
  const minuteToHour = mesh(minutePinion, hourWheelGear);
  const crownToRatchet = mesh(crownWheel, ratchetWheel);
  const settingToMinute = mesh(settingWheel, minuteWheelGear);

  let m = createMovement("Teaching movement: going train and motion works", true);
  m = addFrame(m, mainplate);
  m = addFrame(m, bridge);
  // A separate bridge for the pallet arbor and balance, beyond the train bridge's upper edge.
  const balanceCock = createFrame({
    kind: "BRIDGE",
    name: "Balance cock",
    outline: { kind: "POLYGON", points: [vec2(mm(3), mm(5)), vec2(mm(12), mm(5)), vec2(mm(12), mm(11)), vec2(mm(3), mm(11))] },
    zBottom: mm(4),
    thickness: mm(0.8),
  });
  m = addFrame(m, balanceCock);
  for (const s of [barrel, centre, third, fourth, escape, cannon, minuteWheel, hourWheel, barrelArbor, crownWheelArbor, settingWheelArbor]) {
    m = addShaft(m, s);
  }
  for (const g of [
    barrelDrum, centrePinion, centreWheel, thirdPinion, thirdWheel, fourthPinion, fourthWheel, escapePinion,
    cannonPinion, minuteWheelGear, minutePinion, hourWheelGear, ratchetWheel, crownWheel, settingWheel,
  ]) m = addGear(m, g);
  for (const g of [
    barrelToCentre, centreToThird, thirdToFourth, fourthToEscape, cannonToMinute, minuteToHour, crownToRatchet, settingToMinute,
  ]) {
    m = addGearMesh(m, g);
  }
  for (const s of [palletArbor, balanceStaff]) {
    m = addShaft(m, s);
    m = addJewel(m, createJewel({ name: `${s.name} lower jewel`, kind: "HOLE_JEWEL", frameId: mainplate.id, shaftId: s.id, end: "LOWER" }));
    m = addJewel(m, createJewel({ name: `${s.name} upper jewel`, kind: "HOLE_JEWEL", frameId: balanceCock.id, shaftId: s.id, end: "UPPER" }));
  }
  for (const s of [barrel, centre, third, fourth, escape]) {
    m = addJewel(m, createJewel({ name: `${s.name} lower jewel`, kind: "HOLE_JEWEL", frameId: mainplate.id, shaftId: s.id, end: "LOWER" }));
    m = addJewel(m, createJewel({ name: `${s.name} upper jewel`, kind: "HOLE_JEWEL", frameId: bridge.id, shaftId: s.id, end: "UPPER" }));
  }
  m = addCoupling(m, createFrictionClutch("Cannon pinion clutch", cannon.id, centre.id));
  // Mainspring data: illustrative design inputs (ASM-0009). No train efficiency is configured,
  // so torques downstream are the lossless upper bound (ASM-0002).
  m = addCoupling(m, createMainspring("Mainspring", barrelArbor.id, barrel.id, {
    usableTurns: 6.5,
    fullyWoundTorque: newtonMillimetres(10),
    letDownTorque: newtonMillimetres(6),
    trainEfficiency: null,
  }));

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
  m = updateShaft(m, barrelArbor.id, { placement: { kind: "COAXIAL", referenceShaftId: barrel.id } });

  // Put the crown wheel and setting wheel on the stem line y = 0 (the centre arbor is at the origin).
  // Each is placed from its partner by its mesh; the angle is the one that lands on y = 0 on the crown side.
  const toDeg = (rad: number): number => (rad * 180) / Math.PI;
  const onStemLine = (partnerY: number, centreDistance: number): number => 180 - toDeg(Math.asin(-partnerY / centreDistance));
  const barrelY = meshCentreDistance(trainModule, 72, 12) * Math.sin((200 * Math.PI) / 180);
  const minuteWheelY = meshCentreDistance(motionModule, 10, 30) * Math.sin((135 * Math.PI) / 180);
  polar(crownWheelArbor, barrelArbor, crownToRatchet, onStemLine(barrelY, meshCentreDistance(keylessModule, 20, 40)));
  polar(settingWheelArbor, minuteWheel, settingToMinute, onStemLine(minuteWheelY, meshCentreDistance(keylessModule, 16, 30)));

  m = addKeylessWorks(m, createKeylessWorks({
    name: "Keyless works",
    stemDirection: degrees(180),
    // One winding-pinion pitch radius (0.1 × 14 / 2 = 0.7) below the crown wheel's mid-plane (1.1),
    // and one sliding-pinion pitch radius (0.1 × 20 / 2 = 1.0) above the setting wheel's (−0.6).
    stemHeight: mm(0.4),
    windingPinion: { toothCount: 14, module: keylessModule },
    slidingPinion: { toothCount: 20, module: keylessModule },
    crownWheelGearId: crownWheel.id,
    settingWheelGearId: settingWheel.id,
    ratchetGearId: ratchetWheel.id,
  }));
  m = addDial(m, createDial({
    name: "Dial",
    centreShaftId: centre.id,
    diameter: mm(28),
    thickness: mm(0.4),
    // Below the lowest motion-works part (−1.2 mm) with 0.2 mm clear.
    faceHeight: mm(-1.8),
  }));

  // Pallet arbor and balance staff: fixed positions along a line from the escape arbor
  // (illustrative layout distances). The escape arbor's position follows the mesh chain
  // centre → third (330°) → fourth (0°) → escape (90°).
  const rad = (deg: number): number => (deg * Math.PI) / 180;
  const cd = (z1: number, z2: number): number => meshCentreDistance(trainModule, z1, z2);
  const escapeAt = {
    x: cd(80, 10) * Math.cos(rad(330)) + cd(75, 10),
    y: cd(80, 10) * Math.sin(rad(330)) + cd(80, 8),
  };
  const layoutDirection = rad(120);
  // Pallets span 3½ escape teeth with tangential locking (ASM-0025), which fixes the
  // escape-to-pallet distance at R / cos(φ/2).
  const escapeTeeth = 15;
  const escapeTipRadius = mm(2.3);
  // dropAngle: Playtner's own 15-tooth worked example (SRC-0036, ASM-0036) — within the
  // 12° wheel-angle budget per beat (180°/15 teeth), same tooth count as this movement.
  const palletGeometry = { spanTeeth: 3.5, lockAngle: degrees(2), drawAngle: degrees(12), runAngle: degrees(0.5), dropAngle: degrees(1.5) };
  const escapeToPallet = tangentialCentreDistance(escapeTipRadius, spanAngle(escapeTeeth, palletGeometry.spanTeeth)) ?? mm(Number.NaN);
  const palletToBalance = mm(3.5);
  const palletAt = { x: escapeAt.x + escapeToPallet * Math.cos(layoutDirection), y: escapeAt.y + escapeToPallet * Math.sin(layoutDirection) };
  const balanceAt = { x: palletAt.x + palletToBalance * Math.cos(layoutDirection), y: palletAt.y + palletToBalance * Math.sin(layoutDirection) };
  m = updateShaft(m, palletArbor.id, { placement: fixedAt(metres(palletAt.x), metres(palletAt.y)) });
  m = updateShaft(m, balanceStaff.id, { placement: fixedAt(metres(balanceAt.x), metres(balanceAt.y)) });
  m = addEscapement(m, createEscapement({
    name: "Escapement",
    escapeArborShaftId: escape.id,
    // Below the escape pinion (2.95–3.45 mm) and clear of the fourth pinion in plan.
    escapeWheel: { toothCount: escapeTeeth, tipDiameter: mm(escapeTipRadius * 2000), thickness: mm(0.15), zCentre: mm(2.4) },
    palletArborShaftId: palletArbor.id,
    leverAngle: degrees(10),
    balanceShaftId: balanceStaff.id,
    // Balance radius (3 mm) inside the pallet-to-balance distance, so the rim clears the pallet arbor (ESC-103).
    // Inertia and hairspring stiffness are illustrative inputs (ASM-0009). The stiffness is rounded
    // to four figures, not solved for the train, so the model shows a small derived rate error.
    balance: {
      diameter: mm(6), thickness: mm(0.3), zCentre: mm(3.0), amplitude: degrees(270), liftAngle: degrees(50),
      inertia: milligramSquareCentimetres(10),
      hairspringStiffness: micronewtonMillimetresPerRadian(246.7),
      // A loss property: only measurement or a source can supply it, so it is left unknown.
      qualityFactor: null,
      // Likewise only measurable/sourced per movement; left unknown (ASM-0034).
      isochronismCoefficient: null,
    },
    pallets: palletGeometry,
    // Also a loss property, left unknown for the same reason; the amplitude stays the declared one.
    escapementEfficiency: null,
  }));

  // The balance governs the rate (simplified dynamic model, ASM-0024).
  return setBalanceDrive(m);
}
