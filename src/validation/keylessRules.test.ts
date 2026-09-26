import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { degrees } from "@/units/angle";
import { addDial, addGearMesh, addKeylessWorks, updateDial, updateGear, updateKeylessWorks, type Movement } from "@/domain/movement";
import { createGearMesh } from "@/domain/gearMesh";
import { createKeylessWorks } from "@/domain/keyless";
import { createDial } from "@/domain/dial";
import { removeEntity } from "@/domain/editing";
import { createTeachingMovement } from "@/app/teachingMovement";
import { validateMovement } from "./validateMovement";

const teaching = createTeachingMovement();
const keyless = Object.values(teaching.keylessWorks)[0];
const dial = Object.values(teaching.dials)[0];
if (keyless === undefined || dial === undefined) throw new Error("teaching movement lacks keyless works or dial");
const byName = <T extends { name: string }>(items: Record<string, T>, name: string): T => {
  const found = Object.values(items).find((i) => i.name === name);
  if (found === undefined) throw new Error(name);
  return found;
};
const found = (m: Movement, prefix: string): string[] =>
  validateMovement(m).filter((i) => i.rule.startsWith(prefix)).map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);
const editKeyless = (patch: Parameters<typeof updateKeylessWorks>[2]): Movement => updateKeylessWorks(teaching, keyless.id, patch);

describe("keyless works rules", () => {
  it("the teaching movement's keyless works and dial validate cleanly", () => {
    expect(found(teaching, "KEY")).toEqual([]);
    expect(found(teaching, "DIAL")).toEqual([]);
  });

  it("KEY-001: one keyless works, existing and distinct wheels, valid stem pinions", () => {
    expect(found(addKeylessWorks(teaching, createKeylessWorks({ ...keyless, name: "Second" })), "KEY-001")).toContain("KEY-001:error:several");
    const noSettingWheel = removeEntity(teaching, keyless.settingWheelGearId).movement;
    expect(found(noSettingWheel, "KEY-001")).toContain("KEY-001:error:missing-wheel");
    expect(found(editKeyless({ windingPinion: { ...keyless.windingPinion, toothCount: 11.5 } }), "KEY-001")).toContain("KEY-001:error:teeth-winding pinion");
    expect(found(editKeyless({ settingWheelGearId: keyless.crownWheelGearId }), "KEY-001")).toContain("KEY-001:error:same-wheel");
  });

  it("KEY-002: modules must match", () => {
    expect(found(editKeyless({ windingPinion: { ...keyless.windingPinion, module: mm(0.12) } }), "KEY-002"))
      .toContain("KEY-002:error:module-winding pinion");
  });

  it("KEY-002: a stem turned off the setting wheel's axis cannot engage it", () => {
    const issues = found(editKeyless({ stemDirection: degrees(170) }), "KEY-002");
    expect(issues).toContain("KEY-002:error:offset-sliding pinion");
    expect(issues).not.toContain("KEY-002:error:offset-winding pinion"); // the stem passes over the crown wheel by construction
  });

  it("KEY-002: the stem must be one pitch radius from each wheel, and never level with it", () => {
    const issues = found(editKeyless({ stemHeight: mm(0.5) }), "KEY-002");
    expect(issues).toContain("KEY-002:error:height-winding pinion");
    expect(issues).toContain("KEY-002:error:height-sliding pinion");
    expect(found(editKeyless({ stemHeight: mm(-0.2) }), "KEY-002")).toContain("KEY-002:error:level-winding pinion");
  });

  it("KEY-003: winding needs a mainspring, a connected ratchet, and a ratchet the train does not turn", () => {
    const spring = Object.values(teaching.couplings).find((c) => c.kind === "MAINSPRING");
    if (spring === undefined) throw new Error("no mainspring");
    expect(found(removeEntity(teaching, spring.id).movement, "KEY-003")).toEqual(["KEY-003:warning:NO_MAINSPRING"]);
    const crownMesh = Object.values(teaching.gearMeshes).find((g) => g.drivingGearId === keyless.crownWheelGearId);
    if (crownMesh === undefined) throw new Error("no crown-wheel mesh");
    expect(found(removeEntity(teaching, crownMesh.id).movement, "KEY-003")).toEqual(["KEY-003:error:RATCHET_NOT_CONNECTED"]);
    const driven = addGearMesh(teaching, createGearMesh(byName(teaching.gears, "Cannon pinion").id, keyless.ratchetGearId));
    expect(found(driven, "KEY-003")).toContain("KEY-003:error:click-blocks-train");
  });

  it("KEY-004: the crown must reach the hands", () => {
    const settingMesh = Object.values(teaching.gearMeshes).find((g) => g.drivingGearId === keyless.settingWheelGearId);
    if (settingMesh === undefined) throw new Error("no setting mesh");
    expect(found(removeEntity(teaching, settingMesh.id).movement, "KEY-004")).toEqual(["KEY-004:error:not-connected"]);
  });

  it("CPL-001 applies to a mainspring between arbors that are not coaxial", () => {
    const arbor = byName(teaching.shafts, "Barrel arbor");
    const m = { ...teaching, shafts: { ...teaching.shafts, [arbor.id]: { ...arbor, placement: { kind: "FIXED" as const, position: { x: mm(0), y: mm(5) } } } } };
    const cpl = validateMovement(m).filter((i) => i.rule === "CPL-001");
    expect(cpl.some((i) => i.message.includes("mainspring"))).toBe(true);
  });
});

describe("dial rules", () => {
  const editDial = (patch: Parameters<typeof updateDial>[2]): Movement => updateDial(teaching, dial.id, patch);

  it("DIAL-001: one dial with valid dimensions on an existing arbor", () => {
    expect(found(addDial(teaching, createDial({ ...dial, name: "Second dial" })), "DIAL-001")).toContain("DIAL-001:error:several");
    expect(found(editDial({ diameter: mm(Number.NaN) }), "DIAL-001")).toContain("DIAL-001:error:its diameter must be a positive length");
  });

  it("DIAL-002: nothing it covers may be inside it or on its face side", () => {
    // Face at −1.0: the dial (−1.0…−0.6) overlaps the hour wheel and motion works.
    const inside = found(editDial({ faceHeight: mm(-1.0) }), "DIAL-002");
    expect(inside.length).toBeGreaterThan(0);
    // Above the whole movement: everything it covers is on its face side.
    const above = validateMovement(editDial({ faceHeight: mm(6) })).filter((i) => i.rule === "DIAL-002");
    expect(above.some((i) => i.message.includes("on the face side of"))).toBe(true);
  });

  it("DIAL-003: every hand must be over the dial", () => {
    // A 2 mm dial on the centre arbor leaves the seconds hand's arbor outside it.
    expect(found(editDial({ diameter: mm(2) }), "DIAL-003")).toContain("DIAL-003:error:hand-off-dial");
  });

  it("changing a wheel so it hangs through the dial is caught", () => {
    const m = updateGear(teaching, byName(teaching.gears, "Hour wheel").id, { zCentre: mm(-1.6) });
    expect(found(m, "DIAL-002")).toContain("DIAL-002:error:gear");
  });
});
