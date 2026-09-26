import { describe, expect, it } from "vitest";
import { millimetres } from "@/units/length";
import { setTolerance, updateGear, updateShaft, type Movement } from "@/domain/movement";
import { createTolerance } from "@/domain/tolerance";
import { createDemoMovement } from "@/app/demoMovement";
import { analyzeMovement } from "@/analysis/analyzeMovement";
import { decodeDesign, DESIGN_FORMAT, DESIGN_SCHEMA_VERSION, DesignFileError, encodeDesign } from "./designFile";
import { AUTOSAVE_KEY, loadAutosave, RECOVERY_KEY, writeAutosave, type KeyValueStore } from "./autosave";

const demo = createDemoMovement();
const firstGear = (m: Movement): Movement["gears"][keyof Movement["gears"]] => {
  const g = Object.values(m.gears)[0];
  if (g === undefined) throw new Error("no gear");
  return g;
};

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { Reflect.deleteProperty(data, k); },
  };
}

function rawDoc(movement: Movement = demo): Record<string, unknown> {
  return JSON.parse(encodeDesign(movement)) as Record<string, unknown>;
}

describe("design file", () => {
  it("round-trips the demo exactly", () => {
    expect(decodeDesign(encodeDesign(demo))).toEqual(demo);
  });

  it("round-trips a loaded design to identical analysis", () => {
    const loaded = decodeDesign(encodeDesign(demo));
    expect(analyzeMovement(loaded).issues).toEqual(analyzeMovement(demo).issues);
  });

  it("preserves invalid and unknown user values instead of repairing them", () => {
    let m = updateGear(demo, firstGear(demo).id, { toothCount: Number.NaN, module: millimetres(Number.POSITIVE_INFINITY) });
    const shaft = Object.values(m.shafts)[1];
    if (shaft === undefined) throw new Error("no shaft");
    m = updateShaft(m, shaft.id, { pivotDiameter: { LOWER: millimetres(0.1), UPPER: null } });
    const loaded = decodeDesign(encodeDesign(m));
    expect(firstGear(loaded).toothCount).toBeNaN();
    expect(firstGear(loaded).module).toBe(Number.POSITIVE_INFINITY);
    expect(loaded.shafts[shaft.id]?.pivotDiameter).toEqual({ LOWER: millimetres(0.1), UPPER: null });
  });

  it("records format and schema version", () => {
    const doc = rawDoc();
    expect(doc.format).toBe(DESIGN_FORMAT);
    expect(doc.schemaVersion).toBe(DESIGN_SCHEMA_VERSION);
  });

  it("rejects non-JSON, foreign JSON and newer schema versions with a clear message", () => {
    expect(() => decodeDesign("not json")).toThrow("Not a valid JSON file.");
    expect(() => decodeDesign(JSON.stringify({ hello: 1 }))).toThrow("Not a Mechanical Watchmaker 3D design file.");
    expect(() => decodeDesign(JSON.stringify({ ...rawDoc(), schemaVersion: DESIGN_SCHEMA_VERSION + 1 }))).toThrow(
      /saved by a newer version/,
    );
  });

  it("rejects a structurally broken file and names the path", () => {
    const doc = rawDoc();
    const movement = doc.movement as Record<string, Record<string, Record<string, unknown>>>;
    const gearId = firstGear(demo).id;
    const gears = movement.gears;
    if (gears === undefined) throw new Error("no gears");
    gears[gearId] = { ...gears[gearId], toothCount: "sixty" };
    expect(() => decodeDesign(JSON.stringify(doc))).toThrow(
      new DesignFileError(`Invalid design file at file.movement.gears.${gearId}.toothCount: expected a number`),
    );
  });

  it("rejects an entity stored under a key that isn't its id", () => {
    const doc = rawDoc();
    const movement = doc.movement as Record<string, Record<string, unknown>>;
    const gears = movement.gears;
    if (gears === undefined) throw new Error("no gears");
    const [key, value] = Object.entries(gears)[0] ?? [];
    if (key === undefined) throw new Error("no gear");
    Reflect.deleteProperty(gears, key);
    gears.gear_other = value;
    expect(() => decodeDesign(JSON.stringify(doc))).toThrow(/does not match its key/);
  });

  it("loads dangling references as saved, leaving them to validation (ASSY-001)", () => {
    const doc = rawDoc();
    const movement = doc.movement as Record<string, Record<string, Record<string, unknown>>>;
    const gearId = firstGear(demo).id;
    const gears = movement.gears;
    if (gears === undefined) throw new Error("no gears");
    gears[gearId] = { ...gears[gearId], shaftId: "shaft_missing" };
    const loaded = decodeDesign(JSON.stringify(doc));
    expect(analyzeMovement(loaded).issues.some((i) => i.rule === "ASSY-001")).toBe(true);
  });
});

describe("autosave", () => {
  it("writes and reloads a design", () => {
    const store = memoryStore();
    expect(writeAutosave(store, demo)).toBe(true);
    const result = loadAutosave(store);
    expect(result.status === "LOADED" ? result.movement : null).toEqual(demo);
  });

  it("reports nothing saved as NONE, and handles missing storage", () => {
    expect(loadAutosave(memoryStore()).status).toBe("NONE");
    expect(loadAutosave(null).status).toBe("NONE");
    expect(writeAutosave(null, demo)).toBe(false);
  });

  it("moves an unreadable autosave aside instead of overwriting it", () => {
    const store = memoryStore({ [AUTOSAVE_KEY]: "{broken" });
    const result = loadAutosave(store);
    expect(result.status).toBe("UNREADABLE");
    expect(store.data[RECOVERY_KEY]).toBe("{broken");
    expect(store.data[AUTOSAVE_KEY]).toBeUndefined();
  });

  it("returns false when storage refuses the write", () => {
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => { throw new Error("QuotaExceededError"); },
      removeItem: () => undefined,
    };
    expect(writeAutosave(full, demo)).toBe(false);
  });
});

describe("schema migration v2 → v3", () => {
  it("opens a v2 design with no tolerances", () => {
    const doc = rawDoc() as { movement: Record<string, unknown> };
    const v2 = { ...doc.movement };
    Reflect.deleteProperty(v2, "tolerances");
    Reflect.deleteProperty(v2, "keylessWorks");
    Reflect.deleteProperty(v2, "dials");
    expect(decodeDesign(JSON.stringify({ ...doc, schemaVersion: 2, movement: v2 }))).toEqual(demo);
  });

  it("round-trips a declared tolerance, including an unstated source", () => {
    const shaft = Object.values(demo.shafts)[1];
    if (shaft === undefined) throw new Error("no shaft");
    const m = setTolerance(
      updateShaft(demo, shaft.id, { shoulderSpan: millimetres(3) }),
      createTolerance({ entityId: shaft.id, dimension: "SHAFT_SHOULDER_SPAN", lowerDeviation: millimetres(-0.01), upperDeviation: millimetres(0) }),
    );
    expect(decodeDesign(encodeDesign(m))).toEqual(m);
  });
});

describe("schema migration v1 → v2", () => {
  /** A design exactly as schema 1 saved it: flat drive fields, no supports, hands or couplings. */
  function asV1(movement: Movement): string {
    const doc = JSON.parse(encodeDesign(movement)) as { movement: Record<string, unknown> };
    const v1 = { ...doc.movement };
    const drive = v1.drive as { shaftId: string; angularVelocity: number } | null;
    Reflect.deleteProperty(v1, "drive");
    Reflect.deleteProperty(v1, "couplings");
    Reflect.deleteProperty(v1, "tolerances");
    Reflect.deleteProperty(v1, "keylessWorks");
    Reflect.deleteProperty(v1, "dials");
    v1.shafts = Object.fromEntries(
      Object.entries(v1.shafts as Record<string, Record<string, unknown>>).map(([id, s]) => {
        const v1Shaft = { ...s };
        Reflect.deleteProperty(v1Shaft, "support");
        Reflect.deleteProperty(v1Shaft, "hand");
        return [id, v1Shaft];
      }),
    );
    v1.drivingShaftId = drive === null ? null : drive.shaftId;
    v1.drivingAngularVelocity = drive === null ? 0 : drive.angularVelocity;
    return JSON.stringify({ ...doc, schemaVersion: 1, movement: v1 });
  }

  it("opens a v1 design with a prescribed drive unchanged in meaning", () => {
    // The Phase 2 demo is expressible in v1: pivoted shafts, no hands, no clutches.
    expect(decodeDesign(asV1(demo))).toEqual(demo);
  });

  it("opens a v1 design with no drive", () => {
    const noDrive = { ...demo, drive: null };
    expect(decodeDesign(asV1(noDrive))).toEqual(noDrive);
  });
});
