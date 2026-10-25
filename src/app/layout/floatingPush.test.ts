import { describe, expect, it } from "vitest";
import { FLOATING_PUSH, pushOffset, type RestingBox } from "./floatingPush";

const box: RestingBox = { right: 12, bottom: 12, width: 80, height: 32 };
const viewport = { w: 1100, h: 720 };

describe("a floating control pushed by flyouts (follow-up 44)", () => {
  it("stays put with no flyout out", () => {
    expect(pushOffset(box, viewport, [])).toEqual({ x: 0, y: 0 });
  });

  it("a flyout from the right pushes it left, to just clear the flyout's edge", () => {
    const { x, y } = pushOffset(box, viewport, [{ edge: "right", size: 320 }]);
    expect(y).toBe(0);
    // Its right edge ends FLOATING_PUSH.gapPx left of the flyout's inner edge.
    expect(viewport.w - box.right + x).toBeCloseTo(viewport.w - 320 - FLOATING_PUSH.gapPx, 9);
  });

  it("a flyout from the bottom pushes it up, to just clear the flyout's top edge", () => {
    const { x, y } = pushOffset(box, viewport, [{ edge: "bottom", size: 200 }]);
    expect(x).toBe(0);
    expect(viewport.h - box.bottom + y).toBeCloseTo(viewport.h - 200 - FLOATING_PUSH.gapPx, 9);
  });

  it("a flyout that does not reach the control does not move it", () => {
    expect(pushOffset(box, viewport, [{ edge: "bottom", size: 1 }])).toEqual({ x: 0, y: 0 });
    expect(pushOffset(box, viewport, [{ edge: "left", size: 260 }])).toEqual({ x: 0, y: 0 });
    expect(pushOffset(box, viewport, [{ edge: "right", size: 1 }])).toEqual({ x: 0, y: 0 });
  });

  it("a left flyout on a narrow window pushes it right, but a sliver always stays on screen", () => {
    const narrow = { w: 390, h: 800 };
    const { x } = pushOffset(box, narrow, [{ edge: "left", size: 360 }]);
    expect(x).toBeGreaterThan(0);
    expect(narrow.w - box.right + x).toBeLessThanOrEqual(narrow.w - box.right + (box.width + box.right - FLOATING_PUSH.minVisiblePx));
    const left = narrow.w - box.right - box.width;
    expect(left + x).toBeLessThanOrEqual(narrow.w - FLOATING_PUSH.minVisiblePx);
  });

  it("two flyouts push along their own axes, and closing them all springs back to rest", () => {
    const both = pushOffset(box, viewport, [{ edge: "right", size: 300 }, { edge: "bottom", size: 180 }]);
    expect(both.x).toBeLessThan(0);
    expect(both.y).toBeLessThan(0);
    expect(pushOffset(box, viewport, [])).toEqual({ x: 0, y: 0 });
  });

  it("never pushes it off the left or top of the window", () => {
    const { x, y } = pushOffset(box, { w: 300, h: 200 }, [{ edge: "right", size: 290 }, { edge: "bottom", size: 190 }]);
    const left = 300 - box.right - box.width;
    const top = 200 - box.bottom - box.height;
    expect(left + x).toBeGreaterThanOrEqual(0);
    expect(top + y).toBeGreaterThanOrEqual(0);
  });
});
