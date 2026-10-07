import { describe, expect, it } from "vitest";
import { radians } from "@/units/angle";
import { radiansPerSecond } from "@/units/angularVelocity";
import {
  genevaDriverMotionAngle,
  genevaLambda,
  genevaLockingDiscRadiusRatio,
  genevaStrokeDriverAngle,
  genevaWheelAdvanceAngle,
  genevaWheelAngle,
  genevaWheelAngularVelocity,
} from "./genevaDrive";

describe("genevaLambda (ASM-0050, SRC-0047)", () => {
  it("is sin(pi/n) for standard slot counts", () => {
    expect(genevaLambda(3)).toBeCloseTo(Math.sin(Math.PI / 3), 12);
    expect(genevaLambda(4)).toBeCloseTo(Math.SQRT1_2, 12);
    expect(genevaLambda(6)).toBeCloseTo(0.5, 12);
  });
});

describe("genevaLockingDiscRadiusRatio (ASM-0050, SRC-0047)", () => {
  it("is cos(pi/n), and together with lambda satisfies the Pythagorean identity", () => {
    for (const n of [3, 4, 5, 6, 8]) {
      const lambda = genevaLambda(n);
      const ratio = genevaLockingDiscRadiusRatio(n);
      expect(ratio).toBeCloseTo(Math.cos(Math.PI / n), 12);
      expect(lambda * lambda + ratio * ratio).toBeCloseTo(1, 12);
    }
  });
});

describe("genevaWheelAdvanceAngle / genevaDriverMotionAngle (ASM-0050, SRC-0047)", () => {
  it("the wheel advances 2*pi/n per index", () => {
    expect(genevaWheelAdvanceAngle(4)).toBeCloseTo(Math.PI / 2, 12);
    expect(genevaWheelAdvanceAngle(6)).toBeCloseTo(Math.PI / 3, 12);
  });

  it("the driver's own motion sweep is pi(n-2)/n, 90 degrees for a 4-slot wheel", () => {
    expect(genevaDriverMotionAngle(4)).toBeCloseTo(Math.PI / 2, 12);
    expect(genevaDriverMotionAngle(3)).toBeCloseTo(Math.PI / 3, 12);
    expect(genevaDriverMotionAngle(6)).toBeCloseTo((2 * Math.PI) / 3, 12);
  });
});

/**
 * genevaWheelAngle/genevaWheelAngularVelocity's own α reference point
 * (the stroke's symmetric midpoint) was independently re-derived from
 * direct driver-pin/wheel-centre coordinate geometry (O1 at the origin,
 * O2 at (a, 0), pin at (l cos φ, l sin φ)) and cross-checked numerically
 * against that construction, not just trusted from a secondhand
 * transcription of SRC-0047 — these tests encode that same geometric
 * construction (independent of the implementation under test) as the
 * primary check, plus the internal self-consistency properties
 * (boundary values, symmetry, integration) below.
 */
function directWheelAngle(driverAngleFromMidpoint: number, slotCount: number): number {
  const lambda = genevaLambda(slotCount);
  const phi = -driverAngleFromMidpoint;
  const px = lambda * Math.cos(phi);
  const py = lambda * Math.sin(phi);
  const angleFromWheelCentre = Math.atan2(py, px - 1);
  let beta = angleFromWheelCentre - Math.PI;
  while (beta > Math.PI) beta -= 2 * Math.PI;
  while (beta < -Math.PI) beta += 2 * Math.PI;
  return beta;
}

describe("genevaWheelAngle (ASM-0050, SRC-0047)", () => {
  it("matches direct driver-pin/wheel-centre coordinate geometry", () => {
    const n = 4;
    const half = genevaDriverMotionAngle(n) / 2;
    for (const fraction of [-1, -0.5, 0, 0.5, 1]) {
      const alpha = half * fraction;
      expect(genevaWheelAngle(radians(alpha), n)).toBeCloseTo(directWheelAngle(alpha, n), 9);
    }
  });

  it("is zero at the stroke's symmetric midpoint (alpha = 0)", () => {
    expect(genevaWheelAngle(radians(0), 4)).toBeCloseTo(0, 12);
  });

  it("reaches plus/minus half the wheel's own advance angle at the two ends of the stroke", () => {
    for (const n of [3, 4, 5, 6, 8]) {
      const half = genevaDriverMotionAngle(n) / 2;
      const advanceHalf = genevaWheelAdvanceAngle(n) / 2;
      expect(genevaWheelAngle(radians(half), n)).toBeCloseTo(advanceHalf, 9);
      expect(genevaWheelAngle(radians(-half), n)).toBeCloseTo(-advanceHalf, 9);
    }
  });

  it("is an odd function of alpha (antisymmetric about the midpoint)", () => {
    const n = 4;
    for (const alpha of [0.1, 0.3, 0.5, 0.7]) {
      expect(genevaWheelAngle(radians(alpha), n)).toBeCloseTo(-Number(genevaWheelAngle(radians(-alpha), n)), 12);
    }
  });

  it("is monotonically increasing across the whole stroke", () => {
    const n = 4;
    const half = genevaDriverMotionAngle(n) / 2;
    let previous = -Infinity;
    for (let i = 0; i <= 20; i += 1) {
      const alpha = -half + (2 * half * i) / 20;
      const beta = genevaWheelAngle(radians(alpha), n);
      expect(beta).toBeGreaterThan(previous);
      previous = beta;
    }
  });
});

describe("genevaWheelAngularVelocity (ASM-0050, SRC-0047)", () => {
  it("integrating the angular velocity across the whole stroke recovers the wheel's own net advance", () => {
    const n = 4;
    const driverOmega = radiansPerSecond(1);
    const half = genevaDriverMotionAngle(n) / 2;
    const steps = 20000;
    const dAlpha = (2 * half) / steps;
    let integrated = 0;
    for (let i = 0; i < steps; i += 1) {
      const alpha = -half + (i + 0.5) * dAlpha;
      const omega = genevaWheelAngularVelocity(driverOmega, radians(alpha), n);
      integrated += (omega * dAlpha) / driverOmega;
    }
    expect(integrated).toBeCloseTo(genevaWheelAdvanceAngle(n), 4);
  });

  it("agrees with a numerical derivative of genevaWheelAngle", () => {
    const n = 4;
    const driverOmega = radiansPerSecond(1);
    const h = 1e-6;
    for (const alpha of [-0.6, -0.2, 0, 0.2, 0.6]) {
      const numerical = (genevaWheelAngle(radians(alpha + h), n) - genevaWheelAngle(radians(alpha - h), n)) / (2 * h);
      expect(genevaWheelAngularVelocity(driverOmega, radians(alpha), n)).toBeCloseTo(numerical, 6);
    }
  });

  it("is zero at both ends of the stroke (tangential, impact-free engagement)", () => {
    const n = 4;
    const driverOmega = radiansPerSecond(1);
    const half = genevaDriverMotionAngle(n) / 2;
    expect(genevaWheelAngularVelocity(driverOmega, radians(half), n)).toBeCloseTo(0, 9);
    expect(genevaWheelAngularVelocity(driverOmega, radians(-half), n)).toBeCloseTo(0, 9);
  });

  it("peaks at the stroke's symmetric midpoint", () => {
    const n = 4;
    const driverOmega = radiansPerSecond(1);
    const atMid = genevaWheelAngularVelocity(driverOmega, radians(0), n);
    const beforeMid = genevaWheelAngularVelocity(driverOmega, radians(-0.1), n);
    const afterMid = genevaWheelAngularVelocity(driverOmega, radians(0.1), n);
    expect(atMid).toBeGreaterThan(beforeMid);
    expect(atMid).toBeGreaterThan(afterMid);
  });
});

describe("genevaStrokeDriverAngle (ASM-0050)", () => {
  it("starts at minus half the driver motion sweep and ends at plus half, linear in between", () => {
    const n = 4;
    const half = genevaDriverMotionAngle(n) / 2;
    expect(genevaStrokeDriverAngle(0, 0.4, n)).toBeCloseTo(-half, 12);
    expect(genevaStrokeDriverAngle(0.2, 0.4, n)).toBeCloseTo(0, 12);
    expect(genevaStrokeDriverAngle(0.4, 0.4, n)).toBeCloseTo(half, 12);
  });

  it("clamps elapsed time outside [0, duration] rather than overshooting", () => {
    const n = 4;
    const half = genevaDriverMotionAngle(n) / 2;
    expect(genevaStrokeDriverAngle(-1, 0.4, n)).toBeCloseTo(-half, 12);
    expect(genevaStrokeDriverAngle(10, 0.4, n)).toBeCloseTo(half, 12);
  });

  it("a zero duration snaps straight to the end of the stroke, never divides by zero", () => {
    const n = 4;
    const half = genevaDriverMotionAngle(n) / 2;
    expect(genevaStrokeDriverAngle(0, 0, n)).toBeCloseTo(half, 12);
    expect(Number.isFinite(genevaStrokeDriverAngle(0, 0, n))).toBe(true);
  });

  it("composed with genevaWheelAngle, reproduces the wheel's own pre- and post-stroke angles exactly", () => {
    const n = 4;
    const advanceHalf = genevaWheelAdvanceAngle(n) / 2;
    const atStart = genevaWheelAngle(genevaStrokeDriverAngle(0, 0.4, n), n);
    const atEnd = genevaWheelAngle(genevaStrokeDriverAngle(0.4, 0.4, n), n);
    expect(atStart).toBeCloseTo(-advanceHalf, 9);
    expect(atEnd).toBeCloseTo(advanceHalf, 9);
  });
});
