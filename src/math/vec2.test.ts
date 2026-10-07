import { describe, expect, it } from "vitest";
import { metres } from "@/units/length";
import { degrees } from "@/units/angle";
import { circleOverlapsPolygon, distance, distanceToRectangle, pointInPolygon, polarOffset, vec2, type Vec2 } from "./vec2";

const p = (x: number, y: number): Vec2 => vec2(metres(x), metres(y));
const square = [p(0, 0), p(2, 0), p(2, 2), p(0, 2)];

describe("vec2", () => {
  it("computes distance and polar offsets", () => {
    expect(distance(p(0, 0), p(3, 4))).toBeCloseTo(5);
    const q = polarOffset(p(1, 1), metres(2), degrees(90));
    expect(q.x).toBeCloseTo(1);
    expect(q.y).toBeCloseTo(3);
  });

  it("tests point containment in a polygon", () => {
    expect(pointInPolygon(p(1, 1), square)).toBe(true);
    expect(pointInPolygon(p(3, 1), square)).toBe(false);
    const concave = [p(0, 0), p(4, 0), p(4, 4), p(2, 1), p(0, 4)];
    expect(pointInPolygon(p(2, 3), concave)).toBe(false);
    expect(pointInPolygon(p(1, 1), concave)).toBe(true);
  });

  it("detects circle/polygon overlap from inside, across an edge, and not at all", () => {
    expect(circleOverlapsPolygon(p(1, 1), 0.1, square)).toBe(true);
    expect(circleOverlapsPolygon(p(2.5, 1), 0.6, square)).toBe(true);
    expect(circleOverlapsPolygon(p(2.5, 1), 0.4, square)).toBe(false);
  });

  it("distance to a rectangle is zero from inside it", () => {
    expect(distanceToRectangle(p(0, 0), p(0, 0), 2, 1)).toBe(0);
    expect(distanceToRectangle(p(0.9, 0.4), p(0, 0), 2, 1)).toBe(0);
  });

  it("distance to a rectangle, straight out from an edge, is the perpendicular gap", () => {
    expect(distanceToRectangle(p(2, 0), p(0, 0), 2, 1)).toBeCloseTo(1);
    expect(distanceToRectangle(p(0, 1.5), p(0, 0), 2, 1)).toBeCloseTo(1);
  });

  it("distance to a rectangle, diagonally off a corner, is the straight-line gap to that corner", () => {
    expect(distanceToRectangle(p(4, 3), p(0, 0), 2, 2)).toBeCloseTo(Math.hypot(3, 2));
  });
});
