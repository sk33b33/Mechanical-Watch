import { describe, expect, it } from "vitest";
import { degrees, radians } from "@/units/angle";
import { radiansPerSecond } from "@/units/angularVelocity";
import { DAYS_PER_WEEK, WEEKDAY_ABBREVIATIONS, WEEKDAY_NAMES, crossesRevolution, dateJumpStepAngle, starPosition, weekdayPosition } from "./dateComplication";

describe("crossesRevolution (ASM-0048)", () => {
  it("fires when a forward step carries the angle past a full turn", () => {
    expect(crossesRevolution(degrees(359), radiansPerSecond(degrees(2)), 1)).toBe(true);
  });

  it("does not fire mid-revolution", () => {
    expect(crossesRevolution(degrees(10), radiansPerSecond(degrees(2)), 1)).toBe(false);
  });

  it("fires exactly at the boundary (next === 2π)", () => {
    const remaining = 2 * Math.PI - Math.PI / 2;
    expect(crossesRevolution(radians(Math.PI / 2), radiansPerSecond(remaining), 1)).toBe(true);
  });

  it("never fires for a stationary or reversed drive (ratchet: one-way only)", () => {
    expect(crossesRevolution(degrees(359), radiansPerSecond(0), 1)).toBe(false);
    expect(crossesRevolution(degrees(1), radiansPerSecond(degrees(-2)), 1)).toBe(false);
  });

  describe("forwardSign: -1 (a drive shaft whose solved velocity is negative under the design's own forward running)", () => {
    // A drive shaft one gear mesh away from its neighbours has its solved angular velocity sign
    // flipped by mesh parity alone, independently of which way it is genuinely turning
    // "forward". forwardSign lets the caller declare, once, which raw sign that is for a given
    // shaft; the crossing condition then mirrors the forwardSign: 1 case around angle 0 instead
    // of 2π.
    it("fires when a (negative) forward step carries the angle past its own zero reference", () => {
      expect(crossesRevolution(degrees(1), radiansPerSecond(degrees(-2)), 1, -1)).toBe(true);
    });

    it("does not fire mid-revolution", () => {
      expect(crossesRevolution(degrees(10), radiansPerSecond(degrees(-2)), 1, -1)).toBe(false);
    });

    it("never fires for a stationary or reversed (i.e. raw-positive) drive", () => {
      expect(crossesRevolution(degrees(1), radiansPerSecond(0), 1, -1)).toBe(false);
      expect(crossesRevolution(degrees(359), radiansPerSecond(degrees(2)), 1, -1)).toBe(false);
    });

    it("does NOT fire at the very first instant of a fresh simulation (real bug, found live: previousAngle exactly 0 spuriously satisfied the un-reduced mirror formula's own >= 2π check before any motion at all)", () => {
      expect(crossesRevolution(radians(0), radiansPerSecond(degrees(-2)), 1, -1)).toBe(false);
      // A tiny nonzero dt should likewise not yet cross (needs a full forward lap, ~180s at 2°/s).
      expect(crossesRevolution(radians(0), radiansPerSecond(degrees(-2)), 0.001, -1)).toBe(false);
    });

    it("still fires exactly at its own boundary (next forward angle === 2π) starting from 0", () => {
      const fullLapSeconds = 1;
      expect(crossesRevolution(radians(0), radiansPerSecond(-(2 * Math.PI) / fullLapSeconds), fullLapSeconds, -1)).toBe(true);
    });
  });
});

describe("dateJumpStepAngle (ASM-0048)", () => {
  it("is 2π / starToothCount", () => {
    expect(dateJumpStepAngle(31)).toBeCloseTo((2 * Math.PI) / 31, 12);
    expect(dateJumpStepAngle(4)).toBeCloseTo(Math.PI / 2, 12);
  });
});

describe("starPosition (ASM-0048)", () => {
  it("is 0 at angle 0", () => {
    expect(starPosition(radians(0), 31)).toBe(0);
  });

  it("is the Nth step at N × the step angle", () => {
    expect(starPosition(degrees(360 / 31), 31)).toBe(1);
    const sevenSteps = dateJumpStepAngle(31) * 7;
    expect(starPosition(radians(sevenSteps), 31)).toBe(7);
  });

  it("wraps back to 0 after a full revolution", () => {
    expect(starPosition(radians(2 * Math.PI), 31)).toBe(0);
  });

  it("rounds small floating-point drift to the nearest step rather than reading one short", () => {
    const almostOneStep = dateJumpStepAngle(31) - 1e-9;
    expect(starPosition(radians(almostOneStep), 31)).toBe(1);
  });
});

describe("weekdayPosition (ASM-0081)", () => {
  it("maps Date.getDay() (0 = Sunday) to a Monday-first position", () => {
    expect([1, 2, 3, 4, 5, 6, 0].map(weekdayPosition)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("is periodic and never negative", () => {
    expect(weekdayPosition(7)).toBe(weekdayPosition(0));
    expect(weekdayPosition(-1)).toBe(5);
  });

  it("names seven weekdays with 3-letter upper-case abbreviations", () => {
    expect(WEEKDAY_NAMES).toHaveLength(DAYS_PER_WEEK);
    expect(WEEKDAY_ABBREVIATIONS).toEqual(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
  });

  it("a seven-tooth star steps by 2π/7 per day (ASM-0048 jump, SRC-0048)", () => {
    expect(dateJumpStepAngle(DAYS_PER_WEEK)).toBeCloseTo((2 * Math.PI) / 7, 12);
  });
});
