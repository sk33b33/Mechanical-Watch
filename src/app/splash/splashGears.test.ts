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

import { partOnScreen, SPLASH_PARTS, tiltInput, TILT } from "./splashGears";

describe("tilt to look around (follow-up 44)", () => {
  const level = { gamma: 2, beta: 55 };

  it("a phone held level, or within the hand's tremor, does not pan", () => {
    expect(tiltInput(level, level, 0)).toEqual({ x: 0, y: 0 });
    expect(tiltInput({ gamma: 2 + TILT.deadZoneDegrees, beta: 55 - TILT.deadZoneDegrees }, level, 0)).toEqual({ x: 0, y: 0 });
  });

  it("tilting right and towards the bottom gives positive input, saturating at full tilt", () => {
    const some = tiltInput({ gamma: 12, beta: 65 }, level, 0);
    expect(some.x).toBeGreaterThan(0);
    expect(some.y).toBeGreaterThan(0);
    expect(some.x).toBeLessThan(1);
    expect(tiltInput({ gamma: 80, beta: 150 }, level, 0)).toEqual({ x: 1, y: 1 });
    expect(tiltInput({ gamma: -80, beta: -50 }, level, 0)).toEqual({ x: -1, y: -1 });
  });

  it("whatever way the phone is held counts as level, because the first reading is the reference", () => {
    const held = { gamma: -20, beta: 120 };
    expect(tiltInput(held, held, 0)).toEqual({ x: 0, y: 0 });
  });

  it("rotating the screen swaps the axes, and a full turn is the identity", () => {
    const reading = { gamma: 22, beta: 55 };
    expect(tiltInput(reading, { gamma: 0, beta: 55 }, 0)).toEqual({ x: 1, y: 0 });
    expect(tiltInput(reading, { gamma: 0, beta: 55 }, 90)).toEqual({ x: 0, y: -1 });
    expect(tiltInput(reading, { gamma: 0, beta: 55 }, 180)).toEqual({ x: -1, y: 0 });
    expect(tiltInput(reading, { gamma: 0, beta: 55 }, 270)).toEqual({ x: 0, y: 1 });
    expect(tiltInput(reading, { gamma: 0, beta: 55 }, 360)).toEqual(tiltInput(reading, { gamma: 0, beta: 55 }, 0));
    expect(tiltInput(reading, { gamma: 0, beta: 55 }, -90)).toEqual(tiltInput(reading, { gamma: 0, beta: 55 }, 270));
  });
});

describe("complication parts waiting beyond the screen edges (follow-up 44)", () => {
  const screens = [{ w: 390, h: 844 }, { w: 844, h: 390 }, { w: 1400, h: 900 }];

  it("none is on screen at rest, on a phone held upright or sideways or on a desktop window", () => {
    for (const { w, h } of screens) {
      for (const part of SPLASH_PARTS) expect(partOnScreen(part, w, h, { x: 0, y: 0 }), `${part.kind} at ${String(w)}x${String(h)}`).toBe(false);
    }
  });

  it("a full tilt in any direction brings at least one into view, and every part is reachable by some tilt", () => {
    for (const { w, h } of screens) {
      const reach = TILT.panFraction;
      const views = [{ x: reach * w, y: 0 }, { x: -reach * w, y: 0 }, { x: 0, y: reach * h }, { x: 0, y: -reach * h },
        { x: reach * w, y: reach * h }, { x: -reach * w, y: reach * h }, { x: reach * w, y: -reach * h }, { x: -reach * w, y: -reach * h }];
      for (const view of views) expect(SPLASH_PARTS.some((p) => partOnScreen(p, w, h, view)), `${String(view.x)},${String(view.y)} at ${String(w)}x${String(h)}`).toBe(true);
      for (const part of SPLASH_PARTS) expect(views.some((view) => partOnScreen(part, w, h, view)), `${part.kind} at ${String(w)}x${String(h)}`).toBe(true);
    }
  });

  it("a mouse pointer's small nudge never brings one into view", () => {
    for (const { w, h } of screens) {
      for (const part of SPLASH_PARTS) {
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          expect(partOnScreen(part, w, h, { x: sx * TILT.pointerPanFraction * w, y: sy * TILT.pointerPanFraction * h })).toBe(false);
        }
      }
    }
  });
});

import { moonLitPoints } from "./splashGears";

describe("the off-screen moon wheel's lit phases", () => {
  const area = (points: { x: number; y: number }[]): number => {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (a === undefined || b === undefined) continue;
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
  };

  it("a new moon is dark and a full moon is the whole disc", () => {
    expect(moonLitPoints(0, 10)).toEqual([]);
    expect(area(moonLitPoints(0.5, 10, 200))).toBeCloseTo(Math.PI * 100, 0);
  });

  it("the lit area follows (1 - cos 2 pi p) / 2 of the disc", () => {
    for (const p of [0.125, 0.25, 0.375, 0.625, 0.75, 0.875]) {
      expect(area(moonLitPoints(p, 10, 400)) / (Math.PI * 100)).toBeCloseTo((1 - Math.cos(2 * Math.PI * p)) / 2, 2);
    }
  });
});
