import { describe, expect, it } from "vitest";
import { circularRootFillet, filletArcPoint, type CircularFillet } from "./circularFillet";

const rootR = 3.75;
const baseR = 4.698463103929543; // Rp cos(20°) for m=1, z=10
const flankAngle = 0.1719840165468261; // toothHalfAngleAtPitch + inv(20°) for z=10

function fillet(root: number, base: number, angle: number): CircularFillet {
  const f = circularRootFillet(root, base, angle);
  if (f === null) throw new Error("expected a fillet");
  return f;
}

describe("circularRootFillet", () => {
  it("returns null when the involute already reaches the root circle (no undercut)", () => {
    expect(circularRootFillet(5, 4.698, flankAngle)).toBeNull();
    expect(circularRootFillet(baseR, baseR, flankAngle)).toBeNull();
  });

  it("the centre is tangent to the root circle: distance from the gear centre is rootRadius + radius", () => {
    const f = fillet(rootR, baseR, flankAngle);
    const centreDist = Math.hypot(f.centre.x, f.centre.y);
    expect(centreDist).toBeCloseTo(rootR + f.radius, 10);
  });

  it("the root tangent point lies exactly on the root circle, at distance `radius` from the centre", () => {
    const f = fillet(rootR, baseR, flankAngle);
    expect(Math.hypot(f.rootTangentPoint.x, f.rootTangentPoint.y)).toBeCloseTo(rootR, 10);
    const d = Math.hypot(f.centre.x - f.rootTangentPoint.x, f.centre.y - f.rootTangentPoint.y);
    expect(d).toBeCloseTo(f.radius, 10);
  });

  it("the flank tangent point is exactly the involute's own base-circle tangent point", () => {
    const f = fillet(rootR, baseR, flankAngle);
    expect(f.flankTangentPoint.x).toBeCloseTo(baseR * Math.cos(flankAngle), 10);
    expect(f.flankTangentPoint.y).toBeCloseTo(baseR * Math.sin(flankAngle), 10);
    const d = Math.hypot(f.centre.x - f.flankTangentPoint.x, f.centre.y - f.flankTangentPoint.y);
    expect(d).toBeCloseTo(f.radius, 10);
  });

  it("the radius is exactly half the gap between the root and base circles", () => {
    const f = fillet(rootR, baseR, flankAngle);
    expect(f.radius).toBeCloseTo((baseR - rootR) / 2, 10);
  });

  it("root and flank tangent points sit at opposite ends of the same diameter, both at the flank's own angle", () => {
    const f = fillet(rootR, baseR, flankAngle);
    expect(Math.atan2(f.rootTangentPoint.y, f.rootTangentPoint.x)).toBeCloseTo(flankAngle, 10);
    expect(Math.atan2(f.flankTangentPoint.y, f.flankTangentPoint.x)).toBeCloseTo(flankAngle, 10);
  });
});

describe("filletArcPoint", () => {
  it("every sampled point is at exactly `radius` from the fillet centre", () => {
    const f = fillet(rootR, baseR, flankAngle);
    for (let i = 0; i <= 10; i += 1) {
      const t = (2 * Math.PI * i) / 10;
      const p = filletArcPoint(f, t);
      expect(Math.hypot(p.x - f.centre.x, p.y - f.centre.y)).toBeCloseTo(f.radius, 10);
    }
  });
});
