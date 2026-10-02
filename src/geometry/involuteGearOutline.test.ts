import { describe, expect, it } from "vitest";
import { millimetres, toMetres } from "@/units/length";
import { degrees } from "@/units/angle";
import { createGear } from "@/domain/gear";
import type { Gear } from "@/domain/gear";
import { INVOLUTE_PROPORTIONS, generateInvoluteGearOutline, involuteRootRadius, involuteTipRadius } from "./involuteGearOutline";

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

  it("draws a curved root fillet (not a straight line) down to the root circle for a low (undercut) tooth count", () => {
    const gear = involuteGear(10);
    const root = involuteRootRadius(gear);
    const outline = generateInvoluteGearOutline(gear);
    const atRoot = outline.filter((p) => Math.abs(Math.hypot(p.x, p.y) - root) < 1e-9);
    expect(atRoot.length).toBe(gear.toothCount * 2);

    // A straight radial dedendum segment would put every fillet point at
    // the same angle (the flank's own base-circle tangent angle). The
    // circular arc instead sweeps through a range of angles as its
    // radius varies between the root and base circles — confirming a
    // genuinely curved fillet, not a straight line.
    const betweenRootAndBase = outline.filter((p) => {
      const r = Math.hypot(p.x, p.y);
      return r > root + 1e-9 && r < root + (involuteTipRadius(gear) - root) * 0.5; // comfortably inside the fillet's radius range for this undercut gear
    });
    expect(betweenRootAndBase.length).toBeGreaterThan(0);
    const angles = new Set(betweenRootAndBase.map((p) => Math.atan2(p.y, p.x).toFixed(6)));
    expect(angles.size).toBeGreaterThan(1);
  });

  it("draws a small corner fillet (not a sharp corner) at the root for a non-undercut (high) tooth count", () => {
    // z=50 is well above the ≈41.45-tooth no-undercut crossover for standard
    // 20° full-depth proportions (z >= 2.5 / (1 - cos 20°)): the involute
    // flank reaches the root circle on its own here.
    const gear = involuteGear(50);
    const root = involuteRootRadius(gear);
    const tip = involuteTipRadius(gear);
    const outline = generateInvoluteGearOutline(gear);

    // No point should sit exactly at the unrounded, sharp-corner root
    // radius any more — the corner has been rounded away.
    const exactlyAtRoot = outline.filter((p) => Math.abs(Math.hypot(p.x, p.y) - root) < 1e-12);
    expect(exactlyAtRoot.length).toBe(0);

    // The fillet is a small arc confined close to the root (a few times
    // the standard 0.38m cutter corner radius), unlike the undercut
    // case's semicircle spanning most of the dedendum.
    const filletRadius = INVOLUTE_PROPORTIONS.rootFilletRadiusInModules * toMetres(gear.module);
    const filletBand = outline.filter((p) => {
      const r = Math.hypot(p.x, p.y);
      return r >= root - 1e-9 && r < root + 4 * filletRadius;
    });
    expect(filletBand.length).toBeGreaterThan(gear.toothCount * 2);
    const angles = new Set(filletBand.map((p) => Math.atan2(p.y, p.x).toFixed(6)));
    expect(angles.size).toBeGreaterThan(gear.toothCount * 2); // genuinely curved: many distinct angles, not a straight line

    // Every point stays close to the declared root/tip bounds. The fillet
    // (like the straight root "land" it rounds, already an approximation —
    // any chord of the root circle dips inside it) can dip a little below
    // the nominal root radius; bound that by the fillet radius itself,
    // comfortably wider than the sub-percent dip this construction produces.
    for (const p of outline) {
      const r = Math.hypot(p.x, p.y);
      expect(r).toBeGreaterThanOrEqual(root - filletRadius);
      expect(r).toBeLessThanOrEqual(tip + 1e-9);
    }
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
