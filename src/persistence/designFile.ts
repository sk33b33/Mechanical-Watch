import type { Movement } from "@/domain/movement";
import type { Frame, Outline } from "@/domain/frame";
import type { Shaft, ShaftPlacement } from "@/domain/shaft";
import type { Gear } from "@/domain/gear";
import type { GearMesh } from "@/domain/gearMesh";
import type { Jewel } from "@/domain/jewel";
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
export const DESIGN_SCHEMA_VERSION = 1;

/** MIGRATIONS[n] upgrades a raw version-n document to version n+1. */
const MIGRATIONS: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {};

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
  const kind = field(o, "kind", oneOf(["FIXED", "MESH_POLAR"]), path);
  return kind === "FIXED"
    ? { kind, position: field(o, "position", vec2, path) }
    : {
        kind,
        referenceShaftId: field(o, "referenceShaftId", id<Shaft["id"]>(), path),
        meshId: field(o, "meshId", id<GearMesh["id"]>(), path),
        angle: field(o, "angle", angle, path),
      };
};

const shaft: Decoder<Shaft> = (value, path) => {
  const o = object(value, path);
  const pivots = object(field(o, "pivotDiameter", (v) => v, path), `${path}.pivotDiameter`);
  return {
    id: field(o, "id", id<Shaft["id"]>(), path),
    type: field(o, "type", literal("Shaft"), path),
    name: field(o, "name", string, path),
    placement: field(o, "placement", placement, path),
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
    drivingShaftId: field(o, "drivingShaftId", nullable(id<Shaft["id"]>()), path),
    drivingAngularVelocity: field(o, "drivingAngularVelocity", number as Decoder<AngularVelocity>, path),
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
