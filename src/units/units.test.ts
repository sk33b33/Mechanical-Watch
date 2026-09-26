import { describe, expect, it } from "vitest";
import {
  kilogramSquareMetres,
  micronewtonMillimetresPerRadian,
  milligramSquareCentimetres,
  newtonMetresPerRadian,
  toMicronewtonMillimetresPerRadian,
  toMilligramSquareCentimetres,
} from "./rotational";
import { beatsPerHour, hertz, toBeatsPerHour, toHertz } from "./frequency";
import { millimetres, toMillimetres, metres } from "./length";
import { degrees, toDegrees, radians, normalizeAngle } from "./angle";
import { minutes, toSeconds, seconds } from "./time";
import { rpmToRadPerSecond, toRpm, radiansPerSecond } from "./angularVelocity";

describe("Length", () => {
  it("round-trips millimetres through metres", () => {
    expect(toMillimetres(millimetres(30))).toBeCloseTo(30);
    expect(toMillimetres(metres(0.03))).toBeCloseTo(30);
  });
});

describe("Angle", () => {
  it("converts degrees to radians and back", () => {
    expect(toDegrees(degrees(180))).toBeCloseTo(180);
    expect(radians(Math.PI)).toBeCloseTo(Math.PI);
  });

  it("normalizes angles into [0, 2*PI)", () => {
    expect(normalizeAngle(degrees(370))).toBeCloseTo(degrees(10));
    expect(normalizeAngle(degrees(-10))).toBeCloseTo(degrees(350));
  });
});

describe("Time", () => {
  it("converts minutes to seconds", () => {
    expect(toSeconds(minutes(2))).toBeCloseTo(120);
    expect(seconds(60)).toBeCloseTo(60);
  });
});

describe("AngularVelocity", () => {
  it("converts RPM to rad/s and back", () => {
    expect(rpmToRadPerSecond(60)).toBeCloseTo(2 * Math.PI);
    expect(toRpm(radiansPerSecond(2 * Math.PI))).toBeCloseTo(60);
  });
});

describe("rotational dynamics and frequency units", () => {
  it("converts mg·cm² and µN·mm/rad to SI and back", () => {
    expect(milligramSquareCentimetres(10)).toBeCloseTo(1e-9, 24);
    expect(toMilligramSquareCentimetres(kilogramSquareMetres(1e-9))).toBeCloseTo(10, 12);
    expect(micronewtonMillimetresPerRadian(246.7)).toBeCloseTo(2.467e-7, 20);
    expect(toMicronewtonMillimetresPerRadian(newtonMetresPerRadian(2.467e-7))).toBeCloseTo(246.7, 9);
  });

  it("keeps hertz apart from rad/s and converts beats per hour", () => {
    expect(toBeatsPerHour(hertz(5))).toBe(18000);
    expect(toHertz(beatsPerHour(18000))).toBe(5);
  });
});
