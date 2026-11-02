import { describe, expect, it } from "vitest";
import { effectiveZoom, isZoomedIn, viewportDebugWanted, viewportVariables, ZOOMED_IN_ABOVE, type ViewportBox } from "./visualViewport";

const unzoomed: ViewportBox = { offsetLeft: 0, offsetTop: 0, width: 980, height: 600, scale: 1, layoutWidth: 980, layoutHeight: 600 };

describe("visual viewport variables (follow-up 54, 58, ASM-0098)", () => {
  it("unzoomed, the screen's edges are the page's edges and the zoom is 1", () => {
    expect(viewportVariables(unzoomed)).toEqual({
      "--vv-s": "1", "--vv-left": "0px", "--vv-top": "0px", "--vv-right": "0px", "--vv-bottom": "0px", "--vv-width": "980px", "--vv-height": "600px",
    });
  });

  it("zoomed in, the edges are how far the page's edges are from the edges of what the screen shows, in page pixels", () => {
    // Zoomed 2x on a 980 x 600 layout: the screen shows 490 x 300 of it, here from (100, 50).
    const v = viewportVariables({ offsetLeft: 100, offsetTop: 50, width: 490, height: 300, scale: 2, layoutWidth: 980, layoutHeight: 600 });
    expect(v["--vv-s"]).toBe("2");
    expect(v["--vv-left"]).toBe("100px");
    expect(v["--vv-top"]).toBe("50px");
    expect(v["--vv-right"]).toBe(`${String(980 - 100 - 490)}px`);
    expect(v["--vv-bottom"]).toBe(`${String(600 - 50 - 300)}px`);
    expect(v["--vv-width"]).toBe("490px");
    expect(v["--vv-height"]).toBe("300px");
  });

  it("the edges and the size always add up to the page, for any zoom and offset (so a panel pinned to an edge lands on it)", () => {
    for (const scale of [1, 1.5, 2, 3]) {
      const width = 980 / scale;
      const height = 600 / scale;
      const offsetLeft = Math.max(0, (980 - width) * 0.4);
      const offsetTop = Math.max(0, (600 - height) * 0.7);
      const v = viewportVariables({ offsetLeft, offsetTop, width, height, scale, layoutWidth: 980, layoutHeight: 600 });
      const n = (name: string): number => Number.parseFloat(v[name] ?? "0");
      expect(n("--vv-left") + n("--vv-width") + n("--vv-right"), `width at ${String(scale)}x`).toBeCloseTo(980, 2);
      expect(n("--vv-top") + n("--vv-height") + n("--vv-bottom"), `height at ${String(scale)}x`).toBeCloseTo(600, 2);
    }
  });

  it("nothing is negative, and a nonsense zoom is treated as no zoom", () => {
    const v = viewportVariables({ ...unzoomed, width: 1200 });
    expect(v["--vv-right"]).toBe("0px");
    expect(viewportVariables({ ...unzoomed, scale: 0 })["--vv-s"]).toBe("1");
    expect(viewportVariables({ ...unzoomed, scale: Number.NaN })["--vv-s"]).toBe("1");
  });
});

describe("when a drag should move the zoomed screen (follow-up 55)", () => {
  it("is zoomed in only clearly above 1x, never for a nonsense zoom", () => {
    expect(isZoomedIn(1)).toBe(false);
    expect(isZoomedIn(ZOOMED_IN_ABOVE)).toBe(false);
    expect(isZoomedIn(1.5)).toBe(true);
    expect(isZoomedIn(0.8)).toBe(false);
    expect(isZoomedIn(Number.NaN)).toBe(false);
    expect(isZoomedIn(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("the zoom is what the screen shows of the page, not what the browser calls its scale (follow-up 56)", () => {
  it("a phone in desktop mode that fits the whole page to the screen is not zoomed, whatever scale the browser reports", () => {
    // Some browsers report the fit-to-screen scale (here 0.42) as the visual viewport's scale; the whole 980 px page is in view.
    const fitted: ViewportBox = { offsetLeft: 0, offsetTop: 0, width: 980, height: 2177, scale: 0.42, layoutWidth: 980, layoutHeight: 2177 };
    expect(effectiveZoom(fitted)).toBe(1);
    expect(viewportVariables(fitted)["--vv-s"]).toBe("1");
    expect(viewportVariables(fitted)["--vv-right"]).toBe("0px");
    expect(isZoomedIn(effectiveZoom(fitted))).toBe(false);
  });

  it("pinch zoomed in from that fitted state it is the ratio of page to screen that counts, not the reported scale", () => {
    // Zoomed 2x into the fitted page: the screen now shows 490 of the 980 px, and the browser says 0.84.
    const zoomed: ViewportBox = { offsetLeft: 200, offsetTop: 100, width: 490, height: 1088, scale: 0.84, layoutWidth: 980, layoutHeight: 2177 };
    expect(effectiveZoom(zoomed)).toBeCloseTo(2, 9);
    const v = viewportVariables(zoomed);
    expect(v["--vv-s"]).toBe("2");
    expect(v["--vv-right"]).toBe(`${String(980 - 200 - 490)}px`);
    expect(isZoomedIn(effectiveZoom(zoomed))).toBe(true);
  });

  it("a screen that shows more than the page (or a missing size) needs no compensation", () => {
    expect(effectiveZoom({ ...unzoomed, width: 1200 })).toBe(1);
    expect(effectiveZoom({ ...unzoomed, width: 0, scale: 1 })).toBe(1);
    expect(effectiveZoom({ ...unzoomed, width: 0, scale: 3 })).toBe(3);
  });
});

describe("the viewport read-out is only for ?debug=viewport", () => {
  it("is off by default", () => {
    expect(viewportDebugWanted("")).toBe(false);
    expect(viewportDebugWanted("?splash=off")).toBe(false);
    expect(viewportDebugWanted("?debug=other")).toBe(false);
    expect(viewportDebugWanted("?splash=off&debug=viewport")).toBe(true);
  });
});
