import { describe, expect, it } from "vitest";
import {
  balanceArmHalfExtents,
  balanceRimInnerRadius,
  escapeWheelHubRadius,
  generateEscapeWheelOutline,
} from "./assemblyGeometry3d";

describe("generateEscapeWheelOutline", () => {
  it("produces 3 points per tooth, all between the hub and the tip radius", () => {
    const toothCount = 15;
    const tipRadius = 0.0023;
    const outline = generateEscapeWheelOutline(toothCount, tipRadius);
    expect(outline).toHaveLength(toothCount * 3);
    const hub = escapeWheelHubRadius(tipRadius);
    for (const point of outline) {
      const radius = Math.hypot(point.x, point.y);
      expect(radius).toBeGreaterThan(hub);
      expect(radius).toBeLessThanOrEqual(tipRadius + 1e-12);
    }
  });
});

describe("escapeWheelHubRadius", () => {
  it("is strictly smaller than the root circle it's cut from", () => {
    const tipRadius = 0.002;
    expect(escapeWheelHubRadius(tipRadius)).toBeLessThan(tipRadius * 0.72);
  });
});

describe("balanceRimInnerRadius", () => {
  it("is smaller than the outer radius by the rim-width fraction", () => {
    expect(balanceRimInnerRadius(1)).toBeCloseTo(0.9);
    expect(balanceRimInnerRadius(2)).toBeCloseTo(1.8);
  });
});

describe("balanceArmHalfExtents", () => {
  it("scales the half-length with the balance radius", () => {
    const small = balanceArmHalfExtents(1);
    const large = balanceArmHalfExtents(2);
    expect(large.halfLength).toBeCloseTo(small.halfLength * 2);
    expect(large.halfWidth).toBeCloseTo(small.halfWidth); // width is a fixed metres value, not radius-scaled
  });
});
