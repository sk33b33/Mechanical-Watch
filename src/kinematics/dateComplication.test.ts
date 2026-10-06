import { describe, expect, it } from "vitest";
import { degrees, radians } from "@/units/angle";
import { radiansPerSecond } from "@/units/angularVelocity";
import { crossesRevolution, dateJumpStepAngle, starPosition } from "./dateComplication";

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
