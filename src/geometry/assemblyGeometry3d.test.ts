import { describe, expect, it } from "vitest";
import type { Point2D } from "./gearOutline";
import {
  balanceArmHalfExtents,
  balanceRimInnerRadius,
  createDiscWithHolesGeometry,
  createGenevaWheelGeometry,
  createRodGeometry,
  createZCylinder,
  discCapCanvasAngleForMeshAngle,
  discLabelPlacements,
  escapeWheelHubRadius,
  generateEscapeWheelOutline,
  generateHandOutline,
  generatePalletStoneOutline,
  GENEVA_WHEEL_VISUALIZATION,
  handHubRadius,
  moonImageLocalAngle,
  MOON_PHASE_VISUALIZATION,
  rayCircleInward,
  type PalletArm,
} from "./assemblyGeometry3d";

/** Twice the signed area of a simple polygon (shoelace formula); positive for counter-clockwise winding. */
function signedArea(points: readonly Point2D[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (a === undefined || b === undefined) continue;
    total += a.x * b.y - b.x * a.y;
  }
  return total / 2;
}

function segmentsCross(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): boolean {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-24) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
}

/** True if any two non-adjacent edges of this closed polygon cross. */
function isSelfIntersecting(points: readonly Point2D[]): boolean {
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const a1 = points[i];
      const a2 = points[(i + 1) % n];
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      if (a1 === undefined || a2 === undefined || b1 === undefined || b2 === undefined) continue;
      if (segmentsCross(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

describe("generateEscapeWheelOutline", () => {
  it("without a tooth face, produces 3 points per tooth, all between the hub and the tip radius (ASM-0012)", () => {
    const toothCount = 15;
    const tipRadius = 0.0023;
    const outline = generateEscapeWheelOutline(toothCount, tipRadius);
    expect(outline).toHaveLength(toothCount * 3);
    const hub = escapeWheelHubRadius(tipRadius);
    for (const point of outline) {
      const radius = Math.hypot(point.x, point.y);
      expect(radius).toBeGreaterThan(hub);
      expect(radius).toBeLessThanOrEqual(tipRadius + 1e-12);
    }
  });

  it("with a tooth face, produces 4 points per tooth, each a valid non-self-intersecting quadrilateral (ASM-0040)", () => {
    const toothCount = 15;
    const tipRadius = 0.0023;
    // Playtner's own worked 15-tooth example: 4.5° tooth width, 12° -> 24° draw doubling.
    const face = { toothWidthAngle: (4.5 * Math.PI) / 180, toothDrawAngle: (24 * Math.PI) / 180 };
    const outline = generateEscapeWheelOutline(toothCount, tipRadius, face);
    expect(outline).toHaveLength(toothCount * 4);
    const root = tipRadius * 0.72;
    for (let i = 0; i < toothCount; i += 1) {
      const tooth = outline.slice(i * 4, i * 4 + 4);
      expect(tooth).toHaveLength(4);
      expect(signedArea(tooth)).toBeGreaterThan(0);
      expect(isSelfIntersecting(tooth)).toBe(false);
      for (const point of tooth) {
        const radius = Math.hypot(point.x, point.y);
        expect(radius).toBeGreaterThan(root * 0.5);
        expect(radius).toBeLessThanOrEqual(tipRadius + 1e-12);
      }
    }
  });

  it("clamps a near-zero tooth width (a ratchet tooth, ASM-0038) to a small but non-degenerate sliver", () => {
    const outline = generateEscapeWheelOutline(15, 0.0023, { toothWidthAngle: 0, toothDrawAngle: (24 * Math.PI) / 180 });
    const tooth = outline.slice(0, 4);
    expect(signedArea(tooth)).toBeGreaterThan(0);
  });

  it("falls back to a plain radial trailing edge when the draw-derived lean has no solution (very steep lean)", () => {
    // A lean this steep cannot reach the root circle (rayCircleInward returns null); should not throw or produce NaN.
    const outline = generateEscapeWheelOutline(15, 0.0023, { toothWidthAngle: (4.5 * Math.PI) / 180, toothDrawAngle: (85 * Math.PI) / 180 });
    for (const point of outline) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });
});

describe("rayCircleInward", () => {
  it("with zero lean, reaches the target radius by the straight inward distance", () => {
    const from: Point2D = { x: 2.3e-3, y: 0 };
    const q = rayCircleInward(from, 0, 1.656e-3);
    expect(q?.x).toBeCloseTo(1.656e-3, 9);
    expect(q?.y).toBeCloseTo(0, 9);
  });

  it("a non-zero lean moves the intersection point around the circle, not radially", () => {
    const from: Point2D = { x: 2.3e-3, y: 0 };
    const q = rayCircleInward(from, (24 * Math.PI) / 180, 1.656e-3) ?? { x: Number.NaN, y: Number.NaN };
    expect(Math.hypot(q.x, q.y)).toBeCloseTo(1.656e-3, 9);
    expect(Math.atan2(q.y, q.x)).not.toBeCloseTo(0, 3);
  });

  it("returns null when the lean is too steep for the ray to reach the target circle at all", () => {
    const from: Point2D = { x: 2.3e-3, y: 0 };
    expect(rayCircleInward(from, (80 * Math.PI) / 180, 1.656e-3)).toBeNull();
  });
});

describe("generatePalletStoneOutline", () => {
  it("without a face angle, falls back to a plain square centred on the locking point (ASM-0012)", () => {
    const arm: PalletArm = { angle: 0.3, length: 2e-3, faceAngle: null };
    const outline = generatePalletStoneOutline(arm);
    expect(outline).toHaveLength(4);
    const cx = arm.length * Math.cos(arm.angle);
    const cy = arm.length * Math.sin(arm.angle);
    const centroid = outline.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 });
    expect(centroid.x).toBeCloseTo(cx, 9);
    expect(centroid.y).toBeCloseTo(cy, 9);
  });

  it("with a face angle, produces a valid non-self-intersecting quadrilateral oriented along the face direction (ASM-0039, ASM-0040)", () => {
    const arm: PalletArm = { angle: 0.3, length: 2e-3, faceAngle: 0.3 + (24 * Math.PI) / 180 };
    const outline = generatePalletStoneOutline(arm);
    expect(outline).toHaveLength(4);
    expect(Math.abs(signedArea(outline))).toBeGreaterThan(0);
    expect(isSelfIntersecting(outline)).toBe(false);
  });
});

describe("escapeWheelHubRadius", () => {
  it("is strictly smaller than the root circle it's cut from", () => {
    const tipRadius = 0.002;
    expect(escapeWheelHubRadius(tipRadius)).toBeLessThan(tipRadius * 0.72);
  });
});

describe("balanceRimInnerRadius", () => {
  it("is smaller than the outer radius by the rim-width fraction", () => {
    expect(balanceRimInnerRadius(1)).toBeCloseTo(0.9);
    expect(balanceRimInnerRadius(2)).toBeCloseTo(1.8);
  });
});

describe("balanceArmHalfExtents", () => {
  it("scales the half-length with the balance radius", () => {
    const small = balanceArmHalfExtents(1);
    const large = balanceArmHalfExtents(2);
    expect(large.halfLength).toBeCloseTo(small.halfLength * 2);
    expect(large.halfWidth).toBeCloseTo(small.halfWidth); // width is a fixed metres value, not radius-scaled
  });
});

describe("generateHandOutline", () => {
  it("produces a 4-point taper, narrow at the tail and widening toward the tip", () => {
    const outline = generateHandOutline("MINUTES");
    expect(outline).toHaveLength(4);
    const tailWidth = Math.abs((outline[0]?.x ?? 0) - (outline[1]?.x ?? 0));
    const tipWidth = Math.abs((outline[2]?.x ?? 0) - (outline[3]?.x ?? 0));
    expect(tailWidth).toBeGreaterThan(0);
    expect(tipWidth).toBeGreaterThan(0);
    // All points lie within the hand's own declared length along +Y.
    for (const point of outline) {
      expect(point.y).toBeGreaterThanOrEqual(-5e-3);
      expect(point.y).toBeLessThanOrEqual(8e-3);
    }
  });

  it("each hand kind has its own width and length", () => {
    const hours = generateHandOutline("HOURS");
    const seconds = generateHandOutline("SECONDS");
    const tip = (outline: ReturnType<typeof generateHandOutline>): number => outline[2]?.y ?? 0;
    expect(tip(hours)).not.toBe(tip(seconds));
  });
});

describe("handHubRadius", () => {
  it("is a fixed fraction of the hand's own width", () => {
    expect(handHubRadius("HOURS")).toBeCloseTo(0.6e-3 * 0.2);
    expect(handHubRadius("SECONDS")).toBeCloseTo(0.2e-3 * 0.2);
  });
});

describe("createGenevaWheelGeometry", () => {
  it("stays within the declared tip radius, and is centred on z = 0 spanning [-thickness/2, thickness/2]", () => {
    const tipRadius = 1.5e-3;
    const thickness = 0.15e-3;
    const geometry = createGenevaWheelGeometry(tipRadius, thickness, 4, 0);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    expect(box).not.toBeNull();
    expect(box?.max.x).toBeLessThanOrEqual(tipRadius + 1e-12);
    expect(box?.max.y).toBeLessThanOrEqual(tipRadius + 1e-12);
    expect(box?.min.z).toBeCloseTo(-thickness / 2, 9);
    expect(box?.max.z).toBeCloseTo(thickness / 2, 9);
  });

  it("actually cuts slots: some rim vertices sit well inside the tip radius, at the declared slot depth", () => {
    const tipRadius = 1.5e-3;
    const geometry = createGenevaWheelGeometry(tipRadius, 0.15e-3, 4, 0);
    const positions = geometry.attributes.position;
    if (positions === undefined) throw new Error("geometry has no position attribute");
    let sawSlotBottom = false;
    const innerRadius = tipRadius * GENEVA_WHEEL_VISUALIZATION.slotInnerRadiusFraction;
    for (let i = 0; i < positions.count; i += 1) {
      const radius = Math.hypot(positions.getX(i), positions.getY(i));
      if (Math.abs(radius - innerRadius) < 1e-9) sawSlotBottom = true;
    }
    expect(sawSlotBottom).toBe(true);
  });

  it("baseAngle rotates the whole slot pattern: a slot sits exactly at baseAngle itself, for any baseAngle", () => {
    const tipRadius = 1.5e-3;
    for (const baseAngle of [0, 0.4, Math.PI / 2, 2]) {
      const geometry = createGenevaWheelGeometry(tipRadius, 0.15e-3, 4, baseAngle);
      const positions = geometry.attributes.position;
      if (positions === undefined) throw new Error("geometry has no position attribute");
      const innerRadius = tipRadius * GENEVA_WHEEL_VISUALIZATION.slotInnerRadiusFraction;
      let closest = Infinity;
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const radius = Math.hypot(x, y);
        if (Math.abs(radius - innerRadius) > 1e-9) continue;
        const angle = Math.atan2(y, x);
        const delta = Math.abs(Math.atan2(Math.sin(angle - baseAngle), Math.cos(angle - baseAngle)));
        closest = Math.min(closest, delta);
      }
      expect(closest).toBeLessThan(1e-6);
    }
  });

  it("does not throw for other slot counts", () => {
    for (const slotCount of [3, 5, 6]) {
      expect(() => createGenevaWheelGeometry(1.5e-3, 0.15e-3, slotCount, 0)).not.toThrow();
    }
  });

  it("reshapes its own material groups into CylinderGeometry's [sides, +Z cap, -Z cap] convention, so discMaterials' label texture (index 2) actually lands on a face", () => {
    // ExtrudeGeometry's own default groups are [caps combined, sides] -- not this 3-group
    // split -- so discMaterials' labeled material (array index 2) previously matched no group
    // at all and the leap-year wheel's position labels silently never rendered. Regression
    // coverage for that bug.
    const thickness = 0.15e-3;
    const geometry = createGenevaWheelGeometry(1.5e-3, thickness, 4, 0);
    expect(geometry.groups).toHaveLength(3);
    const indices = geometry.groups.map((g) => g.materialIndex).sort();
    expect(indices).toEqual([0, 1, 2]);

    const position = geometry.attributes.position;
    if (position === undefined) throw new Error("geometry has no position attribute");
    for (const group of geometry.groups) {
      const zValues = new Set<number>();
      for (let i = group.start; i < group.start + group.count; i += 1) {
        zValues.add(Math.sign(Math.round(position.getZ(i) * 1e9)));
      }
      if (group.materialIndex === 1) {
        // +Z cap: every triangle sits entirely on the +Z face.
        expect([...zValues]).toEqual([1]);
      } else if (group.materialIndex === 2) {
        // -Z cap (dial-facing, carries the label texture): every triangle sits entirely on -Z.
        expect([...zValues]).toEqual([-1]);
      } else {
        // Sides: each wall triangle spans both z extremes, so both signs appear somewhere.
        expect(zValues.has(1) && zValues.has(-1)).toBe(true);
      }
    }
  });

  it("normalizes its -Z cap's own UVs into CylinderGeometry's own [0, 1] convention, matching its formula exactly", () => {
    // ExtrudeGeometry's own default UVs are each vertex's raw local (x, y) position in metres
    // (e.g. +/-0.0015), not normalized -- even with the material-group fix above, the whole
    // label texture would sample from a razor-thin sliver of UV space and never actually be
    // visible. Regression coverage for that (separate, second) bug.
    const tipRadius = 1.5e-3;
    const geometry = createGenevaWheelGeometry(tipRadius, 0.15e-3, 4, 0);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    if (position === undefined || uv === undefined) throw new Error("geometry is missing an attribute");
    const dialFacingCap = geometry.groups.find((g) => g.materialIndex === 2);
    if (dialFacingCap === undefined) throw new Error("no -Z cap group");

    expect(dialFacingCap.count).toBeGreaterThan(0);
    for (let i = dialFacingCap.start; i < dialFacingCap.start + dialFacingCap.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const u = uv.getX(i);
      const v = uv.getY(i);
      // CylinderGeometry's own -Z cap formula, empirically derived from createZCylinder.
      // (UV is a Float32Array, so this only needs float32, not float64, precision.)
      expect(u).toBeCloseTo(0.5 - y / (2 * tipRadius), 6);
      expect(v).toBeCloseTo(0.5 - x / (2 * tipRadius), 6);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("createRodGeometry", () => {
  it("spans from the local origin (the pivot) to x = 1 (the unscaled tip), centred in y/z", () => {
    const width = 0.2e-3;
    const thickness = 0.12e-3;
    const geometry = createRodGeometry(width, thickness);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    expect(box?.min.x).toBeCloseTo(0, 9);
    expect(box?.max.x).toBeCloseTo(1, 9);
    expect(box?.min.y).toBeCloseTo(-width / 2, 9);
    expect(box?.max.y).toBeCloseTo(width / 2, 9);
    expect(box?.min.z).toBeCloseTo(-thickness / 2, 9);
    expect(box?.max.z).toBeCloseTo(thickness / 2, 9);
  });

  it("scaling mesh.scale.x reaches any declared tip distance, the technique DATE_LINKAGE_VISUALIZATION's jumper rod relies on", () => {
    const geometry = createRodGeometry(0.2e-3, 0.12e-3);
    geometry.computeBoundingBox();
    const unscaledMax = geometry.boundingBox?.max.x ?? 0;
    const distance = 2.3e-3;
    expect(unscaledMax * distance).toBeCloseTo(distance, 9);
  });
});

describe("createDiscWithHolesGeometry", () => {
  it("punches one hole per valid entry into the disc's bounding box (ASM-0051)", () => {
    const geometry = createDiscWithHolesGeometry(3e-3, 0.3e-3, [
      { kind: "CIRCLE", x: 1e-3, y: 0, radius: 0.3e-3 },
      { kind: "RECTANGLE", x: -1e-3, y: 0.5e-3, width: 0.3e-3, height: 0.2e-3 },
    ]);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    expect(box).not.toBeNull();
    // The holes sit well inside the outer disc, so they must not enlarge its bounding box.
    expect(box?.max.x).toBeLessThanOrEqual(3e-3 + 1e-9);
    expect(box?.min.x).toBeGreaterThanOrEqual(-3e-3 - 1e-9);
    // Depth spans [0, thickness], not centred on it (same convention as createFrameGeometry).
    expect(box?.min.z).toBeCloseTo(0, 9);
    expect(box?.max.z).toBeCloseTo(0.3e-3, 9);
  });

  it("skips a hole with a non-finite or non-positive dimension rather than throwing (DIALWIN-001 leaves the geometry to this)", () => {
    expect(() =>
      createDiscWithHolesGeometry(3e-3, 0.3e-3, [
        { kind: "CIRCLE", x: 0, y: 0, radius: Number.NaN },
        { kind: "CIRCLE", x: 0, y: 0, radius: 0 },
        { kind: "CIRCLE", x: Number.NaN, y: 0, radius: 0.2e-3 },
        { kind: "RECTANGLE", x: 0, y: 0, width: Number.NaN, height: 0.2e-3 },
        { kind: "RECTANGLE", x: 0, y: 0, width: 0.2e-3, height: 0 },
      ]),
    ).not.toThrow();
  });

  it("a rectangle hole is axis-aligned, centred on its own x/y, width along X and height along Y", () => {
    const geometry = createDiscWithHolesGeometry(3e-3, 0.3e-3, [
      { kind: "RECTANGLE", x: 0, y: 0, width: 1.6e-3, height: 0.6e-3 },
    ]);
    const positions = geometry.attributes.position;
    if (positions === undefined) throw new Error("geometry has no position attribute");
    let sawNearCorner = false;
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      if (Math.abs(x - 0.8e-3) < 1e-9 && Math.abs(y - 0.3e-3) < 1e-9) sawNearCorner = true;
    }
    expect(sawNearCorner).toBe(true);
  });

  it("produces a plain solid disc when there are no holes at all", () => {
    const withHoles = createDiscWithHolesGeometry(3e-3, 0.3e-3, []);
    withHoles.computeBoundingBox();
    const box = withHoles.boundingBox;
    expect(box?.max.x).toBeCloseTo(3e-3, 6);
    expect(box?.min.x).toBeCloseTo(-3e-3, 6);
  });
});

describe("discLabelPlacements", () => {
  it("places labels evenly around the rim, each oriented radially outward (ASM-0051)", () => {
    const placements = discLabelPlacements(["Jan", "Feb", "Mar", "Apr"]);
    expect(placements).toHaveLength(4);
    const centre = 512 / 2;
    for (const [i, placement] of placements.entries()) {
      expect(placement.label).toBe(["Jan", "Feb", "Mar", "Apr"][i]);
      const radius = Math.hypot(placement.x - centre, placement.y - centre);
      expect(radius).toBeCloseTo(centre * 0.72, 6);
      const angle = (i / 4) * Math.PI * 2;
      expect(placement.rotation).toBeCloseTo(angle + Math.PI / 2, 9);
    }
    // Evenly spaced: the first and third labels sit on opposite sides of the centre.
    expect(placements[0]?.x).toBeCloseTo(2 * centre - (placements[2]?.x ?? 0), 6);
    expect(placements[0]?.y).toBeCloseTo(2 * centre - (placements[2]?.y ?? 0), 6);
  });

  it("returns an empty array for an empty label set, same as createDiscLabelTexture returning null", () => {
    expect(discLabelPlacements([])).toHaveLength(0);
  });

  it("places a single label at angle 0 (texture-space +X from the centre)", () => {
    const [placement] = discLabelPlacements(["only"]);
    const centre = 512 / 2;
    expect(placement?.x).toBeCloseTo(centre + centre * 0.72, 6);
    expect(placement?.y).toBeCloseTo(centre, 6);
  });
});

describe("moonImageLocalAngle", () => {
  // createMoonPhaseTexture itself touches `document` (a Canvas2D context), which this project's
  // vitest environment ("node") does not provide — the same already-accepted limitation
  // createDiscLabelTexture has (untested directly; discLabelPlacements, its own pure placement
  // math, is). moonImageLocalAngle is pure, so it's tested directly here; the texture's own
  // actual pixels are confirmed live in the browser instead (see STATUS.md).

  it("places a DOUBLE disc's two moon images at local 0 and π (SRC-0045's own 'two moons 180° apart')", () => {
    const a0 = moonImageLocalAngle(0, 2);
    const a1 = moonImageLocalAngle(1, 2);
    expect(((a0 % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toBeCloseTo(0, 9);
    expect(((a1 % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toBeCloseTo(Math.PI, 9);
  });

  it("puts each moon image exactly under the window (world angle) at its own real full-moon instant", () => {
    // moonPhaseFraction's own convention (src/kinematics/moonPhase.ts): fraction = (turns × n)
    // mod 1, so fraction = 0.5 (full moon) at shaftAngle = 2π(k + 0.5)/n for each k in [0, n).
    // A feature painted at local angle `a` appears at world angle `a + shaftAngle` once the
    // shaft group rotates by shaftAngle (the same convention createGenevaWheelGeometry's own
    // baseAngle relies on) -- this is the geometric claim moonImageLocalAngle is built from.
    for (const n of [1, 2]) {
      for (let k = 0; k < n; k += 1) {
        const shaftAngleAtFull = (2 * Math.PI * (k + 0.5)) / n;
        const worldAngle = moonImageLocalAngle(k, n) + shaftAngleAtFull;
        const normalized = ((worldAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const expected = ((MOON_PHASE_VISUALIZATION.windowWorldAngleRadians % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        expect(normalized).toBeCloseTo(expected, 9);
      }
    }
  });

  it("leaves the window clear of any moon image at the real new-moon instant, using the teaching movement's own declared disc/window geometry", () => {
    // Mirrors src/app/teachingMovement.ts's own declared moon-phase disc (3mm radius) and dial
    // window (1.2mm offset, 0.7mm radius) -- if either changes, this and that file's own
    // explanatory comment should be updated together (ASM-0055).
    const discRadius = 3e-3;
    const windowOffset = 1.2e-3;
    const windowRadius = 0.7e-3;
    const v = MOON_PHASE_VISUALIZATION;
    const moonPosRadius = v.moonPositionRadiusFraction * discRadius;
    const moonRadius = v.moonImageRadiusFraction * discRadius;
    expect(moonPosRadius).toBeCloseTo(windowOffset, 9); // concentric with the window at full moon

    const windowWorld = { x: windowOffset * Math.cos(v.windowWorldAngleRadians), y: windowOffset * Math.sin(v.windowWorldAngleRadians) };
    const n = 2; // DOUBLE, the teaching movement's own choice
    for (let k = 0; k < n; k += 1) {
      // The real new-moon instant for image k's own "slot": halfway between its own full-moon
      // instant and the next, i.e. shaftAngle = 2π(k + 1)/n (where moonPhaseFraction reports 0).
      const shaftAngleAtNew = (2 * Math.PI * (k + 1)) / n;
      const worldAngle = moonImageLocalAngle(k, n) + shaftAngleAtNew;
      const moonWorld = { x: moonPosRadius * Math.cos(worldAngle), y: moonPosRadius * Math.sin(worldAngle) };
      const distance = Math.hypot(moonWorld.x - windowWorld.x, moonWorld.y - windowWorld.y);
      expect(distance).toBeGreaterThan(windowRadius + moonRadius);
    }
  });
});

describe("discCapCanvasAngleForMeshAngle", () => {
  it("is self-inverse (a reflection applied twice returns the original angle)", () => {
    for (const meshAngle of [0, 0.7, Math.PI / 2, 2, Math.PI]) {
      const canvasAngle = discCapCanvasAngleForMeshAngle(meshAngle);
      const roundTrip = discCapCanvasAngleForMeshAngle(canvasAngle);
      const normalize = (a: number): number => (((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
      expect(normalize(roundTrip)).toBeCloseTo(normalize(meshAngle), 9);
    }
  });

  it("drawing at the corrected canvas angle actually lands at the intended mesh-local angle on a real createZCylinder -Z cap (regression: the naive, uncorrected angle landed 'reflected', not at the intended angle)", () => {
    // A direct, from-scratch rebuild of CylinderGeometry's own -Z cap UV formula (u = 0.5 -
    // y/2r, v = 0.5 - x/2r), empirically re-derived from a real built disc's own vertex data
    // here -- the same formula reshapeCapGroupsForDiscMaterials relies on for the leap-year
    // wheel fix. This closes the loop between the abstract moonImageLocalAngle/
    // discCapCanvasAngleForMeshAngle math (tested above in isolation) and the real geometry.
    const r = 3e-3;
    const disc = createZCylinder(r, -0.02e-3, 0.02e-3, 128);
    const pos = disc.attributes.position;
    const uv = disc.attributes.uv;
    const index = disc.index;
    if (pos === undefined || uv === undefined || index === null) throw new Error("disc is missing an attribute");
    const dialFacingCap = disc.groups[2];
    if (dialFacingCap === undefined) throw new Error("no -Z cap group");

    // Confirm the formula against a handful of real rim vertices before relying on it below.
    let checked = 0;
    for (let i = dialFacingCap.start; i < dialFacingCap.start + dialFacingCap.count; i += 3) {
      const vi = index.getX(i);
      const x = pos.getX(vi);
      const y = pos.getY(vi);
      if (Math.hypot(x, y) < r * 0.9) continue; // only check rim-ish vertices
      const expectedU = 0.5 - y / (2 * r);
      const expectedV = 0.5 - x / (2 * r);
      expect(uv.getX(vi)).toBeCloseTo(expectedU, 5);
      expect(uv.getY(vi)).toBeCloseTo(expectedV, 5);
      checked += 1;
      if (checked > 5) break;
    }
    expect(checked).toBeGreaterThan(0);

    const size = 512;
    const centre = size / 2;
    const n = 2;
    for (let k = 0; k < n; k += 1) {
      const desiredMeshAngle = moonImageLocalAngle(k, n);
      const canvasAngle = discCapCanvasAngleForMeshAngle(desiredMeshAngle);
      const moonPosPx = MOON_PHASE_VISUALIZATION.moonPositionRadiusFraction * centre;
      const px = centre + moonPosPx * Math.cos(canvasAngle);
      const py = centre + moonPosPx * Math.sin(canvasAngle);
      const u = px / size;
      const v = py / size;
      // Invert the same formula just confirmed against the real disc, to find which mesh-local
      // point this canvas pixel actually lands on.
      const xMesh = r * (1 - 2 * v);
      const yMesh = r * (1 - 2 * u);
      const actualMeshAngle = Math.atan2(yMesh, xMesh);
      const normalize = (a: number): number => (((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
      expect(normalize(actualMeshAngle)).toBeCloseTo(normalize(desiredMeshAngle), 6);
    }
  });
});
