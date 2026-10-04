import { setNominalTimeDrive } from "@/domain/movement";
import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { degrees } from "@/units/angle";
import { addEscapement, addGear, addGearMesh, updateEscapement, updateShaft, type Movement } from "@/domain/movement";
import { createEscapement } from "@/domain/escapement";
import { createGear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { fixedAt } from "@/domain/shaft";
import { removeEntity } from "@/domain/editing";
import { createTeachingMovement } from "@/app/teachingMovement";
import { validateMovement } from "./validateMovement";

// Nominal-time drive: these tests check exact nominal speeds; the default balance drive is tested separately.
const teaching = setNominalTimeDrive(createTeachingMovement());
const esc = Object.values(teaching.escapements)[0];
if (esc === undefined) throw new Error("teaching movement has no escapement");
const found = (m: Movement, prefix: string): string[] =>
  validateMovement(m).filter((i) => i.rule.startsWith(prefix)).map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);
const edit = (patch: Parameters<typeof updateEscapement>[2]): Movement => updateEscapement(teaching, esc.id, patch);

describe("escapement rules", () => {
  it("the teaching escapement declares its model and derives 18 000 beats per hour, with no errors", () => {
    expect(found(teaching, "ESC")).toEqual(["ESC-107:info:drop-clearance", "ESC-001:info:declared", "ESC-002:info:no-contact-claim"]);
    const declared = validateMovement(teaching).find((i) => i.rule === "ESC-001");
    expect(declared?.message).toContain("SIMPLIFIED ESCAPEMENT MODEL");
    expect(declared?.message).toContain("18000 beats per hour");
    expect(declared?.references).toContain("ASM-0021");
  });

  it("the oscillating arbors are not reported as unpowered (KIN-001)", () => {
    const kin = validateMovement(teaching).filter((i) => i.rule === "KIN-001");
    expect(kin).toEqual([]);
  });

  it("ESC-101: one escapement, three distinct existing arbors, valid inputs", () => {
    expect(found(addEscapement(teaching, createEscapement({ ...esc, name: "Second" })), "ESC-101")).toContain("ESC-101:error:several");
    expect(found(removeEntity(teaching, esc.balanceShaftId).movement, "ESC-101")).toContain("ESC-101:error:missing-arbor");
    expect(found(edit({ palletArborShaftId: esc.balanceShaftId }), "ESC-101")).toContain("ESC-101:error:same-arbor");
    expect(found(edit({ escapeWheel: { ...esc.escapeWheel, toothCount: 0 } }), "ESC-101"))
      .toContain("ESC-101:error:the escape wheel's tooth count must be a positive whole number");
  });

  it("ESC-101: the amplitude must exceed half the lift angle", () => {
    expect(found(edit({ balance: { ...esc.balance, amplitude: degrees(20) } }), "ESC-101")).toContain("ESC-101:error:amplitude-below-lift");
  });

  it("ESC-102: the balance staff must not be gear-driven", () => {
    const gear = createGear({ name: "Wrong wheel", toothCount: 20, module: mm(0.12), thickness: mm(0.2), zCentre: mm(3.2), shaftId: esc.balanceShaftId });
    const fourthWheel = Object.values(teaching.gears).find((g) => g.name === "Fourth wheel");
    if (fourthWheel === undefined) throw new Error("fourth wheel");
    const m = addGearMesh(addGear(teaching, gear), createGearMesh(fourthWheel.id, gear.id));
    expect(found(m, "ESC-102")).toContain("ESC-102:error:geared-balance staff");
  });

  it("ESC-103: the escape wheel must clear the pallet arbor", () => {
    const m = edit({ escapeWheel: { ...esc.escapeWheel, tipDiameter: mm(7) } });
    expect(found(m, "ESC-103")).toContain("ESC-103:error:wheel-pallet-arbor");
  });

  it("ESC-103: the balance rim must clear the pallet arbor", () => {
    expect(found(edit({ balance: { ...esc.balance, diameter: mm(8) } }), "ESC-103")).toContain("ESC-103:error:balance-pallet-arbor");
  });

  it("without a drive to the escape arbor no beat rate is claimed", () => {
    const m = updateShaft({ ...teaching, drive: null }, esc.palletArborShaftId, { placement: fixedAt(mm(8.177), mm(5.35)) });
    const declared = validateMovement(m).find((i) => i.rule === "ESC-001");
    expect(declared?.message).toContain("no beat rate is derived");
  });
});
