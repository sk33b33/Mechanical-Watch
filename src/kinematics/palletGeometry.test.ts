import { describe, expect, it } from "vitest";
import { degrees, toDegrees } from "@/units/angle";
import { metres, millimetres as mm, toMillimetres } from "@/units/length";
import {
  dropClearance,
  forkRatio,
  impulseAngle,
  isHalfToothSpan,
  lockingPoints,
  spanAngle,
  tangentialCentreDistance,
  wheelAngleBudgetPerBeat,
} from "./palletGeometry";

describe("pallet geometry (ASM-0025)", () => {
  it("span angle: pitches × 360°/z", () => {
    expect(toDegrees(spanAngle(15, 3.5))).toBeCloseTo(84, 12);
  });

  it("needs a span of k + ½ pitches for two beats per tooth (ASM-0021)", () => {
    expect(isHalfToothSpan(3.5)).toBe(true);
    expect(isHalfToothSpan(2.5)).toBe(true);
    expect(isHalfToothSpan(3)).toBe(false);
    expect(isHalfToothSpan(3.4)).toBe(false);
    expect(isHalfToothSpan(-0.5)).toBe(false);
  });

  it("tangential locking puts the pallet arbor at R / cos(φ/2)", () => {
    const d = tangentialCentreDistance(mm(2.3), spanAngle(15, 3.5));
    expect(toMillimetres(d ?? mm(Number.NaN))).toBeCloseTo(2.3 / Math.cos((42 * Math.PI) / 180), 12);
    expect(tangentialCentreDistance(mm(2.3), degrees(180))).toBeNull();
  });

  it("property: the pallet arbor lies on the tangent at each locking point", () => {
    let seed = 11;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 200; i += 1) {
      const R = mm(1 + next() * 3);
      const span = degrees(10 + next() * 160);
      const d = tangentialCentreDistance(R, span) ?? mm(Number.NaN);
      const dir = next() * 2 * Math.PI;
      const e = { x: metres(next()), y: metres(next()) };
      const p = { x: metres(e.x + d * Math.cos(dir)), y: metres(e.y + d * Math.sin(dir)) };
      for (const q of lockingPoints(e, p, R, span)) {
        // Tangent at q is perpendicular to the radius: (p − q) · (q − e) = 0.
        const dot = (p.x - q.x) * (q.x - e.x) + (p.y - q.y) * (q.y - e.y);
        expect(Math.abs(dot)).toBeLessThan(1e-15);
      }
    }
  });

  it("impulse = lever − lock − run; fork ratio = balance lift / lever", () => {
    expect(toDegrees(impulseAngle(degrees(10), degrees(2), degrees(0.5)))).toBeCloseTo(7.5, 12);
    expect(forkRatio(degrees(50), degrees(10))).toBeCloseTo(5, 12);
    expect(forkRatio(degrees(50), degrees(0))).toBeNull();
  });

  it("wheel-angle budget per beat is half the tooth pitch, π/z (ASM-0021, ASM-0036)", () => {
    // Playtner's own 15-tooth worked example: 180/15 = 12°.
    expect(toDegrees(wheelAngleBudgetPerBeat(15))).toBeCloseTo(12, 12);
    expect(toDegrees(wheelAngleBudgetPerBeat(20))).toBeCloseTo(9, 12);
  });

  it("drop clearance is the arc length at the tip circle (ASM-0036, SRC-0036)", () => {
    // Playtner's own worked example: 7.5 mm primitive diameter (3.75 mm radius), 1.5° drop ⇒ 0.0983 mm.
    const clearance = dropClearance(mm(3.75), degrees(1.5)) ?? mm(Number.NaN);
    expect(toMillimetres(clearance)).toBeCloseTo(0.0983, 3);
    expect(dropClearance(mm(0), degrees(1.5))).toBeNull();
    expect(dropClearance(mm(-1), degrees(1.5))).toBeNull();
  });
});
