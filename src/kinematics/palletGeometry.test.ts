import { describe, expect, it } from "vitest";
import { degrees, radians, toDegrees } from "@/units/angle";
import { metres, millimetres as mm, toMillimetres } from "@/units/length";
import {
  crescentHalfAngle,
  dropClearance,
  forkActingLength,
  forkRatio,
  guardPointClearance,
  impulseAngle,
  isHalfToothSpan,
  lockingPoints,
  ringCrossingAngle,
  rubyPinAngleAtBalance,
  spanAngle,
  suggestedRubyPinWidth,
  tangentialCentreDistance,
  toothDrawAngle,
  toothWidthAngle,
  wheelAngleBudgetPerBeat,
} from "./palletGeometry";

/** Seeded PRNG, same generator used by the other property tests in this file. */
function makeRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Absolute angle between two vectors, in [0, π], via atan2(|cross|, dot) — independent of `ringCrossingAngle`'s own law-of-sines derivation. */
function angleBetween(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(Math.abs(ax * by - ay * bx), ax * bx + ay * by);
}

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

  it("tooth width is the budget remainder after pallet width and drop (ASM-0037, SRC-0036)", () => {
    // Playtner's own 15-tooth worked example: 12° budget − 6° pallet − 1.5° drop = 4.5° tooth.
    expect(toDegrees(toothWidthAngle(15, degrees(6), degrees(1.5)))).toBeCloseTo(4.5, 12);
    // Can go negative when over budget — validity is ESC-106's job, not this function's.
    expect(toDegrees(toothWidthAngle(15, degrees(11), degrees(1.5)))).toBeCloseTo(-0.5, 12);
  });

  it("the escape-tooth locking face is conventionally double the pallet's own draw (ASM-0039, SRC-0036)", () => {
    // Playtner's own worked example: 12° pallet draw, 24° tooth locking face.
    expect(toDegrees(toothDrawAngle(degrees(12)))).toBeCloseTo(24, 12);
    expect(toDegrees(toothDrawAngle(degrees(10)))).toBeCloseTo(20, 12);
  });

  it("fork acting length = impulse radius × fork ratio, the inverse-ratio law (ASM-0041, SRC-0036)", () => {
    // Playtner's own cited 5:1 proportion (lift 50° / lever 10°) and his own 4.5 mm fork-length example.
    const ratio = forkRatio(degrees(50), degrees(10)) ?? Number.NaN;
    expect(ratio).toBeCloseTo(5, 12);
    const length = forkActingLength(mm(0.9), ratio) ?? mm(Number.NaN);
    expect(toMillimetres(length)).toBeCloseTo(4.5, 12);
    expect(forkActingLength(mm(0.9), null)).toBeNull();
    expect(forkActingLength(mm(0), ratio)).toBeNull();
    expect(forkActingLength(mm(-1), ratio)).toBeNull();
  });

  it("the suggested ruby-pin width is half the fork's total angular motion (ASM-0042, SRC-0036)", () => {
    expect(toDegrees(suggestedRubyPinWidth(degrees(10)))).toBeCloseTo(5, 12);
    expect(toDegrees(suggestedRubyPinWidth(degrees(2.5)))).toBeCloseTo(1.25, 12);
  });

  it("guard-point clearance is the arc length at the guard-point radius (ASM-0043, SRC-0036)", () => {
    // Playtner's own worked example: 4 mm guard radius, 1¼° freedom ⇒ 0.0873 mm.
    const clearance = guardPointClearance(mm(4), degrees(1.25)) ?? mm(Number.NaN);
    expect(toMillimetres(clearance)).toBeCloseTo(0.0873, 3);
    expect(guardPointClearance(mm(0), degrees(1.25))).toBeNull();
    expect(guardPointClearance(mm(-1), degrees(1.25))).toBeNull();
  });

  it("property: ringCrossingAngle matches an independent ray-circle intersection (ASM-0044)", () => {
    const next = makeRandom(23);
    for (let i = 0; i < 200; i += 1) {
      const d = 2 + next() * 5; // pallet-to-balance distance, mm (unitless here, formula is scale-free)
      const rayAngle = (5 + next() * 30) * (Math.PI / 180); // 5°-35°, like a fork rest angle plus freedom
      const minR = d * Math.sin(rayAngle); // smallest ring radius the ray can still reach
      // Kept below d (a real roller is always much smaller than the pallet-to-balance distance), so
      // the nearest ray/circle crossing is always ahead of the pallet centre, not behind it.
      const R = minR + next() * (d - minR) * 0.8;
      const result = ringCrossingAngle(metres(d), radians(rayAngle), metres(R));
      expect(result).not.toBeNull();
      // Independent construction: A at origin, A' at (d, 0); ray from A at angle `rayAngle`;
      // nearest forward intersection with the circle of radius R around A'.
      const cosA = Math.cos(rayAngle);
      const disc = R * R - d * d * Math.sin(rayAngle) * Math.sin(rayAngle);
      const t = d * cosA - Math.sqrt(Math.max(disc, 0));
      const gx = t * cosA;
      const gy = t * Math.sin(rayAngle);
      const expected = angleBetween(-d, 0, gx - d, gy);
      expect(toDegrees(result ?? radians(Number.NaN))).toBeCloseTo((expected * 180) / Math.PI, 6);
    }
    // Too small a ring for this angle and distance to reach: null, not a wrong answer.
    expect(ringCrossingAngle(mm(4), degrees(30), mm(0.5))).toBeNull();
    expect(ringCrossingAngle(mm(0), degrees(10), mm(1))).toBeNull();
  });

  it("property: rubyPinAngleAtBalance matches an independent two-circle intersection (ASM-0044)", () => {
    const next = makeRandom(29);
    for (let i = 0; i < 200; i += 1) {
      // Three lengths that satisfy the triangle inequality by construction.
      const d = 1 + next() * 5;
      const L = Math.max(0.2, d * (0.3 + next() * 1.2));
      const R = Math.max(0.2, Math.abs(L - d) + next() * (L + d - Math.abs(L - d)) * 0.98 + 0.01);
      if (!(R > Math.abs(d - L) && R < d + L)) continue;
      const result = rubyPinAngleAtBalance(metres(d), metres(L), metres(R));
      expect(result).not.toBeNull();
      // Independent construction: A at origin, A' at (d, 0); P on both circles (radius L around A,
      // radius R around A'), via the standard two-circle intersection.
      const a = (L * L - R * R + d * d) / (2 * d);
      const h2 = L * L - a * a;
      expect(h2).toBeGreaterThanOrEqual(-1e-9);
      const h = Math.sqrt(Math.max(h2, 0));
      const expected = angleBetween(-d, 0, a - d, h);
      expect(toDegrees(result ?? radians(Number.NaN))).toBeCloseTo((expected * 180) / Math.PI, 6);
    }
    // Lengths that cannot form a triangle: null, not a wrong answer.
    expect(rubyPinAngleAtBalance(mm(3.5), mm(4.5), mm(0.9))).toBeNull(); // the teaching movement's own values
    expect(rubyPinAngleAtBalance(mm(0), mm(4.5), mm(0.9))).toBeNull();
  });

  it("crescent half-angle composes the ruby-pin and guard-point directions (ASM-0044, SRC-0036 \"The Crescent\")", () => {
    const d = mm(5);
    const lever = degrees(10);
    const freedom = degrees(1.25);
    const forkLength = mm(4.5);
    const impulseRadius = mm(0.9);
    const rollerRadius = mm(1.8);
    const half = crescentHalfAngle(d, lever, freedom, forkLength, impulseRadius, rollerRadius);
    const rubyPinAngle = rubyPinAngleAtBalance(d, forkLength, impulseRadius) ?? radians(Number.NaN);
    const guardAngle = ringCrossingAngle(d, radians(lever / 2 + freedom), rollerRadius) ?? radians(Number.NaN);
    expect(half).not.toBeNull();
    expect(toDegrees(half ?? radians(Number.NaN))).toBeCloseTo(Math.abs(toDegrees(guardAngle) - toDegrees(rubyPinAngle)), 9);
    // Not positive lever angle or guard freedom: null.
    expect(crescentHalfAngle(d, degrees(0), freedom, forkLength, impulseRadius, rollerRadius)).toBeNull();
    expect(crescentHalfAngle(d, lever, degrees(0), forkLength, impulseRadius, rollerRadius)).toBeNull();
    // The teaching movement's own pallet-to-balance distance (3.5mm) does not admit its own fork
    // acting length (4.5mm) and impulse radius (0.9mm) as a consistent triangle (ASM-0044) — the
    // ruby-pin direction alone is already ungrounded, so the whole construction is null regardless
    // of roller radius.
    expect(crescentHalfAngle(mm(3.5), lever, freedom, forkLength, impulseRadius, rollerRadius)).toBeNull();
  });
});
