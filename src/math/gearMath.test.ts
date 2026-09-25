import { describe, expect, it } from "vitest";
import { millimetres, toMillimetres } from "@/units/length";
import { rpmToRadPerSecond, toRpm } from "@/units/angularVelocity";
import { newtonMetres, toNewtonMetres } from "@/units/torque";
import {
  InvalidGearParameterError,
  pitchDiameter,
  idealCentreDistance,
  meshCentreDistance,
  isCentreDistanceAchievable,
  meshSpeedRatio,
  drivenAngularVelocity,
  compoundSpeedRatio,
  drivenTorque,
} from "./gearMath";

describe("pitchDiameter", () => {
  it("computes module * toothCount", () => {
    const d = pitchDiameter(millimetres(0.2), 60);
    expect(toMillimetres(d)).toBeCloseTo(12);
  });

  it("rejects invalid tooth counts", () => {
    expect(() => pitchDiameter(millimetres(0.2), 3)).toThrow(InvalidGearParameterError);
    expect(() => pitchDiameter(millimetres(0.2), 6.5)).toThrow(InvalidGearParameterError);
  });

  it("rejects invalid module", () => {
    expect(() => pitchDiameter(millimetres(0), 60)).toThrow(InvalidGearParameterError);
    expect(() => pitchDiameter(millimetres(-0.2), 60)).toThrow(InvalidGearParameterError);
  });
});

describe("centre distance", () => {
  it("is the average of the two pitch diameters", () => {
    const a = pitchDiameter(millimetres(0.2), 60);
    const b = pitchDiameter(millimetres(0.2), 10);
    expect(toMillimetres(idealCentreDistance(a, b))).toBeCloseTo(7);
  });

  it("matches the direct mesh helper", () => {
    expect(toMillimetres(meshCentreDistance(millimetres(0.2), 60, 10))).toBeCloseTo(7);
  });

  it("flags an impossible centre distance", () => {
    const ideal = meshCentreDistance(millimetres(0.2), 60, 10);
    expect(isCentreDistanceAchievable(millimetres(0.2), 60, 10, ideal)).toBe(true);
    expect(isCentreDistanceAchievable(millimetres(0.2), 60, 10, millimetres(99))).toBe(false);
  });
});

describe("meshSpeedRatio / direction reversal", () => {
  it("is negative for an external mesh (direction reversal)", () => {
    expect(meshSpeedRatio(60, 10)).toBeLessThan(0);
  });

  it("has magnitude drivingTeeth / drivenTeeth", () => {
    expect(meshSpeedRatio(60, 10)).toBeCloseTo(-6);
  });

  it("propagates angular velocity with reversed sign", () => {
    const driving = rpmToRadPerSecond(60);
    const driven = drivenAngularVelocity(driving, 60, 10);
    expect(toRpm(driven)).toBeCloseTo(-360);
  });
});

describe("compoundSpeedRatio", () => {
  it("multiplies stage ratios and preserves direction bookkeeping", () => {
    // two external meshes: each reverses direction, so net direction
    // is preserved (double negative).
    const ratio = compoundSpeedRatio([
      { drivingTeeth: 60, drivenTeeth: 10 },
      { drivingTeeth: 40, drivenTeeth: 8 },
    ]);
    expect(ratio).toBeCloseTo(-6 * -5);
    expect(ratio).toBeGreaterThan(0);
  });

  it("rejects an empty train", () => {
    expect(() => compoundSpeedRatio([])).toThrow(InvalidGearParameterError);
  });
});

describe("drivenTorque", () => {
  it("multiplies torque inversely to the speed ratio (ideal, lossless)", () => {
    const driving = newtonMetres(1);
    const driven = drivenTorque(driving, 60, 10);
    // speed ratio magnitude 6 (driven spins 6x faster) => torque divided by 6
    expect(Math.abs(toNewtonMetres(driven))).toBeCloseTo(1 / 6);
  });

  it("reverses sign with the direction reversal", () => {
    const driven = drivenTorque(newtonMetres(1), 60, 10);
    expect(toNewtonMetres(driven)).toBeLessThan(0);
  });
});
