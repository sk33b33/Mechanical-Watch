import { describe, expect, it } from "vitest";
import { degrees, radians } from "@/units/angle";
import { radiansPerSecond } from "@/units/angularVelocity";
import { impliedLunationDays, lunationDriftMinutes, moonPhaseFraction, SYNODIC_MONTH_DAYS } from "./moonPhase";

const SECONDS_PER_DAY = 86_400;

describe("moonPhaseFraction (ASM-0047)", () => {
  it("is 0 at the disc's zero angle, for either window count", () => {
    expect(moonPhaseFraction(radians(0), 1)).toBe(0);
    expect(moonPhaseFraction(radians(0), 2)).toBe(0);
  });

  it("DOUBLE (2 windows): a half-turn is one full lunation (back to 0)", () => {
    expect(moonPhaseFraction(degrees(180), 2)).toBeCloseTo(0, 12);
    expect(moonPhaseFraction(degrees(90), 2)).toBeCloseTo(0.5, 12);
  });

  it("SINGLE (1 window): a full turn is one lunation", () => {
    expect(moonPhaseFraction(degrees(360), 1)).toBeCloseTo(0, 12);
    expect(moonPhaseFraction(degrees(180), 1)).toBeCloseTo(0.5, 12);
  });

  it("wraps a negative angle into [0, 1)", () => {
    const f = moonPhaseFraction(degrees(-90), 2);
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThan(1);
    expect(f).toBeCloseTo(0.5, 12);
  });
});

describe("impliedLunationDays (ASM-0047)", () => {
  it("a disc completing one revolution in 59 days implies 29.5 days per lunation (DOUBLE)", () => {
    const omega = radiansPerSecond((2 * Math.PI) / (59 * SECONDS_PER_DAY));
    expect(impliedLunationDays(omega, 2)).toBeCloseTo(29.5, 9);
  });

  it("the same angular velocity implies twice the period with a SINGLE window", () => {
    const omega = radiansPerSecond((2 * Math.PI) / (59 * SECONDS_PER_DAY));
    expect(impliedLunationDays(omega, 1)).toBeCloseTo(59, 9);
  });

  it("direction does not matter: a reversed (negative) angular velocity gives the same positive period", () => {
    const omega = radiansPerSecond(-(2 * Math.PI) / (59 * SECONDS_PER_DAY));
    expect(impliedLunationDays(omega, 2)).toBeCloseTo(29.5, 9);
  });

  it("is null when not driven (zero) or non-finite", () => {
    expect(impliedLunationDays(radiansPerSecond(0), 2)).toBeNull();
    expect(impliedLunationDays(radiansPerSecond(Number.NaN), 2)).toBeNull();
    expect(impliedLunationDays(radiansPerSecond(Number.POSITIVE_INFINITY), 2)).toBeNull();
  });
});

describe("lunationDriftMinutes (ASM-0047, SRC-0046)", () => {
  it("is zero when the implied period exactly matches the real synodic month", () => {
    expect(lunationDriftMinutes(SYNODIC_MONTH_DAYS)).toBeCloseTo(0, 9);
  });

  it("the conventional 29.5-day approximation runs about 44 minutes short per lunation", () => {
    // 29.53059 - 29.5 = 0.03059 days = 44.05 minutes.
    expect(lunationDriftMinutes(29.5)).toBeCloseTo(-44.05, 1);
  });

  it("a longer implied period than the real month is a positive drift", () => {
    expect(lunationDriftMinutes(30)).toBeGreaterThan(0);
  });
});
