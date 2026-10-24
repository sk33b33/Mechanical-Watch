import { hexToNumber, isHexColour, numberToHex, type HexColour } from "@/domain/appearance";

/**
 * Colour arithmetic for the colour chart (follow-up 39): hue, saturation and value are the three things the chart
 * lets you move, and they convert to and from the "#rrggbb" the design stores. Pure.
 *
 * Hue is in degrees (0 up to 360), saturation and value in 0 to 1.
 */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export function hexToHsv(hex: HexColour): Hsv {
  const n = hexToNumber(hex);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): HexColour {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const val = clamp01(v);
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  const to8 = (channel: number): number => Math.round((channel + m) * 255);
  return numberToHex((to8(r) << 16) | (to8(g) << 8) | to8(b));
}

/**
 * Reads what a person types in the hex box: "#1a2b3c", "1a2b3c", or the short "#abc" / "abc", any case.
 * Null for anything else.
 */
export function parseTypedColour(text: string): HexColour | null {
  const t = text.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(t)) return `#${t.split("").map((c) => c + c).join("").toLowerCase()}`;
  const full = `#${t.toLowerCase()}`;
  return isHexColour(full) ? full : null;
}
