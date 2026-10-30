import { describe, expect, it } from "vitest";
import { lumeGlow, NIGHT_MODE, nightBackground, nightLightIntensity, nightStep } from "./nightMode";

describe("night mode (ASM-0095)", () => {
  it("by day nothing changes and nothing glows; at night the lights are dimmer, the background darker and the lume glows", () => {
    expect(nightLightIntensity(1.3, 0)).toBeCloseTo(1.3, 12);
    expect(nightLightIntensity(1.3, 1)).toBeCloseTo(1.3 * NIGHT_MODE.lightScale, 12);
    expect(nightBackground(0x0b0d10, 0)).toBe(0x0b0d10);
    expect(nightBackground(0x808080, 1)).toBe(0x3a3a3a);
    expect(lumeGlow(0)).toBe(0);
    expect(lumeGlow(1)).toBe(NIGHT_MODE.lumeGlowIntensity);
  });

  it("darkens slightly: the lights stay at more than a third of their daytime strength, so the movement is still readable", () => {
    expect(NIGHT_MODE.lightScale).toBeGreaterThan(0.33);
    expect(NIGHT_MODE.lightScale).toBeLessThan(0.7);
  });

  it("is monotonic between day and night, and clamps outside 0 to 1", () => {
    let previous = Infinity;
    for (let a = 0; a <= 1.0001; a += 0.1) { const v = nightLightIntensity(1, a); expect(v).toBeLessThanOrEqual(previous + 1e-12); previous = v; }
    expect(nightLightIntensity(1, -3)).toBeCloseTo(1, 12);
    expect(nightLightIntensity(1, 9)).toBeCloseTo(NIGHT_MODE.lightScale, 12);
    expect(lumeGlow(5)).toBe(NIGHT_MODE.lumeGlowIntensity);
  });

  it("eases towards the target in under a second without overshooting, either way", () => {
    let amount = 0;
    for (let i = 0; i < 40; i += 1) { amount = nightStep(amount, 1, 1 / 60); expect(amount).toBeLessThanOrEqual(1); }
    expect(amount).toBeCloseTo(1, 9);
    expect(nightStep(0.5, 1, 100)).toBe(1);
    expect(nightStep(0.5, 0, 100)).toBe(0);
    expect(nightStep(0.3, 0.3, 1)).toBe(0.3);
    expect(nightStep(0.3, 1, -5)).toBe(0.3);
  });
});
