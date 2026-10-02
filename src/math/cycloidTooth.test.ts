import { describe, expect, it } from "vitest";
import {
  addendumArcThroughTwoPoints,
  cycloidalToothFactors,
  dedendumDepthFactor,
  practicalAddendumFactor,
  recommendedProfileStyle,
  toothWidthFactor,
} from "./cycloidTooth";

describe("recommendedProfileStyle (SRC-0026 recommended profiles)", () => {
  it("6-7 leaves: high ogival", () => {
    expect(recommendedProfileStyle(6)).toBe("HIGH_OGIVAL");
    expect(recommendedProfileStyle(7)).toBe("HIGH_OGIVAL");
  });
  it("8-9 leaves: medium ogival", () => {
    expect(recommendedProfileStyle(8)).toBe("MEDIUM_OGIVAL");
    expect(recommendedProfileStyle(9)).toBe("MEDIUM_OGIVAL");
  });
  it("10 or more leaves: round top", () => {
    expect(recommendedProfileStyle(10)).toBe("ROUND");
    expect(recommendedProfileStyle(11)).toBe("ROUND");
    expect(recommendedProfileStyle(80)).toBe("ROUND");
  });
});

describe("cycloidalToothFactors (SRC-0026 standardized table)", () => {
  it("looks up the 6-10 leaf bracket for each profile style", () => {
    expect(cycloidalToothFactors(6)).toEqual({ addendumFactor: 0.855, addendumArcRadiusFactor: 1.050 });
    expect(cycloidalToothFactors(8)).toEqual({ addendumFactor: 0.670, addendumArcRadiusFactor: 0.700 });
    expect(cycloidalToothFactors(10)).toEqual({ addendumFactor: 0.525, addendumArcRadiusFactor: 0.525 });
  });

  it("looks up the 11+ leaf bracket once past the boundary", () => {
    expect(cycloidalToothFactors(11)).toEqual({ addendumFactor: 0.625, addendumArcRadiusFactor: 0.625 });
  });
});

describe("practicalAddendumFactor / dedendumDepthFactor (SRC-0026 eq. 21-22)", () => {
  it("applies the 5% practical clearance reduction to the table's theoretical factor", () => {
    expect(practicalAddendumFactor(10)).toBeCloseTo(0.525 * 0.95, 10);
  });

  it("adds the fixed 0.4-module bottom clearance to the practical addendum factor", () => {
    expect(dedendumDepthFactor(10)).toBeCloseTo(0.525 * 0.95 + 0.4, 10);
  });
});

describe("toothWidthFactor (SRC-0026 pinion tooth width)", () => {
  it("1.05 modules for the 6-10 leaf bracket, 1.25 for 11+", () => {
    expect(toothWidthFactor(6)).toBe(1.05);
    expect(toothWidthFactor(10)).toBe(1.05);
    expect(toothWidthFactor(11)).toBe(1.25);
  });
});

describe("addendumArcThroughTwoPoints", () => {
  it("returns null when the points are farther apart than the diameter", () => {
    expect(addendumArcThroughTwoPoints({ x: -10, y: 0 }, { x: 10, y: 0 }, 1)).toBeNull();
  });

  it("returns null for coincident points", () => {
    expect(addendumArcThroughTwoPoints({ x: 1, y: 1 }, { x: 1, y: 1 }, 1)).toBeNull();
  });

  it("both input points lie exactly on the resulting circle", () => {
    const p1 = { x: 3, y: 1 };
    const p2 = { x: 1, y: 4 };
    const arc = addendumArcThroughTwoPoints(p1, p2, 5);
    expect(arc).not.toBeNull();
    if (arc === null) throw new Error("unreachable");
    expect(Math.hypot(p1.x - arc.centre.x, p1.y - arc.centre.y)).toBeCloseTo(arc.radius, 10);
    expect(Math.hypot(p2.x - arc.centre.x, p2.y - arc.centre.y)).toBeCloseTo(arc.radius, 10);
  });

  it("picks the branch whose centre is nearer the origin (the outward-bulging arc)", () => {
    // Two points symmetric about the x-axis, well away from the origin;
    // the two candidate centres straddle them on the x-axis, one
    // closer to the origin than the other.
    const p1 = { x: 10, y: 1 };
    const p2 = { x: 10, y: -1 };
    const arc = addendumArcThroughTwoPoints(p1, p2, 5);
    expect(arc).not.toBeNull();
    if (arc === null) throw new Error("unreachable");
    const other = { x: 2 * 10 - arc.centre.x, y: arc.centre.y }; // reflection = the other candidate, since both centres lie on the x-axis through the chord's midpoint
    expect(Math.hypot(arc.centre.x, arc.centre.y)).toBeLessThanOrEqual(Math.hypot(other.x, other.y));
  });
});
