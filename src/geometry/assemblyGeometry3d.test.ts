import { describe, expect, it } from "vitest";
import {
  balanceArmHalfExtents,
  balanceRimInnerRadius,
  escapeWheelHubRadius,
  generateEscapeWheelOutline,
  generateHandOutline,
  handHubRadius,
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

describe("generateHandOutline", () => {
  it("produces a 4-point taper, narrow at the tail and widening toward the tip", () => {
    const outline = generateHandOutline("MINUTES");
    expect(outline).toHaveLength(4);
    const tailWidth = Math.abs((outline[0]?.x ?? 0) - (outline[1]?.x ?? 0));
    const tipWidth = Math.abs((outline[2]?.x ?? 0) - (outline[3]?.x ?? 0));
    expect(tailWidth).toBeGreaterThan(0);
    expect(tipWidth).toBeGreaterThan(0);
    // All points lie within the hand's own declared length along +Y.
    for (const point of outline) {
      expect(point.y).toBeGreaterThanOrEqual(-5e-3);
      expect(point.y).toBeLessThanOrEqual(8e-3);
    }
  });

  it("each hand kind has its own width and length", () => {
    const hours = generateHandOutline("HOURS");
    const seconds = generateHandOutline("SECONDS");
    const tip = (outline: ReturnType<typeof generateHandOutline>): number => outline[2]?.y ?? 0;
    expect(tip(hours)).not.toBe(tip(seconds));
  });
});

describe("handHubRadius", () => {
  it("is a fixed fraction of the hand's own width", () => {
    expect(handHubRadius("HOURS")).toBeCloseTo(0.6e-3 * 0.2);
    expect(handHubRadius("SECONDS")).toBeCloseTo(0.2e-3 * 0.2);
  });
});
