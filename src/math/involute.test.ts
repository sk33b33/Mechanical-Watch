import { describe, expect, it } from "vitest";
import { degrees } from "@/units/angle";
import { baseRadius, involuteAngle, involutePoint, minimumToothCountForNoUndercut } from "./involute";

describe("involuteAngle (SRC-0024 eq. 3-6: inv α = tan α − α)", () => {
  it("is zero at zero pressure angle", () => {
    expect(involuteAngle(degrees(0))).toBe(0);
  });

  it("matches the source's own worked value (α = 20°, invα ≈ 0.014904)", () => {
    expect(involuteAngle(degrees(20))).toBeCloseTo(0.014904, 6);
  });
});

describe("baseRadius (SRC-0024 Table 4-1: d_b = d cos α)", () => {
  it("matches the source's worked example (m = 3, z = 12, α = 20° → d_b = 33.829mm)", () => {
    const pitchRadius = (3 * 12) / 2;
    expect(baseRadius(pitchRadius, degrees(20))).toBeCloseTo(33.829 / 2, 3);
  });

  it("equals the pitch radius at zero pressure angle", () => {
    expect(baseRadius(10, degrees(0))).toBeCloseTo(10, 9);
  });
});

describe("involutePoint (SRC-0024 eq. 3-7)", () => {
  it("starts on the base circle at its own origin", () => {
    const p = involutePoint(5, 5);
    expect(p.x).toBeCloseTo(5, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it("moves outward and the roll angle grows with radius", () => {
    const near = involutePoint(5, 6);
    const far = involutePoint(5, 8);
    expect(Math.hypot(near.x, near.y)).toBeCloseTo(6, 9);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(8, 9);
    expect(Math.atan2(far.y, far.x)).toBeGreaterThan(Math.atan2(near.y, near.x));
  });

  it("throws for a radius inside the base circle", () => {
    expect(() => involutePoint(5, 4)).toThrow(RangeError);
  });
});

describe("minimumToothCountForNoUndercut (SRC-0024 eq. 4-1)", () => {
  it("matches the source's own worked values (32 at 14.5°, 18 at 20°)", () => {
    expect(minimumToothCountForNoUndercut(degrees(14.5))).toBe(32);
    expect(minimumToothCountForNoUndercut(degrees(20))).toBe(18);
  });

  it("decreases as pressure angle increases", () => {
    expect(minimumToothCountForNoUndercut(degrees(25))).toBeLessThan(minimumToothCountForNoUndercut(degrees(20)));
  });
});
