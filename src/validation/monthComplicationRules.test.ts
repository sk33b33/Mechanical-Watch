import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { addGear, addGearMesh, addMonthComplication, updateMonthComplication, type Movement } from "@/domain/movement";
import { createMonthComplication } from "@/domain/monthComplication";
import { createGear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { removeEntity } from "@/domain/editing";
import { createTeachingMovement } from "@/app/teachingMovement";
import { validateMovement } from "./validateMovement";

const teaching = createTeachingMovement();
const month = Object.values(teaching.monthComplications)[0];
if (month === undefined) throw new Error("teaching movement has no month complication");
const found = (m: Movement, prefix: string): string[] =>
  validateMovement(m).filter((i) => i.rule.startsWith(prefix)).map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);
const edit = (patch: Parameters<typeof updateMonthComplication>[2]): Movement => updateMonthComplication(teaching, month.id, patch);

describe("month complication rules", () => {
  it("the teaching month complication reports no errors (MONTH-001)", () => {
    expect(found(teaching, "MONTH-001")).toEqual([]);
  });

  it("the month star's arbor is not reported as unpowered (KIN-001)", () => {
    expect(validateMovement(teaching).filter((i) => i.rule === "KIN-001")).toEqual([]);
  });

  it("MONTH-001: dimensions must be positive/finite", () => {
    expect(found(edit({ starTipDiameter: mm(0) }), "MONTH-001")).toContain("MONTH-001:error:its star tip diameter must be a positive length");
    expect(found(edit({ starThickness: mm(Number.NaN) }), "MONTH-001")).toContain("MONTH-001:error:its star thickness must be a positive length");
    expect(found(edit({ starZCentre: mm(Number.NaN) }), "MONTH-001")).toContain("MONTH-001:error:its star mid-plane height must be finite");
  });

  it("MONTH-001: the star arbor and referenced date complication must exist", () => {
    expect(found(removeEntity(teaching, month.starShaftId).movement, "MONTH-001")).toContain("MONTH-001:error:its star arbor does not exist");
    expect(found(removeEntity(teaching, month.dateComplicationId).movement, "MONTH-001")).toContain("MONTH-001:error:it does not reference an existing date complication");
  });

  it("MONTH-001: the star arbor must be different from the date complication's own star arbor", () => {
    const date = teaching.dateComplications[month.dateComplicationId];
    if (date === undefined) throw new Error("teaching movement's month complication references no date complication");
    expect(found(edit({ starShaftId: date.starShaftId }), "MONTH-001")).toContain("MONTH-001:error:its star arbor must be different from the date complication's own star arbor");
  });

  it("MONTH-001: several month complications are each checked independently", () => {
    const second = createMonthComplication({ ...month, name: "Second month" });
    expect(found(addMonthComplication(teaching, second), "MONTH-001")).toEqual([]);
  });

  it("MONTH-001: the star arbor must not also be reached by the continuous gear train", () => {
    const strayGear = createGear({ name: "Stray gear", toothCount: 20, module: mm(0.1), thickness: mm(0.1), zCentre: mm(-1.2), shaftId: month.starShaftId });
    const driveGear = Object.values(teaching.gears).find((g) => g.name === "24-hour wheel");
    if (driveGear === undefined) throw new Error("teaching movement has no 24-hour wheel");
    let m = addGear(teaching, strayGear);
    m = addGearMesh(m, createGearMesh(driveGear.id, strayGear.id));
    expect(found(m, "MONTH-001")).toContain("MONTH-001:error:star-also-geared");
  });

  it("MONTH-002: reports the correction schedule, naming every month shorter than 31 days", () => {
    const info = validateMovement(teaching).find((i) => i.rule === "MONTH-002");
    expect(info?.severity).toBe("info");
    expect(info?.message).toContain("February (28 days, +3)");
    expect(info?.message).toContain("April (30 days, +1)");
    expect(info?.message).toContain("leap years are not modeled");
    expect(info?.references).toContain("ASM-0049");
  });
});
