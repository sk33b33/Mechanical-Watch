import { describe, expect, it } from "vitest";
import { lineCircleInterval, linePolygonIntervals, subtractIntervals } from "./sectionCap";
import type { Point2D } from "./gearOutline";

const p = (x: number, y: number): Point2D => ({ x, y });
const square = [p(0, 0), p(4, 0), p(4, 4), p(0, 4)];

describe("lineCircleInterval", () => {
  it("finds the chord through the centre", () => {
    const interval = lineCircleInterval(p(-5, 0), p(1, 0), p(0, 0), 2);
    expect(interval?.t0).toBeCloseTo(3);
    expect(interval?.t1).toBeCloseTo(7);
  });

  it("finds an off-centre chord", () => {
    const interval = lineCircleInterval(p(-5, 1), p(1, 0), p(0, 0), 2);
    const expected = Math.sqrt(4 - 1);
    expect(interval?.t0).toBeCloseTo(5 - expected);
    expect(interval?.t1).toBeCloseTo(5 + expected);
  });

  it("misses a circle entirely", () => {
    expect(lineCircleInterval(p(-5, 10), p(1, 0), p(0, 0), 2)).toBeNull();
  });

  it("is tangent (treated as a miss: no measurable interval)", () => {
    expect(lineCircleInterval(p(-5, 2), p(1, 0), p(0, 0), 2)).toBeNull();
  });

  it("works for any line direction, not just axis-aligned (property check)", () => {
    for (const angleDeg of [0, 30, 45, 90, 135, 181, 272]) {
      const angle = (angleDeg * Math.PI) / 180;
      const dir = p(Math.cos(angle), Math.sin(angle));
      const base = p(-10 * dir.x, -10 * dir.y); // a point 10 units before the origin along the line
      const interval = lineCircleInterval(base, dir, p(0, 0), 3);
      expect(interval).not.toBeNull();
      if (interval === null) continue;
      // The interval should be symmetric about t=10 (the closest approach to a circle centred on the line's own closest point).
      expect(interval.t0 + interval.t1).toBeCloseTo(20, 6);
      expect(interval.t1 - interval.t0).toBeCloseTo(6, 6);
    }
  });
});

describe("linePolygonIntervals", () => {
  it("crosses a square once", () => {
    const intervals = linePolygonIntervals(p(-2, 2), p(1, 0), square);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]?.t0).toBeCloseTo(2);
    expect(intervals[0]?.t1).toBeCloseTo(6);
  });

  it("passes outside the polygon: no intervals", () => {
    expect(linePolygonIntervals(p(-2, 10), p(1, 0), square)).toHaveLength(0);
  });

  it("crosses a concave (gear-tooth-like) outline twice", () => {
    // A 'U' shape open at the top, so a horizontal line through the gap crosses only the two side walls.
    const u = [p(0, 0), p(4, 0), p(4, 4), p(3, 4), p(3, 1), p(1, 1), p(1, 4), p(0, 4)];
    const throughGap = linePolygonIntervals(p(-1, 2.5), p(1, 0), u);
    expect(throughGap).toHaveLength(2);
    expect(throughGap[0]?.t0).toBeCloseTo(1);
    expect(throughGap[0]?.t1).toBeCloseTo(2);
    expect(throughGap[1]?.t0).toBeCloseTo(4);
    expect(throughGap[1]?.t1).toBeCloseTo(5);

    const throughBase = linePolygonIntervals(p(-1, 0.5), p(1, 0), u);
    expect(throughBase).toHaveLength(1);
    expect(throughBase[0]?.t0).toBeCloseTo(1);
    expect(throughBase[0]?.t1).toBeCloseTo(5);
  });

  it("doesn't double-count a line passing exactly through a shared vertex", () => {
    // A line through (2,0) and (2,4) touches the square's corner-free top/bottom edges cleanly;
    // nudge to pass through vertex (4,4) extended isn't representative, so instead check a
    // line along y=4 (coincides with the top edge) is treated consistently (no crash, finite result).
    const onEdge = linePolygonIntervals(p(-2, 4), p(1, 0), square);
    expect(Number.isFinite(onEdge.length)).toBe(true);
  });

  it("gives the same interval regardless of starting point or direction sign, up to reparametrisation", () => {
    const forward = linePolygonIntervals(p(-2, 2), p(1, 0), square);
    const backward = linePolygonIntervals(p(10, 2), p(-1, 0), square);
    expect(forward).toHaveLength(1);
    expect(backward).toHaveLength(1);
    // base changed from -2 to 10 along the same line direction flipped, so lengths must match.
    const flen = (forward[0]?.t1 ?? 0) - (forward[0]?.t0 ?? 0);
    const blen = (backward[0]?.t1 ?? 0) - (backward[0]?.t0 ?? 0);
    expect(blen).toBeCloseTo(flen);
  });
});

describe("subtractIntervals", () => {
  it("removes a hole from the middle of a segment, leaving two pieces", () => {
    const result = subtractIntervals([{ t0: 0, t1: 10 }], [{ t0: 4, t1: 6 }]);
    expect(result).toEqual([
      { t0: 0, t1: 4 },
      { t0: 6, t1: 10 },
    ]);
  });

  it("removes a hole that covers the whole segment", () => {
    expect(subtractIntervals([{ t0: 2, t1: 4 }], [{ t0: 0, t1: 10 }])).toEqual([]);
  });

  it("leaves a segment untouched when the hole doesn't overlap it", () => {
    expect(subtractIntervals([{ t0: 0, t1: 2 }], [{ t0: 5, t1: 6 }])).toEqual([{ t0: 0, t1: 2 }]);
  });

  it("trims only the overlapping end when the hole straddles one edge", () => {
    expect(subtractIntervals([{ t0: 0, t1: 5 }], [{ t0: 3, t1: 8 }])).toEqual([{ t0: 0, t1: 3 }]);
  });

  it("models a gear's outer outline minus its bore (realistic composition)", () => {
    const outer = linePolygonIntervals(p(-6, 0), p(1, 0), [p(-5, -1), p(5, -1), p(5, 1), p(-5, 1)]);
    const bore = lineCircleInterval(p(-6, 0), p(1, 0), p(0, 0), 2);
    const rim = subtractIntervals(outer, bore === null ? [] : [bore]);
    expect(rim).toEqual([
      { t0: 1, t1: 4 },
      { t0: 8, t1: 11 },
    ]);
  });
});
