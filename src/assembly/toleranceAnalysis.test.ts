import { describe, expect, it } from "vitest";
import { millimetres as mm, toMillimetres } from "@/units/length";
import { setTolerance, updateGear, updateJewel, updateShaft, type Movement } from "@/domain/movement";
import { createTolerance, type TolerancedDimension } from "@/domain/tolerance";
import type { EntityId } from "@/domain/ids";
import { removeEntity } from "@/domain/editing";
import { createDemoMovement } from "@/app/demoMovement";
import { validateMovement } from "@/validation/validateMovement";
import { solvePlacement } from "@/kinematics/solvePlacement";
import { endshake, shaftSupport, sideShake } from "./assemblyGeometry";
import { endshakeStack, evaluateStack, meshCentreDistanceStack, sideShakeStack, type StackResult } from "./toleranceAnalysis";

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

  it("warns the same way when a mesh's worst-case centre distance could reach zero", () => {
    const wheelA = byName(m0.gears, "Wheel A");
    const pinionB = byName(m0.gears, "Pinion B");
    const arborA = byName(m0.shafts, "Arbor A");
    const mesh = Object.values(m0.gearMeshes).find((g) => g.drivingGearId === wheelA.id);
    if (mesh === undefined) throw new Error("mesh AB");
    // Arbor A is FIXED; an absurdly wide position tolerance overwhelms the ~5.25 mm nominal distance
    // without also tripping a module positivity check (position has no such lower bound).
    const m = tol(m0, arborA.id, "SHAFT_POSITION_X", -100, 100);
    expect(rules(m)).toEqual(["TOL-002:warning:mesh-centre-distance", "MFG-001:info:summary"]);
    const warning = validateMovement(m).find((i) => i.rule === "TOL-002");
    expect(warning?.message).toContain(`${wheelA.name}/${pinionB.name} centre distance`);
    expect(warning?.entityIds).toEqual(expect.arrayContaining([mesh.id, wheelA.id, pinionB.id]));
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

describe("gear mesh centre-distance stack (ASM-0027, GEAR_MODULE, SHAFT_POSITION_X/Y)", () => {
  const demo = createDemoMovement();
  const wheelA = byName(demo.gears, "Wheel A");
  const pinionB = byName(demo.gears, "Pinion B");
  const wheelB = byName(demo.gears, "Wheel B");
  const meshAB = Object.values(demo.gearMeshes).find((g) => g.drivingGearId === wheelA.id) ?? (() => { throw new Error("mesh AB"); })();
  const meshBC = Object.values(demo.gearMeshes).find((g) => g.drivingGearId === wheelB.id) ?? (() => { throw new Error("mesh BC"); })();
  const arborA = byName(demo.shafts, "Arbor A");
  const arborB = byName(demo.shafts, "Arbor B");

  /** The exact solved distance and unit direction from the driving to the driven arbor, computed independently of the code under test. */
  const solvedGeometry = (m: Movement, mesh: typeof meshAB): { d: number; ux: number; uy: number } => {
    const placement = solvePlacement(m);
    const g1 = m.gears[mesh.drivingGearId];
    const g2 = m.gears[mesh.drivenGearId];
    if (g1 === undefined || g2 === undefined) throw new Error("gears missing");
    const p1 = placement.shaftPositions.get(g1.shaftId);
    const p2 = placement.shaftPositions.get(g2.shaftId);
    if (p1 === undefined || p2 === undefined) throw new Error("unplaced");
    const dx = toMillimetres(p2.x) - toMillimetres(p1.x);
    const dy = toMillimetres(p2.y) - toMillimetres(p1.y);
    const d = Math.hypot(dx, dy);
    return { d, ux: dx / d, uy: dy / d };
  };

  it("without tolerances, the stack is the placed distance, min = max = nominal, coverage NONE", () => {
    const { d } = solvedGeometry(demo, meshAB);
    const r = known(meshCentreDistanceStack(demo, meshAB, solvePlacement(demo)));
    expect(r.nominal).toBeCloseTo(d, 9);
    expect(r.nominal).toBeCloseTo(0.15 * (60 + 10) / 2, 6); // module 0.15 mm, teeth 60 & 10: matches the ideal centre distance
    expect(r.min).toBeCloseTo(d, 9);
    expect(r.max).toBeCloseTo(d, 9);
    expect(r.coverage).toBe("NONE");
  });

  it("a module tolerance on the driving gear moves the distance by (z1+z2)/2 × the deviation", () => {
    const m = tol(demo, wheelA.id, "GEAR_MODULE", -0.01, 0.02);
    const { d } = solvedGeometry(m, meshAB);
    const r = known(meshCentreDistanceStack(m, meshAB, solvePlacement(m)));
    const teethSum = (60 + 10) / 2;
    expect(r.min).toBeCloseTo(d - teethSum * 0.01, 9);
    expect(r.max).toBeCloseTo(d + teethSum * 0.02, 9);
    // Arbor A is FIXED, so it still contributes untoleranced position terms alongside the toleranced module.
    expect(r.coverage).toBe("PARTIAL");
  });

  it("a module tolerance declared on the driven gear instead has no effect (only the driving gear's is read)", () => {
    const m = tol(demo, pinionB.id, "GEAR_MODULE", -0.01, 0.02);
    const r = known(meshCentreDistanceStack(m, meshAB, solvePlacement(m)));
    const { d } = solvedGeometry(m, meshAB);
    expect(r.min).toBeCloseTo(d, 9);
    expect(r.max).toBeCloseTo(d, 9);
  });

  it("a FIXED shaft's position tolerance projects onto the mesh's centre-line direction", () => {
    const m = tol(demo, arborA.id, "SHAFT_POSITION_X", -0.02, 0.03);
    const { d, ux } = solvedGeometry(demo, meshAB);
    const r = known(meshCentreDistanceStack(m, meshAB, solvePlacement(m)));
    // Arbor A is the driving side, so its coefficient is −ux; the two limits give the min/max in either order.
    const atLower = d + -ux * (-0.02 - 0);
    const atUpper = d + -ux * (0.03 - 0);
    expect(r.min).toBeCloseTo(Math.min(atLower, atUpper), 9);
    expect(r.max).toBeCloseTo(Math.max(atLower, atUpper), 9);
    expect(r.coverage).toBe("PARTIAL");
  });

  it("a position tolerance on a MESH_POLAR shaft has no effect: it is not a toleranceable dimension there", () => {
    // Arbor B is placed by its mesh, not FIXED, so this tolerance targets a dimension the shaft doesn't have (TOL-001).
    const m = tol(demo, arborB.id, "SHAFT_POSITION_X", -0.05, 0.05);
    const r = known(meshCentreDistanceStack(m, meshAB, solvePlacement(m)));
    const { d } = solvedGeometry(m, meshAB);
    expect(r.min).toBeCloseTo(d, 9);
    expect(r.max).toBeCloseTo(d, 9);
    expect(validateMovement(m).some((i) => i.rule === "TOL-001" && i.id.includes("target"))).toBe(true);
  });

  it("mesh BC has neither arbor FIXED, so only the module term ever varies it", () => {
    const withPosition = tol(demo, arborB.id, "SHAFT_POSITION_X", -0.05, 0.05); // arbor B drives mesh BC too, but is not FIXED
    const r0 = known(meshCentreDistanceStack(withPosition, meshBC, solvePlacement(withPosition)));
    expect(r0.coverage).toBe("NONE");
    const m = tol(demo, wheelB.id, "GEAR_MODULE", -0.02, 0.02);
    const r = known(meshCentreDistanceStack(m, meshBC, solvePlacement(m)));
    const { d } = solvedGeometry(m, meshBC);
    const teethSum = (48 + 8) / 2;
    expect(r.min).toBeCloseTo(d - teethSum * 0.02, 9);
    expect(r.max).toBeCloseTo(d + teethSum * 0.02, 9);
  });

  it("passes through missing or invalid inputs instead of guessing", () => {
    expect(meshCentreDistanceStack(demo, meshAB, { shaftPositions: new Map(), failures: [] }).status).toBe("UNKNOWN");
    const noTeeth = updateGear(demo, wheelA.id, { toothCount: Number.NaN });
    expect(meshCentreDistanceStack(noTeeth, meshAB, solvePlacement(noTeeth)).status).toBe("UNKNOWN");
    const mismatched = updateGear(demo, wheelA.id, { module: mm(0.2) });
    expect(meshCentreDistanceStack(mismatched, meshAB, solvePlacement(mismatched)).status).toBe("UNKNOWN");
  });

  it("property: min ≤ nominal ≤ max under randomized module and position tolerances", () => {
    let seed = 777;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 200; i += 1) {
      let m = demo;
      m = tol(m, wheelA.id, "GEAR_MODULE", -next() * 0.02, next() * 0.02);
      m = tol(m, arborA.id, "SHAFT_POSITION_X", -next() * 0.05, next() * 0.05);
      m = tol(m, arborA.id, "SHAFT_POSITION_Y", -next() * 0.05, next() * 0.05);
      const r = known(meshCentreDistanceStack(m, meshAB, solvePlacement(m)));
      expect(r.min).toBeLessThanOrEqual(r.nominal + 1e-9);
      expect(r.max).toBeGreaterThanOrEqual(r.nominal - 1e-9);
    }
  });
});
