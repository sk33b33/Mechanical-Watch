import { describe, expect, it } from "vitest";
import { viewportVariables, type ViewportBox } from "./visualViewport";

const unzoomed: ViewportBox = { offsetLeft: 0, offsetTop: 0, width: 980, height: 600, scale: 1, layoutWidth: 980, layoutHeight: 600 };

describe("visual viewport variables (follow-up 54, ASM-0098)", () => {
  it("unzoomed, the screen's edges are the page's edges and the zoom is 1", () => {
    expect(viewportVariables(unzoomed)).toEqual({
      "--vv-s": "1", "--vv-inv": "1", "--vv-left": "0px", "--vv-top": "0px", "--vv-right": "0px", "--vv-bottom": "0px",
    });
  });

  it("zoomed in, the edges are where the visible part of the page ends, multiplied by the zoom, and the zoom is cancelled by its inverse", () => {
    // Zoomed 2x on a 980 x 600 layout: the screen shows 490 x 300 of it, here from (100, 50).
    const v = viewportVariables({ offsetLeft: 100, offsetTop: 50, width: 490, height: 300, scale: 2, layoutWidth: 980, layoutHeight: 600 });
    expect(v["--vv-s"]).toBe("2");
    expect(v["--vv-inv"]).toBe("0.5");
    // Inside an element zoomed by 0.5, a length L is drawn as L * 0.5 layout px, so the edge distances are doubled.
    expect(v["--vv-left"]).toBe("200px");
    expect(v["--vv-top"]).toBe("100px");
    expect(v["--vv-right"]).toBe(`${String((980 - 100 - 490) * 2)}px`);
    expect(v["--vv-bottom"]).toBe(`${String((600 - 50 - 300) * 2)}px`);
  });

  it("each edge, once drawn, lands on the visible edge for any zoom and offset", () => {
    for (const scale of [0.5, 1, 1.5, 3]) {
      const width = 980 / scale;
      const height = 600 / scale;
      const offsetLeft = Math.max(0, (980 - width) * 0.4);
      const offsetTop = Math.max(0, (600 - height) * 0.7);
      const v = viewportVariables({ offsetLeft, offsetTop, width, height, scale, layoutWidth: 980, layoutHeight: 600 });
      const zoom = Number(v["--vv-inv"]);
      const layoutPx = (name: string): number => Number.parseFloat(v[name] ?? "0") * zoom;
      expect(layoutPx("--vv-left")).toBeCloseTo(Math.max(0, offsetLeft), 2);
      expect(layoutPx("--vv-top")).toBeCloseTo(Math.max(0, offsetTop), 2);
      expect(layoutPx("--vv-right")).toBeCloseTo(Math.max(0, 980 - offsetLeft - width), 2);
      expect(layoutPx("--vv-bottom")).toBeCloseTo(Math.max(0, 600 - offsetTop - height), 2);
    }
  });

  it("a nonsense zoom is treated as no zoom", () => {
    expect(viewportVariables({ ...unzoomed, scale: 0 })["--vv-s"]).toBe("1");
    expect(viewportVariables({ ...unzoomed, scale: Number.NaN })["--vv-inv"]).toBe("1");
  });
});
