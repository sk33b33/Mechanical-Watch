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
  pitchLineVelocity,
} from "./gearMath";
import { toMillimetresPerSecond } from "@/units/linearVelocity";

describe("pitchDiameter", () => {
  it("computes module * toothCount", () => {
    const d = pitchDiameter(millimetres(0.2), 60);
    expect(toMillimetres(d)).toBeCloseTo(12);
  });

  it("rejects invalid tooth counts (GEAR-001: positive integer)", () => {
    expect(() => pitchDiameter(millimetres(0.2), 0)).toThrow(InvalidGearParameterError);
    expect(() => pitchDiameter(millimetres(0.2), -6)).toThrow(InvalidGearParameterError);
    expect(() => pitchDiameter(millimetres(0.2), 6.5)).toThrow(InvalidGearParameterError);
    expect(() => pitchDiameter(millimetres(0.2), Number.NaN)).toThrow(InvalidGearParameterError);
  });

  it("does not impose an unsourced minimum tooth count", () => {
    // GEAR-001 only requires a positive integer; any practical minimum
    // (undercut, pinion leaf counts) needs a source before it is enforced.
    expect(toMillimetres(pitchDiameter(millimetres(0.2), 1))).toBeCloseTo(0.2);
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

  it("matches §5.4 T2/T1 = z2/z1 in magnitude (reduction case)", () => {
    const driven = drivenTorque(newtonMetres(1), 10, 60);
    expect(Math.abs(toNewtonMetres(driven))).toBeCloseTo(6);
  });

  it("applies an explicitly configured efficiency (ASM-0002)", () => {
    // 0.5 is an arbitrary test input, not a claimed real-world efficiency.
    const driven = drivenTorque(newtonMetres(1), 10, 60, { value: 0.5, reference: "ASM-0002" });
    expect(Math.abs(toNewtonMetres(driven))).toBeCloseTo(3);
  });

  it("rejects an efficiency outside (0, 1]", () => {
    expect(() => drivenTorque(newtonMetres(1), 10, 60, { value: 1.2, reference: "ASM-0002" })).toThrow(
      InvalidGearParameterError,
    );
    expect(() => drivenTorque(newtonMetres(1), 10, 60, { value: 0, reference: "ASM-0002" })).toThrow(
      InvalidGearParameterError,
    );
  });
});

describe("pitchLineVelocity", () => {
  it("computes v = ω r (§5.5)", () => {
    // 60 rpm = 2π rad/s; d = 12 mm => r = 6 mm => v = 12π mm/s
    const v = pitchLineVelocity(rpmToRadPerSecond(60), pitchDiameter(millimetres(0.2), 60));
    expect(toMillimetresPerSecond(v)).toBeCloseTo(12 * Math.PI);
  });

  it("is equal on both gears of a mesh (no slip at the pitch point)", () => {
    const driving = rpmToRadPerSecond(60);
    const driven = drivenAngularVelocity(driving, 60, 10);
    const vA = pitchLineVelocity(driving, pitchDiameter(millimetres(0.2), 60));
    const vB = pitchLineVelocity(driven, pitchDiameter(millimetres(0.2), 10));
    expect(vA).toBeCloseTo(vB, 12);
  });
});
