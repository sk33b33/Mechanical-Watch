import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { addDateComplication, addGear, addGearMesh, addLeapYearComplication, addMonthComplication, addShaft, updateLeapYearComplication, type Movement } from "@/domain/movement";
import { createLeapYearComplication } from "@/domain/leapYearComplication";
import { createMonthComplication } from "@/domain/monthComplication";
import { createDateComplication } from "@/domain/dateComplication";
import { createShaft, fixedAt } from "@/domain/shaft";
import { createGear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { removeEntity } from "@/domain/editing";
import { createTeachingMovement } from "@/app/teachingMovement";
import { validateMovement } from "./validateMovement";

const teaching = createTeachingMovement();
const year = Object.values(teaching.leapYearComplications)[0];
if (year === undefined) throw new Error("teaching movement has no leap-year complication");
const found = (m: Movement, prefix: string): string[] =>
  validateMovement(m).filter((i) => i.rule.startsWith(prefix)).map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);
const edit = (patch: Parameters<typeof updateLeapYearComplication>[2]): Movement => updateLeapYearComplication(teaching, year.id, patch);

describe("leap-year complication rules", () => {
  it("the teaching leap-year complication reports no errors (YEAR-001)", () => {
    expect(found(teaching, "YEAR-001")).toEqual([]);
  });

  it("the leap-year wheel's arbor is not reported as unpowered (KIN-001)", () => {
    expect(validateMovement(teaching).filter((i) => i.rule === "KIN-001")).toEqual([]);
  });

  it("YEAR-001: dimensions must be positive/finite", () => {
    expect(found(edit({ wheelTipDiameter: mm(0) }), "YEAR-001")).toContain("YEAR-001:error:its wheel tip diameter must be a positive length");
    expect(found(edit({ wheelThickness: mm(Number.NaN) }), "YEAR-001")).toContain("YEAR-001:error:its wheel thickness must be a positive length");
    expect(found(edit({ wheelZCentre: mm(Number.NaN) }), "YEAR-001")).toContain("YEAR-001:error:its wheel mid-plane height must be finite");
  });

  it("YEAR-001: the wheel arbor and referenced month complication must exist", () => {
    expect(found(removeEntity(teaching, year.wheelShaftId).movement, "YEAR-001")).toContain("YEAR-001:error:its wheel arbor does not exist");
    expect(found(removeEntity(teaching, year.monthComplicationId).movement, "YEAR-001")).toContain("YEAR-001:error:it does not reference an existing month complication");
  });

  it("YEAR-001: the wheel arbor must be different from the month complication's own star arbor", () => {
    const month = teaching.monthComplications[year.monthComplicationId];
    if (month === undefined) throw new Error("teaching movement's leap-year complication references no month complication");
    expect(found(edit({ wheelShaftId: month.starShaftId }), "YEAR-001")).toContain("YEAR-001:error:its wheel arbor must be different from the month complication's own star arbor");
  });

  it("YEAR-001: several leap-year complications are each checked independently", () => {
    const month = teaching.monthComplications[year.monthComplicationId];
    const date = month === undefined ? undefined : teaching.dateComplications[month.dateComplicationId];
    if (month === undefined || date === undefined) throw new Error("teaching movement's leap-year complication references no month/date complication");
    // Its own date complication, month complication and wheel arbor, distinct from the teaching
    // movement's own — otherwise this would trip the duplicate-reference checks, not stay error-free.
    const secondDate = createDateComplication({ ...date, name: "Second date" });
    const secondMonthArbor = createShaft("Second month star", fixedAt(mm(-20), mm(0)));
    const secondMonth = createMonthComplication({ ...month, name: "Second month", dateComplicationId: secondDate.id, starShaftId: secondMonthArbor.id });
    const secondYearArbor = createShaft("Second leap-year wheel", fixedAt(mm(-20), mm(-5)));
    let m = addDateComplication(teaching, secondDate);
    m = addShaft(m, secondMonthArbor);
    m = addMonthComplication(m, secondMonth);
    m = addShaft(m, secondYearArbor);
    const second = createLeapYearComplication({ ...year, name: "Second leap year", monthComplicationId: secondMonth.id, wheelShaftId: secondYearArbor.id });
    expect(found(addLeapYearComplication(m, second), "YEAR-001")).toEqual([]);
  });

  it("YEAR-001: two leap-year complications referencing the same month complication are each flagged", () => {
    const second = createLeapYearComplication({ ...year, name: "Second leap year" });
    expect(found(addLeapYearComplication(teaching, second), "YEAR-001")).toEqual([
      "YEAR-001:error:another leap-year complication already references this same month complication — only one can be driven by its wrap, so one of them never advances",
      "YEAR-001:error:another leap-year complication already references this same month complication — only one can be driven by its wrap, so one of them never advances",
    ]);
  });

  it("YEAR-001: the wheel arbor must not also be reached by the continuous gear train", () => {
    const strayGear = createGear({ name: "Stray gear", toothCount: 20, module: mm(0.1), thickness: mm(0.1), zCentre: mm(-1.2), shaftId: year.wheelShaftId });
    const driveGear = Object.values(teaching.gears).find((g) => g.name === "24-hour wheel");
    if (driveGear === undefined) throw new Error("teaching movement has no 24-hour wheel");
    let m = addGear(teaching, strayGear);
    m = addGearMesh(m, createGearMesh(driveGear.id, strayGear.id));
    expect(found(m, "YEAR-001")).toContain("YEAR-001:error:wheel-also-geared");
  });

  it("YEAR-002: reports the drive model and reference Geneva-mechanism figures", () => {
    const info = validateMovement(teaching).find((i) => i.rule === "YEAR-002");
    expect(info?.severity).toBe("info");
    expect(info?.message).toContain("December-to-January wrap");
    expect(info?.message).toContain("90");
    expect(info?.message).toContain("0.7071");
    expect(info?.message).toContain("not model leap-year exceptions");
    expect(info?.references).toContain("ASM-0050");
    expect(info?.references).toContain("SRC-0047");
  });
});
