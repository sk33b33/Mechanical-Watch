import { describe, expect, it } from "vitest";
import { millimetres, toMetres } from "@/units/length";
import { createGear } from "@/domain/gear";
import type { Gear } from "@/domain/gear";
import { addGear, addGearMesh, addShaft, createMovement } from "@/domain/movement";
import type { Movement } from "@/domain/movement";
import { createGearMesh } from "@/domain/gearMesh";
import { createShaft, fixedAt } from "@/domain/shaft";
import { cycloidalToothFactors, practicalAddendumFactor } from "@/math/cycloidTooth";
import {
  cycloidRootRadius,
  cycloidTipRadius,
  effectiveLeafCount,
  generateWatchSpecificGearOutline,
} from "./watchSpecificGearOutline";

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

function meshedMovement(wheelTeeth: number, pinionTeeth: number, pinionProfile: Gear["profileModel"] = "WATCH_SPECIFIC_PROFILE"): { movement: Movement; wheel: Gear; pinion: Gear } {
  const shaftA = createShaft("Shaft A", fixedAt(millimetres(0), millimetres(0)));
  const shaftB = createShaft("Shaft B", fixedAt(millimetres(1), millimetres(0)));
  const wheel = createGear({
    name: "wheel", toothCount: wheelTeeth, module: millimetres(0.12), thickness: millimetres(0.2),
    shaftId: shaftA.id, profileModel: "WATCH_SPECIFIC_PROFILE",
  });
  const pinion = createGear({
    name: "pinion", toothCount: pinionTeeth, module: millimetres(0.12), thickness: millimetres(0.2),
    shaftId: shaftB.id, profileModel: pinionProfile,
  });
  let m = createMovement("test", true);
  m = addShaft(m, shaftA);
  m = addShaft(m, shaftB);
  m = addGear(m, wheel);
  m = addGear(m, pinion);
  m = addGearMesh(m, createGearMesh(wheel.id, pinion.id));
  return { movement: m, wheel, pinion };
}

describe("effectiveLeafCount (ASM-0033 mesh-pair dependency)", () => {
  it("falls back to the gear's own tooth count when no movement is supplied", () => {
    const gear = cycloidGear(40);
    expect(effectiveLeafCount(gear)).toBe(40);
  });

  it("falls back to the gear's own tooth count when it has no mesh", () => {
    const { movement } = meshedMovement(40, 8);
    const unmeshedShaft = createShaft("Shaft C", fixedAt(millimetres(2), millimetres(0)));
    const unmeshed = createGear({
      name: "lone", toothCount: 40, module: millimetres(0.12), thickness: millimetres(0.2),
      shaftId: unmeshedShaft.id, profileModel: "WATCH_SPECIFIC_PROFILE",
    });
    const m = addGear(addShaft(movement, unmeshedShaft), unmeshed);
    expect(effectiveLeafCount(unmeshed, m)).toBe(40);
  });

  it("falls back to the gear's own tooth count when the mesh partner has a different profile model", () => {
    const { movement, wheel } = meshedMovement(40, 8, "PITCH_MODEL");
    expect(effectiveLeafCount(wheel, movement)).toBe(40);
  });

  it("uses the smaller (pinion) partner's tooth count for the larger (wheel) gear", () => {
    const { movement, wheel } = meshedMovement(40, 8);
    expect(effectiveLeafCount(wheel, movement)).toBe(8);
  });

  it("uses its own tooth count (already the smaller side) for the pinion", () => {
    const { movement, pinion } = meshedMovement(40, 8);
    expect(effectiveLeafCount(pinion, movement)).toBe(8);
  });

  it("uses the smallest partner when meshing more than one WATCH_SPECIFIC_PROFILE gear", () => {
    const { movement, wheel } = meshedMovement(40, 10);
    const thirdShaft = createShaft("Shaft D", fixedAt(millimetres(-1), millimetres(0)));
    const smallerPinion = createGear({
      name: "smaller pinion", toothCount: 6, module: millimetres(0.12), thickness: millimetres(0.2),
      shaftId: thirdShaft.id, profileModel: "WATCH_SPECIFIC_PROFILE",
    });
    let m = addGear(addShaft(movement, thirdShaft), smallerPinion);
    m = addGearMesh(m, createGearMesh(wheel.id, smallerPinion.id));
    expect(effectiveLeafCount(wheel, m)).toBe(6);
  });
});

describe("mesh-aware tooth proportions", () => {
  it("a wheel meshing a small pinion gets that pinion's addendum factor, not its own leaf count's", () => {
    const { movement, wheel } = meshedMovement(40, 8); // 40 teeth alone -> ROUND; 8 teeth -> MEDIUM_OGIVAL
    const standaloneFactor = cycloidalToothFactors(40).addendumFactor;
    const pinionFactor = cycloidalToothFactors(8).addendumFactor;
    expect(standaloneFactor).not.toBeCloseTo(pinionFactor, 6);

    const module = toMetres(wheel.module);
    const pitchRadius = (module * wheel.toothCount) / 2;
    const tipWithMesh = cycloidTipRadius(wheel, movement);
    const tipStandalone = cycloidTipRadius(wheel);
    expect(tipWithMesh).toBeCloseTo(pitchRadius + practicalAddendumFactor(8) * module, 12);
    expect(tipStandalone).toBeCloseTo(pitchRadius + practicalAddendumFactor(40) * module, 12);
    expect(tipWithMesh).not.toBeCloseTo(tipStandalone, 9);
  });

  it("the wheel's dedendum is deep enough to clear the meshing pinion's addendum height (mesh-consistent clearance)", () => {
    const { movement, wheel, pinion } = meshedMovement(40, 8);
    const module = toMetres(wheel.module);
    const wheelPitch = (module * wheel.toothCount) / 2;
    const pinionPitch = (module * pinion.toothCount) / 2;
    const wheelDedendumDepth = wheelPitch - cycloidRootRadius(wheel, movement);
    const pinionAddendumHeight = cycloidTipRadius(pinion, movement) - pinionPitch;
    expect(wheelDedendumDepth).toBeGreaterThan(pinionAddendumHeight); // clearance, not just equality
  });

  it("GEAR-104's condition fires for a large wheel whose only mesh partner is below the table's range", () => {
    const { movement, wheel } = meshedMovement(40, 5);
    expect(effectiveLeafCount(wheel, movement)).toBe(5);
    expect(() => generateWatchSpecificGearOutline(wheel, movement)).toThrow();
    // Without the mesh (its own tooth count, 40), it would not throw.
    expect(() => generateWatchSpecificGearOutline(wheel)).not.toThrow();
  });
});
