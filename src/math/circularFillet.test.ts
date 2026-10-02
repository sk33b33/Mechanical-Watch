import { describe, expect, it } from "vitest";
import { circularRootFillet, cornerFillet, filletArcPoint, type CircularFillet } from "./circularFillet";

const rootR = 3.75;
const baseR = 4.698463103929543; // Rp cos(20°) for m=1, z=10
const flankAngle = 0.1719840165468261; // toothHalfAngleAtPitch + inv(20°) for z=10

function fillet(root: number, base: number, angle: number): CircularFillet {
  const f = circularRootFillet(root, base, angle);
  if (f === null) throw new Error("expected a fillet");
  return f;
}

describe("circularRootFillet (undercut: rootRadius < baseRadius)", () => {
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

describe("cornerFillet", () => {
  const corner = { x: 1, y: 1 };
  const radius = 0.1;

  it("for a right-angle corner (dir1 ⊥ dir2), the classical result holds: tangentDistance = radius, centre at radius·√2 along the bisector", () => {
    const dir1 = { x: 1, y: 0 };
    const dir2 = { x: 0, y: 1 };
    const f = cornerFillet(corner, dir1, dir2, radius);
    expect(f.tangentDistance).toBeCloseTo(radius, 10);
    expect(Math.hypot(f.centre.x - corner.x, f.centre.y - corner.y)).toBeCloseTo(radius * Math.SQRT2, 10);
  });

  it("both tangent points lie exactly on their own edge, at `tangentDistance` from the corner", () => {
    const dir1 = { x: 1, y: 0 };
    const dir2 = { x: Math.cos(Math.PI / 3), y: Math.sin(Math.PI / 3) }; // 60° between edges
    const f = cornerFillet(corner, dir1, dir2, radius);
    expect(f.tangent1.x).toBeCloseTo(corner.x + f.tangentDistance * dir1.x, 10);
    expect(f.tangent1.y).toBeCloseTo(corner.y + f.tangentDistance * dir1.y, 10);
    expect(f.tangent2.x).toBeCloseTo(corner.x + f.tangentDistance * dir2.x, 10);
    expect(f.tangent2.y).toBeCloseTo(corner.y + f.tangentDistance * dir2.y, 10);
  });

  it("both tangent points are at exactly `radius` from the fillet centre (true tangency, not just proximity)", () => {
    const dir1 = { x: 1, y: 0 };
    const dir2 = { x: Math.cos(Math.PI / 3), y: Math.sin(Math.PI / 3) };
    const f = cornerFillet(corner, dir1, dir2, radius);
    expect(Math.hypot(f.centre.x - f.tangent1.x, f.centre.y - f.tangent1.y)).toBeCloseTo(radius, 10);
    expect(Math.hypot(f.centre.x - f.tangent2.x, f.centre.y - f.tangent2.y)).toBeCloseTo(radius, 10);
  });

  it("the centre lies on the angle bisector, equidistant in direction from both edges", () => {
    const dir1 = { x: 1, y: 0 };
    const dir2 = { x: Math.cos(Math.PI / 4), y: Math.sin(Math.PI / 4) };
    const f = cornerFillet(corner, dir1, dir2, radius);
    const toCentre = { x: f.centre.x - corner.x, y: f.centre.y - corner.y };
    const toCentreAngle = Math.atan2(toCentre.y, toCentre.x);
    const dir1Angle = Math.atan2(dir1.y, dir1.x);
    const dir2Angle = Math.atan2(dir2.y, dir2.x);
    expect(toCentreAngle).toBeCloseTo((dir1Angle + dir2Angle) / 2, 10);
  });
});
