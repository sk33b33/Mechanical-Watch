import { describe, expect, it } from "vitest";
import { millimetres } from "@/units/length";
import { degrees } from "@/units/angle";
import { createGear } from "@/domain/gear";
import type { Gear } from "@/domain/gear";
import { generateInvoluteGearOutline, involuteRootRadius, involuteTipRadius } from "./involuteGearOutline";

function involuteGear(toothCount: number, pressureAngleDeg = 20): Gear {
  return createGear({
    name: "test",
    toothCount,
    module: millimetres(0.2),
    thickness: millimetres(0.2),
    shaftId: "shaft_test" as never,
    profileModel: "INVOLUTE_PROFILE",
    pressureAngle: degrees(pressureAngleDeg),
  });
}

describe("generateInvoluteGearOutline", () => {
  it("produces a closed outline with every point between the root and tip radius", () => {
    const gear = involuteGear(24);
    const outline = generateInvoluteGearOutline(gear);
    const root = involuteRootRadius(gear);
    const tip = involuteTipRadius(gear);
    expect(outline.length).toBeGreaterThan(24 * 4);
    for (const point of outline) {
      const radius = Math.hypot(point.x, point.y);
      expect(Number.isFinite(radius)).toBe(true);
      expect(radius).toBeGreaterThanOrEqual(root - 1e-9);
      expect(radius).toBeLessThanOrEqual(tip + 1e-9);
    }
  });

  it("every tooth's angular span stays within its own pitch sector (no overlap with neighbours)", () => {
    const gear = involuteGear(24);
    const outline = generateInvoluteGearOutline(gear);
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

  it("draws a straight dedendum segment down to the root circle for a low (undercut) tooth count", () => {
    const gear = involuteGear(10);
    const root = involuteRootRadius(gear);
    const outline = generateInvoluteGearOutline(gear);
    const atRoot = outline.filter((p) => Math.abs(Math.hypot(p.x, p.y) - root) < 1e-9);
    expect(atRoot.length).toBe(gear.toothCount * 2);
  });

  it("throws if the gear has no pressure angle", () => {
    const gear = createGear({
      name: "test", toothCount: 20, module: millimetres(0.2), thickness: millimetres(0.2),
      shaftId: "shaft_test" as never, profileModel: "INVOLUTE_PROFILE",
    });
    expect(() => generateInvoluteGearOutline(gear)).toThrow();
  });
});

describe("involuteTipRadius / involuteRootRadius (SRC-0024 Table 4-1)", () => {
  it("addendum = 1.00m above pitch radius, dedendum = 1.25m below it", () => {
    const gear = involoteSample();
    const module = 0.0002; // 0.2mm in metres
    const pitchRadius = (module * 20) / 2;
    expect(involuteTipRadius(gear)).toBeCloseTo(pitchRadius + module, 9);
    expect(involuteRootRadius(gear)).toBeCloseTo(pitchRadius - 1.25 * module, 9);
  });
});

function involoteSample(): Gear {
  return createGear({
    name: "test", toothCount: 20, module: millimetres(0.2), thickness: millimetres(0.2),
    shaftId: "shaft_test" as never, profileModel: "INVOLUTE_PROFILE", pressureAngle: degrees(20),
  });
}
