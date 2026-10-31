import type { Movement } from "./movement";
import type { YearDigitComplicationId } from "./yearDigitComplication";
import { NO_DIAL_TEXTURE, type DialTexture } from "@/geometry/dialTexture";

/**
 * The colours the user has chosen for the dial and the wheels seen through its windows (follow-up 39,
 * ASM-0090). Presentation only, part of the saved design so a layout keeps its look, but never read by
 * validation, kinematics or any export. A colour that is `null` is not chosen: the built-in colour is used.
 */
export type HexColour = string;

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

export function isHexColour(value: unknown): value is HexColour {
  return typeof value === "string" && HEX_COLOUR.test(value);
}

/** "#rrggbb" to the number three.js takes. */
export function hexToNumber(colour: HexColour): number {
  return Number.parseInt(colour.slice(1), 16);
}

export function numberToHex(value: number): HexColour {
  return `#${Math.max(0, Math.min(0xffffff, Math.round(value))).toString(16).padStart(6, "0")}`;
}

/** The chosen colours of one wheel seen through a dial window: its body, and the text or digits printed on it. */
export interface WheelAppearance {
  body: HexColour | null;
  text: HexColour | null;
}

/** The single colours of the dial's own parts. */
export const DIAL_COLOUR_KEYS = ["dial", "hourMarkers", "dialPrint", "secondsHand", "minuteHand", "hourHand"] as const;
export type DialColourKey = (typeof DIAL_COLOUR_KEYS)[number];

export interface Appearance {
  /** The dial's face. */
  dial: HexColour | null;
  /** The top layer of the hour markers (the eleven circles and the triangle at 12); their metal body keeps its own finish (follow-up 51). */
  hourMarkers: HexColour | null;
  /** The printed text, triangles, frames and digits on the dial itself (captions, seconds numerals, window pointers and frames, the brand line). */
  dialPrint: HexColour | null;
  secondsHand: HexColour | null;
  minuteHand: HexColour | null;
  hourHand: HexColour | null;
  /** The top layer of the applied hour markers glows in the dark (lume) instead of taking the hour marker colour (follow-up 51, ASM-0095). */
  hourMarkerLume: boolean;
  /** The dial's surface relief (follow-up 50, ASM-0094): none, a built-in texture, or an imported picture. It carries no colour: it takes the dial's. */
  dialTexture: DialTexture;
  /** Per wheel, keyed by `appearanceKeyFor`. */
  wheels: Record<string, WheelAppearance>;
}

export const DEFAULT_APPEARANCE: Appearance = {
  dial: null, hourMarkers: null, dialPrint: null, secondsHand: null, minuteHand: null, hourHand: null, hourMarkerLume: false, dialTexture: NO_DIAL_TEXTURE, wheels: {},
};

export function defaultAppearance(): Appearance {
  return { ...DEFAULT_APPEARANCE, wheels: {} };
}

/**
 * The key a wheel's colours are stored under. A year display is four digit barrels that look alike and move
 * together, so they share the colours of the first of them (by id); every other wheel uses its own id.
 */
export function appearanceKeyFor(movement: Movement, complicationId: string): string {
  const digit = movement.yearDigitComplications[complicationId as YearDigitComplicationId];
  if (digit === undefined) return complicationId;
  const siblings = Object.values(movement.yearDigitComplications)
    .filter((d) => d.monthComplicationId === digit.monthComplicationId)
    .map((d) => d.id as string)
    .sort();
  return siblings[0] ?? complicationId;
}

/** The colours chosen for a wheel, with nothing chosen as nulls. */
export function wheelAppearance(movement: Movement, complicationId: string): WheelAppearance {
  return movement.appearance.wheels[appearanceKeyFor(movement, complicationId)] ?? { body: null, text: null };
}

/**
 * The wheels the colour menu offers: every complication a dial window shows, once each (the four year digits
 * are one). Names are the complication's own, with "Year digits" for the display of four.
 */
export function colourableWheels(movement: Movement): { key: string; name: string; textLabel: string }[] {
  const seen = new Set<string>();
  const wheels: { key: string; name: string; textLabel: string }[] = [];
  for (const window of Object.values(movement.dialWindows)) {
    const id = window.complicationId as string;
    const key = appearanceKeyFor(movement, id);
    if (seen.has(key)) continue;
    const named =
      movement.moonPhases[id as keyof typeof movement.moonPhases]?.name ??
      movement.dateComplications[id as keyof typeof movement.dateComplications]?.name ??
      movement.monthComplications[id as keyof typeof movement.monthComplications]?.name ??
      movement.leapYearComplications[id as keyof typeof movement.leapYearComplications]?.name ??
      movement.seasonComplications[id as keyof typeof movement.seasonComplications]?.name;
    const isDigit = movement.yearDigitComplications[id as YearDigitComplicationId] !== undefined;
    if (named === undefined && !isDigit) continue;
    seen.add(key);
    // The moon wheel prints only its lit phases (follow-up 41), so its text colour is the colour of the moon phases.
    const isMoon = movement.moonPhases[id as keyof typeof movement.moonPhases] !== undefined;
    wheels.push({ key, name: isMoon ? "Moon wheel" : isDigit ? "Year digits" : named ?? id, textLabel: isMoon ? "Moon phases" : "Text" });
  }
  return wheels;
}
