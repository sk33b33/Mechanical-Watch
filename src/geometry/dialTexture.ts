import type { AssumptionId } from "@/reference/assumptions";

/**
 * Dial surface textures (follow-up 50, ASM-0094): a relief, a height field, that the viewport lights as a normal
 * map, so the dial catches the light like a real engine-turned or brushed dial. The relief carries no colour:
 * the dial's colour is the material's own colour, so the texture follows whatever colour the dial is given.
 *
 * Presentation only (L0 visual, ASM-0004). The patterns are drawn in "dial units": `u` and `v` run 0 to 1 across
 * the dial's diameter, `u` to the right and `v` up as read from the dial side, so a pattern covers any dial size
 * the same way, and nothing here says how a real dial would be cut or stamped. Pure maths, no THREE dependency,
 * deterministic: the same inputs give the same pixels (the "random" parts hash their cell, never `Math.random`).
 */
export const DIAL_TEXTURE_IDS = [
  "BRUSHED", "SUNBURST", "CONCENTRIC", "CLOUS_DE_PARIS", "HOBNAIL", "GRAIN", "LINEN", "CARBON_TWILL", "HONEYCOMB", "WAVES", "BARLEYCORN",
] as const;
export type DialTextureId = (typeof DIAL_TEXTURE_IDS)[number];

export const DIAL_TEXTURE_LABELS: Readonly<Record<DialTextureId, string>> = {
  BRUSHED: "Brushed",
  SUNBURST: "Sunburst",
  CONCENTRIC: "Concentric rings",
  CLOUS_DE_PARIS: "Clous de Paris",
  HOBNAIL: "Hobnail domes",
  GRAIN: "Fine grain",
  LINEN: "Linen weave",
  CARBON_TWILL: "Carbon twill",
  HONEYCOMB: "Honeycomb",
  WAVES: "Waves",
  BARLEYCORN: "Barleycorn",
};

export const DIAL_TEXTURE = {
  /** Height-field and normal-map side in pixels for the dial itself. */
  sizePx: 1024,
  /** Side in pixels of an imported image's stored height map (it is stored in the design, so it is kept small). */
  importedSizePx: 192,
  /** Side in pixels of a menu preview. */
  previewPx: 44,
  /** The part of the dial a menu preview shows (its middle fifth), so the pattern's cells are big enough to see. */
  previewWindow: { u0: 0.4, v0: 0.4, span: 0.2 },
  /**
   * How steep the relief reads: the normal's slope is this times the height change per pixel. Per texture, because a
   * fine weave and a coarse dome need different amounts to look equally deep.
   */
  strength: {
    BRUSHED: 2, SUNBURST: 2.2, CONCENTRIC: 2, CLOUS_DE_PARIS: 3, HOBNAIL: 3, GRAIN: 2.6, LINEN: 5, CARBON_TWILL: 4, HONEYCOMB: 3.5, WAVES: 6, BARLEYCORN: 5,
  } as Readonly<Record<DialTextureId, number>>,
  /** Strength for an imported image (a grey-level picture, softer than the engineered patterns). */
  importedStrength: 3,
  /** Largest image file the import accepts, bytes. */
  maxImportBytes: 12 * 1024 * 1024,
  /** The longest name kept for an imported image. */
  maxNameLength: 60,
  assumption: "ASM-0094" satisfies AssumptionId,
} as const;

/** A stored choice of dial texture. */
export type DialTexture =
  | { kind: "NONE" }
  | { kind: "BUILT_IN"; id: DialTextureId }
  /** `data` is `size * size` height bytes, row by row from the top of the picture, as base64. */
  | { kind: "IMPORTED"; name: string; size: number; data: string };

export const NO_DIAL_TEXTURE: DialTexture = { kind: "NONE" };

export function isDialTextureId(value: unknown): value is DialTextureId {
  return typeof value === "string" && (DIAL_TEXTURE_IDS as readonly string[]).includes(value);
}

// --- hashing ---------------------------------------------------------------------------------

/** A deterministic hash of two integers to [0, 1). */
export function hash2(ix: number, iy: number): number {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const fract = (x: number): number => x - Math.floor(x);
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Smooth value noise at (x, y), in [0, 1). */
function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// --- the patterns ----------------------------------------------------------------------------

/** How many cells span the dial's diameter, for the tiled patterns. */
const CELLS = { clous: 44, hobnail: 38, linen: 70, twill: 64, honeycomb: 34, waves: 14, barleycorn: 56 } as const;

/** The height, in [0, 1], of a built-in texture at (u, v), each running 0 to 1 across the dial's diameter. */
export function dialTextureHeight(id: DialTextureId, u: number, v: number): number {
  switch (id) {
    case "BRUSHED": {
      // Fine horizontal lines: one random level per hair-thin row, wandering slowly along it.
      const row = Math.floor(v * 900);
      return clamp01(0.55 * hash2(row, 3) + 0.3 * valueNoise(u * 6 + hash2(row, 9) * 40, row * 0.37) + 0.15 * hash2(Math.floor(u * 700), row));
    }
    case "SUNBURST": {
      // Fine rays from the dial's centre: one random level per thin wedge, with a little fibre along each.
      const x = u - 0.5;
      const y = v - 0.5;
      const ray = Math.floor((Math.atan2(y, x) / (2 * Math.PI) + 0.5) * 900);
      const radius = Math.hypot(x, y);
      return clamp01(0.6 * hash2(ray, 5) + 0.25 * valueNoise(radius * 60, ray * 0.13) + 0.15 * hash2(ray, Math.floor(radius * 400)));
    }
    case "CONCENTRIC": {
      // Fine circular grooves about the dial's centre, with a slight wobble.
      const radius = Math.hypot(u - 0.5, v - 0.5);
      const ring = Math.floor(radius * 360);
      return clamp01(0.55 * hash2(ring, 7) + 0.3 * (0.5 + 0.5 * Math.sin(radius * 360 * 2 * Math.PI)) * 0.8 + 0.15 * valueNoise(Math.atan2(v - 0.5, u - 0.5) * 20, ring * 0.2));
    }
    case "CLOUS_DE_PARIS": {
      // Little four-sided pyramids on a square grid: the peak at each cell's middle.
      const fx = fract(u * CELLS.clous) - 0.5;
      const fy = fract(v * CELLS.clous) - 0.5;
      return clamp01(1 - 2 * Math.max(Math.abs(fx), Math.abs(fy)));
    }
    case "HOBNAIL": {
      // Round domes on a square grid.
      const fx = fract(u * CELLS.hobnail) - 0.5;
      const fy = fract(v * CELLS.hobnail) - 0.5;
      const d2 = (fx * fx + fy * fy) * 4;
      return d2 >= 1 ? 0 : Math.sqrt(1 - d2);
    }
    case "GRAIN": {
      // Three octaves of value noise: a fine, uneven grain.
      return clamp01(0.5 * valueNoise(u * 150, v * 150) + 0.3 * valueNoise(u * 380, v * 380) + 0.2 * valueNoise(u * 900, v * 900));
    }
    case "LINEN": {
      // Plain weave: horizontal and vertical threads passing over and under each other.
      const cx = u * CELLS.linen;
      const cy = v * CELLS.linen;
      const over = (Math.floor(cx) + Math.floor(cy)) % 2 === 0;
      const thread = over ? 0.5 + 0.5 * Math.cos((fract(cy) - 0.5) * Math.PI) : 0.5 + 0.5 * Math.cos((fract(cx) - 0.5) * Math.PI);
      return clamp01(0.15 + 0.75 * thread * (over ? 1 : 0.7) + 0.1 * hash2(Math.floor(cx * 3), Math.floor(cy * 3)));
    }
    case "CARBON_TWILL": {
      // Twill: each thread passes over two and under two, so the weave runs in diagonals.
      const cx = Math.floor(u * CELLS.twill);
      const cy = Math.floor(v * CELLS.twill);
      const over = (((cx - cy) % 4) + 4) % 4 < 2;
      const fx = fract(u * CELLS.twill);
      const fy = fract(v * CELLS.twill);
      const across = over ? 0.5 + 0.5 * Math.cos((fy - 0.5) * Math.PI) : 0.5 + 0.5 * Math.cos((fx - 0.5) * Math.PI);
      return clamp01(0.1 + 0.85 * across * (over ? 1 : 0.65));
    }
    case "HONEYCOMB": {
      // Raised hexagon walls round shallow cells: height by distance from the nearest cell centre. Hexagon centres
      // sit on two interleaved rectangular lattices (spacing 1 across, root 3 down, the second offset by half of each).
      const x = u * CELLS.honeycomb;
      const y = v * CELLS.honeycomb;
      const rowHeight = Math.sqrt(3);
      const nearestA = Math.hypot(x - Math.round(x), y - Math.round(y / rowHeight) * rowHeight);
      const nearestB = Math.hypot(x - (Math.round(x - 0.5) + 0.5), y - (Math.round(y / rowHeight - 0.5) + 0.5) * rowHeight);
      // A cell's edge is 0.5 from its centre and its corners 0.577: the wall is where that distance is greatest.
      return clamp01((Math.min(nearestA, nearestB) / 0.577) ** 2);
    }
    case "WAVES": {
      // Soft parallel waves that themselves meander.
      const phase = u * CELLS.waves + 0.12 * Math.sin(v * CELLS.waves * 0.9 * Math.PI) * CELLS.waves * 0.3;
      return 0.5 + 0.5 * Math.sin(phase * 2 * Math.PI * 0.5 + v * CELLS.waves * Math.PI);
    }
    case "BARLEYCORN": {
      // Grain d'orge: diagonal ridges, crossed so each cell reads as a little barley ear.
      const a = Math.sin((u + v) * CELLS.barleycorn * Math.PI);
      const b = Math.sin((u - v) * CELLS.barleycorn * 0.5 * Math.PI);
      return clamp01(0.5 + 0.32 * a + 0.18 * b);
    }
  }
}

// --- height fields ---------------------------------------------------------------------------

/**
 * A square grid of heights in [0, 1]: `size` rows of `size` columns, row 0 at the BOTTOM of the dial (v near 0),
 * column 0 at the dial's left as read from its face (u near 0). `window` picks a part of the dial (for previews).
 */
export function heightField(
  source: DialTexture,
  size: number,
  window: { u0: number; v0: number; span: number } = { u0: 0, v0: 0, span: 1 },
): Float32Array {
  const field = new Float32Array(size * size);
  if (source.kind === "NONE") return field;
  const imported = source.kind === "IMPORTED" ? decodeHeights(source.data, source.size) : null;
  for (let row = 0; row < size; row += 1) {
    const v = window.v0 + ((row + 0.5) / size) * window.span;
    for (let column = 0; column < size; column += 1) {
      const u = window.u0 + ((column + 0.5) / size) * window.span;
      field[row * size + column] =
        source.kind === "BUILT_IN" ? dialTextureHeight(source.id, u, v) : imported === null ? 0 : sampleBilinear(imported, source.size, u, 1 - v);
    }
  }
  return field;
}

/** Bilinear sample of a square byte image at (u, w), both 0 to 1 (w downward from the picture's top), as a height in [0, 1]. */
function sampleBilinear(image: Uint8Array, size: number, u: number, w: number): number {
  const x = clamp01(u) * (size - 1);
  const y = clamp01(w) * (size - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const at = (xx: number, yy: number): number => (image[yy * size + xx] ?? 0) / 255;
  return at(x0, y0) * (1 - fx) * (1 - fy) + at(x1, y0) * fx * (1 - fy) + at(x0, y1) * (1 - fx) * fy + at(x1, y1) * fx * fy;
}

// --- normals ---------------------------------------------------------------------------------

/** The strength a texture reads with (see `DIAL_TEXTURE.strength`). */
export function textureStrength(source: DialTexture): number {
  return source.kind === "BUILT_IN" ? DIAL_TEXTURE.strength[source.id] : DIAL_TEXTURE.importedStrength;
}

/**
 * A tangent-space normal map (RGBA bytes, row 0 at the bottom, red to the right, green up, blue out of the surface)
 * from a height field, by central differences (edges clamp). The slope in each direction is `strength` times the
 * height change per pixel scaled by the grid size, so the same texture reads the same at any resolution.
 */
export function normalMapRgba(heights: Float32Array, size: number, strength: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const at = (column: number, row: number): number => heights[Math.max(0, Math.min(size - 1, row)) * size + Math.max(0, Math.min(size - 1, column))] ?? 0;
  const scale = (strength * size) / 256;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const dx = (at(column + 1, row) - at(column - 1, row)) * 0.5 * scale;
      const dy = (at(column, row + 1) - at(column, row - 1)) * 0.5 * scale;
      const length = Math.hypot(dx, dy, 1);
      const o = (row * size + column) * 4;
      out[o] = Math.round((-dx / length * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((-dy / length * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
      out[o + 3] = 255;
    }
  }
  return out;
}

/** A menu preview swatch (RGBA bytes): the texture in the middle of the dial, lit from the upper left, in `colour` (0xrrggbb). */
export function previewRgba(source: DialTexture, colour: number): Uint8ClampedArray {
  const size = DIAL_TEXTURE.previewPx;
  const base = [(colour >> 16) & 255, (colour >> 8) & 255, colour & 255];
  const out = new Uint8ClampedArray(size * size * 4);
  const normals = source.kind === "NONE"
    ? null
    : normalMapRgba(heightField(source, size, source.kind === "IMPORTED" ? { u0: 0, v0: 0, span: 1 } : DIAL_TEXTURE.previewWindow), size, textureStrength(source) * 2.2);
  // Light from the upper left and the front.
  const light = { x: -0.45, y: 0.55, z: 0.7 };
  const lightLength = Math.hypot(light.x, light.y, light.z);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      // Rows of the swatch run top to bottom; the normal map's run bottom to top.
      const o = ((size - 1 - row) * size + column) * 4;
      const nx = normals === null ? 0 : ((normals[o] ?? 128) / 255) * 2 - 1;
      const ny = normals === null ? 0 : ((normals[o + 1] ?? 128) / 255) * 2 - 1;
      const nz = normals === null ? 1 : ((normals[o + 2] ?? 255) / 255) * 2 - 1;
      const shade = Math.max(0, (nx * light.x + ny * light.y + nz * light.z) / lightLength);
      // Flat reads at the middle shade, so a smooth swatch is the dial colour itself.
      const flat = light.z / lightLength;
      const factor = 0.35 + 0.65 * (shade / flat) * 0.85;
      const p = (row * size + column) * 4;
      out[p] = base[0] === undefined ? 0 : base[0] * factor;
      out[p + 1] = base[1] === undefined ? 0 : base[1] * factor;
      out[p + 2] = base[2] === undefined ? 0 : base[2] * factor;
      out[p + 3] = 255;
    }
  }
  return out;
}

// --- imported images -------------------------------------------------------------------------

/**
 * Height bytes (row by row from the top) from a picture's RGBA pixels: the grey level is the height, a transparent
 * pixel counts as the lowest, and the picture is cropped to the square about its middle and resampled to `size`.
 */
export function heightsFromImage(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, size: number): Uint8Array {
  const out = new Uint8Array(size * size);
  if (width <= 0 || height <= 0) return out;
  const side = Math.min(width, height);
  const x0 = (width - side) / 2;
  const y0 = (height - side) / 2;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const sx = Math.min(width - 1, Math.floor(x0 + ((column + 0.5) / size) * side));
      const sy = Math.min(height - 1, Math.floor(y0 + ((row + 0.5) / size) * side));
      const o = (sy * width + sx) * 4;
      const alpha = (rgba[o + 3] ?? 255) / 255;
      const grey = 0.2126 * (rgba[o] ?? 0) + 0.7152 * (rgba[o + 1] ?? 0) + 0.0722 * (rgba[o + 2] ?? 0);
      out[row * size + column] = Math.round(grey * alpha);
    }
  }
  return out;
}

/** Bytes to base64 (the design file keeps an imported image as text). */
export function encodeHeights(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Base64 back to `size * size` height bytes, or null when the text is not that. */
export function decodeHeights(data: string, size: number): Uint8Array | null {
  if (!Number.isInteger(size) || size < 8 || size > 1024) return null;
  let binary: string;
  try { binary = atob(data); } catch { return null; }
  if (binary.length !== size * size) return null;
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** A short label for a stored texture, for the menu button. */
export function dialTextureLabel(texture: DialTexture): string {
  if (texture.kind === "NONE") return "Smooth (none)";
  return texture.kind === "BUILT_IN" ? DIAL_TEXTURE_LABELS[texture.id] : texture.name;
}

/** The same choice, by value (an imported image compares by its name and data). */
export function sameDialTexture(a: DialTexture, b: DialTexture): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "BUILT_IN" && b.kind === "BUILT_IN") return a.id === b.id;
  if (a.kind === "IMPORTED" && b.kind === "IMPORTED") return a.name === b.name && a.size === b.size && a.data === b.data;
  return true;
}
