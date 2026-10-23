import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { addDateComplication, addGear, addGearMesh, updateDateComplication, type Movement } from "@/domain/movement";
import { createDateComplication } from "@/domain/dateComplication";
import { createGear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { removeEntity } from "@/domain/editing";
import { createTeachingMovement } from "@/app/teachingMovement";
import { discComplicationLabel, findDiscComplication } from "@/domain/discComplication";
import { validateMovement } from "./validateMovement";

const teaching = createTeachingMovement();
const date = Object.values(teaching.dateComplications)[0];
if (date === undefined) throw new Error("teaching movement has no date complication");
const found = (m: Movement, prefix: string): string[] =>
  validateMovement(m).filter((i) => i.rule.startsWith(prefix)).map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);
const edit = (patch: Parameters<typeof updateDateComplication>[2]): Movement => updateDateComplication(teaching, date.id, patch);

describe("date complication rules", () => {
  it("the teaching date complication reports no errors, and a ~24-hour drive period (DATE-003)", () => {
    expect(found(teaching, "DATE-001")).toEqual([]);
    expect(found(teaching, "DATE-002")).toEqual([]);
    const info = validateMovement(teaching).find((i) => i.rule === "DATE-003");
    expect(info?.severity).toBe("info");
    expect(info?.message).toContain("the drive arbor implies a jump every");
    expect(info?.message).toContain("versus one day (24 h)");
    expect(info?.references).toContain("SRC-0042");
  });

  it("the date star's arbor is not reported as unpowered (KIN-001)", () => {
    expect(validateMovement(teaching).filter((i) => i.rule === "KIN-001")).toEqual([]);
  });

  it("DATE-001: dimensions must be positive/finite and the tooth count a positive integer", () => {
    expect(found(edit({ starTipDiameter: mm(0) }), "DATE-001")).toContain("DATE-001:error:its star tip diameter must be a positive length");
    expect(found(edit({ starThickness: mm(Number.NaN) }), "DATE-001")).toContain("DATE-001:error:its star thickness must be a positive length");
    expect(found(edit({ starZCentre: mm(Number.NaN) }), "DATE-001")).toContain("DATE-001:error:its star mid-plane height must be finite");
    expect(found(edit({ starToothCount: 0 }), "DATE-001")).toContain("DATE-001:error:its star tooth count must be a positive integer");
    expect(found(edit({ starToothCount: 1.5 }), "DATE-001")).toContain("DATE-001:error:its star tooth count must be a positive integer");
  });

  it("DATE-001: the drive and star arbors must exist and be distinct", () => {
    expect(found(removeEntity(teaching, date.driveShaftId).movement, "DATE-001")).toContain("DATE-001:error:its drive arbor does not exist");
    expect(found(removeEntity(teaching, date.starShaftId).movement, "DATE-001")).toContain("DATE-001:error:its star arbor does not exist");
    expect(found(edit({ starShaftId: date.driveShaftId }), "DATE-001")).toContain("DATE-001:error:its drive and star arbors must be different");
  });

  it("DATE-001: several date complications are each checked independently", () => {
    const second = createDateComplication({ ...date, name: "Second date" });
    expect(found(addDateComplication(teaching, second), "DATE-001")).toEqual([]);
  });

  it("DATE-002: the star arbor must not also be reached by the continuous gear train", () => {
    const strayGear = createGear({ name: "Stray gear", toothCount: 20, module: mm(0.1), thickness: mm(0.1), zCentre: mm(-1.2), shaftId: date.starShaftId });
    const driveGear = Object.values(teaching.gears).find((g) => g.name === "24-hour wheel");
    if (driveGear === undefined) throw new Error("teaching movement has no 24-hour wheel");
    let m = addGear(teaching, strayGear);
    m = addGearMesh(m, createGearMesh(driveGear.id, strayGear.id));
    expect(found(m, "DATE-002")).toContain("DATE-002:error:star-also-geared");
  });

  it("DATE-003: an undriven date complication reports no implied period", () => {
    const info = validateMovement({ ...teaching, drive: null }).find((i) => i.rule === "DATE-003");
    expect(info?.message).toBe(`${date.name}: not driven, so no jump period is implied.`);
  });

  it("DATE-004: a day-of-week star needs exactly seven teeth, a day-of-month star is not constrained", () => {
    const weekday = Object.values(teaching.dateComplications).find((d) => d.display === "DAY_OF_WEEK");
    if (weekday === undefined) throw new Error("teaching movement has no day-of-week star");
    expect(found(teaching, "DATE-004")).toEqual([]);
    const six = updateDateComplication(teaching, weekday.id, { starToothCount: 6 });
    expect(found(six, "DATE-004")).toEqual([`DATE-004:error:weekday-tooth-count`]);
    const asMonthDay = updateDateComplication(six, weekday.id, { display: "DAY_OF_MONTH" });
    expect(found(asMonthDay, "DATE-004")).toEqual([]);
  });

  it("the day-of-week star reads full weekday names and labels its positions MON..SUN (ASM-0081)", () => {
    const weekday = Object.values(teaching.dateComplications).find((d) => d.display === "DAY_OF_WEEK");
    if (weekday === undefined) throw new Error("teaching movement has no day-of-week star");
    expect(findDiscComplication(teaching, weekday.id)?.positionLabels).toEqual(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
    expect(discComplicationLabel(teaching, { shaftAngle: {}, yearDigitAngle: {} }, weekday.id)).toBe("Monday");
  });
});
