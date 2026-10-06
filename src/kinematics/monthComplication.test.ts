import { describe, expect, it } from "vitest";
import { daysInMonth, GREGORIAN_MONTH_LENGTHS, MONTHS_PER_YEAR, monthEndCorrection, monthJumpStepAngle } from "./monthComplication";

describe("daysInMonth (ASM-0049)", () => {
  it("returns the Gregorian length of each month, January first", () => {
    expect(daysInMonth(0)).toBe(31);
    expect(daysInMonth(1)).toBe(28);
    expect(daysInMonth(11)).toBe(31);
  });

  it("wraps out-of-range indices back into [0, 12)", () => {
    expect(daysInMonth(12)).toBe(daysInMonth(0));
    expect(daysInMonth(13)).toBe(daysInMonth(1));
    expect(daysInMonth(-1)).toBe(daysInMonth(11));
    expect(daysInMonth(-13)).toBe(daysInMonth(11));
  });
});

describe("monthEndCorrection (ASM-0049)", () => {
  const starToothCount = 31;

  it("is an ordinary single step on any day that is not a month's last day", () => {
    expect(monthEndCorrection(0, 0, starToothCount)).toEqual({ dateSteps: 1, monthAdvances: false });
    expect(monthEndCorrection(14, 3, starToothCount)).toEqual({ dateSteps: 1, monthAdvances: false });
  });

  it("reduces to an ordinary single step (with a month advance) on the last day of a 31-day month", () => {
    // January (index 0), day position 30 = the 31st, the last day.
    expect(monthEndCorrection(30, 0, starToothCount)).toEqual({ dateSteps: 1, monthAdvances: true });
  });

  it("skips two days at the end of a 30-day month (April, June, September, November)", () => {
    // April (index 3), day position 29 = the 30th, the last day.
    expect(monthEndCorrection(29, 3, starToothCount)).toEqual({ dateSteps: 2, monthAdvances: true });
  });

  it("skips four days at the end of February (28 days, no leap-year awareness yet, Phase 8.4)", () => {
    // February (index 1), day position 27 = the 28th, the last day.
    expect(monthEndCorrection(27, 1, starToothCount)).toEqual({ dateSteps: 4, monthAdvances: true });
  });

  it("does not fire early: the day before the last day is still an ordinary step", () => {
    expect(monthEndCorrection(26, 1, starToothCount)).toEqual({ dateSteps: 1, monthAdvances: false });
  });
});

describe("monthJumpStepAngle (ASM-0049)", () => {
  it("is 2π / MONTHS_PER_YEAR", () => {
    expect(monthJumpStepAngle()).toBeCloseTo((2 * Math.PI) / MONTHS_PER_YEAR, 12);
  });
});

describe("GREGORIAN_MONTH_LENGTHS (ASM-0049)", () => {
  it("has 12 entries summing to 365 (non-leap year)", () => {
    expect(GREGORIAN_MONTH_LENGTHS).toHaveLength(12);
    expect(GREGORIAN_MONTH_LENGTHS.reduce((a, b) => a + b, 0)).toBe(365);
  });
});
