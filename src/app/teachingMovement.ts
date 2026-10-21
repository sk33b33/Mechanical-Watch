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
import { createScrew } from "@/domain/screw";
import { createFrictionClutch, createMainspring } from "@/domain/coupling";
import { createKeylessWorks } from "@/domain/keyless";
import { createDial } from "@/domain/dial";
import { addDateComplication, addDial, addDialWindow, addEscapement, addKeylessWorks, addLeapYearComplication, addMonthComplication, addMoonPhase, addScrew, addSeasonComplication, addYearDigitComplication, setBalanceDrive } from "@/domain/movement";
import { createMoonPhase } from "@/domain/moonPhase";
import { createDateComplication } from "@/domain/dateComplication";
import { createMonthComplication } from "@/domain/monthComplication";
import { createLeapYearComplication } from "@/domain/leapYearComplication";
import { createSeasonComplication } from "@/domain/seasonComplication";
import { createYearDigitComplication } from "@/domain/yearDigitComplication";
import { createDialWindow } from "@/domain/dialWindow";
import { solvePlacement } from "@/kinematics/solvePlacement";
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
 *
 * Moonphase disc (Phase 8.1, ASM-0047): a two-stage 8:87 reduction off the
 * hour wheel's own arbor, at 6 o'clock, stud-mounted on the mainplate. No
 * jumper/cam mechanism — an ordinary continuous gear train, same engine as
 * the going train. ≈1/118.27 of the hour wheel's own speed gives a disc
 * period of about 59.1 days; with two moon images 180° apart (the
 * conventional layout, SRC-0045) that is a ≈29.57-day lunation, a few tens
 * of minutes off the real synodic month (29.53059 days, SRC-0046) — reported
 * (MOON-002), not engineered away.
 *
 * Simple instantaneous date (Phase 8.2, ASM-0048) and month indicator (Phase
 * 8.3, ASM-0049): a 24-hour wheel geared 2:1 off the hour wheel drives a date
 * star through one jump per revolution. The month star has no gear train of
 * its own at all — it is driven entirely by the date complication's own
 * jumps, and only on the one each month that also enlarges to skip the days
 * the current month does not have.
 *
 * Leap-year (four-year cycle) wheel (Phase 8.4, ASM-0050): likewise no gear
 * train of its own — driven entirely by the month star's own
 * December-to-January wrap, once a calendar year. Advances by one real
 * Geneva-mechanism index step (90°, a 4-slot wheel, SRC-0047), though only
 * the net effect is simulated, not the real mechanism's continuous
 * non-uniform indexing motion (its closed-form kinematics are implemented
 * and tested, `src/kinematics/genevaDrive.ts`, but not wired into the live
 * simulation).
 */
/** The fewest teeth for a wheel in the teaching movement to be drawn as an open five-spoke wheel (follow-up 22, ASM-0077). */
const SPOKED_WHEEL_MIN_TEETH = 30;

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
    // Large wheels are drawn as open five-spoke wheels (follow-up 22, ASM-0077): any wheel big enough
    // (30+ teeth) to leave room for gaps. Pinions and the smaller wheels stay solid discs.
    createGear({ name, toothCount, module, shaftId: s.id, zCentre: mm(zCentre), thickness: mm(thickness), spoked: toothCount >= SPOKED_WHEEL_MIN_TEETH });

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

  // Moonphase disc (Phase 8.1, ASM-0047): a two-stage continuous reduction off the hour
  // wheel's own arbor, at a different plan position (6 o'clock, off the motion works). Stud-
  // mounted on the mainplate, like the minute wheel, so it needs no dial-side bearing of its
  // own (BRG-001). Its own z-levels (−1.15 / −1.26) sit below the existing motion works
  // (−0.6 / −1.0) and above the dial's back (−1.4, DIAL-002). No jumper/cam mechanism — an
  // ordinary gear train, same as the going train.
  // 8:87 twice gives 64/7569 ≈ 1/118.27 of the hour wheel's own speed (1 rev/12 h), so the disc
  // completes a revolution in about 59.1 days; with two moon images 180° apart (the conventional
  // DOUBLE layout, SRC-0045) that is a lunation of about 29.57 days — a few tens of minutes off
  // the real 29.53059-day synodic month (SRC-0046), reported rather than engineered away
  // (illustrative tooth counts, ASM-0009, same as the rest of this movement).
  const moonPinion = gear("Moon pinion", hourWheel, 8, motionModule, -1.15, 0.06);
  const moonReductionArbor = shaft("Moon reduction arbor", null, { kind: "STUD", frameId: mainplate.id });
  const moonWheel1 = gear("Moon wheel 1", moonReductionArbor, 87, motionModule, -1.15, 0.06);
  const moonPinion2 = gear("Moon pinion 2", moonReductionArbor, 8, motionModule, -1.26, 0.06);
  const moonDiscArbor = shaft("Moon disc arbor", null, { kind: "STUD", frameId: mainplate.id });
  const moonWheel2 = gear("Moon wheel 2", moonDiscArbor, 87, motionModule, -1.26, 0.06);

  // Simple instantaneous date (Phase 8.2, ASM-0048): the "24-hour wheel" is an ordinary
  // continuous reduction, same engine as the moonphase train above — 2:1 off the hour wheel's
  // own arbor, at 9 o'clock this time (SRC-0042: "the driving wheel 3 makes one turn in
  // twenty-four hours"). The date star itself is NOT meshed with anything: it is a separate,
  // declared (FIXED-position) arbor that the DateComplication entity below advances by one
  // step per 24-hour-wheel revolution — the genuinely new "jump" kinematics this item scoped.
  // Stud-mounted, like the minute wheel and moonphase train, so it needs no dial-side bearing.
  const twentyFourHourPinion = gear("24-hour pinion", hourWheel, 8, motionModule, -0.85, 0.06);
  const twentyFourHourArbor = shaft("24-hour arbor", null, { kind: "STUD", frameId: mainplate.id });
  const twentyFourHourWheel = gear("24-hour wheel", twentyFourHourArbor, 16, motionModule, -0.85, 0.1);
  // Declared, not mesh-derived (there is no real gear mesh to derive it from, same as the
  // pallet arbor/balance staff below): a plausible clearance further along the same 9 o'clock
  // line from the 24-hour arbor, comfortably inside the mainplate and clear of the dial back.
  const dateStarArbor = shaft("Date star", null, { kind: "STUD", frameId: mainplate.id });

  // Month star (Phase 8.3, ASM-0049): driven entirely by the date complication's own jumps, so
  // unlike every other arbor above it has no gear, mesh or drive train of its own — just a
  // separate, declared (FIXED-position) arbor for the MonthComplication entity below to turn.
  const monthStarArbor = shaft("Month star", null, { kind: "STUD", frameId: mainplate.id });

  // Leap-year wheel (Phase 8.4, ASM-0050): driven entirely by the month complication's own
  // December-to-January wrap, so — like the month star — it has no gear, mesh or drive train of
  // its own, just a separate, declared (FIXED-position) arbor for the LeapYearComplication below.
  const leapYearWheelArbor = shaft("Leap-year wheel", null, { kind: "STUD", frameId: mainplate.id });

  // Season wheel (Phase 8.11, ASM-0057): driven entirely by the month complication's own jump
  // into Jan/Apr/Jul/Oct, so — like the month star and leap-year wheel — it has no gear, mesh or
  // drive train of its own, just a separate, declared (FIXED-position) arbor for the
  // SeasonComplication below.
  const seasonWheelArbor = shaft("Season wheel", null, { kind: "STUD", frameId: mainplate.id });

  // Year digits (Phase 8.15, "page-flip" horizontal barrel): unlike the month star, leap-year
  // wheel and season wheel above, there is no arbor at all here — a YearDigitComplication is not
  // a Shaft (ASM-0019-style exception to ASM-0006, the same exception the keyless works' stem
  // already has), so each of the four digit segments below declares its own horizontal axle
  // placement directly.

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
  const hourToMoon1 = mesh(moonPinion, moonWheel1);
  const moon1ToMoon2 = mesh(moonPinion2, moonWheel2);
  const hourToTwentyFourHour = mesh(twentyFourHourPinion, twentyFourHourWheel);

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
  // A few illustrative mounting screws (ASM-0056, ASM-0009): declared positions within each
  // frame's own outline, not a complete screw layout for every frame.
  m = addScrew(m, createScrew({ name: "Mainplate screw 1", frameId: mainplate.id, position: vec2(mm(14.5), mm(0)), diameter: mm(0.8) }));
  m = addScrew(m, createScrew({ name: "Mainplate screw 2", frameId: mainplate.id, position: vec2(mm(-7.5), mm(8)), diameter: mm(0.8) }));
  m = addScrew(m, createScrew({ name: "Mainplate screw 3", frameId: mainplate.id, position: vec2(mm(-7.5), mm(-8)), diameter: mm(0.8) }));
  m = addScrew(m, createScrew({ name: "Train bridge screw", frameId: bridge.id, position: vec2(mm(5), mm(-1)), diameter: mm(0.7) }));
  m = addScrew(m, createScrew({ name: "Balance cock screw", frameId: balanceCock.id, position: vec2(mm(7), mm(6.5)), diameter: mm(0.6) }));
  for (const s of [
    barrel, centre, third, fourth, escape, cannon, minuteWheel, hourWheel, barrelArbor, crownWheelArbor, settingWheelArbor,
    moonReductionArbor, moonDiscArbor, twentyFourHourArbor, dateStarArbor, monthStarArbor, leapYearWheelArbor, seasonWheelArbor,
  ]) {
    m = addShaft(m, s);
  }
  for (const g of [
    barrelDrum, centrePinion, centreWheel, thirdPinion, thirdWheel, fourthPinion, fourthWheel, escapePinion,
    cannonPinion, minuteWheelGear, minutePinion, hourWheelGear, ratchetWheel, crownWheel, settingWheel,
    moonPinion, moonWheel1, moonPinion2, moonWheel2, twentyFourHourPinion, twentyFourHourWheel,
  ]) m = addGear(m, g);
  for (const g of [
    barrelToCentre, centreToThird, thirdToFourth, fourthToEscape, cannonToMinute, minuteToHour, crownToRatchet, settingToMinute,
    hourToMoon1, moon1ToMoon2, hourToTwentyFourHour,
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
  // Straight down from the hour wheel (6 o'clock, ASM-0014's dial convention), clear of the
  // train and balance bridges and well inside both the mainplate and the dial.
  //
  // Phase 8.15 follow-up 13: the moon disc's window now shows the WHOLE disc (6.3mm across), and
  // at the former straight-down chain (9.5mm below the hour wheel) its lower edge ran into the
  // 6 o'clock hour marker (inner edge ≈12.2mm from the centre). Both 4.75mm mesh legs are bent
  // into a shallow "V" — hour wheel → reduction arbor → disc at ±asin(4.3 / 4.75) = ±64.86° off
  // straight down — which lands the disc directly below the hour wheel at 8.6mm instead of
  // 9.5mm, ≈0.45mm clear of the marker. (Follow-up 14 briefly deepened this to 4.0mm for a ring of
  // dial icons; follow-up 15 removed the ring, so the V is back at 4.3mm.) Mesh centre distances
  // are unchanged, so every gear ratio and mesh is exactly as before; only the declared polar
  // angles differ.
  polar(moonReductionArbor, hourWheel, hourToMoon1, 244.86);
  polar(moonDiscArbor, moonReductionArbor, moon1ToMoon2, 295.14);
  // 9 o'clock from the hour wheel, clear of the moonphase train (6 o'clock) and the stem line.
  polar(twentyFourHourArbor, hourWheel, hourToTwentyFourHour, 180);
  // Declared, not mesh-derived (the star is not meshed with anything, ASM-0048) — a plausible
  // clearance further along the same 9 o'clock line, raised 0.8mm so its whole-wheel window clears the month window's own north pointer.
  m = updateShaft(m, dateStarArbor.id, { placement: fixedAt(mm(-6), mm(0.8)) });
  // Declared, not mesh-derived (the month star is not meshed with anything either, ASM-0049) —
  // offset from the date star by more than both their tip radii combined (ASSY-002 clearance).
  m = updateShaft(m, monthStarArbor.id, { placement: fixedAt(mm(-6), mm(-5)) });
  // Declared, not mesh-derived (the leap-year wheel is not meshed with anything either,
  // ASM-0050) — 4mm from the month star (more than their tip radii combined, ASSY-002
  // clearance), comfortably inside the mainplate, along the SOUTH-WEST diagonal from it. The
  // diagonal is deliberate: the Geneva wheel's own rim slots always face the driver (the month
  // star) at dwell, so they sit on the diagonals when the wheel is placed there, leaving the
  // wheel's own N/E/S/W free for its four position labels — which is what lets the leap-year
  // window show the whole wheel with a north index pointer reading the label at north, instead of
  // that label landing on a slot cutout (as it would at the previous straight-below placement,
  // where a slot points straight up at the pointer).
  m = updateShaft(m, leapYearWheelArbor.id, {
    placement: fixedAt(mm(-6 - 4 * Math.SQRT1_2), mm(-5 - 4 * Math.SQRT1_2)),
  });
  // Declared, not mesh-derived (the season wheel is not meshed with anything either, ASM-0057) —
  // on the date star's own line but the opposite direction from the month/leap-year wheels, by
  // more than their tip radii combined (ASSY-002 clearance), comfortably inside the mainplate.
  m = updateShaft(m, seasonWheelArbor.id, { placement: fixedAt(mm(-10.5), mm(3)) });

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
  const dial = createDial({
    name: "Dial",
    centreShaftId: centre.id,
    diameter: mm(28),
    thickness: mm(0.4),
    // Below the lowest motion-works part (−1.2 mm) with 0.2 mm clear.
    faceHeight: mm(-1.8),
  });
  m = addDial(m, dial);
  const moonPhase = createMoonPhase({
    name: "Moon phase",
    shaftId: moonDiscArbor.id,
    diameter: mm(6),
    thickness: mm(0.04),
    // Clear of moon wheel 2 (−1.26 ± 0.03 mm) and the dial's own back (−1.4 mm).
    faceHeight: mm(-1.35),
    windowCount: "DOUBLE",
  });
  m = addMoonPhase(m, moonPhase);
  const dateComplication = createDateComplication({
    name: "Date",
    driveShaftId: twentyFourHourArbor.id,
    starShaftId: dateStarArbor.id,
    // 31 positions, SRC-0042's own worked example ("a calendar mobile 1... bearing the numerals
    // 0 to 31... with an inner toothing 1a of thirty-one teeth").
    starToothCount: 31,
    starTipDiameter: mm(5),
    starThickness: mm(0.15),
    starZCentre: mm(-1.2),
  });
  m = addDateComplication(m, dateComplication);
  const monthComplication = createMonthComplication({
    name: "Month",
    dateComplicationId: dateComplication.id,
    starShaftId: monthStarArbor.id,
    // Smaller than the date star: 12 positions need less resolution than 31 (illustrative, ASM-0009).
    starTipDiameter: mm(4),
    starThickness: mm(0.15),
    starZCentre: mm(-1.2),
  });
  m = addMonthComplication(m, monthComplication);
  const leapYearComplication = createLeapYearComplication({
    name: "Leap year",
    monthComplicationId: monthComplication.id,
    wheelShaftId: leapYearWheelArbor.id,
    // Smaller still: 4 positions need the least resolution of the three star/wheel discs (illustrative, ASM-0009).
    wheelTipDiameter: mm(3),
    wheelThickness: mm(0.15),
    wheelZCentre: mm(-1.2),
  });
  m = addLeapYearComplication(m, leapYearComplication);
  const seasonComplication = createSeasonComplication({
    name: "Season",
    monthComplicationId: monthComplication.id,
    wheelShaftId: seasonWheelArbor.id,
    // Same resolution class as the leap-year wheel: 4 positions need the least resolution of the four star/wheel discs (illustrative, ASM-0009).
    wheelTipDiameter: mm(3),
    wheelThickness: mm(0.15),
    wheelZCentre: mm(-1.2),
  });
  m = addSeasonComplication(m, seasonComplication);

  // Year digits (Phase 8.15, "page-flip" horizontal barrel): one cylindrical barrel, its axis
  // horizontal (ASM-0019-style exception to ASM-0006), sliced along its own axle into four
  // abutting segments (thousands/hundreds/tens/ones, reading left to right like a printed year)
  // showing today's own year at the design's own t=0 (2026) — like DateComplication always
  // starting at day 1 and MonthComplication always starting at January, each segment's own
  // starting digit is independently declared (there is no sourced way for a watch to know the
  // real calendar year on its own), not derived from a single shared "year" field.
  //
  // Replaces the earlier vertical-axis "drum clock" (Phase 8.12-8.14, four separate wheels each
  // on its own vertical arbor): raised directly by the user, who rejected "4 gears with 4
  // windows" in favour of "1 large rectangular window with 1 large cylindrical barrel behind it
  // that is separated into 4 parts" with digits that "turn horizontally when facing the dial".
  // With the axle along world +X (axleDirection = 0°), the four segments are laid out abutting
  // end to end along X, each segmentLength (0.8mm) wide. barrelDiameter is 0.8mm — NOT the 2mm
  // the old vertical-axis drum used (Phase 8.12-8.14 real bug, caught from a live screenshot:
  // "a black box protruding through the dial"). On a horizontal-axis barrel, barrelDiameter sets
  // the Z-extent directly (the circular cross-section lies in the Y-Z plane), unlike the old
  // drum, where diameter only set the flat XY footprint and a separate, small `thickness` set
  // the Z-extent — so carrying the old drum's own 2mm diameter over unchanged needed ~2.8mm of
  // mainplate-to-dial clearance (diameter + the housing's own margin/wall overhead,
  // YEAR_DIGIT_HOUSING_VISUALIZATION), where only 1.4mm actually exists (the mainplate's own
  // underside at 0mm down to the dial's own back at -1.8mm + 0.4mm thickness = -1.4mm) — the
  // housing necessarily poked through both. axleHeight = -0.75mm centres the now-smaller
  // (0.8mm-diameter) barrel, plus its housing's own smaller margin/wall overhead, inside that
  // same 1.4mm gap with clearance on both sides (not just re-centred at the old 2mm size, which
  // cannot fit regardless of centring). Centres at x = -1.8/-2.6/-3.4/-4.2mm (thousands through
  // ones), y = 8mm: the same row position the old drums used (north of the balance cock's own
  // bridge footprint, clear of the train bridge, comfortably inside the mainplate's own 15mm
  // radius, and clear of the month/leap-year/season wheels further west at x = -6, ASSY-002
  // clearance).
  //
  // This x-order is DELIBERATELY the reverse of what "reading left to right" suggests at first
  // glance (thousands would naturally seem to want the most-negative x). It is not: the dial-side
  // camera (viewport.ts frameCamera, view "DIAL") looks along world +Z with up = +Y — it views the
  // dial from the dial's own −Z side (ASM-0014), the opposite face from the default bridge-side
  // view — so on screen, right = cross(forward, up) = cross((0,0,1),(0,1,0)) = (−1,0,0): screen-
  // right is world −X, a mirror. A circular window or a single centred digit never betrays this
  // (symmetric), which is why it went unnoticed through the per-digit rotation/legibility fixes
  // above; a 4-digit row crossing the window is the first place it shows. Confirmed against a real
  // rendered screenshot (user report: year showing as "6202" instead of "2026", i.e. exactly the
  // ones-through-thousands order reversed) before this fix.
  const yearThousandsComplication = createYearDigitComplication({
    name: "Year thousands", monthComplicationId: monthComplication.id, digitPlace: "THOUSANDS", startDigit: 2,
    axleOrigin: vec2(mm(-1.8), mm(8)), axleDirection: degrees(0), axleHeight: mm(-0.75), barrelDiameter: mm(0.8), segmentLength: mm(0.8),
  });
  m = addYearDigitComplication(m, yearThousandsComplication);
  const yearHundredsComplication = createYearDigitComplication({
    name: "Year hundreds", monthComplicationId: monthComplication.id, digitPlace: "HUNDREDS", startDigit: 0,
    axleOrigin: vec2(mm(-2.6), mm(8)), axleDirection: degrees(0), axleHeight: mm(-0.75), barrelDiameter: mm(0.8), segmentLength: mm(0.8),
  });
  m = addYearDigitComplication(m, yearHundredsComplication);
  const yearTensComplication = createYearDigitComplication({
    name: "Year tens", monthComplicationId: monthComplication.id, digitPlace: "TENS", startDigit: 2,
    axleOrigin: vec2(mm(-3.4), mm(8)), axleDirection: degrees(0), axleHeight: mm(-0.75), barrelDiameter: mm(0.8), segmentLength: mm(0.8),
  });
  m = addYearDigitComplication(m, yearTensComplication);
  const yearOnesComplication = createYearDigitComplication({
    name: "Year ones", monthComplicationId: monthComplication.id, digitPlace: "ONES", startDigit: 6,
    axleOrigin: vec2(mm(-4.2), mm(8)), axleDirection: degrees(0), axleHeight: mm(-0.75), barrelDiameter: mm(0.8), segmentLength: mm(0.8),
  });
  m = addYearDigitComplication(m, yearOnesComplication);

  // Dial windows (Phase 8.6, ASM-0051): without one, every disc complication above sits fully
  // hidden behind the dial's own opaque disc. Each window is offset from its complication's own
  // rotation axis by (illustrative) the radius its position labels print at
  // (DIAL_WINDOW_VISUALIZATION.labelRadiusFraction × disc radius, src/geometry/assemblyGeometry3d.ts)
  // — the same real-watch convention as a date window: a small aperture catching one label at a
  // time as the ring rotates beneath it, not a wide view of the whole disc. Moonphase prints no
  // labels (continuous, not discrete positions); its own window radius/offset are instead tuned
  // to MOON_PHASE_VISUALIZATION's own moon-image geometry (ASM-0055, assemblyGeometry3d.ts) so
  // the window and a painted moon image are exactly concentric at the real full-moon instant and
  // clear of each other at the real new-moon instant — see that constant's own doc comment for
  // the derivation. Date stays circular, the usual shape for a simple date aperture; month and leap-year use a
  // rectangle instead, sized for a short label ("Jan", "Year 4"), which a fixed-radius circle
  // cannot show without either clipping the text or revealing its neighbours. The month star's
  // own disc prints MONTH_ABBREVIATIONS, not MONTH_NAMES (src/kinematics/monthComplication.ts):
  // 12 full words crowd a disc a few millimetres across, so this window's own width is also kept
  // under one label's own rim spacing (2π × discRadius × labelRadiusFraction / 12 positions), the
  // same "catch one label at a time" reasoning as the comment above.
  const solved = solvePlacement(m);
  // Every disc window here is now a whole-wheel window centred on its own arbor's solved position
  // (follow-ups 7, 9, 11, 13). The former catch-one-label placement, kept here for reverting a
  // trial: the arbor's solved position moved north by `discRadiusMm × labelRadiusFraction`, i.e.
  // `{ x: at.x, y: at.y + mm(discRadiusMm * labelRadiusFraction) }` — "+Y = north = the current
  // reading position", the convention the pointer (ASM-0069) now makes visible. Written
  // `windowAbove(shaft, discRadiusMm, labelRadiusFraction)` in the revert notes below and in
  // docs/STATUS.md.
  m = addDialWindow(m, createDialWindow({
    name: "Moon phase window",
    dialId: dial.id,
    complicationId: moonPhase.id,
    // Offset matches MOON_PHASE_VISUALIZATION.moonPositionRadiusFraction (0.4) × this disc's own
    // 3mm radius = 1.2mm, so a painted moon image is exactly concentric with this window at the
    // real full-moon instant. Radius (0.7mm) is small enough that, summed with the moon image's
    // own radius (0.75mm = moonImageRadiusFraction × 3mm), the two stay clear of each other
    // (0.7+0.75=1.45mm) at the real new-moon instant, when their centres are offset×√2≈1.70mm
    // apart — a genuinely dark window, not just a dim one. ASM-0055.
    //
    // Whole-disc window (Phase 8.15 follow-up 13, a trial at the user's request — easy to revert
    // to the former catch-one-moon 0.7mm-radius circle at `windowAbove(moonDiscArbor.id, 3, 0.4)`):
    // same treatment as the date, month, season and leap-year wheels. Centred on the disc's own
    // axis, radius 5% over its declared radius, so the whole star sky and both moon images show.
    // The north pointer (ASM-0069) marks the full-moon position: `MOON_PHASE_VISUALIZATION.
    // windowWorldAngleRadians` already places a moon image straight north at the real full-moon
    // instant (ASM-0055), so "a moon under the triangle" reads as full moon.
    centre: (() => {
      const at = solved.shaftPositions.get(moonDiscArbor.id);
      if (at === undefined) throw new Error("teaching movement: no solved position for the moon disc arbor");
      return { x: metres(at.x), y: metres(at.y) };
    })(),
    outline: { kind: "CIRCLE", radius: (moonPhase.diameter / 2) * 1.05 as Length },
    pointer: "NORTH",
    // A thin dark printed frame around every window (follow-up 21, ASM-0074/0076).
    bezel: true,
    // The dial ring of fixed phase icons (follow-up 14, ASM-0072) is off: at the user's request
    // (follow-up 15, ASM-0073) the phases are printed on the moon wheel itself instead, and this
    // window's north pointer points at the one that is current.
    phaseMarks: false,
  }));
  // Date window radius (real bug, reported live: "check the numbers for the date gear it looks
  // clumped up together") is NOT just the font-size fix above (ASM-0067) — the window itself was
  // sized without checking it against the date ring's own tight pitch. The date star has 31
  // positions (far denser than month's 12 or leap-year's 4), so its own per-label slot — the
  // circumferential spacing between adjacent label centres, 2π × (2.5mm × 0.72) / 31 ≈ 0.365mm —
  // is tiny; the old 0.6mm radius (1.2mm diameter) is more than 3× that, so the window always
  // revealed several adjacent date numbers side by side, not one — previously an unreadable
  // overlapping mass (the same font-size bug every other ring had), now, after the font fix,
  // several CLEARLY SEPARATE numbers in one window ("…4 15 16 1…"), still wrong either way.
  // Measured directly against the real rendered canvas at the fitted font (ASM-0067's own
  // discLabelFittedFontSizePx, ≈26px here): the widest label ("24") needs a window radius of at
  // least 0.168mm (half its own bounding-box diagonal) to show whole, and under 0.182mm (half the
  // 0.365mm slot) to stay clear of its neighbour — a genuinely tight band, the tightest of any
  // ring here, but a real one. 0.175mm sits inside it.
  m = addDialWindow(m, createDialWindow({
    name: "Date window",
    dialId: dial.id,
    complicationId: dateComplication.id,
    // Whole-wheel window (Phase 8.15 follow-up 11, a trial at the user's request — easy to revert
    // to the former 0.175mm-radius catch-one-number window at `windowAbove(dateStarArbor.id, 2.5,
    // 0.72)`, see the derivation above): same treatment as the month, season and leap-year wheels.
    // Centred on the date star's own axis, radius 5% over its declared tip radius, with the north
    // index pointer (ASM-0069) naming the day read there.
    centre: (() => {
      const at = solved.shaftPositions.get(dateStarArbor.id);
      if (at === undefined) throw new Error("teaching movement: no solved position for the date star arbor");
      return { x: metres(at.x), y: metres(at.y) };
    })(),
    outline: { kind: "CIRCLE", radius: (dateComplication.starTipDiameter / 2) * 1.05 as Length },
    pointer: "NORTH",
    // A thin dark printed frame around every window (follow-up 21, ASM-0074/0076).
    bezel: true,
  }));
  m = addDialWindow(m, createDialWindow({
    name: "Month window",
    dialId: dial.id,
    complicationId: monthComplication.id,
    // Whole-wheel window (Phase 8.15 follow-up 9, a trial at the user's request — easy to revert
    // to the former small 0.65 × 0.6mm RECTANGLE at `windowAbove(monthStarArbor.id, 2, 0.72)`):
    // same treatment as the season and leap-year wheels. Centred on the month star's own axis,
    // radius 5% over its declared tip radius, with the north index pointer (ASM-0069) naming the
    // position read there (the month labels use `DISC_LABEL_CURRENT_AT_NORTH_OFFSET_RADIANS`).
    centre: (() => {
      const at = solved.shaftPositions.get(monthStarArbor.id);
      if (at === undefined) throw new Error("teaching movement: no solved position for the month star arbor");
      return { x: metres(at.x), y: metres(at.y) };
    })(),
    outline: { kind: "CIRCLE", radius: (monthComplication.starTipDiameter / 2) * 1.05 as Length },
    pointer: "NORTH",
    // A thin dark printed frame around every window (follow-up 21, ASM-0074/0076).
    bezel: true,
  }));
  m = addDialWindow(m, createDialWindow({
    name: "Leap-year window",
    dialId: dial.id,
    complicationId: leapYearComplication.id,
    // Same treatment as the season window below (raised directly by the user): the whole wheel
    // shows, radius 5% over its own declared tip radius, centred on its own solved axis, with a
    // north index pointer naming the label currently at north.
    centre: (() => {
      const at = solved.shaftPositions.get(leapYearWheelArbor.id);
      if (at === undefined) throw new Error("teaching movement: no solved position for the leap-year wheel arbor");
      return { x: metres(at.x), y: metres(at.y) };
    })(),
    outline: { kind: "CIRCLE", radius: (leapYearComplication.wheelTipDiameter / 2) * 1.05 as Length },
    pointer: "NORTH",
    // A thin dark printed frame around every window (follow-up 21, ASM-0074/0076).
    bezel: true,
  }));
  // Season window: NOT the small "catch one label" aperture every other disc window above uses
  // — raised directly by the user ("the window for the seasons needs to be the same size or a
  // tiny bit bigger than the actual gear in order to see the artwork"). SeasonComplication's own
  // wheel carries real pictorial wedge art (sun/leaf/snowflake/flower, SEASON_VISUALIZATION,
  // ASM-0058), not just a short text label — a small offset window built to catch one label
  // (like date/month/leap-year's own windows) would hide that art almost entirely, revealing only
  // the current label. Centred directly on the wheel's own solved axis (not offset north via
  // `windowAbove`, since the goal here is to show the WHOLE disc, not catch one rotating
  // position), with radius 5% over the wheel's own declared 1.5mm tip radius (wheelTipDiameter /
  // 2, the same dimension SeasonComplication's own domain entity already declares) so the full
  // wedge illustration clears the window's own edge with a small margin, never clipped.
  //
  // Because the window no longer catches just one label, which wedge is "current" is no longer
  // obvious from the window alone (every other window's own small size already answers that by
  // construction) — `pointer: "NORTH"` (ASM-0069) adds a fixed upside-down-triangle index mark on
  // the dial, just outside the window's own north edge, naming the position read there: the same
  // "north = current" convention `windowAbove`'s own north offset already uses for every other
  // disc window, now made visible since the window itself is too big to make it obvious by sight.
  m = addDialWindow(m, createDialWindow({
    name: "Season window",
    dialId: dial.id,
    complicationId: seasonComplication.id,
    centre: (() => {
      const at = solved.shaftPositions.get(seasonWheelArbor.id);
      if (at === undefined) throw new Error("teaching movement: no solved position for the season wheel arbor");
      return { x: metres(at.x), y: metres(at.y) };
    })(),
    outline: { kind: "CIRCLE", radius: (seasonComplication.wheelTipDiameter / 2) * 1.05 as Length },
    pointer: "NORTH",
    // A thin dark printed frame around every window (follow-up 21, ASM-0074/0076).
    bezel: true,
  }));
  // One shared window over the whole barrel (Phase 8.15, replacing the earlier four separate
  // windows): the user's own explicit request ("it needs to be 1 large rectangular window...
  // separated into 4 parts"). Centred on the barrel's own along-axle midpoint (x = -3mm, the
  // mean of the four segment centres above) at the barrel's own y = 8mm — not offset the way
  // `windowAbove` offsets the other complications' windows, since a barrel has no rotating
  // position label to catch, just its own four always-forward-facing digit segments. Width
  // (3.4mm) spans the full four-segment barrel (4 × 0.8mm = 3.2mm) with a small margin.
  //
  // Height is NOT comparable to a flat disc window's own radius-based sizing (a real follow-up
  // bug: the first value here, 0.45mm, was picked that way and reported live as "the year...
  // jumbled" — two digits visibly stacked through one window after pressing "Set to browser
  // time"). On a horizontal-axis barrel the relevant comparison is the single digit's own
  // CIRCUMFERENTIAL ARC LENGTH at the dial-facing point — (barrelDiameter / 2) × (2π /
  // YEAR_DIGIT_SLOT_COUNT) = 0.4mm × 0.628 ≈ 0.251mm for the real 0.8mm barrelDiameter and 10
  // digits — since the barrel's own tangent direction at that point is locally vertical
  // (`yearDigitBarrelRestAngle`'s own doc comment), not its radius. A window taller than that
  // arc length inevitably reveals part of the next digit (and its divider) above or below the
  // current one.
  //
  // The follow-up fix (0.15mm) stayed safely under that 0.251mm ceiling but introduced a SECOND
  // real bug the other direction, reported live ("the window for 2026 needs to be bigger in
  // order to see the full number"): 0.15mm is itself smaller than a digit glyph's own real
  // rendered extent along that same circumferential direction, so the window now cropped the
  // TOP and BOTTOM off every digit instead of revealing a neighbour. Measured directly against
  // the real rendered canvas (`YEAR_DIGIT_BARREL_VISUALIZATION`'s original `fontSizePx: 105`, bold
  // sans-serif), `ctx.measureText(d).actualBoundingBoxAscent + actualBoundingBoxDescent` peaks
  // at 75px (digits 0/3/6/8/9) out of the texture's 1024px full width, which maps onto the
  // barrel's own full circumference (π × 0.8mm ≈ 2.513mm) — 75/1024 × 2.513mm ≈ 0.184mm, the
  // digit glyph's own real circumferential extent. The window height must sit strictly between
  // that figure (0.184mm, or the digit is cropped) and the 0.251mm slot ceiling above (or the
  // neighbour bleeds in); 0.22mm sits at roughly the midpoint, giving ≈0.018mm of clearance
  // past the glyph on each side (well inside the ≈0.034mm blank gap either side of a digit's own
  // slot, the same "verified against real pixel data" standard the digit font-size fix (Phase
  // 8.15 follow-up 3) already used) without approaching the next digit or its divider.
  //
  // Phase 8.15 follow-up 7 ("I can barely see the year"): the digits were raised to
  // `fontSizePx: 125` (glyph extent ≈ 89px → ≈0.218mm on the barrel). Follow-up 8 then enlarged
  // the WINDOW alone (barrel, digit font and every other dimension unchanged, at the user's
  // explicit direction): 3.6mm × 0.4mm. This deliberately exceeds the 0.251mm slot arc above, so
  // a thin sliver of the next digit's top (and its divider) now shows past the current digit —
  // the known cost of a window taller than one slot, accepted in exchange for the larger
  // opening. Past ≈0.5mm the neighbouring digits read as stacked/"jumbled" (verified live), which
  // is why the height stopped at 0.4mm. Follow-up 16 trimmed it to 0.34mm — still past the
  // glyph's own 0.218mm, so the digit has clear margin either side, but with the neighbour
  // slivers mostly gone — and added a thin bezel and a "YEAR" caption (ASM-0074).
  m = addDialWindow(m, createDialWindow({
    name: "Year window",
    dialId: dial.id,
    complicationId: yearOnesComplication.id,
    centre: { x: metres(mm(-3)), y: metres(mm(8)) },
    outline: { kind: "RECTANGLE", width: mm(3.6), height: mm(0.34) },
    // Printed furniture (follow-up 16, ASM-0074): a thin frame for a crisp edge and a "YEAR" caption below.
    bezel: true,
    caption: "YEAR",
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
  // kind/widthAngle/dropAngle: Playtner's own 15-tooth worked example (SRC-0036, ASM-0036/0037) —
  // equidistant pallets, 6° wide, 1.5° drop, within the 12° wheel-angle budget per beat
  // (180°/15 teeth, leaving 4.5° for the tooth), same tooth count as this movement.
  // rubyPinEntryFreedom: Playtner's own specific worked number, 1¼° (SRC-0036, ASM-0042), comfortably
  // under this movement's total lock (2° lock + 0.5° run = 2.5°, ESC-110). rubyPinSlotShake: the low
  // end of his cited ¼°-½° range. guardPointFreedom: the same 1¼° figure, reused by Playtner for his
  // worked guard-point example. guardPointRadius: his own worked guard radius, 4 mm (ASM-0043) —
  // together they reproduce his own computed clearance, 0.0873 mm (ESC-111). hornFreedom: 1½°, his
  // own worked horn-to-ruby-pin figure from a separate (double-roller) specification whose own
  // dart/safety-roller freedom was also 1¼° (SRC-0036, ASM-0045) — the low end of his cited "¼° to
  // ½° more than we allow for the guard point" range, applied to this movement's own 1¼° guard-point
  // freedom (1.25° + 0.25° = 1.5°, ESC-113).
  const palletGeometry = {
    spanTeeth: 3.5, kind: "EQUIDISTANT" as const, lockAngle: degrees(2), drawAngle: degrees(12), runAngle: degrees(0.5),
    dropAngle: degrees(1.5), widthAngle: degrees(6), rubyPinEntryFreedom: degrees(1.25), rubyPinSlotShake: degrees(0.25),
    guardPointFreedom: degrees(1.25), guardPointRadius: mm(4), hornFreedom: degrees(1.5),
  };
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
    // toothKind: Playtner's own 15-tooth specification is explicitly "the wheel teeth of the 'club' form" (SRC-0036, ASM-0038).
    escapeWheel: { toothCount: escapeTeeth, toothKind: "CLUB", tipDiameter: mm(escapeTipRadius * 2000), thickness: mm(0.15), zCentre: mm(2.4) },
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
      // Lift 50° / lever 10° = Playtner's own cited 5:1 proportion (SRC-0036, "some might use a
      // proportion of... even 5 to 1"). Impulse radius chosen so the derived fork acting length
      // (ESC-109) lands on Playtner's own worked example of 4.5 mm (SRC-0036, used for the ruby-pin
      // shake calculation): 4.5 mm / 5 = 0.9 mm (ASM-0041).
      impulseRadius: mm(0.9),
      // Single roller (ASM-0043) — the only configuration previously assumed. This movement's own
      // 5:1 fork ratio is comfortably above Playtner's cited single-roller floor (3 to 1, ESC-111).
      rollerKind: "SINGLE",
      // Roller radius (ASM-0044): left unknown. Playtner gives no worked numeric example for it, and
      // this movement's own placed pallet-to-balance distance (3.5 mm, below) does not geometrically
      // admit its own 4.5 mm fork acting length and 0.9 mm impulse radius as a consistent triangle
      // (3.5 mm < |4.5 − 0.9| mm) — entering a roller radius here would only ever report the
      // crescent construction as not realizable, not a useful demonstration (ESC-112).
      rollerRadius: null,
      // No source gives this movement's own measured temperature coefficient; left unknown (ASM-0046).
      temperatureCoefficient: null,
    },
    pallets: palletGeometry,
    // Also a loss property, left unknown for the same reason; the amplitude stays the declared one.
    escapementEfficiency: null,
  }));

  // The balance governs the rate (simplified dynamic model, ASM-0024).
  return setBalanceDrive(m);
}
