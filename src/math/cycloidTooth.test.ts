import { describe, expect, it } from "vitest";
import {
  addendumArcThroughTwoPoints,
  cycloidalToothFactors,
  dedendumDepthFactor,
  generatingCircleRadius,
  hypocycloidPoint,
  hypocycloidThetaAtRadius,
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

describe("generatingCircleRadius (SRC-0026)", () => {
  it("is a quarter of module times leaf count (half the pinion's own pitch radius)", () => {
    expect(generatingCircleRadius(8, 0.0002)).toBeCloseTo((0.0002 * 8) / 4, 15);
  });
});

describe("hypocycloidPoint (SRC-0028)", () => {
  it("starts at (R, 0) when theta=0, for any rolling-circle radius", () => {
    for (const r of [0.1, 0.3, 0.49, 0.5]) {
      const p = hypocycloidPoint(1, r, 0);
      expect(p.x).toBeCloseTo(1, 12);
      expect(p.y).toBeCloseTo(0, 12);
    }
  });

  it("always sits at exactly distance r from the rolling circle's own current centre (the rolling-without-slipping definition)", () => {
    const R = 1;
    const r = 0.23;
    for (const theta of [0.1, 0.7, 1.5, 2.3, 4.0, 5.5]) {
      const p = hypocycloidPoint(R, r, theta);
      const rollingCentre = { x: (R - r) * Math.cos(theta), y: (R - r) * Math.sin(theta) };
      expect(Math.hypot(p.x - rollingCentre.x, p.y - rollingCentre.y)).toBeCloseTo(r, 10);
    }
  });

  it("degenerates to the straight line y=0, x=R·cos(theta) when r=R/2 (the Tusi couple)", () => {
    const R = 1;
    for (const theta of [0.1, 0.5, 1.0, 2.0, 3.0, -0.8]) {
      const p = hypocycloidPoint(R, R / 2, theta);
      expect(p.y).toBeCloseTo(0, 10);
      expect(p.x).toBeCloseTo(R * Math.cos(theta), 10);
    }
  });

  it("stays within the fixed circle of radius R (a hypocycloid never leaves the circle it rolls inside)", () => {
    const R = 1;
    const r = 0.3;
    for (let i = 0; i <= 200; i += 1) {
      const theta = (i / 200) * 2 * Math.PI;
      const p = hypocycloidPoint(R, r, theta);
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(R + 1e-9);
    }
  });
});

describe("hypocycloidThetaAtRadius (SRC-0028)", () => {
  it("finds the crossing in the degenerate (straight-line) case: R·cos(theta) = targetRadius", () => {
    const R = 1;
    const targetRadius = 0.6;
    const theta = hypocycloidThetaAtRadius(R, R / 2, targetRadius, 1);
    expect(theta).not.toBeNull();
    if (theta === null) throw new Error("unreachable");
    expect(R * Math.cos(theta)).toBeCloseTo(targetRadius, 6);
  });

  it("the negative-sign search finds the mirror-image (negated) theta of the positive-sign search", () => {
    const R = 1;
    const r = 0.3;
    const targetRadius = 0.9;
    const thetaPos = hypocycloidThetaAtRadius(R, r, targetRadius, 1);
    const thetaNeg = hypocycloidThetaAtRadius(R, r, targetRadius, -1);
    expect(thetaPos).not.toBeNull();
    expect(thetaNeg).not.toBeNull();
    if (thetaPos === null || thetaNeg === null) throw new Error("unreachable");
    expect(thetaNeg).toBeCloseTo(-thetaPos, 6);
  });

  it("returns null for a target radius the curve can never reach (greater than R)", () => {
    expect(hypocycloidThetaAtRadius(1, 0.3, 1.1, 1)).toBeNull();
  });

  it("the found theta's point is genuinely at the target radius, not just near it", () => {
    const R = 0.0024;
    const r = 0.00024; // a realistic wheel/pinion generating-circle scale
    const targetRadius = 0.00227562;
    const theta = hypocycloidThetaAtRadius(R, r, targetRadius, -1);
    expect(theta).not.toBeNull();
    if (theta === null) throw new Error("unreachable");
    const p = hypocycloidPoint(R, r, theta);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(targetRadius, 12);
  });
});
