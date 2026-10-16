import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { radians } from "@/units/angle";
import { vec2 } from "@/math/vec2";
import { addMonthComplication, addYearDigitComplication, addShaft, updateYearDigitComplication, type Movement } from "@/domain/movement";
import { createYearDigitComplication } from "@/domain/yearDigitComplication";
import { createMonthComplication } from "@/domain/monthComplication";
import { createShaft, fixedAt } from "@/domain/shaft";
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
  it("the teaching movement's four digit segments report no errors (YEARDIGIT-001)", () => {
    expect(found(teaching, "YEARDIGIT-001")).toEqual([]);
  });

  it("the teaching movement reports no unpowered-shaft issues (KIN-001) — year-digit segments are not shafts at all", () => {
    expect(validateMovement(teaching).filter((i) => i.rule === "KIN-001")).toEqual([]);
  });

  it("YEARDIGIT-001: dimensions must be positive/finite", () => {
    expect(found(edit({ barrelDiameter: mm(0) }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its barrel diameter must be a positive length");
    expect(found(edit({ segmentLength: mm(Number.NaN) }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its segment length must be a positive length");
    expect(found(edit({ axleHeight: mm(Number.NaN) }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its axle height must be finite");
    expect(found(edit({ axleOrigin: vec2(mm(Number.NaN), mm(0)) }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its axle origin must be a finite point");
    expect(found(edit({ axleDirection: radians(Number.NaN) }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its axle direction must be finite");
  });

  it("YEARDIGIT-001: the starting digit must be a whole number from 0 to 9", () => {
    expect(found(edit({ startDigit: Number.NaN }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its starting digit must be a whole number from 0 to 9");
    expect(found(edit({ startDigit: 10 }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its starting digit must be a whole number from 0 to 9");
    expect(found(edit({ startDigit: -1 }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its starting digit must be a whole number from 0 to 9");
    expect(found(edit({ startDigit: 3.5 }), "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:its starting digit must be a whole number from 0 to 9");
  });

  it("YEARDIGIT-001: the referenced month complication must exist", () => {
    expect(found(removeEntity(teaching, ones.monthComplicationId).movement, "YEARDIGIT-001")).toContain("YEARDIGIT-001:error:it does not reference an existing month complication");
  });

  it("YEARDIGIT-001: two segments sharing the same digit place on the same month complication are each flagged", () => {
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
    let m = addShaft(teaching, secondMonthArbor);
    m = addMonthComplication(m, secondMonth);
    const second = createYearDigitComplication({ ...ones, name: "Second ones", monthComplicationId: secondMonth.id, axleOrigin: vec2(mm(-20), mm(-5)) });
    expect(found(addYearDigitComplication(m, second), "YEARDIGIT-001")).toEqual([]);
  });

  it("YEARDIGIT-001: a gap below the declared digit place is reported as a carry-stopping warning", () => {
    // The teaching movement's tens segment sits directly above ones with no gap; remove ones so
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

  it("YEARDIGIT-002: each of the four digit segments reports its own drive model", () => {
    const infos = validateMovement(teaching).filter((i) => i.rule === "YEARDIGIT-002");
    expect(infos).toHaveLength(4);
    for (const info of infos) {
      expect(info.severity).toBe("info");
      expect(info.message).toContain("December-to-January wrap");
      expect(info.message).toContain("decimal carry");
      expect(info.message).toContain("No sourced real wristwatch mechanism");
      expect(info.references).toContain("ASM-0063");
    }
  });
});
