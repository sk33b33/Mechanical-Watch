import type { AssumptionId } from "@/reference/assumptions";

/**
 * Night mode (follow-up 51, ASM-0095): the view darkens, and the glow-in-the-dark (lume) parts of the dial light up.
 * Presentation only: it changes how the scene is lit, never the design, the simulation or any export. The lume's
 * glow is an emissive colour, a picture of phosphorescence: it does not fade over time the way a real charged lume
 * does, and no luminance or charge time is modelled or claimed.
 */
export const NIGHT_MODE = {
  /** The scene's lights at full night, as a fraction of their daytime strength ("darkens slightly": still readable). */
  lightScale: 0.4,
  /** The background at full night, as a fraction of its daytime brightness. */
  backgroundScale: 0.45,
  /** How fast the view moves into or out of night, in full transitions per second (about 0.6 s). */
  rampPerSecond: 1.7,
  /** The lume by day: a pale cream-green paint that does not glow. */
  lumeDayColour: 0xdfe8c4,
  /** The colour it glows at night. */
  lumeGlowColour: 0x7dffb2,
  /** How strongly it glows at full night (the emissive intensity). */
  lumeGlowIntensity: 1.8,
  assumption: "ASM-0095" satisfies AssumptionId,
} as const;

/** One frame's step of the night amount (0 day, 1 night) towards its target, never overshooting. */
export function nightStep(current: number, target: number, seconds: number): number {
  const step = NIGHT_MODE.rampPerSecond * Math.max(0, seconds);
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

/** A light's strength at a given night amount: the daytime strength, scaled down towards `lightScale`. */
export function nightLightIntensity(daytime: number, amount: number): number {
  return daytime * (1 - (1 - NIGHT_MODE.lightScale) * clamp01(amount));
}

/** The background colour (0xrrggbb) at a given night amount. */
export function nightBackground(daytime: number, amount: number): number {
  const scale = 1 - (1 - NIGHT_MODE.backgroundScale) * clamp01(amount);
  const channel = (shift: number): number => Math.round(((daytime >> shift) & 255) * scale);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** How strongly the lume glows at a given night amount. */
export function lumeGlow(amount: number): number {
  return NIGHT_MODE.lumeGlowIntensity * clamp01(amount);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
