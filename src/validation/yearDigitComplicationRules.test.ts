import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { addGear, addGearMesh, addMonthComplication, addYearDigitComplication, addShaft, updateYearDigitComplication, type Movement } from "@/domain/movement";
import { createYearDigitComplication } from "@/domain/yearDigitComplication";
import { createMonthComplication } from "@/domain/monthComplication";
import { createShaft, fixedAt } from "@/domain/shaft";
import { createGear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { removeEntity } from "@/domain/editing";
import { createTeachingMovement } from "@/app/teachingMovement";
import { validateMovement } from "./validateMovement";

const teaching = createTeachingMovement();
const ones = Object.values(teaching.yearDigitComplications).find((d) => d.digitPlace === "ONES");
if (ones === undefined) throw new Error("teaching movement has no year-ones digit complication");
const found = (m: Movement, prefix: string): string[] =>
  validateMovement(m).filter((i) => i.rule.startsWith(prefix)).map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);
const edit = (patch: Parameters<typeof updateYearDigitComplication>[2]): Movement => updateYearDigitComplication(teaching, ones.id, patch);

describe("year-digit complication rules", () => {
  it("the teaching movement's four digit complications report no errors (YEARDIGIT-001)", () => {
    expect(found(teaching, "YEARDIGIT-001")).toEqual([]);
  });

  it("none of the four digit wheels' arbors are reported as unpowered (KIN-001)", () => {
    expect(validateMovement(teaching).filter((i) => i.rule === "KIN-001")).toEqual([]);
  });

  it("YEARDIGIT-001: dimensions must be positive/finite", () => {
    expect(found(edit({ wheelTipDiameter: mm(0) }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its wheel tip diameter must be a positive length");
    expect(found(edit({ wheelThickness: mm(Number.NaN) }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its wheel thickness must be a positive length");
    expect(found(edit({ wheelZCentre: mm(Number.NaN) }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its wheel mid-plane height must be finite");
  });

  it("YEARDIGIT-001: the starting digit must be a whole number from 0 to 9", () => {
    expect(found(edit({ startDigit: Number.NaN }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its starting digit must be a whole number from 0 to 9");
    expect(found(edit({ startDigit: 10 }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its starting digit must be a whole number from 0 to 9");
    expect(found(edit({ startDigit: -1 }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its starting digit must be a whole number from 0 to 9");
    expect(found(edit({ startDigit: 3.5 }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its starting digit must be a whole number from 0 to 9");
  });

  it("YEARDIGIT-001: the wheel arbor and referenced month complication must exist", () => {
    expect(found(removeEntity(teaching, ones.wheelShaftId).movement, "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its wheel arbor does not exist");
    expect(found(removeEntity(teaching, ones.monthComplicationId).movement, "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:it does not reference an existing month complication");
  });

  it("YEARDIGIT-001: the wheel arbor must be different from the month complication's own star arbor", () => {
    const month = teaching.monthComplications[ones.monthComplicationId];
    if (month === undefined) throw new Error("teaching movement's year-ones complication references no month complication");
    expect(found(edit({ wheelShaftId: month.starShaftId }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its wheel arbor must be different from the month complication's own star arbor");
  });

  it("YEARDIGIT-001: two wheels sharing the same digit place on the same month complication are each flagged", () => {
    const second = createYearDigitComplication({ ...ones, name: "Second ones" });
    expect(found(addYearDigitComplication(teaching, second), "YEARDIGIT-001")).toEqual([
      "YEARDIGIT-001:error:another year-digit complication already uses this same digit place on this same month complication — only one can be driven by its jumps, so one of them never advances",
      "YEARDIGIT-001:error:another year-digit complication already uses this same digit place on this same month complication — only one can be driven by its jumps, so one of them never advances",
    ]);
  });

  it("YEARDIGIT-001: several year-digit complications are each checked independently when fully distinct", () => {
    const month = teaching.monthComplications[ones.monthComplicationId];
    if (month === undefined) throw new Error("teaching movement's year-ones complication references no month complication");
    const secondMonthArbor = createShaft("Second month star", fixedAt(mm(-20), mm(0)));
    const secondMonth = createMonthComplication({ ...month, name: "Second month", starShaftId: secondMonthArbor.id });
    const secondOnesArbor = createShaft("Second ones wheel", fixedAt(mm(-20), mm(-5)));
    let m = addShaft(teaching, secondMonthArbor);
    m = addMonthComplication(m, secondMonth);
    m = addShaft(m, secondOnesArbor);
    const second = createYearDigitComplication({ ...ones, name: "Second ones", monthComplicationId: secondMonth.id, wheelShaftId: secondOnesArbor.id });
    expect(found(addYearDigitComplication(m, second), "YEARDIGIT-001")).toEqual([]);
  });

  it("YEARDIGIT-001: a gap below the declared digit place is reported as a carry-stopping warning", () => {
    // The teaching movement's tens wheel sits directly above ones with no gap; remove ones so
    // tens has nothing below it.
    const month = teaching.monthComplications[ones.monthComplicationId];
    const tens = month === undefined ? undefined : Object.values(teaching.yearDigitComplications).find((d) => d.digitPlace === "TENS" && d.monthComplicationId === month.id);
    if (tens === undefined) throw new Error("teaching movement has no year-tens digit complication");
    const m = removeEntity(teaching, ones.id).movement;
    const warning = validateMovement(m).find((i) => i.rule === "YEARDIGIT-001" && i.id.startsWith("YEARDIGIT-001:carry-gap:") && i.entityIds.includes(tens.id));
    expect(warning?.severity).toBe("warning");
    expect(warning?.message).toContain("ones");
    expect(warning?.message).toContain("digitsToAdvance");
  });

  it("YEARDIGIT-001: the wheel arbor must not also be reached by the continuous gear train", () => {
    const strayGear = createGear({ name: "Stray gear", toothCount: 20, module: mm(0.1), thickness: mm(0.1), zCentre: mm(-1.2), shaftId: ones.wheelShaftId });
    const driveGear = Object.values(teaching.gears).find((g) => g.name === "24-hour wheel");
    if (driveGear === undefined) throw new Error("teaching movement has no 24-hour wheel");
    let m = addGear(teaching, strayGear);
    m = addGearMesh(m, createGearMesh(driveGear.id, strayGear.id));
    expect(found(m, "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:wheel-also-geared");
  });

  it("YEARDIGIT-002: each of the four digit wheels reports its own drive model", () => {
    const infos = validateMovement(teaching).filter((i) => i.rule === "YEARDIGIT-002");
    expect(infos).toHaveLength(4);
    for (const info of infos) {
      expect(info.severity).toBe("info");
      expect(info.message).toContain("December-to-January wrap");
      expect(info.message).toContain("decimal carry");
      expect(info.message).toContain("No sourced real wristwatch mechanism");
      expect(info.references).toContain("ASM-0059");
    }
  });
});
