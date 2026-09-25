import { describe, expect, it } from "vitest";
import { millimetres } from "@/units/length";
import { createGear } from "@/domain/gear";
import { generateGearOutline } from "./gearOutline";

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
