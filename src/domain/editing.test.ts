import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { degrees } from "@/units/angle";
import { rpmToRadPerSecond } from "@/units/angularVelocity";
import { vec2 } from "@/math/vec2";
import { analyzeMovement } from "@/analysis/analyzeMovement";
import { decodeDesign, encodeDesign } from "@/persistence/designFile";
import { createDemoMovement } from "@/app/demoMovement";
import {
  addFrame,
  addGear,
  addGearMesh,
  addJewel,
  addShaft,
  setPrescribedDrive,
  updateFrame,
  updateGear,
  updateShaft,
  type Movement,
} from "./movement";
import {
  createEmptyMovement,
  newFrame,
  newGear,
  newGearMesh,
  newJewel,
  newShaft,
  nextName,
  removeEntity,
} from "./editing";

const rulesOf = (m: Movement): string[] => analyzeMovement(m).issues.filter((i) => i.severity === "error").map((i) => i.rule);

describe("creating parts", () => {
  it("an empty movement has no parts and no errors", () => {
    const m = createEmptyMovement();
    expect(m.isTeachingDemo).toBe(false);
    expect(rulesOf(m)).toEqual([]);
  });

  it("new parts start empty and validation names what is missing, without crashing", () => {
    let m = createEmptyMovement();
    const plate = newFrame(m, "MAINPLATE");
    m = addFrame(m, plate);
    const arbor = newShaft(m);
    m = addShaft(m, arbor);
    const gear = newGear(m, arbor.id);
    m = addGear(m, gear);
    m = addJewel(m, newJewel(m, arbor.id, "LOWER", plate.id));

    expect(gear.toothCount).toBeNaN();
    expect(gear.module).toBeNaN();
    expect(new Set(rulesOf(m))).toEqual(
      new Set(["FRAME-001", "SHAFT-001", "GEAR-001", "GEAR-002", "GEAR-102", "BRG-001"]),
    );
    // Empty (NaN) values survive a save/load round trip unchanged.
    expect(decodeDesign(encodeDesign(m))).toEqual(m);
  });

  it("can build a valid two-arbor train from nothing", () => {
    let m = createEmptyMovement("From scratch");
    const plate = newFrame(m, "MAINPLATE");
    m = addFrame(m, plate);
    m = updateFrame(m, plate.id, {
      outline: { kind: "CIRCLE", centre: vec2(mm(0), mm(0)), radius: mm(10) },
      zBottom: mm(0),
      thickness: mm(1),
    });
    const bridge = newFrame(m, "BRIDGE");
    m = addFrame(m, bridge);
    m = updateFrame(m, bridge.id, {
      outline: { kind: "POLYGON", points: [vec2(mm(-4), mm(-4)), vec2(mm(8), mm(-4)), vec2(mm(8), mm(4)), vec2(mm(-4), mm(4))] },
      zBottom: mm(3),
      thickness: mm(0.8),
    });

    const a = newShaft(m);
    m = addShaft(m, a);
    m = updateShaft(m, a.id, { placement: { kind: "FIXED", position: vec2(mm(0), mm(0)) } });
    const b = newShaft(m);
    m = addShaft(m, b);
    expect(b.name).toBe("Arbor 2");

    const wheel = newGear(m, a.id);
    m = addGear(m, wheel);
    m = updateGear(m, wheel.id, { toothCount: 40, module: mm(0.15), thickness: mm(0.2), zCentre: mm(1.5) });
    const pinion = newGear(m, b.id);
    m = addGear(m, pinion);
    m = updateGear(m, pinion.id, { toothCount: 8, module: mm(0.15), thickness: mm(0.4), zCentre: mm(1.5) });
    const mesh = newGearMesh(wheel.id, pinion.id);
    m = addGearMesh(m, mesh);
    m = updateShaft(m, b.id, { placement: { kind: "MESH_POLAR", referenceShaftId: a.id, meshId: mesh.id, angle: degrees(0) } });

    for (const shaft of [a, b]) {
      m = addJewel(m, newJewel(m, shaft.id, "LOWER", plate.id));
      m = addJewel(m, newJewel(m, shaft.id, "UPPER", bridge.id));
    }
    m = setPrescribedDrive(m, a.id, rpmToRadPerSecond(1));

    expect(rulesOf(m)).toEqual([]);
    expect(analyzeMovement(m).train.shaftAngularVelocity.size).toBe(2);
  });

  it("names new parts without reusing a name", () => {
    expect(nextName([{ name: "Arbor 1" }, { name: "Arbor 3" }], "Arbor")).toBe("Arbor 2");
  });
});

describe("removing parts", () => {
  const demo = createDemoMovement();
  const byName = <T extends { name: string }>(r: Record<string, T>, name: string): T => {
    const e = Object.values(r).find((x) => x.name === name);
    if (e === undefined) throw new Error(name);
    return e;
  };

  it("removing an arbor removes its gears, their meshes and its bearings, and clears the drive", () => {
    const arborA = byName(demo.shafts, "Arbor A");
    const { movement, removedIds } = removeEntity(demo, arborA.id);
    expect(movement.shafts[arborA.id]).toBeUndefined();
    expect(Object.values(movement.gears).map((g) => g.name)).not.toContain("Wheel A");
    expect(Object.keys(movement.gearMeshes)).toHaveLength(1);
    expect(Object.values(movement.jewels).some((j) => j.shaftId === arborA.id)).toBe(false);
    expect(movement.drive).toBeNull();
    expect(removedIds).toHaveLength(1 + 1 + 1 + 2);
  });

  it("leaves other shafts' constraints dangling and reports them, rather than silently re-placing", () => {
    const arborA = byName(demo.shafts, "Arbor A");
    const { movement } = removeEntity(demo, arborA.id);
    const arborB = byName(movement.shafts, "Arbor B");
    expect(arborB.placement.kind).toBe("MESH_POLAR");
    const issues = analyzeMovement(movement).issues;
    expect(issues.some((i) => i.rule === "ASSY-001" && i.entityIds.includes(arborB.id))).toBe(true);
  });

  it("removing a gear removes only its meshes", () => {
    const wheelB = byName(demo.gears, "Wheel B");
    const { movement } = removeEntity(demo, wheelB.id);
    expect(Object.keys(movement.gearMeshes)).toHaveLength(1);
    expect(Object.keys(movement.shafts)).toHaveLength(3);
  });

  it("removing a frame removes the bearings seated in it; the shafts become unsupported (BRG-001)", () => {
    const bridge = byName(demo.frames, "Train bridge");
    const { movement } = removeEntity(demo, bridge.id);
    expect(Object.values(movement.jewels).every((j) => j.frameId !== bridge.id)).toBe(true);
    expect(rulesOf(movement)).toContain("BRG-001");
  });

  it("removing an unknown id changes nothing", () => {
    expect(removeEntity(demo, "gear_nope" as never).movement).toEqual(demo);
  });
});
