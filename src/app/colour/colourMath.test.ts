import { describe, expect, it } from "vitest";
import { hexToHsv, hsvToHex, parseTypedColour } from "./colourMath";

describe("colour chart arithmetic", () => {
  it("converts the primaries and greys correctly", () => {
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#00ff00").h).toBe(120);
    expect(hexToHsv("#0000ff").h).toBe(240);
    expect(hexToHsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv("#ffffff")).toEqual({ h: 0, s: 0, v: 1 });
    expect(hexToHsv("#808080").s).toBe(0);
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe("#ff0000");
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe("#00ff00");
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe("#0000ff");
    expect(hsvToHex({ h: 60, s: 1, v: 1 })).toBe("#ffff00");
    expect(hsvToHex({ h: 180, s: 1, v: 1 })).toBe("#00ffff");
    expect(hsvToHex({ h: 300, s: 1, v: 1 })).toBe("#ff00ff");
  });

  it("round-trips every colour on a grid to within one step per channel", () => {
    let worst = 0;
    for (let r = 0; r <= 255; r += 15) {
      for (let g = 0; g <= 255; g += 15) {
        for (let b = 0; b <= 255; b += 15) {
          const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
          const back = hsvToHex(hexToHsv(hex));
          const diff = Math.max(...[1, 3, 5].map((i) => Math.abs(Number.parseInt(hex.slice(i, i + 2), 16) - Number.parseInt(back.slice(i, i + 2), 16))));
          worst = Math.max(worst, diff);
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(1);
  });

  it("wraps and clamps out-of-range input instead of producing a bad colour", () => {
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe("#ff0000");
    expect(hsvToHex({ h: -120, s: 1, v: 1 })).toBe("#0000ff");
    expect(hsvToHex({ h: 10, s: 5, v: 9 })).toBe(hsvToHex({ h: 10, s: 1, v: 1 }));
    expect(hsvToHex({ h: 10, s: -1, v: -1 })).toBe("#000000");
  });

  it("reads typed colours: with or without #, any case, three or six digits; anything else is rejected", () => {
    expect(parseTypedColour("#1A2b3C")).toBe("#1a2b3c");
    expect(parseTypedColour("1a2b3c")).toBe("#1a2b3c");
    expect(parseTypedColour(" #abc ")).toBe("#aabbcc");
    for (const bad of ["", "#12", "#12345", "#1234567", "blue", "#ggg", "#12 456"]) expect(parseTypedColour(bad)).toBeNull();
  });
});
