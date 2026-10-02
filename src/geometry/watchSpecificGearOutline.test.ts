import { describe, expect, it } from "vitest";
import { millimetres, toMetres } from "@/units/length";
import { createGear } from "@/domain/gear";
import type { Gear } from "@/domain/gear";
import { cycloidalToothFactors, practicalAddendumFactor } from "@/math/cycloidTooth";
import { cycloidRootRadius, cycloidTipRadius, generateWatchSpecificGearOutline } from "./watchSpecificGearOutline";

function cycloidGear(toothCount: number): Gear {
  return createGear({
    name: "test",
    toothCount,
    module: millimetres(0.12),
    thickness: millimetres(0.2),
    shaftId: "shaft_test" as never,
    profileModel: "WATCH_SPECIFIC_PROFILE",
  });
}

describe("cycloidTipRadius / cycloidRootRadius (SRC-0026)", () => {
  it("tip is pitch radius plus the practical addendum factor in modules", () => {
    const gear = cycloidGear(10);
    const module = toMetres(gear.module);
    const pitchRadius = (module * 10) / 2;
    expect(cycloidTipRadius(gear)).toBeCloseTo(pitchRadius + practicalAddendumFactor(10) * module, 12);
  });

  it("root is pitch radius minus the dedendum depth factor in modules", () => {
    const gear = cycloidGear(10);
    const module = toMetres(gear.module);
    const pitchRadius = (module * 10) / 2;
    const expectedRoot = pitchRadius - (practicalAddendumFactor(10) + 0.4) * module;
    expect(cycloidRootRadius(gear)).toBeCloseTo(expectedRoot, 12);
  });
});

describe("generateWatchSpecificGearOutline", () => {
  it("produces a closed outline with every point between the root and tip radius", () => {
    const gear = cycloidGear(20);
    const outline = generateWatchSpecificGearOutline(gear);
    const root = cycloidRootRadius(gear);
    const tip = cycloidTipRadius(gear);
    expect(outline.length).toBeGreaterThan(20 * 4);
    for (const point of outline) {
      const radius = Math.hypot(point.x, point.y);
      expect(Number.isFinite(radius)).toBe(true);
      expect(radius).toBeGreaterThanOrEqual(root - 1e-9);
      expect(radius).toBeLessThanOrEqual(tip + 1e-9);
    }
  });

  it("every tooth's angular span stays within its own pitch sector (no overlap with neighbours)", () => {
    const gear = cycloidGear(20);
    const outline = generateWatchSpecificGearOutline(gear);
    const toothAngle = (2 * Math.PI) / gear.toothCount;
    const perTooth = outline.length / gear.toothCount;
    for (let i = 0; i < gear.toothCount; i += 1) {
      const centreAngle = i * toothAngle;
      for (let j = 0; j < perTooth; j += 1) {
        const point = outline[i * perTooth + j];
        if (point === undefined) continue;
        const angle = Math.atan2(point.y, point.x);
        const delta = Math.atan2(Math.sin(angle - centreAngle), Math.cos(angle - centreAngle));
        expect(Math.abs(delta)).toBeLessThan(toothAngle / 2);
      }
    }
  });

  it("the dedendum flank is a straight radial line (clock toothing, ASM-0032): root and pitch-edge points share the same angle", () => {
    const gear = cycloidGear(8);
    const outline = generateWatchSpecificGearOutline(gear);
    const root = cycloidRootRadius(gear);
    const pitchRadius = toMetres(gear.module) * gear.toothCount / 2;
    // The first point of each tooth is the leading root point; the second is the leading pitch-edge point.
    const perTooth = outline.length / gear.toothCount;
    for (let i = 0; i < gear.toothCount; i += 1) {
      const rootPoint = outline[i * perTooth];
      const pitchPoint = outline[i * perTooth + 1];
      if (rootPoint === undefined || pitchPoint === undefined) continue;
      expect(Math.hypot(rootPoint.x, rootPoint.y)).toBeCloseTo(root, 9);
      expect(Math.hypot(pitchPoint.x, pitchPoint.y)).toBeCloseTo(pitchRadius, 9);
      expect(Math.atan2(rootPoint.y, rootPoint.x)).toBeCloseTo(Math.atan2(pitchPoint.y, pitchPoint.x), 9);
    }
  });

  it("the tooth is narrower than the space (SRC-0026): tooth width at the pitch circle is less than half the circular pitch", () => {
    const gear = cycloidGear(8);
    const outline = generateWatchSpecificGearOutline(gear);
    const perTooth = outline.length / gear.toothCount;
    const leadingPitchEdge = outline[1];
    const trailingPitchEdge = outline[perTooth - 2];
    if (leadingPitchEdge === undefined || trailingPitchEdge === undefined) throw new Error("unreachable");
    const toothHalfAngle = Math.abs(Math.atan2(leadingPitchEdge.y, leadingPitchEdge.x));
    expect(toothHalfAngle).toBeCloseTo(Math.abs(Math.atan2(trailingPitchEdge.y, trailingPitchEdge.x)), 9);
    const toothAngle = (2 * Math.PI) / gear.toothCount;
    expect(toothHalfAngle * 2).toBeLessThan(toothAngle / 2); // nominal equal split would be toothAngle/2
  });

  it("draws a curved addendum arc (not a sharp tip)", () => {
    const gear = cycloidGear(10);
    const outline = generateWatchSpecificGearOutline(gear);
    const tip = cycloidTipRadius(gear);
    const nearTip = outline.filter((p) => {
      const r = Math.hypot(p.x, p.y);
      return r > tip * 0.995 && r <= tip;
    });
    const angles = new Set(nearTip.map((p) => Math.atan2(p.y, p.x).toFixed(6)));
    expect(angles.size).toBeGreaterThan(gear.toothCount); // many distinct angles near the tip across all teeth: a curved cap, not a single point
  });

  it("the standardized factor table is applied by this gear's own leaf count (ASM-0033)", () => {
    const gear = cycloidGear(6);
    expect(cycloidalToothFactors(gear.toothCount).addendumFactor).toBeCloseTo(0.855, 10);
  });

  it("throws for a tooth count below SRC-0026's table range", () => {
    const gear = cycloidGear(5);
    expect(() => generateWatchSpecificGearOutline(gear)).toThrow();
  });
});
