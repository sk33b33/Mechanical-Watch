import { describe, expect, it } from "vitest";
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
