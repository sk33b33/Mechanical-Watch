import type { Drive, Movement } from "@/domain/movement";
import type { Coupling } from "@/domain/coupling";
import type { Frame, Outline } from "@/domain/frame";
import type { Shaft, ShaftPlacement, ShaftSupport } from "@/domain/shaft";
import type { Gear } from "@/domain/gear";
import type { GearMesh } from "@/domain/gearMesh";
import type { Jewel } from "@/domain/jewel";
import type { Tolerance } from "@/domain/tolerance";
import type { KeylessWorks, StemPinion } from "@/domain/keyless";
import type { Dial } from "@/domain/dial";
import type { Escapement, PalletGeometry } from "@/domain/escapement";
import type { MoonPhase } from "@/domain/moonPhase";
import type { DateComplication } from "@/domain/dateComplication";
import type { MonthComplication } from "@/domain/monthComplication";
import type { LeapYearComplication } from "@/domain/leapYearComplication";
import type { MainspringSpec } from "@/domain/coupling";
import type { Torque } from "@/units/torque";
import type { MomentOfInertia, TorsionalStiffness } from "@/units/rotational";
import type { Vec2 } from "@/math/vec2";
import type { Length } from "@/units/length";
import type { Angle } from "@/units/angle";
import type { AngularVelocity } from "@/units/angularVelocity";
import { VALIDATION_LEVELS } from "@/reference/validationLevels";
import {
  arrayOf,
  boolean,
  DecodeError,
  entityRecord,
  field,
  literal,
  nullable,
  number,
  object,
  oneOf,
  string,
  type Decoder,
} from "./decode";

export const DESIGN_FORMAT = "mechanical-watchmaker-3d.design";

/**
 * Bump when the saved shape of Movement changes, and add a migration from
 * the previous version to MIGRATIONS so older files still open.
 */
export const DESIGN_SCHEMA_VERSION = 21;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * MIGRATIONS[n] upgrades a raw version-n document to version n+1. A
 * migration only reshapes data; anything it doesn't recognise is passed
 * through for the decoder to reject with a precise path.
 */
const MIGRATIONS: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {
  /**
   * v1 → v2: `drivingShaftId`/`drivingAngularVelocity` become a `drive`
   * union; shafts gain `support` (PIVOTED, which is how v1 treated every
   * shaft) and `hand` (none); movements gain empty `couplings`.
   */
  1: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement)) return doc;
    const { drivingShaftId, drivingAngularVelocity, ...rest } = movement;
    const shafts = isRecord(rest.shafts)
      ? Object.fromEntries(
          Object.entries(rest.shafts).map(([id, shaft]) => [
            id,
            isRecord(shaft) ? { ...shaft, support: { kind: "PIVOTED" }, hand: null } : shaft,
          ]),
        )
      : rest.shafts;
    const drive =
      drivingShaftId === null || drivingShaftId === undefined
        ? null
        : { kind: "PRESCRIBED", shaftId: drivingShaftId, angularVelocity: drivingAngularVelocity };
    return { ...doc, schemaVersion: 2, movement: { ...rest, shafts, couplings: {}, drive } };
  },
  /** v2 → v3: movements gain `tolerances`, empty (v2 had no tolerance model). */
  2: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement)) return doc;
    return { ...doc, schemaVersion: 3, movement: { ...movement, tolerances: {} } };
  },
  /** v3 → v4: movements gain empty `keylessWorks` and `dials`; couplings may now also be MAINSPRING. */
  3: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement)) return doc;
    return { ...doc, schemaVersion: 4, movement: { ...movement, keylessWorks: {}, dials: {} } };
  },
  /** v4 → v5: movements gain empty `escapements`. */
  4: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement)) return doc;
    return { ...doc, schemaVersion: 5, movement: { ...movement, escapements: {} } };
  },
  /** v5 → v6: balances gain `inertia` and `hairspringStiffness`, unknown (null); the drive may be BALANCE. */
  5: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement) || !isRecord(movement.escapements)) return doc;
    const escapements = Object.fromEntries(
      Object.entries(movement.escapements).map(([id, e]) => [
        id,
        isRecord(e) && isRecord(e.balance) ? { ...e, balance: { ...e.balance, inertia: null, hairspringStiffness: null } } : e,
      ]),
    );
    return { ...doc, schemaVersion: 6, movement: { ...movement, escapements } };
  },
  /**
   * v6 → v7: escapements gain unknown pallet geometry, escapement efficiency
   * and balance quality factor; mainspring links gain unknown spring data.
   */
  6: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement)) return doc;
    const escapements = isRecord(movement.escapements)
      ? Object.fromEntries(Object.entries(movement.escapements).map(([id, e]) => [
          id,
          isRecord(e) && isRecord(e.balance)
            ? { ...e, pallets: null, escapementEfficiency: null, balance: { ...e.balance, qualityFactor: null } }
            : e,
        ]))
      : movement.escapements;
    const couplings = isRecord(movement.couplings)
      ? Object.fromEntries(Object.entries(movement.couplings).map(([id, c]) => [
          id,
          isRecord(c) && c.kind === "MAINSPRING" ? { ...c, spring: null } : c,
        ]))
      : movement.couplings;
    return { ...doc, schemaVersion: 7, movement: { ...movement, escapements, couplings } };
  },
  /** v7 → v8: balances gain an unknown (null) isochronism coefficient (ASM-0034). */
  7: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement) || !isRecord(movement.escapements)) return doc;
    const escapements = Object.fromEntries(
      Object.entries(movement.escapements).map(([id, e]) => [
        id,
        isRecord(e) && isRecord(e.balance) ? { ...e, balance: { ...e.balance, isochronismCoefficient: null } } : e,
      ]),
    );
    return { ...doc, schemaVersion: 8, movement: { ...movement, escapements } };
  },
  /** v8 → v9: pallet geometry, where given, gains an empty (NaN) drop angle (ASM-0036) to fill in. */
  8: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement) || !isRecord(movement.escapements)) return doc;
    const escapements = Object.fromEntries(
      Object.entries(movement.escapements).map(([id, e]) => [
        id,
        isRecord(e) && isRecord(e.pallets) ? { ...e, pallets: { ...e.pallets, dropAngle: Number.NaN } } : e,
      ]),
    );
    return { ...doc, schemaVersion: 9, movement: { ...movement, escapements } };
  },
  /**
   * v9 → v10: pallet geometry, where given, gains EQUIDISTANT (the only
   * implemented kind, and what the existing tangential-locking math already
   * builds, ASM-0037) and an empty (NaN) width angle to fill in.
   */
  9: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement) || !isRecord(movement.escapements)) return doc;
    const escapements = Object.fromEntries(
      Object.entries(movement.escapements).map(([id, e]) => [
        id,
        isRecord(e) && isRecord(e.pallets) ? { ...e, pallets: { ...e.pallets, kind: "EQUIDISTANT", widthAngle: Number.NaN } } : e,
      ]),
    );
    return { ...doc, schemaVersion: 10, movement: { ...movement, escapements } };
  },
  /**
   * v10 → v11: escape wheels gain CLUB (the only form previously assumed —
   * a positive derived tooth width was already required, ASM-0036/0037 —
   * and Playtner's own worked example uses it, ASM-0038).
   */
  10: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement) || !isRecord(movement.escapements)) return doc;
    const escapements = Object.fromEntries(
      Object.entries(movement.escapements).map(([id, e]) => [
        id,
        isRecord(e) && isRecord(e.escapeWheel) ? { ...e, escapeWheel: { ...e.escapeWheel, toothKind: "CLUB" } } : e,
      ]),
    );
    return { ...doc, schemaVersion: 11, movement: { ...movement, escapements } };
  },
  /**
   * v11 → v12: balances gain `impulseRadius`, unknown (null) — like
   * `inertia`/`hairspringStiffness`, entered directly, never guessed
   * (ASM-0041).
   */
  11: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement) || !isRecord(movement.escapements)) return doc;
    const escapements = Object.fromEntries(
      Object.entries(movement.escapements).map(([id, e]) => [
        id,
        isRecord(e) && isRecord(e.balance) ? { ...e, balance: { ...e.balance, impulseRadius: null } } : e,
      ]),
    );
    return { ...doc, schemaVersion: 12, movement: { ...movement, escapements } };
  },
  /**
   * v12 → v13: pallet geometry, where given, gains an empty (null) ruby
   * pin entry freedom and slot shake to fill in — entered directly,
   * never guessed (ASM-0042).
   */
  12: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement) || !isRecord(movement.escapements)) return doc;
    const escapements = Object.fromEntries(
      Object.entries(movement.escapements).map(([id, e]) => [
        id,
        isRecord(e) && isRecord(e.pallets) ? { ...e, pallets: { ...e.pallets, rubyPinEntryFreedom: null, rubyPinSlotShake: null } } : e,
      ]),
    );
    return { ...doc, schemaVersion: 13, movement: { ...movement, escapements } };
  },
  /**
   * v13 → v14: balances gain `rollerKind: "SINGLE"` (the only
   * configuration previously assumed, ASM-0043); pallet geometry, where
   * given, gains an empty (null) guard-point freedom and radius to fill
   * in — entered directly, never guessed.
   */
  13: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement) || !isRecord(movement.escapements)) return doc;
    const escapements = Object.fromEntries(
      Object.entries(movement.escapements).map(([id, e]) => {
        if (!isRecord(e)) return [id, e];
        const withRoller = isRecord(e.balance) ? { ...e, balance: { ...e.balance, rollerKind: "SINGLE" } } : e;
        return [id, isRecord(withRoller.pallets) ? { ...withRoller, pallets: { ...withRoller.pallets, guardPointFreedom: null, guardPointRadius: null } } : withRoller];
      }),
    );
    return { ...doc, schemaVersion: 14, movement: { ...movement, escapements } };
  },
  /**
   * v14 → v15: balances gain an empty (null) roller radius to fill in —
   * entered directly, never guessed (ASM-0044).
   */
  14: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement) || !isRecord(movement.escapements)) return doc;
    const escapements = Object.fromEntries(
      Object.entries(movement.escapements).map(([id, e]) => [
        id,
        isRecord(e) && isRecord(e.balance) ? { ...e, balance: { ...e.balance, rollerRadius: null } } : e,
      ]),
    );
    return { ...doc, schemaVersion: 15, movement: { ...movement, escapements } };
  },
  /**
   * v15 → v16: pallet geometry, where given, gains an empty (null) horn
   * freedom to fill in — entered directly, never guessed (ASM-0045).
   */
  15: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement) || !isRecord(movement.escapements)) return doc;
    const escapements = Object.fromEntries(
      Object.entries(movement.escapements).map(([id, e]) => [
        id,
        isRecord(e) && isRecord(e.pallets) ? { ...e, pallets: { ...e.pallets, hornFreedom: null } } : e,
      ]),
    );
    return { ...doc, schemaVersion: 16, movement: { ...movement, escapements } };
  },
  /**
   * v16 → v17: balances gain an empty (null) temperature coefficient to
   * fill in — entered directly, never guessed (ASM-0046).
   */
  16: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement) || !isRecord(movement.escapements)) return doc;
    const escapements = Object.fromEntries(
      Object.entries(movement.escapements).map(([id, e]) => [
        id,
        isRecord(e) && isRecord(e.balance) ? { ...e, balance: { ...e.balance, temperatureCoefficient: null } } : e,
      ]),
    );
    return { ...doc, schemaVersion: 17, movement: { ...movement, escapements } };
  },
  /** v17 → v18: movements gain empty `moonPhases` (ASM-0047, Phase 8.1). */
  17: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement)) return doc;
    return { ...doc, schemaVersion: 18, movement: { ...movement, moonPhases: {} } };
  },
  /** v18 → v19: movements gain empty `dateComplications` (ASM-0048, Phase 8.2). */
  18: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement)) return doc;
    return { ...doc, schemaVersion: 19, movement: { ...movement, dateComplications: {} } };
  },
  /** v19 → v20: movements gain empty `monthComplications` (ASM-0049, Phase 8.3). */
  19: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement)) return doc;
    return { ...doc, schemaVersion: 20, movement: { ...movement, monthComplications: {} } };
  },
  /** v20 → v21: movements gain empty `leapYearComplications` (ASM-0050, Phase 8.4). */
  20: (doc) => {
    const movement = doc.movement;
    if (!isRecord(movement)) return doc;
    return { ...doc, schemaVersion: 21, movement: { ...movement, leapYearComplications: {} } };
  },
};

export class DesignFileError extends Error {}

/**
 * JSON has no NaN/Infinity. A user's invalid entry (e.g. an empty tooth
 * count, held as NaN) must survive a save/load round trip rather than
 * silently becoming null or 0, so non-finite numbers are tagged.
 */
const NON_FINITE_TAG = "$nonFinite";

function replacer(_key: string, value: unknown): unknown {
  return typeof value === "number" && !Number.isFinite(value) ? { [NON_FINITE_TAG]: String(value) } : value;
}

function reviver(_key: string, value: unknown): unknown {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const keys = Object.keys(value);
    const tag = (value as Record<string, unknown>)[NON_FINITE_TAG];
    if (keys.length === 1 && (tag === "NaN" || tag === "Infinity" || tag === "-Infinity")) {
      return Number(tag);
    }
  }
  return value;
}

/**
 * True when two designs have the same content (non-finite values
 * included), whatever their object identity.
 */
export function designsEqual(a: Movement, b: Movement): boolean {
  return a === b || JSON.stringify(a, replacer) === JSON.stringify(b, replacer);
}

export function encodeDesign(movement: Movement, savedAt: Date = new Date()): string {
  return JSON.stringify(
    { format: DESIGN_FORMAT, schemaVersion: DESIGN_SCHEMA_VERSION, savedAt: savedAt.toISOString(), movement },
    replacer,
    2,
  );
}

// ---- entity decoders --------------------------------------------------------

const length = number as Decoder<Length>;
const angle = number as Decoder<Angle>;
const id = <T extends string>(): Decoder<T> => string as Decoder<T>;

const vec2: Decoder<Vec2> = (value, path) => {
  const o = object(value, path);
  return { x: field(o, "x", length, path), y: field(o, "y", length, path) };
};

const outline: Decoder<Outline> = (value, path) => {
  const o = object(value, path);
  const kind = field(o, "kind", oneOf(["CIRCLE", "POLYGON"]), path);
  return kind === "CIRCLE"
    ? { kind, centre: field(o, "centre", vec2, path), radius: field(o, "radius", length, path) }
    : { kind, points: field(o, "points", arrayOf(vec2), path) };
};

const frame: Decoder<Frame> = (value, path) => {
  const o = object(value, path);
  return {
    id: field(o, "id", id<Frame["id"]>(), path),
    type: field(o, "type", literal("Frame"), path),
    kind: field(o, "kind", oneOf(["MAINPLATE", "BRIDGE"]), path),
    name: field(o, "name", string, path),
    outline: field(o, "outline", outline, path),
    zBottom: field(o, "zBottom", length, path),
    thickness: field(o, "thickness", length, path),
  };
};

const placement: Decoder<ShaftPlacement> = (value, path) => {
  const o = object(value, path);
  const kind = field(o, "kind", oneOf(["FIXED", "MESH_POLAR", "COAXIAL"]), path);
  switch (kind) {
    case "FIXED":
      return { kind, position: field(o, "position", vec2, path) };
    case "MESH_POLAR":
      return {
        kind,
        referenceShaftId: field(o, "referenceShaftId", id<Shaft["id"]>(), path),
        meshId: field(o, "meshId", id<GearMesh["id"]>(), path),
        angle: field(o, "angle", angle, path),
      };
    case "COAXIAL":
      return { kind, referenceShaftId: field(o, "referenceShaftId", id<Shaft["id"]>(), path) };
  }
};

const support: Decoder<ShaftSupport> = (value, path) => {
  const o = object(value, path);
  const kind = field(o, "kind", oneOf(["PIVOTED", "STUD", "CARRIED"]), path);
  return kind === "STUD" ? { kind, frameId: field(o, "frameId", id<Frame["id"]>(), path) } : { kind };
};

const mainspringSpec: Decoder<MainspringSpec> = (value, path) => {
  const o = object(value, path);
  return {
    usableTurns: field(o, "usableTurns", number, path),
    fullyWoundTorque: field(o, "fullyWoundTorque", number as Decoder<Torque>, path),
    letDownTorque: field(o, "letDownTorque", number as Decoder<Torque>, path),
    trainEfficiency: field(o, "trainEfficiency", nullable(number), path),
  };
};

const coupling: Decoder<Coupling> = (value, path) => {
  const o = object(value, path);
  const base = {
    id: field(o, "id", id<Coupling["id"]>(), path),
    type: field(o, "type", literal("Coupling"), path),
    name: field(o, "name", string, path),
    shaftAId: field(o, "shaftAId", id<Shaft["id"]>(), path),
    shaftBId: field(o, "shaftBId", id<Shaft["id"]>(), path),
  };
  const kind = field(o, "kind", oneOf(["FRICTION_CLUTCH", "MAINSPRING"]), path);
  return kind === "MAINSPRING"
    ? { ...base, kind, spring: field(o, "spring", nullable(mainspringSpec), path) }
    : { ...base, kind };
};

const drive: Decoder<Drive> = (value, path) => {
  const o = object(value, path);
  const kind = field(o, "kind", oneOf(["PRESCRIBED", "NOMINAL_TIME", "BALANCE"]), path);
  return kind === "PRESCRIBED"
    ? {
        kind,
        shaftId: field(o, "shaftId", id<Shaft["id"]>(), path),
        angularVelocity: field(o, "angularVelocity", number as Decoder<AngularVelocity>, path),
      }
    : { kind };
};

const shaft: Decoder<Shaft> = (value, path) => {
  const o = object(value, path);
  const pivots = object(field(o, "pivotDiameter", (v) => v, path), `${path}.pivotDiameter`);
  return {
    id: field(o, "id", id<Shaft["id"]>(), path),
    type: field(o, "type", literal("Shaft"), path),
    name: field(o, "name", string, path),
    placement: field(o, "placement", placement, path),
    support: field(o, "support", support, path),
    hand: field(o, "hand", nullable(oneOf(["HOURS", "MINUTES", "SECONDS"])), path),
    pivotDiameter: {
      LOWER: field(pivots, "LOWER", nullable(length), `${path}.pivotDiameter`),
      UPPER: field(pivots, "UPPER", nullable(length), `${path}.pivotDiameter`),
    },
    shoulderSpan: field(o, "shoulderSpan", nullable(length), path),
  };
};

const gear: Decoder<Gear> = (value, path) => {
  const o = object(value, path);
  return {
    id: field(o, "id", id<Gear["id"]>(), path),
    type: field(o, "type", literal("Gear"), path),
    name: field(o, "name", string, path),
    toothCount: field(o, "toothCount", number, path),
    module: field(o, "module", length, path),
    profileModel: field(
      o,
      "profileModel",
      oneOf(["PITCH_MODEL", "INVOLUTE_PROFILE", "WATCH_SPECIFIC_PROFILE", "MANUFACTURING_VALIDATED_PROFILE"]),
      path,
    ),
    pressureAngle: field(o, "pressureAngle", nullable(angle), path),
    thickness: field(o, "thickness", length, path),
    zCentre: field(o, "zCentre", length, path),
    shaftId: field(o, "shaftId", id<Shaft["id"]>(), path),
  };
};

const gearMesh: Decoder<GearMesh> = (value, path) => {
  const o = object(value, path);
  return {
    id: field(o, "id", id<GearMesh["id"]>(), path),
    type: field(o, "type", literal("GearMesh"), path),
    drivingGearId: field(o, "drivingGearId", id<Gear["id"]>(), path),
    drivenGearId: field(o, "drivenGearId", id<Gear["id"]>(), path),
  };
};

const jewel: Decoder<Jewel> = (value, path) => {
  const o = object(value, path);
  return {
    id: field(o, "id", id<Jewel["id"]>(), path),
    type: field(o, "type", literal("Jewel"), path),
    name: field(o, "name", string, path),
    kind: field(o, "kind", oneOf(["HOLE_JEWEL", "PLAIN_HOLE"]), path),
    frameId: field(o, "frameId", id<Frame["id"]>(), path),
    shaftId: field(o, "shaftId", id<Shaft["id"]>(), path),
    end: field(o, "end", oneOf(["LOWER", "UPPER"]), path),
    boreDiameter: field(o, "boreDiameter", nullable(length), path),
  };
};

const tolerance: Decoder<Tolerance> = (value, path) => {
  const o = object(value, path);
  return {
    id: field(o, "id", id<Tolerance["id"]>(), path),
    type: field(o, "type", literal("Tolerance"), path),
    entityId: field(o, "entityId", id<Tolerance["entityId"]>(), path),
    dimension: field(
      o,
      "dimension",
      oneOf([
        "SHAFT_PIVOT_LOWER",
        "SHAFT_PIVOT_UPPER",
        "SHAFT_SHOULDER_SPAN",
        "JEWEL_BORE",
        "FRAME_Z_BOTTOM",
        "FRAME_THICKNESS",
        "GEAR_MODULE",
        "SHAFT_POSITION_X",
        "SHAFT_POSITION_Y",
      ]),
      path,
    ),
    lowerDeviation: field(o, "lowerDeviation", length, path),
    upperDeviation: field(o, "upperDeviation", length, path),
    distribution: field(o, "distribution", oneOf(["NOT_STATED", "UNIFORM", "NORMAL"]), path),
    source: field(o, "source", nullable(string), path),
    validationScope: field(o, "validationScope", string, path),
  };
};

const stemPinion: Decoder<StemPinion> = (value, path) => {
  const o = object(value, path);
  return { toothCount: field(o, "toothCount", number, path), module: field(o, "module", length, path) };
};

const keylessWorks: Decoder<KeylessWorks> = (value, path) => {
  const o = object(value, path);
  return {
    id: field(o, "id", id<KeylessWorks["id"]>(), path),
    type: field(o, "type", literal("KeylessWorks"), path),
    name: field(o, "name", string, path),
    stemDirection: field(o, "stemDirection", angle, path),
    stemHeight: field(o, "stemHeight", length, path),
    windingPinion: field(o, "windingPinion", stemPinion, path),
    slidingPinion: field(o, "slidingPinion", stemPinion, path),
    crownWheelGearId: field(o, "crownWheelGearId", id<Gear["id"]>(), path),
    settingWheelGearId: field(o, "settingWheelGearId", id<Gear["id"]>(), path),
    ratchetGearId: field(o, "ratchetGearId", id<Gear["id"]>(), path),
  };
};

const dial: Decoder<Dial> = (value, path) => {
  const o = object(value, path);
  return {
    id: field(o, "id", id<Dial["id"]>(), path),
    type: field(o, "type", literal("Dial"), path),
    name: field(o, "name", string, path),
    centreShaftId: field(o, "centreShaftId", id<Shaft["id"]>(), path),
    diameter: field(o, "diameter", length, path),
    thickness: field(o, "thickness", length, path),
    faceHeight: field(o, "faceHeight", length, path),
  };
};

const moonPhase: Decoder<MoonPhase> = (value, path) => {
  const o = object(value, path);
  return {
    id: field(o, "id", id<MoonPhase["id"]>(), path),
    type: field(o, "type", literal("MoonPhase"), path),
    name: field(o, "name", string, path),
    shaftId: field(o, "shaftId", id<Shaft["id"]>(), path),
    diameter: field(o, "diameter", length, path),
    thickness: field(o, "thickness", length, path),
    faceHeight: field(o, "faceHeight", length, path),
    windowCount: field(o, "windowCount", oneOf(["SINGLE", "DOUBLE"]), path),
  };
};

const dateComplication: Decoder<DateComplication> = (value, path) => {
  const o = object(value, path);
  return {
    id: field(o, "id", id<DateComplication["id"]>(), path),
    type: field(o, "type", literal("DateComplication"), path),
    name: field(o, "name", string, path),
    driveShaftId: field(o, "driveShaftId", id<Shaft["id"]>(), path),
    starShaftId: field(o, "starShaftId", id<Shaft["id"]>(), path),
    starToothCount: field(o, "starToothCount", number, path),
    starTipDiameter: field(o, "starTipDiameter", length, path),
    starThickness: field(o, "starThickness", length, path),
    starZCentre: field(o, "starZCentre", length, path),
  };
};

const monthComplication: Decoder<MonthComplication> = (value, path) => {
  const o = object(value, path);
  return {
    id: field(o, "id", id<MonthComplication["id"]>(), path),
    type: field(o, "type", literal("MonthComplication"), path),
    name: field(o, "name", string, path),
    dateComplicationId: field(o, "dateComplicationId", id<DateComplication["id"]>(), path),
    starShaftId: field(o, "starShaftId", id<Shaft["id"]>(), path),
    starTipDiameter: field(o, "starTipDiameter", length, path),
    starThickness: field(o, "starThickness", length, path),
    starZCentre: field(o, "starZCentre", length, path),
  };
};

const leapYearComplication: Decoder<LeapYearComplication> = (value, path) => {
  const o = object(value, path);
  return {
    id: field(o, "id", id<LeapYearComplication["id"]>(), path),
    type: field(o, "type", literal("LeapYearComplication"), path),
    name: field(o, "name", string, path),
    monthComplicationId: field(o, "monthComplicationId", id<MonthComplication["id"]>(), path),
    wheelShaftId: field(o, "wheelShaftId", id<Shaft["id"]>(), path),
    wheelTipDiameter: field(o, "wheelTipDiameter", length, path),
    wheelThickness: field(o, "wheelThickness", length, path),
    wheelZCentre: field(o, "wheelZCentre", length, path),
  };
};

const pallets: Decoder<PalletGeometry> = (value, path) => {
  const o = object(value, path);
  return {
    spanTeeth: field(o, "spanTeeth", number, path),
    kind: field(o, "kind", oneOf(["EQUIDISTANT", "CIRCULAR"]), path),
    lockAngle: field(o, "lockAngle", angle, path),
    drawAngle: field(o, "drawAngle", angle, path),
    runAngle: field(o, "runAngle", angle, path),
    dropAngle: field(o, "dropAngle", angle, path),
    widthAngle: field(o, "widthAngle", angle, path),
    rubyPinEntryFreedom: field(o, "rubyPinEntryFreedom", nullable(angle), path),
    rubyPinSlotShake: field(o, "rubyPinSlotShake", nullable(angle), path),
    guardPointFreedom: field(o, "guardPointFreedom", nullable(angle), path),
    guardPointRadius: field(o, "guardPointRadius", nullable(length), path),
    hornFreedom: field(o, "hornFreedom", nullable(angle), path),
  };
};

const escapement: Decoder<Escapement> = (value, path) => {
  const o = object(value, path);
  const wheel = object(field(o, "escapeWheel", (v) => v, path), `${path}.escapeWheel`);
  const balance = object(field(o, "balance", (v) => v, path), `${path}.balance`);
  const wp = `${path}.escapeWheel`;
  const bp = `${path}.balance`;
  return {
    id: field(o, "id", id<Escapement["id"]>(), path),
    type: field(o, "type", literal("Escapement"), path),
    name: field(o, "name", string, path),
    kind: field(o, "kind", literal("SWISS_LEVER"), path),
    modelLevel: field(o, "modelLevel", literal("SIMPLIFIED_KINEMATIC"), path),
    escapeArborShaftId: field(o, "escapeArborShaftId", id<Shaft["id"]>(), path),
    escapeWheel: {
      toothCount: field(wheel, "toothCount", number, wp),
      toothKind: field(wheel, "toothKind", oneOf(["CLUB", "RATCHET"]), wp),
      tipDiameter: field(wheel, "tipDiameter", length, wp),
      thickness: field(wheel, "thickness", length, wp),
      zCentre: field(wheel, "zCentre", length, wp),
    },
    palletArborShaftId: field(o, "palletArborShaftId", id<Shaft["id"]>(), path),
    leverAngle: field(o, "leverAngle", angle, path),
    balanceShaftId: field(o, "balanceShaftId", id<Shaft["id"]>(), path),
    balance: {
      diameter: field(balance, "diameter", length, bp),
      thickness: field(balance, "thickness", length, bp),
      zCentre: field(balance, "zCentre", length, bp),
      amplitude: field(balance, "amplitude", angle, bp),
      liftAngle: field(balance, "liftAngle", angle, bp),
      inertia: field(balance, "inertia", nullable(number as Decoder<MomentOfInertia>), bp),
      hairspringStiffness: field(balance, "hairspringStiffness", nullable(number as Decoder<TorsionalStiffness>), bp),
      qualityFactor: field(balance, "qualityFactor", nullable(number), bp),
      isochronismCoefficient: field(balance, "isochronismCoefficient", nullable(number), bp),
      impulseRadius: field(balance, "impulseRadius", nullable(length), bp),
      rollerKind: field(balance, "rollerKind", oneOf(["SINGLE", "DOUBLE"]), bp),
      rollerRadius: field(balance, "rollerRadius", nullable(length), bp),
      temperatureCoefficient: field(balance, "temperatureCoefficient", nullable(number), bp),
    },
    pallets: field(o, "pallets", nullable(pallets), path),
    escapementEfficiency: field(o, "escapementEfficiency", nullable(number), path),
  };
};

const movement: Decoder<Movement> = (value, path) => {
  const o = object(value, path);
  return {
    id: field(o, "id", id<Movement["id"]>(), path),
    name: field(o, "name", string, path),
    isTeachingDemo: field(o, "isTeachingDemo", boolean, path),
    declaredValidationLevel: field(o, "declaredValidationLevel", oneOf(VALIDATION_LEVELS), path),
    frames: field(o, "frames", entityRecord(frame), path),
    shafts: field(o, "shafts", entityRecord(shaft), path),
    gears: field(o, "gears", entityRecord(gear), path),
    gearMeshes: field(o, "gearMeshes", entityRecord(gearMesh), path),
    jewels: field(o, "jewels", entityRecord(jewel), path),
    couplings: field(o, "couplings", entityRecord(coupling), path),
    tolerances: field(o, "tolerances", entityRecord(tolerance), path),
    keylessWorks: field(o, "keylessWorks", entityRecord(keylessWorks), path),
    dials: field(o, "dials", entityRecord(dial), path),
    escapements: field(o, "escapements", entityRecord(escapement), path),
    moonPhases: field(o, "moonPhases", entityRecord(moonPhase), path),
    dateComplications: field(o, "dateComplications", entityRecord(dateComplication), path),
    monthComplications: field(o, "monthComplications", entityRecord(monthComplication), path),
    leapYearComplications: field(o, "leapYearComplications", entityRecord(leapYearComplication), path),
    drive: field(o, "drive", nullable(drive), path),
  };
};

/**
 * Parses and checks a saved design. The file's structure is checked
 * exactly; its engineering validity is not. Dangling references or
 * invalid dimensions load as saved and are reported by validation, so
 * a design is never silently repaired on load.
 */
export function decodeDesign(text: string): Movement {
  let raw: unknown;
  try {
    raw = JSON.parse(text, reviver);
  } catch {
    throw new DesignFileError("Not a valid JSON file.");
  }
  try {
    let doc = object(raw, "file");
    if (doc.format !== DESIGN_FORMAT) {
      throw new DesignFileError("Not a Mechanical Watchmaker 3D design file.");
    }
    let version = field(doc, "schemaVersion", number, "file");
    if (!Number.isInteger(version) || version < 1) {
      throw new DesignFileError(`Unrecognised schema version ${String(version)}.`);
    }
    if (version > DESIGN_SCHEMA_VERSION) {
      throw new DesignFileError(
        `This design was saved by a newer version (schema ${String(version)}; this app reads up to ${String(DESIGN_SCHEMA_VERSION)}).`,
      );
    }
    while (version < DESIGN_SCHEMA_VERSION) {
      const migrate = MIGRATIONS[version];
      if (migrate === undefined) throw new DesignFileError(`No migration from schema version ${String(version)}.`);
      doc = migrate(doc);
      version += 1;
    }
    return field(doc, "movement", movement, "file");
  } catch (error) {
    if (error instanceof DecodeError) throw new DesignFileError(`Invalid design file at ${error.message}`);
    throw error;
  }
}
