import { describe, expect, it } from "vitest";
import { meshCentreDistance, meshSpeedRatio } from "@/math/gearMath";
import { metres } from "@/units/length";
import { gearOutline, meshedAngle, splashDisabled, splashGearAngles, splashGearTrain, splashTrainBounds, SPLASH_TOOTH } from "./splashGears";

describe("splash gear train (decorative, L0, reusing the gear relations)", () => {
  const train = splashGearTrain();

  it("places every meshed pair at the ideal centre distance a = m (z1 + z2) / 2", () => {
    for (const gear of train) {
      if (gear.drivenBy === null) continue;
      const driver = train[gear.drivenBy];
      if (driver === undefined) throw new Error("driver missing");
      const distance = Math.hypot(gear.x - driver.x, gear.y - driver.y);
      expect(distance).toBeCloseTo(meshCentreDistance(metres(1), driver.teeth, gear.teeth), 9);
    }
  });

  it("no two gears that are not meshed overlap (tip circles stay apart)", () => {
    for (let i = 0; i < train.length; i += 1) {
      for (let j = i + 1; j < train.length; j += 1) {
        const a = train[i];
        const b = train[j];
        if (a === undefined || b === undefined) throw new Error("gear missing");
        if (a.drivenBy === j || b.drivenBy === i) continue;
        const reach = a.teeth / 2 + b.teeth / 2 + 2 * SPLASH_TOOTH.addendum;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `gears ${String(i)} and ${String(j)}`).toBeGreaterThan(reach);
      }
    }
  });

  it("a driven gear turns at -z1/z2 of its driver and in the opposite direction", () => {
    const step = 0.01;
    const before = splashGearAngles(train, 1);
    const after = splashGearAngles(train, 1 + step);
    train.forEach((gear, i) => {
      if (gear.drivenBy === null) return;
      const driver = train[gear.drivenBy];
      const driverTurn = (after[gear.drivenBy] ?? 0) - (before[gear.drivenBy] ?? 0);
      const turn = (after[i] ?? 0) - (before[i] ?? 0);
      expect(turn / driverTurn).toBeCloseTo(meshSpeedRatio(driver?.teeth ?? 1, gear.teeth), 9);
    });
  });

  it("interlocks: when a driver tooth points at the driven gear, the driven gear has a gap there", () => {
    const direction = 0.7;
    const zA = 36;
    const zB = 20;
    const driverAngle = direction; // tooth 0 of the driver points at the driven gear
    const driven = meshedAngle(driverAngle, zA, zB, direction);
    const pitchAngle = (2 * Math.PI) / zB;
    // The driven gear's nearest tooth to the contact line (direction + π) is half a pitch away.
    const offset = (((direction + Math.PI - driven) % pitchAngle) + pitchAngle) % pitchAngle;
    expect(offset).toBeCloseTo(pitchAngle / 2, 9);
  });

  it("keeps the interlock as the driver turns (a tooth and a gap alternate at the contact line)", () => {
    const direction = -0.5;
    const zA = 28;
    const zB = 44;
    for (const turn of [0.03, 0.2, 1.1, 2.9]) {
      const a = direction + turn;
      const b = meshedAngle(a, zA, zB, direction);
      // Tooth-pitch arc lengths at the pitch circles advance equally: rA·Δa = -rB·Δb.
      const b0 = meshedAngle(direction, zA, zB, direction);
      expect((zA / 2) * turn).toBeCloseTo(-(zB / 2) * (b - b0), 9);
    }
  });

  it("outlines have four points per tooth, between the root and tip circles", () => {
    const outline = gearOutline(24, 0.3);
    expect(outline).toHaveLength(24 * 4);
    const radii = outline.map((p) => Math.hypot(p.x, p.y));
    expect(Math.min(...radii)).toBeCloseTo(12 - SPLASH_TOOTH.dedendum, 9);
    expect(Math.max(...radii)).toBeCloseTo(12 + SPLASH_TOOTH.addendum, 9);
  });

  it("bounds contain every gear's tip circle", () => {
    const b = splashTrainBounds(train);
    for (const g of train) {
      expect(g.x - g.teeth / 2).toBeGreaterThanOrEqual(b.minX);
      expect(g.x + g.teeth / 2).toBeLessThanOrEqual(b.maxX);
      expect(g.y - g.teeth / 2).toBeGreaterThanOrEqual(b.minY);
      expect(g.y + g.teeth / 2).toBeLessThanOrEqual(b.maxY);
    }
  });
});

describe("splashDisabled", () => {
  it("is on only for ?splash=off", () => {
    expect(splashDisabled("?splash=off")).toBe(true);
    expect(splashDisabled("?a=1&splash=off")).toBe(true);
    expect(splashDisabled("")).toBe(false);
    expect(splashDisabled("?splash=on")).toBe(false);
  });
});
