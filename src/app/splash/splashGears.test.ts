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

import { FIELD_GAP_FRACTION, gearFieldGap, orientationMatrix, panRange, partOnScreen, SPLASH_CORE_COUNT, SPLASH_PARTS, springStep, tiltFromLevel, tiltInput, TILT } from "./splashGears";

describe("tilt to look around (follow-up 44, continuous in follow-up 51)", () => {
  const level = { gamma: 2, beta: 55, alpha: 0 };

  it("a phone held level, or within the hand's tremor, does not pan", () => {
    expect(tiltInput(level, level, 0)).toEqual({ x: 0, y: 0 });
    expect(tiltInput({ gamma: 3, beta: 54, alpha: 0 }, level, 0)).toEqual({ x: 0, y: 0 });
  });

  it("tilting right and towards the bottom gives positive input, saturating at full tilt", () => {
    const some = tiltInput({ gamma: 12, beta: 65, alpha: 0 }, level, 0);
    expect(some.x).toBeGreaterThan(0);
    expect(some.y).toBeGreaterThan(0);
    expect(some.x).toBeLessThan(1);
    expect(tiltInput({ gamma: 40, beta: 90, alpha: 0 }, level, 0)).toEqual({ x: 1, y: 1 });
    expect(tiltInput({ gamma: -40, beta: 20, alpha: 0 }, level, 0)).toEqual({ x: -1, y: -1 });
  });

  it("whatever way the phone is held counts as level, because the first reading is the reference", () => {
    const held = { gamma: -20, beta: 120, alpha: 70 };
    expect(tiltInput(held, held, 0)).toEqual({ x: 0, y: 0 });
  });

  it("measures a turn about one axis as that many degrees, as the change in gamma or beta did", () => {
    expect(tiltFromLevel({ gamma: 12, beta: 55, alpha: 0 }, level).y).toBeCloseTo(10, 9);
    expect(tiltFromLevel({ gamma: 2, beta: 70, alpha: 0 }, level).x).toBeCloseTo(15, 1); // (the level pose has a little gamma of its own)
  });

  it("rotating the screen swaps the axes, and a full turn is the identity", () => {
    const reading = { gamma: 22, beta: 55, alpha: 0 };
    const flat = { gamma: 0, beta: 55, alpha: 0 };
    const at = (angle: number): { x: number; y: number } => {
      const { x, y } = tiltInput(reading, flat, angle);
      return { x: Math.round(x * 1e9) / 1e9 + 0, y: Math.round(y * 1e9) / 1e9 + 0 };
    };
    expect(at(0)).toEqual({ x: 1, y: 0 });
    expect(at(90)).toEqual({ x: 0, y: -1 });
    expect(at(180)).toEqual({ x: -1, y: 0 });
    expect(at(270)).toEqual({ x: 0, y: 1 });
    expect(at(360)).toEqual(at(0));
    expect(at(-90)).toEqual(at(270));
  });

  /** The W3C Euler angles (degrees, gamma limited to [-90, 90)) of a device-to-earth rotation matrix. */
  const eulerOf = (m: Matrix): { alpha: number; beta: number; gamma: number } => {
    const deg = 180 / Math.PI;
    const beta = Math.asin(Math.max(-1, Math.min(1, m[2][1])));
    let gamma = Math.atan2(-m[2][0], m[2][2]);
    let alpha = Math.atan2(-m[0][1], m[1][1]);
    let b = beta;
    if (gamma >= Math.PI / 2 || gamma < -Math.PI / 2) {
      // The same rotation with gamma brought into range, as the specification does.
      gamma += gamma > 0 ? -Math.PI : Math.PI;
      b = (b >= 0 ? Math.PI : -Math.PI) - b;
      alpha += alpha > 0 ? -Math.PI : Math.PI;
    }
    return { alpha: (((alpha * deg) % 360) + 360) % 360, beta: b * deg, gamma: gamma * deg };
  };

  type Matrix = ReturnType<typeof orientationMatrix>;
  /** The rotation `m` followed by a turn of `turn` radians about the unit earth axis `axis` (Rodrigues' formula). */
  const aboutAxis = (axis: readonly [number, number, number], turn: number, m: Matrix): Matrix => {
    const [x, y, z] = axis;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const t = 1 - c;
    const r = [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
    const row = (i: 0 | 1 | 2): [number, number, number] => {
      const cell = (j: 0 | 1 | 2): number => (r[i]?.[0] ?? 0) * m[0][j] + (r[i]?.[1] ?? 0) * m[1][j] + (r[i]?.[2] ?? 0) * m[2][j];
      return [cell(0), cell(1), cell(2)];
    };
    return [row(0), row(1), row(2)];
  };

  it("does not jump when the phone is stood nearly upright, where the Euler angles themselves flip", () => {
    // Swing a phone that stands almost upright (beta 89.5 degrees, the Euler singularity at 90) about each of the earth's
    // axes in quarter-degree steps. Alpha and gamma lurch by huge amounts for some of these tiny movements; the pan input
    // follows the true rotation and so changes in small steps.
    const start = { alpha: 0, beta: 89.5, gamma: 0 };
    const startMatrix = orientationMatrix(start);
    let biggestRawJump = 0;
    let biggestStep = 0;
    for (const axis of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.6, 0.8, 0]] as const) {
      let previous: { x: number; y: number } | null = null;
      let previousRaw: { alpha: number; beta: number; gamma: number } | null = null;
      for (let degrees = -40; degrees <= 40; degrees += 0.25) {
        const raw = eulerOf(aboutAxis(axis, degrees * (Math.PI / 180), startMatrix));
        const input = tiltInput(raw, start, 0);
        if (previousRaw !== null) {
          const wrap = (d: number): number => Math.abs(((d + 540) % 360) - 180);
          biggestRawJump = Math.max(biggestRawJump, wrap(raw.gamma - previousRaw.gamma), wrap(raw.alpha - previousRaw.alpha));
        }
        if (previous !== null) biggestStep = Math.max(biggestStep, Math.abs(input.x - previous.x), Math.abs(input.y - previous.y));
        previous = input;
        previousRaw = raw;
      }
    }
    expect(biggestRawJump, "the raw angles do jump on this path").toBeGreaterThan(20);
    // A quarter degree of turning is about 1 percent of the 22-degree range; the input never steps by more than a few times that.
    expect(biggestStep).toBeLessThan(0.05);
  });
});

describe("critically damped pan (follow-up 51)", () => {
  it("reaches the target without overshooting and without a velocity kick at the start", () => {
    let position = 0;
    let velocity = 0;
    let peak = 0;
    for (let i = 0; i < 600; i += 1) {
      ({ position, velocity } = springStep(position, velocity, 100, TILT.springOmega, 1 / 60));
      peak = Math.max(peak, position);
      if (i === 0) expect(position).toBeLessThan(2); // starts gently: under 2 percent of the way after a frame
    }
    expect(peak).toBeLessThanOrEqual(100 + 1e-9);
    expect(position).toBeCloseTo(100, 3);
  });

  it("gives the same result however the time is divided, and stays put at the target", () => {
    const whole = springStep(0, 0, 50, TILT.springOmega, 0.5);
    let position = 0;
    let velocity = 0;
    for (let i = 0; i < 50; i += 1) ({ position, velocity } = springStep(position, velocity, 50, TILT.springOmega, 0.01));
    expect(position).toBeCloseTo(whole.position, 9);
    expect(velocity).toBeCloseTo(whole.velocity, 9);
    expect(springStep(50, 0, 50, TILT.springOmega, 0.1)).toEqual({ position: 50, velocity: 0 });
  });
});

describe("the gear field is wide enough to tilt across (follow-up 51)", () => {
  const phones = [{ w: 390, h: 844 }, { w: 844, h: 390 }, { w: 360, h: 800 }, { w: 800, h: 360 }, { w: 768, h: 1024 }, { w: 1024, h: 768 }];

  it("leaves no hole wider than the allowed fraction of the shorter side at any pan, on phones and tablets that tilt", () => {
    for (const { w, h } of phones) {
      expect(gearFieldGap(w, h, true), `${String(w)}x${String(h)}`).toBeLessThanOrEqual(FIELD_GAP_FRACTION * Math.min(w, h));
    }
  });

  it("also covers a desktop window, where the view only nudges", () => {
    for (const { w, h } of [{ w: 1400, h: 900 }, { w: 1920, h: 1080 }, { w: 900, h: 1400 }]) {
      expect(gearFieldGap(w, h, false), `${String(w)}x${String(h)}`).toBeLessThanOrEqual(FIELD_GAP_FRACTION * Math.min(w, h));
    }
  });

  it("the pan range is a fixed fraction of each side, larger when the device tilts", () => {
    expect(panRange(400, 800, true)).toEqual({ x: TILT.panFraction * 400, y: TILT.panFraction * 800 });
    expect(panRange(400, 800, false).x).toBeLessThan(panRange(400, 800, true).x);
  });

  it("the portrait layout is the same train turned a quarter turn, with every mesh intact", () => {
    const upright = splashGearTrain(true);
    const sideways = splashGearTrain(false);
    expect(upright).toHaveLength(sideways.length);
    upright.forEach((gear, i) => {
      const other = sideways[i];
      if (other === undefined) throw new Error("gear missing");
      expect(Math.hypot(gear.x, gear.y)).toBeCloseTo(Math.hypot(other.x, other.y), 9);
      expect(gear.x).toBeCloseTo(-other.y, 9);
      expect(gear.y).toBeCloseTo(other.x, 9);
      if (gear.drivenBy === null) return;
      const driver = upright[gear.drivenBy];
      if (driver === undefined) throw new Error("driver missing");
      expect(Math.hypot(gear.x - driver.x, gear.y - driver.y)).toBeCloseTo(meshCentreDistance(metres(1), driver.teeth, gear.teeth), 9);
    });
  });

  it("keeps the hand-composed centrepiece first, so the arrival view is unchanged", () => {
    expect(splashGearTrain().slice(0, SPLASH_CORE_COUNT).map((g) => g.teeth)).toEqual([60, 36, 20, 44, 16, 28]);
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
