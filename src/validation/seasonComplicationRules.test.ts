import { describe, expect, it } from "vitest";
import { millimetres as mm } from "@/units/length";
import { addDateComplication, addGear, addGearMesh, addMonthComplication, addSeasonComplication, addShaft, updateSeasonComplication, type Movement } from "@/domain/movement";
import { createSeasonComplication } from "@/domain/seasonComplication";
import { createMonthComplication } from "@/domain/monthComplication";
import { createDateComplication } from "@/domain/dateComplication";
import { createShaft, fixedAt } from "@/domain/shaft";
import { createGear } from "@/domain/gear";
import { createGearMesh } from "@/domain/gearMesh";
import { removeEntity } from "@/domain/editing";
import { createTeachingMovement } from "@/app/teachingMovement";
import { validateMovement } from "./validateMovement";

const teaching = createTeachingMovement();
const season = Object.values(teaching.seasonComplications)[0];
if (season === undefined) throw new Error("teaching movement has no season complication");
const found = (m: Movement, prefix: string): string[] =>
  validateMovement(m).filter((i) => i.rule.startsWith(prefix)).map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);
const edit = (patch: Parameters<typeof updateSeasonComplication>[2]): Movement => updateSeasonComplication(teaching, season.id, patch);

describe("season complication rules", () => {
  it("the teaching season complication reports no errors (SEASON-001)", () => {
    expect(found(teaching, "SEASON-001")).toEqual([]);
  });

  it("the season wheel's arbor is not reported as unpowered (KIN-001)", () => {
    expect(validateMovement(teaching).filter((i) => i.rule === "KIN-001")).toEqual([]);
  });

  it("SEASON-001: dimensions must be positive/finite", () => {
    expect(found(edit({ wheelTipDiameter: mm(0) }), "SEASON-001")).toContain("SEASON-001:error:its wheel tip diameter must be a positive length");
    expect(found(edit({ wheelThickness: mm(Number.NaN) }), "SEASON-001")).toContain("SEASON-001:error:its wheel thickness must be a positive length");
    expect(found(edit({ wheelZCentre: mm(Number.NaN) }), "SEASON-001")).toContain("SEASON-001:error:its wheel mid-plane height must be finite");
  });

  it("SEASON-001: the wheel arbor and referenced month complication must exist", () => {
    expect(found(removeEntity(teaching, season.wheelShaftId).movement, "SEASON-001")).toContain("SEASON-001:error:its wheel arbor does not exist");
    expect(found(removeEntity(teaching, season.monthComplicationId).movement, "SEASON-001")).toContain("SEASON-001:error:it does not reference an existing month complication");
  });

  it("SEASON-001: the wheel arbor must be different from the month complication's own star arbor", () => {
    const month = teaching.monthComplications[season.monthComplicationId];
    if (month === undefined) throw new Error("teaching movement's season complication references no month complication");
    expect(found(edit({ wheelShaftId: month.starShaftId }), "SEASON-001")).toContain("SEASON-001:error:its wheel arbor must be different from the month complication's own star arbor");
  });

  it("SEASON-001: several season complications are each checked independently", () => {
    const month = teaching.monthComplications[season.monthComplicationId];
    const date = month === undefined ? undefined : teaching.dateComplications[month.dateComplicationId];
    if (month === undefined || date === undefined) throw new Error("teaching movement's season complication references no month/date complication");
    // Its own date complication, month complication and wheel arbor, distinct from the teaching
    // movement's own — otherwise this would trip the duplicate-reference checks, not stay error-free.
    const secondDate = createDateComplication({ ...date, name: "Second date" });
    const secondMonthArbor = createShaft("Second month star", fixedAt(mm(-20), mm(0)));
    const secondMonth = createMonthComplication({ ...month, name: "Second month", dateComplicationId: secondDate.id, starShaftId: secondMonthArbor.id });
    const secondSeasonArbor = createShaft("Second season wheel", fixedAt(mm(-20), mm(-5)));
    let m = addDateComplication(teaching, secondDate);
    m = addShaft(m, secondMonthArbor);
    m = addMonthComplication(m, secondMonth);
    m = addShaft(m, secondSeasonArbor);
    const second = createSeasonComplication({ ...season, name: "Second season", monthComplicationId: secondMonth.id, wheelShaftId: secondSeasonArbor.id });
    expect(found(addSeasonComplication(m, second), "SEASON-001")).toEqual([]);
  });

  it("SEASON-001: two season complications referencing the same month complication are each flagged", () => {
    const second = createSeasonComplication({ ...season, name: "Second season" });
    expect(found(addSeasonComplication(teaching, second), "SEASON-001")).toEqual([
      "SEASON-001:error:another season complication already references this same month complication — only one can be driven by its jumps, so one of them never advances",
      "SEASON-001:error:another season complication already references this same month complication — only one can be driven by its jumps, so one of them never advances",
    ]);
  });

  it("SEASON-001: the wheel arbor must not also be reached by the continuous gear train", () => {
    const strayGear = createGear({ name: "Stray gear", toothCount: 20, module: mm(0.1), thickness: mm(0.1), zCentre: mm(-1.2), shaftId: season.wheelShaftId });
    const driveGear = Object.values(teaching.gears).find((g) => g.name === "24-hour wheel");
    if (driveGear === undefined) throw new Error("teaching movement has no 24-hour wheel");
    let m = addGear(teaching, strayGear);
    m = addGearMesh(m, createGearMesh(driveGear.id, strayGear.id));
    expect(found(m, "SEASON-001")).toContain("SEASON-001:error:wheel-also-geared");
  });

  it("SEASON-002: reports the drive model and the distinction from the real equation-of-time season complication", () => {
    const info = validateMovement(teaching).find((i) => i.rule === "SEASON-002");
    expect(info?.severity).toBe("info");
    expect(info?.message).toContain("January, April, July or October");
    expect(info?.message).toContain("neutral quarter indicator");
    expect(info?.message).toContain("equation-of-time");
    expect(info?.message).toContain("hemisphere-dependent");
    expect(info?.references).toContain("ASM-0057");
  });
});
