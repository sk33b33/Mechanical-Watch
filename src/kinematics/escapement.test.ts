import { describe, expect, it } from "vitest";
import { degrees, toDegrees } from "@/units/angle";
import { rpmToRadPerSecond } from "@/units/angularVelocity";
import { hertz, toBeatsPerHour } from "@/units/frequency";
import {
  balanceFrequency,
  beatFrequency,
  beatsPerEscapeRevolution,
  escapementMotion,
  impulseFraction,
  type EscapementInputs,
} from "./escapement";

describe("escapement rate (ASM-0021)", () => {
  it("two beats per escape tooth", () => {
    expect(beatsPerEscapeRevolution(15)).toBe(30);
    expect(() => beatsPerEscapeRevolution(0)).toThrow();
    expect(() => beatsPerEscapeRevolution(14.5)).toThrow();
  });

  it("an escape arbor at 10 rev/min with 15 teeth beats 18 000 times an hour; the balance runs at 2.5 Hz", () => {
    const beats = beatFrequency(rpmToRadPerSecond(10), 15);
    expect(toBeatsPerHour(beats)).toBeCloseTo(18000, 9);
    expect(balanceFrequency(beats)).toBeCloseTo(2.5, 12);
  });

  it("direction does not change the beat rate", () => {
    expect(beatFrequency(rpmToRadPerSecond(-10), 15)).toBeCloseTo(beatFrequency(rpmToRadPerSecond(10), 15), 12);
  });
});

describe("impulse window (ASM-0022, ASM-0023)", () => {
  it("is the share of each swing spent within half the lift angle of the dead point", () => {
    expect(impulseFraction(degrees(270), degrees(50))).toBeCloseTo((2 / Math.PI) * Math.asin(50 / 540), 12);
  });

  it("needs an amplitude above half the lift angle", () => {
    expect(impulseFraction(degrees(20), degrees(50))).toBeNull();
    expect(impulseFraction(degrees(Number.NaN), degrees(50))).toBeNull();
    expect(impulseFraction(degrees(270), degrees(0))).toBeNull();
  });
});

describe("escapement motion", () => {
  const inputs: EscapementInputs = { beatFrequency: hertz(5), amplitude: degrees(270), liftAngle: degrees(50), leverAngle: degrees(10) };
  const T = 1 / 5;
  const at = (t: number): NonNullable<ReturnType<typeof escapementMotion>> => {
    const m = escapementMotion(inputs, t);
    if (m === null) throw new Error("invalid inputs");
    return m;
  };

  it("the train keeps real time on average: never more than half a beat off, and exact at each dead point", () => {
    for (let t = 0; t < 3; t += 0.0007) {
      const m = at(t);
      expect(Math.abs(m.effectiveTime - t)).toBeLessThanOrEqual(T / 2 + 1e-12);
    }
    for (let n = 0; n < 10; n += 1) expect(at(n * T).effectiveTime).toBeCloseTo(n * T, 12);
  });

  it("the train never runs backward and is locked between impulse windows", () => {
    let previous = at(0).effectiveTime;
    for (let t = 0.0005; t < 2; t += 0.0005) {
      const now = at(t).effectiveTime;
      expect(now).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = now;
    }
    // Midway between dead points, outside any window, it stands still.
    expect(at(0.5 * T - 0.001).effectiveTime).toBeCloseTo(at(0.5 * T + 0.001).effectiveTime, 12);
  });

  it("the fork rests on alternate bankings and crosses at each dead point, with the balance", () => {
    const L = 10;
    expect(toDegrees(at(0.5 * T - 0.001).forkAngle)).toBeCloseTo(L / 2, 9);
    expect(toDegrees(at(1.5 * T - 0.001).forkAngle)).toBeCloseTo(-L / 2, 9);
    expect(at(T).forkAngle).toBeCloseTo(0, 12);
    // Balance at its dead point then, swinging with amplitude A.
    expect(at(T).balanceAngle).toBeCloseTo(0, 9);
    expect(toDegrees(at(T / 2).balanceAngle)).toBeCloseTo(270, 9);
  });

  it("is deterministic in time (SIM-002)", () => {
    expect(at(1.2345)).toEqual(at(1.2345));
  });
});
