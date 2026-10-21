import { describe, expect, it } from "vitest";
import { millimetres } from "@/units/length";
import { createGear } from "@/domain/gear";
import { GEAR_SPOKE_VISUALIZATION, gearSpokeOpenings, generateGearOutline, visualBoreRadius } from "./gearOutline";
import { GEAR_SPOKE_MIN_TOOTH_COUNT } from "@/domain/gear";
import { createGearGeometry } from "./gearGeometry";
import { pitchDiameter } from "@/math/gearMath";

describe("generateGearOutline", () => {
  it("produces 4 points per tooth, all outside a sane inner bound", () => {
    const gear = createGear({
      name: "test",
      toothCount: 20,
      module: millimetres(0.2),
      thickness: millimetres(0.2),
      shaftId: "shaft_test" as never,
    });
    const outline = generateGearOutline(gear);
    expect(outline).toHaveLength(20 * 4);
    for (const point of outline) {
      const radius = Math.hypot(point.x, point.y);
      expect(radius).toBeGreaterThan(0);
      expect(Number.isFinite(radius)).toBe(true);
    }
  });
});

describe("spoked gears (ASM-0077)", () => {
  const make = (toothCount: number, spoked: boolean): ReturnType<typeof createGear> => createGear({
    name: "wheel", toothCount, module: millimetres(0.12), thickness: millimetres(0.2), shaftId: "shaft_test" as never, spoked,
  });

  it("defaults to a solid disc", () => {
    expect(createGear({ name: "g", toothCount: 40, module: millimetres(0.12), thickness: millimetres(0.2), shaftId: "s" as never }).spoked).toBe(false);
  });

  it("has five gaps between the hub and a solid ring (20% of the root radius) under the teeth", () => {
    const gear = make(80, true);
    const openings = gearSpokeOpenings(gear);
    expect(openings).toHaveLength(5);
    const pitchR = pitchDiameter(gear.module, gear.toothCount) / 2;
    const rootR = pitchR - 1.25 * gear.module;
    let maxR = 0;
    let minR = Number.POSITIVE_INFINITY;
    for (const opening of openings) {
      for (const p of opening) {
        const r = Math.hypot(p.x, p.y);
        maxR = Math.max(maxR, r);
        minR = Math.min(minR, r);
      }
    }
    expect(maxR).toBeCloseTo(rootR * (1 - GEAR_SPOKE_VISUALIZATION.rimFraction), 9);
    // The gaps stay outside the visual bore, so the hub is never cut through.
    expect(minR).toBeGreaterThan(visualBoreRadius(gear));
  });

  it("cuts material from the extruded gear only when the gear is flagged and has enough teeth", () => {
    const faceArea = (geometry: ReturnType<typeof createGearGeometry>): number => {
      const pos = geometry.attributes.position;
      const index = geometry.index;
      if (pos === undefined) throw new Error("no positions");
      let area = 0;
      const tri = (a: number, b: number, c: number): void => {
        if (!(pos.getZ(a) > 0 && pos.getZ(b) > 0 && pos.getZ(c) > 0)) return;
        area += Math.abs((pos.getX(b) - pos.getX(a)) * (pos.getY(c) - pos.getY(a)) - (pos.getX(c) - pos.getX(a)) * (pos.getY(b) - pos.getY(a))) / 2;
      };
      if (index === null) for (let i = 0; i < pos.count; i += 3) tri(i, i + 1, i + 2);
      else for (let i = 0; i < index.count; i += 3) tri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
      return area;
    };
    const solid = faceArea(createGearGeometry(make(80, false)));
    const spoked = faceArea(createGearGeometry(make(80, true)));
    expect(spoked).toBeLessThan(solid * 0.8);
    expect(spoked).toBeGreaterThan(solid * 0.3);
    // Below the floor the gear is drawn solid whatever the flag says (GEAR-105 reports it).
    const small = make(GEAR_SPOKE_MIN_TOOTH_COUNT - 1, true);
    expect(faceArea(createGearGeometry(small))).toBeCloseTo(faceArea(createGearGeometry(make(GEAR_SPOKE_MIN_TOOTH_COUNT - 1, false))), 12);
    expect(faceArea(createGearGeometry(make(GEAR_SPOKE_MIN_TOOTH_COUNT, true)))).toBeLessThan(faceArea(createGearGeometry(make(GEAR_SPOKE_MIN_TOOTH_COUNT, false))));
  });

  it("leaves the tooth outline and pitch geometry untouched", () => {
    const a = generateGearOutline(make(80, false));
    const b = generateGearOutline(make(80, true));
    expect(b).toEqual(a);
  });
});

