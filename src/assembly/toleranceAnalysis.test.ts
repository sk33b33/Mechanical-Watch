import { describe, expect, it } from "vitest";
import { millimetres as mm, toMillimetres } from "@/units/length";
import { setTolerance, updateJewel, updateShaft, type Movement } from "@/domain/movement";
import { createTolerance, type TolerancedDimension } from "@/domain/tolerance";
import type { EntityId } from "@/domain/ids";
import { removeEntity } from "@/domain/editing";
import { createDemoMovement } from "@/app/demoMovement";
import { validateMovement } from "@/validation/validateMovement";
import { endshake, shaftSupport, sideShake } from "./assemblyGeometry";
import { endshakeStack, evaluateStack, sideShakeStack, type StackResult } from "./toleranceAnalysis";

const demo = createDemoMovement();
const byName = <T extends { name: string }>(items: Record<string, T>, name: string): T => {
  const found = Object.values(items).find((i) => i.name === name);
  if (found === undefined) throw new Error(name);
  return found;
};

/** Arbor A with every bearing dimension known (illustrative test inputs, ASM-0009). */
function dimensioned(): Movement {
  let m = demo;
  const a = byName(m.shafts, "Arbor A");
  m = updateShaft(m, a.id, { pivotDiameter: { LOWER: mm(0.1), UPPER: mm(0.1) }, shoulderSpan: mm(1.97) });
  m = updateJewel(m, byName(m.jewels, "Arbor A lower jewel").id, { boreDiameter: mm(0.11) });
  m = updateJewel(m, byName(m.jewels, "Arbor A upper jewel").id, { boreDiameter: mm(0.11) });
  return m;
}

const tol = (m: Movement, entityId: EntityId, dimension: TolerancedDimension, lower: number, upper: number): Movement =>
  setTolerance(m, createTolerance({ entityId, dimension, lowerDeviation: mm(lower), upperDeviation: mm(upper) }));

const known = (r: StackResult): { nominal: number; min: number; max: number; coverage: string } => {
  if (r.status !== "KNOWN") throw new Error(r.status);
  return {
    nominal: toMillimetres(r.stack.nominal),
    min: toMillimetres(r.stack.min),
    max: toMillimetres(r.stack.max),
    coverage: r.stack.coverage,
  };
};

describe("worst-case tolerance stacks (REF-ENG §14, ASM-0017)", () => {
  const m0 = dimensioned();
  const a = byName(m0.shafts, "Arbor A");
  const lowerJewel = byName(m0.jewels, "Arbor A lower jewel");

  it("without tolerances, min = max = nominal and coverage is NONE", () => {
    const r = known(sideShakeStack(m0, a, "LOWER", lowerJewel));
    expect(r.nominal).toBeCloseTo(0.01, 12);
    expect(r.min).toBeCloseTo(0.01, 12);
    expect(r.max).toBeCloseTo(0.01, 12);
    expect(r.coverage).toBe("NONE");
  });

  it("side shake: min takes the smallest bore and the largest pivot", () => {
    let m = tol(m0, lowerJewel.id, "JEWEL_BORE", 0, 0.005);
    m = tol(m, a.id, "SHAFT_PIVOT_LOWER", -0.004, 0);
    const r = known(sideShakeStack(m, a, "LOWER", lowerJewel));
    expect(r.min).toBeCloseTo(0.01, 12); // 0.110 − 0.100
    expect(r.max).toBeCloseTo(0.019, 12); // 0.115 − 0.096
    expect(r.coverage).toBe("COMPLETE");
  });

  it("endshake stacks bridge position, plate position and thickness, and shoulder span", () => {
    const plate = byName(m0.frames, "Mainplate");
    const bridge = byName(m0.frames, "Train bridge");
    let m = tol(m0, bridge.id, "FRAME_Z_BOTTOM", -0.01, 0.01);
    m = tol(m, plate.id, "FRAME_THICKNESS", -0.01, 0.01);
    m = tol(m, a.id, "SHAFT_SHOULDER_SPAN", -0.005, 0.005);
    const r = known(endshakeStack(m, a, shaftSupport(m, a.id)));
    expect(r.nominal).toBeCloseTo(0.03, 12); // (3 − 1) − 1.97
    expect(r.min).toBeCloseTo(0.03 - 0.025, 12);
    expect(r.max).toBeCloseTo(0.03 + 0.025, 12);
    expect(r.coverage).toBe("PARTIAL"); // the mainplate's axial position has no tolerance
  });

  it("nominal of each stack equals the plain clearance calculation", () => {
    const shake = sideShake(a, "UPPER", byName(m0.jewels, "Arbor A upper jewel"));
    const end = endshake(m0, a, shaftSupport(m0, a.id));
    if (shake.status !== "KNOWN" || end.status !== "KNOWN") throw new Error("expected known");
    expect(known(sideShakeStack(m0, a, "UPPER", byName(m0.jewels, "Arbor A upper jewel"))).nominal).toBe(toMillimetres(shake.value));
    expect(known(endshakeStack(m0, a, shaftSupport(m0, a.id))).nominal).toBe(toMillimetres(end.value));
  });

  it("passes unknown inputs through instead of guessing", () => {
    const b = byName(demo.shafts, "Arbor B");
    const r = sideShakeStack(demo, b, "LOWER", byName(demo.jewels, "Arbor B lower jewel"));
    expect(r.status).toBe("UNKNOWN");
  });

  it("property: min ≤ nominal ≤ max, and the width is the sum of tolerance widths", () => {
    // Deterministic pseudo-random cases (linear congruential generator).
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 200; i += 1) {
      const widths: number[] = [];
      let m = m0;
      const terms = [
        { entityId: lowerJewel.id, entityName: "j", dimension: "JEWEL_BORE" as const, sign: 1 as const },
        { entityId: a.id, entityName: "a", dimension: "SHAFT_PIVOT_LOWER" as const, sign: -1 as const },
      ];
      for (const term of terms) {
        const lower = -next() * 0.01;
        const upper = next() * 0.01;
        widths.push(upper - lower);
        m = tol(m, term.entityId, term.dimension, lower, upper);
      }
      const r = known(evaluateStack(m, terms));
      expect(r.min).toBeLessThanOrEqual(r.nominal + 1e-12);
      expect(r.max).toBeGreaterThanOrEqual(r.nominal - 1e-12);
      expect(r.max - r.min).toBeCloseTo(widths.reduce((s, w) => s + w, 0), 9);
    }
  });
});

describe("tolerance validation (TOL-001, TOL-002, MFG-001)", () => {
  const m0 = dimensioned();
  const a = byName(m0.shafts, "Arbor A");
  const lowerJewel = byName(m0.jewels, "Arbor A lower jewel");
  const rules = (m: Movement): string[] =>
    validateMovement(m).filter((i) => i.rule.startsWith("TOL") || i.rule === "MFG-001").map((i) => `${i.rule}:${i.severity}:${i.id.split(":")[1] ?? ""}`);

  it("no tolerances: no tolerance issues at all", () => {
    expect(rules(m0)).toEqual([]);
  });

  it("warns when the worst case closes a nominally positive clearance", () => {
    const m = tol(m0, a.id, "SHAFT_PIVOT_LOWER", 0, 0.012); // pivot up to 0.112 > bore 0.110
    expect(rules(m)).toEqual(["TOL-002:warning:side-shake-LOWER", "MFG-001:info:summary"]);
    const warning = validateMovement(m).find((i) => i.rule === "TOL-002");
    expect(warning?.message).toMatch(/partial/);
    expect(warning?.references).toContain("ASM-0017");
  });

  it("stays quiet when the worst case keeps the clearance", () => {
    const m = tol(m0, lowerJewel.id, "JEWEL_BORE", -0.002, 0.002);
    expect(rules(m)).toEqual(["MFG-001:info:summary"]);
  });

  it("rejects reversed or non-finite limits and non-positive size limits", () => {
    expect(rules(tol(m0, lowerJewel.id, "JEWEL_BORE", 0.002, -0.002))).toContain("TOL-001:error:limits");
    expect(rules(tol(m0, lowerJewel.id, "JEWEL_BORE", Number.NaN, 0))).toContain("TOL-001:error:limits");
    expect(rules(tol(m0, lowerJewel.id, "JEWEL_BORE", -0.2, 0))).toContain("TOL-001:error:non-positive-limit");
  });

  it("flags a tolerance on an unknown dimension or a missing part", () => {
    const b = byName(m0.shafts, "Arbor B");
    expect(rules(tol(m0, b.id, "SHAFT_SHOULDER_SPAN", -0.01, 0.01))).toContain("TOL-001:warning:no-nominal");
    const orphan = { ...m0, tolerances: { t: { ...createTolerance({ entityId: "shaft_gone" as EntityId, dimension: "SHAFT_SHOULDER_SPAN", lowerDeviation: mm(0), upperDeviation: mm(0) }) } } };
    expect(rules(orphan as unknown as Movement)).toContain("TOL-001:error:target");
  });

  it("setTolerance replaces an earlier tolerance on the same dimension", () => {
    let m = tol(m0, lowerJewel.id, "JEWEL_BORE", -0.001, 0.001);
    m = tol(m, lowerJewel.id, "JEWEL_BORE", -0.002, 0.002);
    expect(Object.values(m.tolerances)).toHaveLength(1);
    expect(toMillimetres(Object.values(m.tolerances)[0]?.lowerDeviation ?? mm(Number.NaN))).toBeCloseTo(-0.002, 12);
  });

  it("removing a part removes the tolerances declared on it", () => {
    let m = tol(m0, lowerJewel.id, "JEWEL_BORE", -0.001, 0.001);
    m = tol(m, a.id, "SHAFT_SHOULDER_SPAN", -0.001, 0.001);
    const { movement, removedIds } = removeEntity(m, a.id);
    expect(Object.keys(movement.tolerances)).toEqual([]);
    expect(removedIds.length).toBeGreaterThan(2);
  });
});
