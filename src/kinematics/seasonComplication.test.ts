import { describe, expect, it } from "vitest";
import { toDegrees } from "@/units/angle";
import { isQuarterBoundary, seasonJumpStepAngle } from "./seasonComplication";

describe("seasonJumpStepAngle", () => {
  it("is one quarter turn (90°)", () => {
    expect(toDegrees(seasonJumpStepAngle())).toBeCloseTo(90, 9);
  });
});

describe("isQuarterBoundary", () => {
  it("is true only for the last month of each calendar quarter (Mar, Jun, Sep, Dec), 0-indexed", () => {
    const lastMonthOfQuarter = [2, 5, 8, 11];
    for (let m = 0; m < 12; m += 1) {
      expect(isQuarterBoundary(m)).toBe(lastMonthOfQuarter.includes(m));
    }
  });

  it("flips the season wheel exactly on the jump into Jan/Apr/Jul/Oct (the user's own chosen convention)", () => {
    // monthPosition is read PRE-advance; a jump FROM month m LANDS on (m+1) % 12.
    const triggers = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec (pre-advance)
    const landedOn = triggers.map((m) => (m + 1) % 12); // Apr, Jul, Oct, Jan
    expect(landedOn).toEqual([3, 6, 9, 0]);
  });
});
