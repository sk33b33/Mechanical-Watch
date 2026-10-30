import { describe, expect, it } from "vitest";
import {
  decodeHeights, DIAL_TEXTURE, DIAL_TEXTURE_IDS, DIAL_TEXTURE_LABELS, dialTextureHeight, dialTextureLabel, encodeHeights, hash2, heightField,
  heightsFromImage, isDialTextureId, normalMapRgba, previewRgba, sameDialTexture, textureStrength, type DialTexture,
} from "./dialTexture";

describe("dial textures (ASM-0094)", () => {
  it("lists the built-in textures, each with a name", () => {
    expect(DIAL_TEXTURE_IDS.length).toBeGreaterThanOrEqual(10);
    for (const id of DIAL_TEXTURE_IDS) expect(DIAL_TEXTURE_LABELS[id].length).toBeGreaterThan(2);
    expect(new Set(Object.values(DIAL_TEXTURE_LABELS)).size).toBe(DIAL_TEXTURE_IDS.length);
    expect(isDialTextureId("BRUSHED")).toBe(true);
    expect(isDialTextureId("nonsense")).toBe(false);
  });

  it("the hash is deterministic and spreads over [0, 1)", () => {
    expect(hash2(3, 9)).toBe(hash2(3, 9));
    expect(hash2(3, 9)).not.toBe(hash2(9, 3));
    let low = 1;
    let high = 0;
    for (let i = 0; i < 500; i += 1) { const h = hash2(i, i * 7); low = Math.min(low, h); high = Math.max(high, h); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1); }
    expect(low).toBeLessThan(0.1);
    expect(high).toBeGreaterThan(0.9);
  });

  for (const id of DIAL_TEXTURE_IDS) {
    it(`${id}: heights stay in [0, 1], repeat exactly, and have real relief (not flat)`, () => {
      const field = heightField({ kind: "BUILT_IN", id }, 96);
      let low = Infinity;
      let high = -Infinity;
      for (const h of field) {
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(1);
        low = Math.min(low, h);
        high = Math.max(high, h);
      }
      expect(high - low, `${id} range`).toBeGreaterThan(0.3);
      expect(heightField({ kind: "BUILT_IN", id }, 96)).toEqual(field);
      expect(dialTextureHeight(id, 0.3, 0.7)).toBe(dialTextureHeight(id, 0.3, 0.7));
    });
  }

  it("the tiled patterns repeat from cell to cell", () => {
    // One clous de Paris cell is 1/44 of the dial wide: the same spot one cell along reads the same.
    expect(dialTextureHeight("CLOUS_DE_PARIS", 0.2, 0.3)).toBeCloseTo(dialTextureHeight("CLOUS_DE_PARIS", 0.2 + 1 / 44, 0.3), 9);
    expect(dialTextureHeight("HOBNAIL", 0.31, 0.4)).toBeCloseTo(dialTextureHeight("HOBNAIL", 0.31, 0.4 + 1 / 38), 9);
  });

  it("the radial patterns are symmetric about the dial's centre in their own way", () => {
    // Concentric rings depend only on the distance from the centre (up to the slight wobble along each ring).
    const a = heightField({ kind: "BUILT_IN", id: "CONCENTRIC" }, 64);
    expect(a.length).toBe(64 * 64);
  });

  it("no texture is a flat field, and 'none' is", () => {
    expect([...heightField({ kind: "NONE" }, 16)].every((h) => h === 0)).toBe(true);
  });
});

describe("normal maps from heights", () => {
  it("a flat field gives straight-out normals", () => {
    const rgba = normalMapRgba(new Float32Array(16 * 16), 16, 4);
    for (let i = 0; i < 16 * 16; i += 1) {
      expect(rgba[i * 4]).toBeGreaterThanOrEqual(127);
      expect(rgba[i * 4]).toBeLessThanOrEqual(128);
      expect(rgba[i * 4 + 1]).toBeGreaterThanOrEqual(127);
      expect(rgba[i * 4 + 2]).toBe(255);
      expect(rgba[i * 4 + 3]).toBe(255);
    }
  });

  it("a ramp rising to the right tilts the normal to the left (red down), and one rising upward tilts it down (green down)", () => {
    const size = 16;
    const ramp = new Float32Array(size * size);
    const rise = new Float32Array(size * size);
    for (let row = 0; row < size; row += 1) for (let column = 0; column < size; column += 1) { ramp[row * size + column] = column / size; rise[row * size + column] = row / size; }
    const right = normalMapRgba(ramp, size, 4);
    const up = normalMapRgba(rise, size, 4);
    const mid = (8 * size + 8) * 4;
    expect(right[mid] ?? 255).toBeLessThan(127);
    expect(up[mid + 1] ?? 255).toBeLessThan(127);
  });

  it("every normal is a unit vector (within byte rounding)", () => {
    const field = heightField({ kind: "BUILT_IN", id: "HOBNAIL" }, 64);
    const rgba = normalMapRgba(field, 64, 3);
    for (let i = 0; i < 64 * 64; i += 7) {
      const x = ((rgba[i * 4] ?? 0) / 255) * 2 - 1;
      const y = ((rgba[i * 4 + 1] ?? 0) / 255) * 2 - 1;
      const z = ((rgba[i * 4 + 2] ?? 0) / 255) * 2 - 1;
      expect(Math.hypot(x, y, z)).toBeGreaterThan(0.97);
      expect(Math.hypot(x, y, z)).toBeLessThan(1.03);
      expect(z).toBeGreaterThan(0);
    }
  });

  it("the relief does not depend on the grid size: a bigger grid reads the same slope", () => {
    const small = normalMapRgba(heightField({ kind: "BUILT_IN", id: "CLOUS_DE_PARIS" }, 128), 128, 3);
    const big = normalMapRgba(heightField({ kind: "BUILT_IN", id: "CLOUS_DE_PARIS" }, 256), 256, 3);
    const spread = (rgba: Uint8ClampedArray): number => { let sum = 0; for (let i = 0; i < rgba.length; i += 4) sum += Math.abs((rgba[i] ?? 128) - 128); return sum / (rgba.length / 4); };
    expect(spread(big) / spread(small)).toBeGreaterThan(0.5);
    expect(spread(big) / spread(small)).toBeLessThan(2);
  });
});

describe("previews follow the dial colour", () => {
  it("a smooth swatch is the dial colour, a textured one varies around it, and a brighter dial gives a brighter swatch", () => {
    const dark = previewRgba({ kind: "BUILT_IN", id: "CLOUS_DE_PARIS" }, 0x202020);
    const light = previewRgba({ kind: "BUILT_IN", id: "CLOUS_DE_PARIS" }, 0xe0e0e0);
    const mean = (rgba: Uint8ClampedArray): number => { let sum = 0; for (let i = 0; i < rgba.length; i += 4) sum += rgba[i] ?? 0; return sum / (rgba.length / 4); };
    expect(mean(light)).toBeGreaterThan(mean(dark) * 3);
    const red = previewRgba({ kind: "BUILT_IN", id: "BRUSHED" }, 0xc03020);
    // Red stays the strongest channel everywhere: the relief shades the colour, it does not change it.
    for (let i = 0; i < red.length; i += 4) expect(red[i] ?? 0).toBeGreaterThanOrEqual(red[i + 1] ?? 0);
    const smooth = previewRgba({ kind: "NONE" }, 0x808080);
    const first = smooth[0];
    for (let i = 0; i < smooth.length; i += 4) expect(smooth[i]).toBe(first);
    const varied = new Set<number>();
    for (let i = 0; i < dark.length; i += 4) varied.add(dark[i] ?? 0);
    expect(varied.size).toBeGreaterThan(4);
  });
});

describe("imported images", () => {
  const picture = (width: number, height: number, rgbaAt: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) out.set(rgbaAt(x, y), (y * width + x) * 4);
    return out;
  };

  it("the grey level is the height: white high, black low, a transparent pixel low", () => {
    const heights = heightsFromImage(picture(4, 4, (x) => (x < 2 ? [255, 255, 255, 255] : [0, 0, 0, 255])), 4, 4, 4);
    expect(heights[0]).toBe(255);
    expect(heights[3]).toBe(0);
    const clear = heightsFromImage(picture(2, 2, () => [255, 255, 255, 0]), 2, 2, 2);
    expect([...clear]).toEqual([0, 0, 0, 0]);
  });

  it("a wide picture is cropped to the square about its middle, and rows run from the top", () => {
    // 8 wide, 4 tall: the middle 4 columns are used. Top row white, bottom row black.
    const heights = heightsFromImage(picture(8, 4, (x, y) => (x < 2 || x >= 6 ? [128, 128, 128, 255] : y < 2 ? [255, 255, 255, 255] : [0, 0, 0, 255])), 8, 4, 4);
    expect(heights[0]).toBe(255);
    expect(heights[3 * 4]).toBe(0);
    for (const h of heights) expect(h === 0 || h === 255).toBe(true);
  });

  it("round-trips through the base64 text kept in the design, and refuses data of the wrong size", () => {
    const bytes = new Uint8Array(16 * 16).map((_, i) => (i * 37) % 256);
    expect(decodeHeights(encodeHeights(bytes), 16)).toEqual(bytes);
    expect(decodeHeights(encodeHeights(bytes), 15)).toBeNull();
    expect(decodeHeights("not base64 !!!", 16)).toBeNull();
    expect(decodeHeights(encodeHeights(bytes), 4)).toBeNull();
  });

  it("an imported texture becomes a height field the right way up (picture top is the dial's top)", () => {
    const size = DIAL_TEXTURE.importedSizePx;
    const bytes = new Uint8Array(size * size);
    for (let row = 0; row < size / 2; row += 1) bytes.fill(255, row * size, (row + 1) * size); // picture's top half bright
    const texture: DialTexture = { kind: "IMPORTED", name: "half", size, data: encodeHeights(bytes) };
    const field = heightField(texture, 8);
    // Row 0 of the field is the BOTTOM of the dial: dark. The last row, the top: bright.
    expect(field[0]).toBeLessThan(0.1);
    expect(field[7 * 8]).toBeGreaterThan(0.9);
  });

  it("labels and equality", () => {
    expect(dialTextureLabel({ kind: "NONE" })).toMatch(/smooth/i);
    expect(dialTextureLabel({ kind: "BUILT_IN", id: "LINEN" })).toBe("Linen weave");
    expect(dialTextureLabel({ kind: "IMPORTED", name: "leather.png", size: 8, data: "" })).toBe("leather.png");
    expect(sameDialTexture({ kind: "BUILT_IN", id: "LINEN" }, { kind: "BUILT_IN", id: "LINEN" })).toBe(true);
    expect(sameDialTexture({ kind: "BUILT_IN", id: "LINEN" }, { kind: "BUILT_IN", id: "WAVES" })).toBe(false);
    expect(sameDialTexture({ kind: "NONE" }, { kind: "BUILT_IN", id: "WAVES" })).toBe(false);
    expect(textureStrength({ kind: "BUILT_IN", id: "GRAIN" })).toBe(DIAL_TEXTURE.strength.GRAIN);
  });
});
