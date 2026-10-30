import type { AngularVelocity } from "@/units/angularVelocity";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { Gear, GearId } from "./gear";
import type { Shaft, ShaftId } from "./shaft";
import { DIAL_TEXTURE, decodeHeights, isDialTextureId, type DialTexture } from "@/geometry/dialTexture";
import { appearanceKeyFor, defaultAppearance, isHexColour, type Appearance, type DialColourKey, type HexColour } from "./appearance";
import type { GearMesh, GearMeshId } from "./gearMesh";
import type { Frame, FrameId } from "./frame";
import type { Jewel, JewelId } from "./jewel";
import type { Coupling, CouplingId, MainspringSpec } from "./coupling";
import type { Tolerance, ToleranceId } from "./tolerance";
import type { KeylessWorks, KeylessWorksId } from "./keyless";
import type { Dial, DialId } from "./dial";
import type { Escapement, EscapementId } from "./escapement";
import type { MoonPhase, MoonPhaseId } from "./moonPhase";
import type { DateComplication, DateComplicationId } from "./dateComplication";
import type { MonthComplication, MonthComplicationId } from "./monthComplication";
import type { LeapYearComplication, LeapYearComplicationId } from "./leapYearComplication";
import type { SeasonComplication, SeasonComplicationId } from "./seasonComplication";
import type { YearDigitComplication, YearDigitComplicationId } from "./yearDigitComplication";
import type { DialWindow, DialWindowId } from "./dialWindow";
import type { Screw, ScrewId } from "./screw";
import type { ValidationLevel } from "@/reference/validationLevels";

export type MovementId = EntityId<"movement">;

/**
 * What sets the train's speed. No kind models energy, torque or a
 * mainspring (ASM-0007).
 * - PRESCRIBED: a chosen shaft turns at a chosen angular velocity.
 * - NOMINAL_TIME: the train runs at its nominal timekeeping rate. The
 *   minutes-hand shaft turns once per hour, clockwise seen from the dial
 *   (ASM-0014), and everything else follows from the gearing.
 * - BALANCE: the escapement's balance governs. Its free frequency (a
 *   linear undamped oscillator, ASM-0024) sets the escape arbor's speed
 *   (ASM-0021), and the train follows. The hands then run fast or slow
 *   relative to nominal time by however much that frequency differs.
 */
export type Drive =
  | { kind: "PRESCRIBED"; shaftId: ShaftId; angularVelocity: AngularVelocity }
  | { kind: "NOMINAL_TIME" }
  | { kind: "BALANCE" };

/**
 * The authoritative mechanical model of a watch movement (or, for
 * Milestone 1, a minimal gear sandbox). Three.js and the UI read from
 * this model; they never mutate mechanical state directly.
 */
export interface Movement {
  readonly id: MovementId;
  name: string;
  /** Explicitly labels demo/teaching content so it is never mistaken for a production caliber (see docs/PRODUCT_SPEC.md). */
  isTeachingDemo: boolean;
  shafts: Record<ShaftId, Shaft>;
  gears: Record<GearId, Gear>;
  gearMeshes: Record<GearMeshId, GearMesh>;
  /** Mainplate and bridges. A movement with no frames is a free-floating gear sandbox. */
  frames: Record<FrameId, Frame>;
  jewels: Record<JewelId, Jewel>;
  couplings: Record<CouplingId, Coupling>;
  /** Declared tolerances on entered dimensions (REF-ENG §14). Nominal values stay on the entities. */
  tolerances: Record<ToleranceId, Tolerance>;
  /** Crown, stem and stem pinions (at most one; see KEY-001). */
  keylessWorks: Record<KeylessWorksId, KeylessWorks>;
  /** At most one (DIAL-001). */
  dials: Record<DialId, Dial>;
  /** At most one (ESC-101). */
  escapements: Record<EscapementId, Escapement>;
  /** Zero or more; each driven continuously by its own arbor (ASM-0047, Phase 8.1). */
  moonPhases: Record<MoonPhaseId, MoonPhase>;
  /** Zero or more; each star advanced only by a jump, not continuous gear-train propagation (ASM-0048, Phase 8.2). */
  dateComplications: Record<DateComplicationId, DateComplication>;
  /** Zero or more; each driven by its referenced date complication's own jumps, not a continuous arbor (ASM-0049, Phase 8.3). */
  monthComplications: Record<MonthComplicationId, MonthComplication>;
  /** Zero or more; each driven by its referenced month complication's own December-to-January wrap, not a continuous arbor (ASM-0050, Phase 8.4). */
  leapYearComplications: Record<LeapYearComplicationId, LeapYearComplication>;
  /** Zero or more; each driven by its referenced month complication's own jump into Jan/Apr/Jul/Oct, not a continuous arbor (ASM-0057, Phase 8.11). */
  seasonComplications: Record<SeasonComplicationId, SeasonComplication>;
  /** Zero or more; each a single decimal digit wheel of a "drum clock" year display, driven by its referenced month complication's own December-to-January wrap with decimal carry between digit places, not a continuous arbor (Phase 8.12). */
  yearDigitComplications: Record<YearDigitComplicationId, YearDigitComplication>;
  /** Zero or more; a pure display entity, kinematically inert (ASM-0051, Phase 8.6). */
  dialWindows: Record<DialWindowId, DialWindow>;
  /** Zero or more; holds one frame in place, a plain declared through-hole (ASM-0056). */
  screws: Record<ScrewId, Screw>;
  drive: Drive | null;
  /** The colours chosen for the dial and the wheels seen through its windows (follow-up 39, ASM-0090); presentation only. */
  appearance: Appearance;
  /**
   * The level this design's model targets (REFERENCE_ENGINEERING.md §15).
   * Set explicitly by the author; never raised automatically.
   */
  declaredValidationLevel: ValidationLevel;
}

export function createMovement(
  name: string,
  isTeachingDemo: boolean,
  declaredValidationLevel: ValidationLevel = "L2_KINEMATIC",
): Movement {
  return {
    id: createId("movement"),
    name,
    isTeachingDemo,
    declaredValidationLevel,
    shafts: {},
    gears: {},
    gearMeshes: {},
    frames: {},
    jewels: {},
    couplings: {},
    tolerances: {},
    keylessWorks: {},
    dials: {},
    escapements: {},
    moonPhases: {},
    dateComplications: {},
    monthComplications: {},
    leapYearComplications: {},
    seasonComplications: {},
    yearDigitComplications: {},
    dialWindows: {},
    screws: {},
    drive: null,
    appearance: defaultAppearance(),
  };
}

/** Sets (or, with null, clears) one of the dial's own colours. */
export function setDialColour(movement: Movement, key: DialColourKey, colour: HexColour | null): Movement {
  if (colour !== null && !isHexColour(colour)) throw new Error(`Not a colour: ${String(colour)}`);
  return { ...movement, appearance: { ...movement.appearance, [key]: colour } };
}

/** Sets (or, with null, clears) the body or text colour of a wheel seen through a dial window. */
export function setWheelColour(movement: Movement, complicationId: string, part: "body" | "text", colour: HexColour | null): Movement {
  if (colour !== null && !isHexColour(colour)) throw new Error(`Not a colour: ${String(colour)}`);
  const key = appearanceKeyFor(movement, complicationId);
  const current = movement.appearance.wheels[key] ?? { body: null, text: null };
  const next = { ...current, [part]: colour };
  const wheels = { ...movement.appearance.wheels };
  if (next.body === null && next.text === null) Reflect.deleteProperty(wheels, key);
  else wheels[key] = next;
  return { ...movement, appearance: { ...movement.appearance, wheels } };
}

/**
 * Sets the dial's surface texture (follow-up 50, ASM-0094): none, a built-in texture, or an imported picture's
 * height map. An imported one must be a valid square of height bytes of a sane size and name.
 */
export function setDialTexture(movement: Movement, texture: DialTexture): Movement {
  if (texture.kind === "BUILT_IN" && !isDialTextureId(texture.id)) throw new Error(`Not a dial texture: ${String(texture.id)}`);
  if (texture.kind === "IMPORTED") {
    if (decodeHeights(texture.data, texture.size) === null) throw new Error("The imported picture is not a valid height map.");
    if (texture.name.trim() === "" || texture.name.length > DIAL_TEXTURE.maxNameLength) throw new Error("The imported picture needs a name of 1 to 60 characters.");
  }
  return { ...movement, appearance: { ...movement.appearance, dialTexture: texture } };
}

/** Puts every colour back to the built-in one. The dial's texture is a choice of surface, not a colour, so it is kept. */
export function resetAppearance(movement: Movement): Movement {
  return { ...movement, appearance: { ...defaultAppearance(), dialTexture: movement.appearance.dialTexture } };
}

export function addShaft(movement: Movement, shaft: Shaft): Movement {
  return { ...movement, shafts: { ...movement.shafts, [shaft.id]: shaft } };
}

export function addGear(movement: Movement, gear: Gear): Movement {
  return { ...movement, gears: { ...movement.gears, [gear.id]: gear } };
}

export function addGearMesh(movement: Movement, mesh: GearMesh): Movement {
  return { ...movement, gearMeshes: { ...movement.gearMeshes, [mesh.id]: mesh } };
}

export function addFrame(movement: Movement, frame: Frame): Movement {
  return { ...movement, frames: { ...movement.frames, [frame.id]: frame } };
}

export function addJewel(movement: Movement, jewel: Jewel): Movement {
  return { ...movement, jewels: { ...movement.jewels, [jewel.id]: jewel } };
}

export function addCoupling(movement: Movement, coupling: Coupling): Movement {
  return { ...movement, couplings: { ...movement.couplings, [coupling.id]: coupling } };
}

export function addKeylessWorks(movement: Movement, keyless: KeylessWorks): Movement {
  return { ...movement, keylessWorks: { ...movement.keylessWorks, [keyless.id]: keyless } };
}

export function updateKeylessWorks(
  movement: Movement,
  id: KeylessWorksId,
  patch: Partial<Omit<KeylessWorks, "id" | "type">>,
): Movement {
  const existing = movement.keylessWorks[id];
  if (existing === undefined) {
    throw new Error(`Unknown keyless works id: ${id}`);
  }
  return { ...movement, keylessWorks: { ...movement.keylessWorks, [id]: { ...existing, ...patch } } };
}

export function addEscapement(movement: Movement, escapement: Escapement): Movement {
  return { ...movement, escapements: { ...movement.escapements, [escapement.id]: escapement } };
}

export function updateEscapement(
  movement: Movement,
  id: EscapementId,
  patch: Partial<Omit<Escapement, "id" | "type" | "kind" | "modelLevel">>,
): Movement {
  const existing = movement.escapements[id];
  if (existing === undefined) {
    throw new Error(`Unknown escapement id: ${id}`);
  }
  return { ...movement, escapements: { ...movement.escapements, [id]: { ...existing, ...patch } } };
}

/** Sets or clears a mainspring link's spring data (REF-ENG §11). */
export function updateCouplingSpring(movement: Movement, id: CouplingId, spring: MainspringSpec | null): Movement {
  const existing = movement.couplings[id];
  if (existing?.kind !== "MAINSPRING") {
    throw new Error(`Not a mainspring link: ${id}`);
  }
  return { ...movement, couplings: { ...movement.couplings, [id]: { ...existing, spring } } };
}

export function addDial(movement: Movement, dial: Dial): Movement {
  return { ...movement, dials: { ...movement.dials, [dial.id]: dial } };
}

export function updateDial(movement: Movement, id: DialId, patch: Partial<Omit<Dial, "id" | "type">>): Movement {
  const existing = movement.dials[id];
  if (existing === undefined) {
    throw new Error(`Unknown dial id: ${id}`);
  }
  return { ...movement, dials: { ...movement.dials, [id]: { ...existing, ...patch } } };
}

export function addMoonPhase(movement: Movement, moonPhase: MoonPhase): Movement {
  return { ...movement, moonPhases: { ...movement.moonPhases, [moonPhase.id]: moonPhase } };
}

export function updateMoonPhase(movement: Movement, id: MoonPhaseId, patch: Partial<Omit<MoonPhase, "id" | "type">>): Movement {
  const existing = movement.moonPhases[id];
  if (existing === undefined) {
    throw new Error(`Unknown moon phase id: ${id}`);
  }
  return { ...movement, moonPhases: { ...movement.moonPhases, [id]: { ...existing, ...patch } } };
}

export function addDateComplication(movement: Movement, date: DateComplication): Movement {
  return { ...movement, dateComplications: { ...movement.dateComplications, [date.id]: date } };
}

export function updateDateComplication(movement: Movement, id: DateComplicationId, patch: Partial<Omit<DateComplication, "id" | "type">>): Movement {
  const existing = movement.dateComplications[id];
  if (existing === undefined) {
    throw new Error(`Unknown date complication id: ${id}`);
  }
  return { ...movement, dateComplications: { ...movement.dateComplications, [id]: { ...existing, ...patch } } };
}

export function addMonthComplication(movement: Movement, month: MonthComplication): Movement {
  return { ...movement, monthComplications: { ...movement.monthComplications, [month.id]: month } };
}

export function updateMonthComplication(movement: Movement, id: MonthComplicationId, patch: Partial<Omit<MonthComplication, "id" | "type">>): Movement {
  const existing = movement.monthComplications[id];
  if (existing === undefined) {
    throw new Error(`Unknown month complication id: ${id}`);
  }
  return { ...movement, monthComplications: { ...movement.monthComplications, [id]: { ...existing, ...patch } } };
}

export function addLeapYearComplication(movement: Movement, year: LeapYearComplication): Movement {
  return { ...movement, leapYearComplications: { ...movement.leapYearComplications, [year.id]: year } };
}

export function updateLeapYearComplication(movement: Movement, id: LeapYearComplicationId, patch: Partial<Omit<LeapYearComplication, "id" | "type">>): Movement {
  const existing = movement.leapYearComplications[id];
  if (existing === undefined) {
    throw new Error(`Unknown leap-year complication id: ${id}`);
  }
  return { ...movement, leapYearComplications: { ...movement.leapYearComplications, [id]: { ...existing, ...patch } } };
}

export function addSeasonComplication(movement: Movement, season: SeasonComplication): Movement {
  return { ...movement, seasonComplications: { ...movement.seasonComplications, [season.id]: season } };
}

export function updateSeasonComplication(movement: Movement, id: SeasonComplicationId, patch: Partial<Omit<SeasonComplication, "id" | "type">>): Movement {
  const existing = movement.seasonComplications[id];
  if (existing === undefined) {
    throw new Error(`Unknown season complication id: ${id}`);
  }
  return { ...movement, seasonComplications: { ...movement.seasonComplications, [id]: { ...existing, ...patch } } };
}

export function addYearDigitComplication(movement: Movement, digit: YearDigitComplication): Movement {
  return { ...movement, yearDigitComplications: { ...movement.yearDigitComplications, [digit.id]: digit } };
}

export function updateYearDigitComplication(movement: Movement, id: YearDigitComplicationId, patch: Partial<Omit<YearDigitComplication, "id" | "type">>): Movement {
  const existing = movement.yearDigitComplications[id];
  if (existing === undefined) {
    throw new Error(`Unknown year digit complication id: ${id}`);
  }
  return { ...movement, yearDigitComplications: { ...movement.yearDigitComplications, [id]: { ...existing, ...patch } } };
}

export function addDialWindow(movement: Movement, window: DialWindow): Movement {
  return { ...movement, dialWindows: { ...movement.dialWindows, [window.id]: window } };
}

export function updateDialWindow(movement: Movement, id: DialWindowId, patch: Partial<Omit<DialWindow, "id" | "type">>): Movement {
  const existing = movement.dialWindows[id];
  if (existing === undefined) {
    throw new Error(`Unknown dial window id: ${id}`);
  }
  return { ...movement, dialWindows: { ...movement.dialWindows, [id]: { ...existing, ...patch } } };
}

export function addScrew(movement: Movement, screw: Screw): Movement {
  return { ...movement, screws: { ...movement.screws, [screw.id]: screw } };
}

export function updateScrew(movement: Movement, id: ScrewId, patch: Partial<Omit<Screw, "id" | "type">>): Movement {
  const existing = movement.screws[id];
  if (existing === undefined) {
    throw new Error(`Unknown screw id: ${id}`);
  }
  return { ...movement, screws: { ...movement.screws, [id]: { ...existing, ...patch } } };
}

/**
 * Declares a tolerance, replacing any earlier one on the same dimension of
 * the same entity (a dimension has at most one tolerance).
 */
export function setTolerance(movement: Movement, tolerance: Tolerance): Movement {
  const kept = Object.fromEntries(
    Object.entries(movement.tolerances).filter(
      ([, t]) => !(t.entityId === tolerance.entityId && t.dimension === tolerance.dimension),
    ),
  ) as Record<ToleranceId, Tolerance>;
  return { ...movement, tolerances: { ...kept, [tolerance.id]: tolerance } };
}

export function updateTolerance(
  movement: Movement,
  toleranceId: ToleranceId,
  patch: Partial<Omit<Tolerance, "id" | "type" | "entityId" | "dimension">>,
): Movement {
  const existing = movement.tolerances[toleranceId];
  if (existing === undefined) {
    throw new Error(`Unknown tolerance id: ${toleranceId}`);
  }
  return { ...movement, tolerances: { ...movement.tolerances, [toleranceId]: { ...existing, ...patch } } };
}

export function updateFrame(
  movement: Movement,
  frameId: FrameId,
  patch: Partial<Omit<Frame, "id" | "type">>,
): Movement {
  const existing = movement.frames[frameId];
  if (existing === undefined) {
    throw new Error(`Unknown frame id: ${frameId}`);
  }
  return { ...movement, frames: { ...movement.frames, [frameId]: { ...existing, ...patch } } };
}

export function updateJewel(
  movement: Movement,
  jewelId: JewelId,
  patch: Partial<Omit<Jewel, "id" | "type">>,
): Movement {
  const existing = movement.jewels[jewelId];
  if (existing === undefined) {
    throw new Error(`Unknown jewel id: ${jewelId}`);
  }
  return { ...movement, jewels: { ...movement.jewels, [jewelId]: { ...existing, ...patch } } };
}

export function updateGear(
  movement: Movement,
  gearId: GearId,
  patch: Partial<Omit<Gear, "id" | "type">>,
): Movement {
  const existing = movement.gears[gearId];
  if (existing === undefined) {
    throw new Error(`Unknown gear id: ${gearId}`);
  }
  return {
    ...movement,
    gears: { ...movement.gears, [gearId]: { ...existing, ...patch } },
  };
}

export function updateShaft(
  movement: Movement,
  shaftId: ShaftId,
  patch: Partial<Omit<Shaft, "id" | "type">>,
): Movement {
  const existing = movement.shafts[shaftId];
  if (existing === undefined) {
    throw new Error(`Unknown shaft id: ${shaftId}`);
  }
  return { ...movement, shafts: { ...movement.shafts, [shaftId]: { ...existing, ...patch } } };
}

export function setPrescribedDrive(
  movement: Movement,
  shaftId: ShaftId,
  angularVelocity: AngularVelocity,
): Movement {
  return { ...movement, drive: { kind: "PRESCRIBED", shaftId, angularVelocity } };
}

export function setNominalTimeDrive(movement: Movement): Movement {
  return { ...movement, drive: { kind: "NOMINAL_TIME" } };
}

export function clearDrive(movement: Movement): Movement {
  return { ...movement, drive: null };
}

/** The single shaft carrying the minutes hand, or null if there is none or more than one. */
export function minutesHandShaftId(movement: Movement): ShaftId | null {
  const minutes = Object.values(movement.shafts).filter((s) => s.hand === "MINUTES");
  return minutes.length === 1 && minutes[0] !== undefined ? minutes[0].id : null;
}

/** The shaft the drive acts on: the prescribed shaft, or the minutes-hand shaft for nominal time. */
export function drivenShaftId(movement: Movement): ShaftId | null {
  const drive = movement.drive;
  if (drive === null) return null;
  switch (drive.kind) {
    case "PRESCRIBED":
      return drive.shaftId;
    case "NOMINAL_TIME":
      return minutesHandShaftId(movement);
    case "BALANCE": {
      const escapement = Object.values(movement.escapements)[0];
      return escapement !== undefined && escapement.escapeArborShaftId in movement.shafts ? escapement.escapeArborShaftId : null;
    }
  }
}

export function setBalanceDrive(movement: Movement): Movement {
  return { ...movement, drive: { kind: "BALANCE" } };
}
