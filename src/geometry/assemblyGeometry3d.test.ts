import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { metres } from "@/units/length";
import { radians } from "@/units/angle";
import { moonPhaseFraction } from "@/kinematics/moonPhase";
import type { Point2D } from "./gearOutline";
import {
  balanceArmHalfExtents,
  balanceRimInnerRadius,
  createDiscWithHolesGeometry,
  createFrameGeometry,
  createDialWindowPointerOutline,
  createGenevaWheelGeometry,
  createRodGeometry,
  createXAxisCylinder,
  createZCylinder,
  cylinderXAxisCanvasUForLocalAngle,
  discCapCanvasAngleForMeshAngle,
  discLabelFittedFontSizePx,
  DISC_LABEL_CURRENT_AT_NORTH_OFFSET_RADIANS,
  DISC_LABEL_RING_DIRECTION,
  DIAL_VISUALIZATION,
  createDialWindowBezelGeometry,
  dialMarkerPlacements,
  secondsNumeralPlacements,
  createFlutedCylinderGeometry,
  createJewelGeometry,
  JEWEL_VISUALIZATION,
  createMoonPhaseMarkGeometry,
  dialWindowPointerSize,
  DIAL_WINDOW_POINTER_VISUALIZATION,
  createSpokedWheelGeometry,
  SPOKED_WHEEL_VISUALIZATION,
  spokedWheelOpenings,
  dialWindowCaptionOffset,
  discLabelPlacements,
  discLabelSlotArcLengthPx,
  DIAL_WINDOW_VISUALIZATION,
  escapeWheelHubRadius,
  generateEscapeWheelOutline,
  generateHandOutline,
  HAND_ARROWHEAD_VISUALIZATION,
  generatePalletStoneOutline,
  GENEVA_WHEEL_VISUALIZATION,
  handHubRadius,
  moonImageLocalAngle,
  MOON_PHASE_VISUALIZATION,
  rayCircleInward,
  moonPhaseIconPlacements,
  moonPhaseLitPolygon,
  moonPhaseMarks,
  seasonWedgeBoundaryAngles,
  yearDigitAxleProjection,
  yearDigitBarrelAlongBounds,
  yearDigitBarrelDividerPositions,
  yearDigitBarrelRestAngle,
  YEAR_DIGIT_BARREL_VISUALIZATION,
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
  it("the seconds hand keeps its plain 4-point taper, narrow at the tail and widening toward the tip", () => {
    const outline = generateHandOutline("SECONDS");
    expect(outline).toHaveLength(4);
    const tailWidth = Math.abs((outline[0]?.x ?? 0) - (outline[1]?.x ?? 0));
    const tipWidth = Math.abs((outline[2]?.x ?? 0) - (outline[3]?.x ?? 0));
    expect(tailWidth).toBeGreaterThan(0);
    expect(tipWidth).toBeGreaterThan(0);
    for (const point of outline) {
      expect(point.y).toBeGreaterThanOrEqual(-3e-3);
      expect(point.y).toBeLessThanOrEqual(3e-3);
    }
  });

  it("each hand kind has its own width and length", () => {
    const tipY = (outline: ReturnType<typeof generateHandOutline>): number => Math.max(...outline.map((p) => p.y));
    expect(tipY(generateHandOutline("HOURS"))).toBeCloseTo(5e-3, 12);
    expect(tipY(generateHandOutline("MINUTES"))).toBeCloseTo(8e-3, 12);
    expect(tipY(generateHandOutline("SECONDS"))).toBeCloseTo(3e-3, 12);
  });

  it("the hour and minute hands end in an arrowhead (ASM-0076): a pointed tip at the hand's own length, barbs overhanging the shaft", () => {
    for (const [hand, length, width] of [["HOURS", 5e-3, 0.6e-3], ["MINUTES", 8e-3, 0.4e-3]] as const) {
      const outline = generateHandOutline(hand);
      expect(outline).toHaveLength(7);
      const tip = outline[4];
      expect(tip?.x).toBe(0);
      expect(tip?.y).toBeCloseTo(length, 12);
      const barbRight = outline[3];
      const barbLeft = outline[5];
      const shaftRight = outline[2];
      // Barbs mirror each other and sit wider than the shaft where it meets the head.
      expect(barbRight?.x).toBeCloseTo(-(barbLeft?.x ?? 0), 12);
      expect(barbRight?.y).toBeCloseTo(barbLeft?.y ?? 0, 12);
      expect(barbRight?.x ?? 0).toBeGreaterThan(shaftRight?.x ?? 0);
      expect(barbRight?.x ?? 0).toBeGreaterThan(width / 2);
      // The head is longer than it is wide-ish and the barbs sit below the tip.
      expect(barbRight?.y ?? length).toBeLessThan(length);
      expect(length - (barbRight?.y ?? 0)).toBeCloseTo(width * HAND_ARROWHEAD_VISUALIZATION.headLengthInWidths, 12);
    }
  });

  it("the arrowhead hands' outline is a simple polygon (no self-intersection) so it extrudes cleanly", () => {
    const segmentsCross = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }): boolean => {
      const o = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
      return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
    };
    for (const hand of ["HOURS", "MINUTES"] as const) {
      const pts = generateHandOutline(hand);
      for (let i = 0; i < pts.length; i += 1) {
        for (let j = i + 2; j < pts.length; j += 1) {
          if (i === 0 && j === pts.length - 1) continue; // adjacent via wrap-around
          const a = pts[i]; const b = pts[(i + 1) % pts.length]; const c = pts[j]; const d = pts[(j + 1) % pts.length];
          if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
          expect(segmentsCross(a, b, c, d)).toBe(false);
        }
      }
    }
  });
});

describe("createDialWindowPointerOutline (ASM-0069, DialWindow.pointer)", () => {
  it("is an upside-down (apex-down) triangle: a single point at the local origin, a flat base above it", () => {
    const outline = createDialWindowPointerOutline(0.6e-3, 0.5e-3);
    expect(outline).toHaveLength(3);
    const [apex, baseLeft, baseRight] = outline;
    expect(apex?.x).toBe(0);
    expect(apex?.y).toBe(0);
    expect(baseLeft?.y).toBeGreaterThan(0);
    expect(baseRight?.y).toBeGreaterThan(0);
    expect(baseLeft?.y).toBe(baseRight?.y);
    expect(baseLeft?.x).toBeLessThan(0);
    expect(baseRight?.x).toBeGreaterThan(0);
  });

  it("the base spans exactly the declared width, centred on the apex's own x", () => {
    const outline = createDialWindowPointerOutline(0.8e-3, 0.3e-3);
    const [, baseLeft, baseRight] = outline;
    expect((baseRight?.x ?? 0) - (baseLeft?.x ?? 0)).toBeCloseTo(0.8e-3, 12);
    expect((baseLeft?.x ?? 0) + (baseRight?.x ?? 0)).toBeCloseTo(0, 12);
  });

  it("the apex-to-base height matches the declared height exactly", () => {
    const outline = createDialWindowPointerOutline(0.5e-3, 0.42e-3);
    expect(outline[1]?.y).toBeCloseTo(0.42e-3, 12);
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

describe("createFrameGeometry", () => {
  it("produces a plain solid slab when no holes are given (the default)", () => {
    const geometry = createFrameGeometry({ kind: "CIRCLE", centre: { x: metres(0), y: metres(0) }, radius: metres(5e-3) }, 1e-3);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    expect(box?.max.x).toBeCloseTo(5e-3, 6);
    expect(box?.min.z).toBeCloseTo(0, 9);
    expect(box?.max.z).toBeCloseTo(1e-3, 9);
  });

  it("punches a hole in the same (x, y) coordinates as the outline itself — not relative to a local origin (ASM-0056)", () => {
    const geometry = createFrameGeometry(
      { kind: "CIRCLE", centre: { x: metres(2.5e-3), y: metres(0) }, radius: metres(15e-3) },
      1e-3,
      [{ x: 10e-3, y: 0, radius: 1e-3 }],
    );
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    // The outer bounding box stays the full outline's — the hole sits well inside it.
    expect(box?.max.x).toBeCloseTo(17.5e-3, 6);
    expect(box?.min.x).toBeCloseTo(-12.5e-3, 6);
  });

  it("skips a hole with a non-finite or non-positive radius rather than throwing", () => {
    expect(() =>
      createFrameGeometry({ kind: "CIRCLE", centre: { x: metres(0), y: metres(0) }, radius: metres(5e-3) }, 1e-3, [
        { x: 0, y: 0, radius: Number.NaN },
        { x: 0, y: 0, radius: 0 },
        { x: Number.NaN, y: 0, radius: 1e-3 },
      ]),
    ).not.toThrow();
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
      const angle = DISC_LABEL_RING_DIRECTION * (i / 4) * Math.PI * 2;
      expect(placement.rotation).toBeCloseTo(angle + Math.PI / 2, 9);
    }
    // Evenly spaced: the first and third labels sit on opposite sides of the centre.
    expect(placements[0]?.x).toBeCloseTo(2 * centre - (placements[2]?.x ?? 0), 6);
    expect(placements[0]?.y).toBeCloseTo(2 * centre - (placements[2]?.y ?? 0), 6);
  });

  it("lays the ring out counter-clockwise in canvas angle (label 1 one slot BEFORE label 0), so the next label arrives at the window as the disc advances (ASM-0071)", () => {
    expect(DISC_LABEL_RING_DIRECTION).toBe(-1);
    const placements = discLabelPlacements(["a", "b", "c", "d"]);
    const centre = 512 / 2;
    const angleOf = (i: number): number => Math.atan2((placements[i]?.y ?? 0) - centre, (placements[i]?.x ?? 0) - centre);
    expect(angleOf(1)).toBeCloseTo(-Math.PI / 2, 9);
    expect(Math.cos(angleOf(2))).toBeCloseTo(-1, 9);
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

  it("canvasAngleOffset rotates the whole ring by that amount, default 0 leaving existing callers (date/month) unchanged", () => {
    const base = discLabelPlacements(["Jan", "Feb", "Mar", "Apr"]);
    const baseDefault = discLabelPlacements(["Jan", "Feb", "Mar", "Apr"], 0);
    expect(baseDefault).toEqual(base);

    const offset = 0.9;
    const rotated = discLabelPlacements(["Jan", "Feb", "Mar", "Apr"], offset);
    const centre = 512 / 2;
    for (const [i, placement] of rotated.entries()) {
      const angle = DISC_LABEL_RING_DIRECTION * (i / 4) * Math.PI * 2 + offset;
      expect(placement.x).toBeCloseTo(centre + centre * 0.72 * Math.cos(angle), 6);
      expect(placement.y).toBeCloseTo(centre + centre * 0.72 * Math.sin(angle), 6);
      expect(placement.rotation).toBeCloseTo(angle + Math.PI / 2, 9);
    }
  });
});

describe("discLabelSlotArcLengthPx", () => {
  it("is the ring's own circumference divided by the label count", () => {
    const labelRadius = (DIAL_WINDOW_VISUALIZATION.textureSizePx / 2) * DIAL_WINDOW_VISUALIZATION.labelRadiusFraction;
    expect(discLabelSlotArcLengthPx(4)).toBeCloseTo((2 * Math.PI * labelRadius) / 4, 9);
    expect(discLabelSlotArcLengthPx(31)).toBeCloseTo((2 * Math.PI * labelRadius) / 31, 9);
  });

  it("is inversely proportional to label count (double the labels, half the slot)", () => {
    expect(discLabelSlotArcLengthPx(24)).toBeCloseTo(discLabelSlotArcLengthPx(12) / 2, 9);
  });
});

describe("discLabelFittedFontSizePx (ASM-0051, real bug — date/month labels reported live as clumped together)", () => {
  it("clamps to the unscaled base font when the glyph already fits with the declared fill fraction (leap-year/season: 4 wide slots)", () => {
    // Measured directly against the real rendered canvas (ctx.measureText, bold 105px
    // sans-serif): the widest leap-year/season label ("WI") is 57-144px wide, well under
    // 0.75 × a 4-label slot (≈289.5px) — these two rings were never actually broken.
    expect(discLabelFittedFontSizePx(144, 4)).toBe(DIAL_WINDOW_VISUALIZATION.fontSizePx);
  });

  it("scales the font down to fit a real dense ring without reaching the next label (date: 31 positions, up to 2 digits)", () => {
    // Measured directly against the real rendered canvas: the widest date label ("24") is
    // 113.4px wide at the 105px base font, against a 37.4px slot — a real ≈3x overflow
    // (clumped digits), confirmed live before this fix.
    const slotArc = discLabelSlotArcLengthPx(31);
    const fitted = discLabelFittedFontSizePx(113.4, 31);
    expect(fitted).toBeLessThan(DIAL_WINDOW_VISUALIZATION.fontSizePx);
    // The glyph scales down by exactly the same factor as the font size (both linear in
    // font size), so it must now fit within the declared fill fraction of its own slot.
    const scaledGlyphWidth = 113.4 * (fitted / DIAL_WINDOW_VISUALIZATION.fontSizePx);
    expect(scaledGlyphWidth).toBeLessThanOrEqual(slotArc * DIAL_WINDOW_VISUALIZATION.labelFillFraction + 1e-9);
  });

  it("scales the font down for month's own real 12-position, 3-letter ring", () => {
    // Measured directly against the real rendered canvas: the widest month abbreviation
    // ("May") is 196.9px wide at the 105px base font, against a 96.5px slot — a real ≈2x
    // overflow, confirmed live before this fix.
    const slotArc = discLabelSlotArcLengthPx(12);
    const fitted = discLabelFittedFontSizePx(196.9, 12);
    expect(fitted).toBeLessThan(DIAL_WINDOW_VISUALIZATION.fontSizePx);
    const scaledGlyphWidth = 196.9 * (fitted / DIAL_WINDOW_VISUALIZATION.fontSizePx);
    expect(scaledGlyphWidth).toBeLessThanOrEqual(slotArc * DIAL_WINDOW_VISUALIZATION.labelFillFraction + 1e-9);
  });

  it("never scales up (a short label never gets a larger-than-base font)", () => {
    expect(discLabelFittedFontSizePx(1, 4)).toBe(DIAL_WINDOW_VISUALIZATION.fontSizePx);
  });

  it("never returns below the declared floor even for a pathologically dense ring", () => {
    expect(discLabelFittedFontSizePx(1000, 500)).toBeGreaterThanOrEqual(DIAL_WINDOW_VISUALIZATION.minFontSizePx);
  });

  it("falls back to the base font for degenerate inputs (no measured width, or no labels)", () => {
    expect(discLabelFittedFontSizePx(0, 31)).toBe(DIAL_WINDOW_VISUALIZATION.fontSizePx);
    expect(discLabelFittedFontSizePx(113.4, 0)).toBe(DIAL_WINDOW_VISUALIZATION.fontSizePx);
  });
});

describe("seasonWedgeBoundaryAngles (ASM-0058)", () => {
  it("returns one boundary per wedge, each offset half a wedge's own width from the first label's own angle (0)", () => {
    const boundaries = seasonWedgeBoundaryAngles(4);
    expect(boundaries).toHaveLength(4);
    const step = (Math.PI * 2) / 4;
    for (const [i, boundary] of boundaries.entries()) {
      expect(boundary).toBeCloseTo(i * step + step / 2, 9);
    }
  });

  it("the boundary just after label 0's own angle (0) sits exactly between label 0 and label 1", () => {
    const [firstBoundary] = seasonWedgeBoundaryAngles(4);
    const labelAngle0 = 0;
    const labelAngle1 = (1 / 4) * Math.PI * 2;
    expect(firstBoundary).toBeCloseTo((labelAngle0 + labelAngle1) / 2, 9);
  });

  it("evenly spaced: consecutive boundaries are exactly 2π/count apart", () => {
    const boundaries = seasonWedgeBoundaryAngles(4);
    const step = (Math.PI * 2) / 4;
    for (let i = 1; i < boundaries.length; i += 1) {
      expect((boundaries[i] ?? 0) - (boundaries[i - 1] ?? 0)).toBeCloseTo(step, 9);
    }
  });
});

describe("leap-year label/slot alignment (regression)", () => {
  // Reported live: "no text showing on leap year gear". Root cause, found by direct live-browser
  // inspection (not just algebra): discLabelPlacements' own default label ring (phase 0, i.e.
  // canvas angle (i/n)*2*PI) and createGenevaWheelGeometry's own rim slots (phase baseAngle, i.e.
  // mesh angle baseAngle + k*spacing) are BOTH 4-fold symmetric and the −Z-cap UV reflection
  // (discCapCanvasAngleForMeshAngle) maps a 4-fold-symmetric angle set onto itself -- so whenever
  // baseAngle is itself a multiple of the slot spacing (as it happened to be, to within the
  // slot's own half-width, in the teaching movement's actual geometry), every label lands exactly
  // on a slot's own cutout: there is no geometry there for the label's own UV position to land on,
  // so it is invisible regardless of the texture's own content. viewport.ts now offsets the label
  // ring by half a slot's own spacing (converted through discCapCanvasAngleForMeshAngle) so every
  // label is centred between two slots instead. This directly builds the real geometry (not just
  // the abstract angle math) to confirm both halves: the bug reproduces at the default phase, and
  // the fix's own offset formula avoids it, for a representative range of baseAngle values.
  function maxRadiusNearAngle(geometry: THREE.BufferGeometry, targetAngle: number, toleranceRadians: number): number {
    const position = geometry.attributes.position;
    if (position === undefined) throw new Error("geometry has no position attribute");
    let maxRadius = 0;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const angle = Math.atan2(y, x);
      const delta = Math.abs(Math.atan2(Math.sin(angle - targetAngle), Math.cos(angle - targetAngle)));
      if (delta > toleranceRadians) continue;
      maxRadius = Math.max(maxRadius, Math.hypot(x, y));
    }
    return maxRadius;
  }

  it("reproduces the bug at the label ring's own default phase: when baseAngle is a slot-spacing multiple, every label's own mesh angle lands in a slot cutout (no material out to the label radius)", () => {
    const tipRadius = 1.5e-3;
    const slotCount = 4;
    const thickness = 0.15e-3;
    const labelRadiusFraction = 0.72;
    const spacing = (2 * Math.PI) / slotCount;
    for (const baseAngle of [0, spacing, 2 * spacing]) {
      const geometry = createGenevaWheelGeometry(tipRadius, thickness, slotCount, baseAngle);
      const placements = discLabelPlacements(["1", "2", "3", "4"]); // default phase, no offset
      const centre = 512 / 2;
      for (const placement of placements) {
        const canvasAngle = Math.atan2(placement.y - centre, placement.x - centre);
        const meshAngle = discCapCanvasAngleForMeshAngle(canvasAngle);
        const available = maxRadiusNearAngle(geometry, meshAngle, 1e-6);
        // The slot cuts all the way to slotInnerRadiusFraction at its own exact centre angle.
        expect(available).toBeLessThanOrEqual(tipRadius * GENEVA_WHEEL_VISUALIZATION.slotInnerRadiusFraction + 1e-9);
        expect(available).toBeLessThan(tipRadius * labelRadiusFraction);
      }
    }
  });

  it("the fix's own offset (half a slot's own spacing, via discCapCanvasAngleForMeshAngle) centres every label between two slots, on full-tip-radius material, for a range of baseAngle values", () => {
    const tipRadius = 1.5e-3;
    const slotCount = 4;
    const thickness = 0.15e-3;
    const labelRadiusFraction = 0.72;
    const spacing = (2 * Math.PI) / slotCount;
    for (const baseAngle of [0, 0.4, Math.PI / 2, 2, spacing, 2 * spacing]) {
      const geometry = createGenevaWheelGeometry(tipRadius, thickness, slotCount, baseAngle);
      const labelCanvasAngleOffset = discCapCanvasAngleForMeshAngle(baseAngle + spacing / 2);
      const placements = discLabelPlacements(["1", "2", "3", "4"], labelCanvasAngleOffset);
      const centre = 512 / 2;
      for (const placement of placements) {
        const canvasAngle = Math.atan2(placement.y - centre, placement.x - centre);
        const meshAngle = discCapCanvasAngleForMeshAngle(canvasAngle);
        const available = maxRadiusNearAngle(geometry, meshAngle, 1e-6);
        // Midway between two slots the rim sits at the full, uncut tip radius.
        expect(available).toBeCloseTo(tipRadius, 6);
        expect(available).toBeGreaterThan(tipRadius * labelRadiusFraction);
      }
    }
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

const normalizeAngle = (a: number): number => (((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));

describe("createXAxisCylinder (ASM-0019, ASM-0064)", () => {
  it("builds a cylinder whose own axis runs along local X, verified against real built vertex data", () => {
    // The horizontal-axis counterpart to createZCylinder: every side vertex must sit at radius r
    // in the Y/Z plane, with X spanning the declared length -- confirming geometry.rotateZ(π/2)
    // actually moved the axis from local Y onto local X, not just that the call didn't throw.
    const r = 1e-3;
    const length = 2e-3;
    const cyl = createXAxisCylinder(r, length, 32);
    const pos = cyl.attributes.position;
    if (pos === undefined) throw new Error("cylinder is missing a position attribute");
    let checked = 0;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const radial = Math.hypot(y, z);
      if (radial < r * 0.99) continue; // skip cap-centre vertices, on the axis itself
      expect(radial).toBeCloseTo(r, 9);
      expect(Math.abs(x)).toBeLessThanOrEqual(length / 2 + 1e-9);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("yearDigitBarrelRestAngle (ASM-0064)", () => {
  // createYearDigitBarrelTexture itself touches `document` (a Canvas2D context), the same already-
  // accepted gap every other texture generator here has (moonImageLocalAngle's own describe block
  // above); yearDigitBarrelRestAngle and cylinderXAxisCanvasUForLocalAngle are pure, so tested directly.

  it("every digit's own local angle, after applying the segment's own rotation.x for that digit, lands on the dial-facing angle", () => {
    // This is the whole point of the formula: whichever digit the segment is currently showing
    // (rotation.x = digit * stepAngle, src/simulation/simulationState.ts's yearDigitAngle), that
    // digit's own painted position must be the one facing the dial -- not just the segment's own
    // starting digit.
    const digitCount = 10;
    const step = (2 * Math.PI) / digitCount;
    for (let digit = 0; digit < digitCount; digit += 1) {
      const liveAngle = yearDigitBarrelRestAngle(digit, digitCount) + digit * step;
      expect(normalizeAngle(liveAngle)).toBeCloseTo(normalizeAngle(YEAR_DIGIT_BARREL_VISUALIZATION.dialFacingLocalAngleRadians), 9);
    }
  });

  it("runs the digits around the barrel in the opposite sense to increasing rotation.x (a real drum counter's own printed order)", () => {
    const digitCount = 10;
    const a0 = normalizeAngle(yearDigitBarrelRestAngle(0, digitCount));
    const a1 = normalizeAngle(yearDigitBarrelRestAngle(1, digitCount));
    const step = (2 * Math.PI) / digitCount;
    // Going from digit 0 to digit 1, the local angle decreases by one step (mod 2π) -- the digits
    // are NOT laid out in the same rotational sense the barrel itself advances in.
    expect(normalizeAngle(a0 - a1)).toBeCloseTo(step, 9);
  });
});

describe("cylinderXAxisCanvasUForLocalAngle (ASM-0064)", () => {
  it("is the real inverse of createXAxisCylinder's own lateral-surface UV mapping, verified against a real built cylinder's own vertex data", () => {
    // A from-scratch rebuild of CylinderGeometry's own pre-rotation side vertex/UV convention
    // (generateTorso: u = x/radialSegments, theta = u*2π, vertex = (r sinθ, height axis, r cosθ),
    // uv = (u, 1-v)), tracked through rotateZ(π/2) (x' = -(height-axis), y' = r sinθ, z' = r cosθ,
    // the axis moving from local Y to local X) and empirically confirmed here against the real
    // post-rotation geometry this project actually builds -- the same evidentiary standard
    // discCapCanvasAngleForMeshAngle's own regression test already holds itself to.
    const r = 1e-3;
    const cyl = createXAxisCylinder(r, 1e-3, 64);
    const pos = cyl.attributes.position;
    const uv = cyl.attributes.uv;
    const index = cyl.index;
    if (pos === undefined || uv === undefined || index === null) throw new Error("cylinder is missing an attribute");
    const sideGroup = cyl.groups[0];
    if (sideGroup === undefined) throw new Error("no side group");

    let checked = 0;
    for (let i = sideGroup.start; i < sideGroup.start + sideGroup.count; i += 1) {
      const vi = index.getX(i);
      const y = pos.getY(vi);
      const z = pos.getZ(vi);
      if (Math.hypot(y, z) < r * 0.99) continue; // only rim vertices, skip the axis if any
      const u = uv.getX(vi);
      const actualLocalAngle = Math.atan2(z, y);
      const predictedU = cylinderXAxisCanvasUForLocalAngle(actualLocalAngle);
      // u and predictedU should agree modulo 1 (the seam makes u=0 and u=1 the same point).
      const diff = Math.abs(u - predictedU);
      expect(Math.min(diff, Math.abs(diff - 1))).toBeLessThan(1e-4);
      checked += 1;
      if (checked > 20) break;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("round-trips through yearDigitBarrelRestAngle: the canvas u this function gives for digit d's own local angle, fed back through the same θ = π/2 − a convention, reproduces that local angle", () => {
    const digitCount = 10;
    for (let digit = 0; digit < digitCount; digit += 1) {
      const localAngle = yearDigitBarrelRestAngle(digit, digitCount);
      const u = cylinderXAxisCanvasUForLocalAngle(localAngle);
      const theta = u * 2 * Math.PI;
      const recoveredLocalAngle = Math.PI / 2 - theta;
      expect(normalizeAngle(recoveredLocalAngle)).toBeCloseTo(normalizeAngle(localAngle), 9);
    }
  });
});

describe("yearDigitAxleProjection (ASM-0066)", () => {
  it("projects onto world +X when direction is 0", () => {
    expect(yearDigitAxleProjection({ x: 3e-3, y: 7e-3 }, 0)).toBeCloseTo(3e-3, 12);
  });

  it("projects onto world +Y when direction is π/2", () => {
    expect(yearDigitAxleProjection({ x: 3e-3, y: 7e-3 }, Math.PI / 2)).toBeCloseTo(7e-3, 12);
  });

  it("matches the plain dot product with the direction's own unit vector for an arbitrary angle", () => {
    const direction = (37 * Math.PI) / 180;
    const point = { x: -2e-3, y: 5e-3 };
    const expected = point.x * Math.cos(direction) + point.y * Math.sin(direction);
    expect(yearDigitAxleProjection(point, direction)).toBeCloseTo(expected, 12);
  });
});

describe("yearDigitBarrelAlongBounds (ASM-0066)", () => {
  it("returns null for an empty segment group (nothing to enclose)", () => {
    expect(yearDigitBarrelAlongBounds([], 0.3e-3)).toBeNull();
  });

  it("is the span of every segment's own length, expanded by the margin on each end", () => {
    const segments = [
      { along: -4.2e-3, length: 0.8e-3 },
      { along: -3.4e-3, length: 0.8e-3 },
      { along: -2.6e-3, length: 0.8e-3 },
      { along: -1.8e-3, length: 0.8e-3 },
    ];
    const margin = 0.3e-3;
    const bounds = yearDigitBarrelAlongBounds(segments, margin);
    expect(bounds).not.toBeNull();
    expect(bounds?.min).toBeCloseTo(-4.2e-3 - 0.4e-3 - margin, 12);
    expect(bounds?.max).toBeCloseTo(-1.8e-3 + 0.4e-3 + margin, 12);
  });

  it("handles a single segment (a one-digit-place design)", () => {
    const bounds = yearDigitBarrelAlongBounds([{ along: 2e-3, length: 1e-3 }], 0.2e-3);
    expect(bounds).toEqual({ min: 2e-3 - 0.5e-3 - 0.2e-3, max: 2e-3 + 0.5e-3 + 0.2e-3 });
  });

  it("does not depend on the segments' own order in the input array", () => {
    const segments = [
      { along: 1e-3, length: 0.4e-3 },
      { along: -2e-3, length: 0.6e-3 },
      { along: 0, length: 0.3e-3 },
    ];
    const forward = yearDigitBarrelAlongBounds(segments, 0.1e-3);
    const reversed = yearDigitBarrelAlongBounds([...segments].reverse(), 0.1e-3);
    expect(reversed).toEqual(forward);
  });
});

describe("yearDigitBarrelDividerPositions (ASM-0066)", () => {
  it("places one fewer divider than there are segments, at each pair's own midpoint", () => {
    const segments = [
      { along: -4.2e-3 },
      { along: -3.4e-3 },
      { along: -2.6e-3 },
      { along: -1.8e-3 },
    ];
    const dividers = yearDigitBarrelDividerPositions(segments);
    expect(dividers).toHaveLength(3);
    expect(dividers[0]).toBeCloseTo(-3.8e-3, 12);
    expect(dividers[1]).toBeCloseTo(-3e-3, 12);
    expect(dividers[2]).toBeCloseTo(-2.2e-3, 12);
  });

  it("sorts by along-axle position first, so the input order does not matter", () => {
    const segments = [
      { along: -1.8e-3 },
      { along: -4.2e-3 },
      { along: -2.6e-3 },
      { along: -3.4e-3 },
    ];
    const dividers = yearDigitBarrelDividerPositions(segments);
    expect(dividers).toHaveLength(3);
    [-3.8e-3, -3e-3, -2.2e-3].forEach((expected, i) => { expect(dividers[i]).toBeCloseTo(expected, 12); });
  });

  it("returns no dividers for zero or one segment", () => {
    expect(yearDigitBarrelDividerPositions([])).toEqual([]);
    expect(yearDigitBarrelDividerPositions([{ along: 0 }])).toEqual([]);
  });
});

describe("moonPhaseMarks (ASM-0072)", () => {
  const angleOf = (n: number, kind: string): number[] =>
    moonPhaseMarks(n).filter((m) => m.kind === kind).map((m) => m.worldAngle).sort((a, b) => a - b);

  it("for the usual two-image disc puts full at north and south, new at east and west and the quarters on the diagonals", () => {
    const near = (actual: number[], expected: number[]): void => {
      expect(actual).toHaveLength(expected.length);
      expected.forEach((e, i) => { expect(actual[i]).toBeCloseTo(e, 9); });
    };
    near(angleOf(2, "FULL"), [Math.PI / 2, (3 * Math.PI) / 2]);
    near(angleOf(2, "NEW"), [0, Math.PI]);
    near(angleOf(2, "FIRST_QUARTER"), [Math.PI / 4, (5 * Math.PI) / 4]);
    near(angleOf(2, "LAST_QUARTER"), [(3 * Math.PI) / 4, (7 * Math.PI) / 4]);
  });

  it("for a single-image disc puts full at north and new at south", () => {
    expect(angleOf(1, "FULL")[0]).toBeCloseTo(Math.PI / 2, 9);
    expect(angleOf(1, "NEW")[0]).toBeCloseTo((3 * Math.PI) / 2, 9);
    expect(moonPhaseMarks(1)).toHaveLength(4);
  });

  it("agrees with the real kinematics: an image sits on a mark of each phase exactly when moonPhaseFraction reads that phase", () => {
    for (const n of [1, 2]) {
      for (const [kind, fraction] of [["NEW", 0], ["FIRST_QUARTER", 0.25], ["FULL", 0.5], ["LAST_QUARTER", 0.75]] as const) {
        // Disc angle whose phase fraction is `fraction` (moonPhaseFraction: (turns × n) mod 1).
        const shaftAngle = (2 * Math.PI * fraction) / n;
        expect(moonPhaseFraction(radians(shaftAngle), n)).toBeCloseTo(fraction, 9);
        for (let k = 0; k < n; k += 1) {
          const world = ((moonImageLocalAngle(k, n) + shaftAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          expect(angleOf(n, kind).some((a) => Math.abs(Math.atan2(Math.sin(a - world), Math.cos(a - world))) < 1e-9)).toBe(true);
        }
      }
    }
    expect(MOON_PHASE_VISUALIZATION.windowWorldAngleRadians).toBeCloseTo(Math.PI / 2, 12);
  });

  it("returns no marks for an invalid image count", () => {
    expect(moonPhaseMarks(0)).toEqual([]);
    expect(moonPhaseMarks(1.5)).toEqual([]);
    expect(moonPhaseMarks(-2)).toEqual([]);
  });
});

describe("createMoonPhaseMarkGeometry (ASM-0072)", () => {
  const radius = 1e-3;
  const bounds = (kind: Parameters<typeof createMoonPhaseMarkGeometry>[0], litSide: 1 | -1): THREE.Box3 => {
    const g = createMoonPhaseMarkGeometry(kind, radius, 1e-4, litSide);
    g.computeBoundingBox();
    return g.boundingBox ?? new THREE.Box3();
  };

  it("every icon spans the icon radius, centred on the origin, with the requested thickness", () => {
    for (const kind of ["NEW", "FIRST_QUARTER", "FULL", "LAST_QUARTER"] as const) {
      const box = bounds(kind, 1);
      expect(box.max.x).toBeCloseTo(radius, 6);
      expect(box.min.x).toBeCloseTo(-radius, 6);
      expect(box.max.z - box.min.z).toBeCloseTo(1e-4, 9);
    }
  });

  it("a quarter icon carries more material than a new-moon ring and less than the full disc, weighted toward the lit side", () => {
    // Area and area-weighted x-centroid of the extrusion's own top face (z at its max).
    const top = (kind: Parameters<typeof createMoonPhaseMarkGeometry>[0], litSide: 1 | -1): { area: number; cx: number } => {
      const g = createMoonPhaseMarkGeometry(kind, radius, 1e-4, litSide);
      const pos = g.attributes.position;
      const index = g.index;
      if (pos === undefined) throw new Error("no positions");
      let area = 0;
      let moment = 0;
      const tri = (a: number, b: number, c: number): void => {
        const za = pos.getZ(a); const zb = pos.getZ(b); const zc = pos.getZ(c);
        if (!(Math.abs(za - zb) < 1e-12 && Math.abs(zb - zc) < 1e-12 && za > 5e-5)) return;
        const t = Math.abs((pos.getX(b) - pos.getX(a)) * (pos.getY(c) - pos.getY(a)) - (pos.getX(c) - pos.getX(a)) * (pos.getY(b) - pos.getY(a))) / 2;
        area += t;
        moment += (t * (pos.getX(a) + pos.getX(b) + pos.getX(c))) / 3;
      };
      if (index === null) for (let i = 0; i < pos.count; i += 3) tri(i, i + 1, i + 2);
      else for (let i = 0; i < index.count; i += 3) tri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
      return { area, cx: area > 0 ? moment / area : 0 };
    };
    expect(top("FIRST_QUARTER", 1).area).toBeGreaterThan(top("NEW", 1).area);
    expect(top("FULL", 1).area).toBeGreaterThan(top("FIRST_QUARTER", 1).area);
    expect(top("FIRST_QUARTER", 1).cx).toBeGreaterThan(0);
    expect(top("LAST_QUARTER", -1).cx).toBeLessThan(0);
    expect(Math.abs(top("FULL", 1).cx)).toBeLessThan(1e-9);
    expect(Math.abs(top("NEW", 1).cx)).toBeLessThan(1e-9);
  });
});

describe("moonPhaseLitPolygon (ASM-0073)", () => {
  const r = 100;
  const polygonArea = (pts: { x: number; y: number }[]): number => {
    let a = 0;
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      if (q !== undefined) a += p.x * q.y - q.x * p.y;
    });
    return Math.abs(a) / 2;
  };
  const centroidX = (pts: { x: number; y: number }[]): number => pts.reduce((sum, p) => sum + p.x, 0) / pts.length;

  it("is empty for a new moon and the whole disc for a full moon", () => {
    expect(moonPhaseLitPolygon(0, r)).toEqual([]);
    expect(moonPhaseLitPolygon(1, r)).toEqual([]);
    expect(polygonArea(moonPhaseLitPolygon(0.5, r)) / (Math.PI * r * r)).toBeCloseTo(1, 2);
  });

  it("lights the textbook illuminated fraction (1 − cos 2π·phase) / 2 at every phase of the printed series", () => {
    for (let j = 1; j < 8; j += 1) {
      const phase = j / 8;
      const expected = (1 - Math.cos(2 * Math.PI * phase)) / 2;
      expect(polygonArea(moonPhaseLitPolygon(phase, r, 400)) / (Math.PI * r * r)).toBeCloseTo(expected, 2);
    }
  });

  it("lights the LEFT (viewer) side while waxing and the RIGHT while waning — the declared Southern Hemisphere convention", () => {
    for (const phase of [0.125, 0.25, 0.375]) expect(centroidX(moonPhaseLitPolygon(phase, r))).toBeLessThan(0);
    for (const phase of [0.625, 0.75, 0.875]) expect(centroidX(moonPhaseLitPolygon(phase, r))).toBeGreaterThan(0);
  });

  it("mirrors exactly between a waxing phase and its waning counterpart", () => {
    const waxing = moonPhaseLitPolygon(0.25, r);
    const waning = moonPhaseLitPolygon(0.75, r);
    expect(polygonArea(waxing)).toBeCloseTo(polygonArea(waning), 6);
    expect(centroidX(waxing)).toBeCloseTo(-centroidX(waning), 6);
  });
});

describe("moonPhaseIconPlacements (ASM-0073)", () => {
  it("prints the whole eight-phase series once per moon image (16 icons on a two-image disc, 8 on a single)", () => {
    expect(moonPhaseIconPlacements(2)).toHaveLength(16);
    expect(moonPhaseIconPlacements(1)).toHaveLength(8);
    expect(moonPhaseIconPlacements(0)).toEqual([]);
    expect(moonPhaseIconPlacements(1.5)).toEqual([]);
  });

  it("places each icon where a label of the same disc turn would be: at north exactly when the disc has turned 2π(phase + k)/n", () => {
    // Calibrated by the label rings (DISC_LABEL_RING_DIRECTION, ASM-0071): a label at canvas angle
    // −φ + DISC_LABEL_CURRENT_AT_NORTH_OFFSET_RADIANS reads at north once the disc has turned φ.
    for (const n of [1, 2]) {
      const placements = moonPhaseIconPlacements(n);
      placements.forEach((placement, index) => {
        const k = Math.floor(index / 8);
        const turned = (2 * Math.PI * (placement.phase + k)) / n;
        expect(placement.canvasAngle).toBeCloseTo(-turned + DISC_LABEL_CURRENT_AT_NORTH_OFFSET_RADIANS, 9);
        expect(moonPhaseFraction(radians(turned), n)).toBeCloseTo(placement.phase, 9);
      });
    }
  });

  it("repeats the series half a turn apart on a two-image disc, so each phase appears twice", () => {
    const placements = moonPhaseIconPlacements(2);
    for (let j = 0; j < 8; j += 1) {
      const a = placements[j];
      const b = placements[8 + j];
      expect(a?.phase).toBeCloseTo(b?.phase ?? NaN, 12);
      expect(Math.abs(((a?.canvasAngle ?? 0) - (b?.canvasAngle ?? 0)) % (2 * Math.PI))).toBeCloseTo(Math.PI, 9);
    }
  });
});

describe("createDialWindowBezelGeometry (ASM-0074)", () => {
  const box = (g: ReturnType<typeof createDialWindowBezelGeometry>): THREE.Box3 => {
    g.computeBoundingBox();
    return g.boundingBox ?? new THREE.Box3();
  };

  it("frames a rectangular window from the outside: outer extent = window + bezel on every side, thickness as asked", () => {
    const b = box(createDialWindowBezelGeometry({ kind: "RECTANGLE", width: 3e-3, height: 0.4e-3 }, 0.1e-3, 0.03e-3));
    expect(b.max.x).toBeCloseTo(1.6e-3, 9);
    expect(b.min.x).toBeCloseTo(-1.6e-3, 9);
    expect(b.max.y).toBeCloseTo(0.3e-3, 9);
    expect(b.min.y).toBeCloseTo(-0.3e-3, 9);
    expect(b.max.z - b.min.z).toBeCloseTo(0.03e-3, 9);
  });

  it("frames a circular window from the outside, and leaves the window's own area open", () => {
    const g = createDialWindowBezelGeometry({ kind: "CIRCLE", radius: 2e-3 }, 0.1e-3, 0.03e-3);
    const b = box(g);
    expect(b.max.x).toBeCloseTo(2.1e-3, 6);
    expect(b.min.y).toBeCloseTo(-2.1e-3, 6);
    const pos = g.attributes.position;
    if (pos === undefined) throw new Error("no positions");
    let innermost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < pos.count; i += 1) innermost = Math.min(innermost, Math.hypot(pos.getX(i), pos.getY(i)));
    expect(innermost).toBeCloseTo(2e-3, 6);
  });
});

describe("dialWindowCaptionOffset (ASM-0074)", () => {
  it("centres the caption under the window, its top the gap below the window's (bezel's) southern edge", () => {
    const o = dialWindowCaptionOffset(0.2e-3, 0.05e-3, 0.17e-3, 0.5e-3);
    expect(o.x).toBe(0);
    // top of the caption = −(south extent + bezel + gap); centre is half the caption height further.
    expect(o.y + 0.25e-3).toBeCloseTo(-(0.2e-3 + 0.05e-3 + 0.17e-3), 12);
    expect(dialWindowCaptionOffset(0.2e-3, 0, 0.17e-3, 0.5e-3).y).toBeGreaterThan(o.y);
  });
});

describe("spoked date/month wheels (ASM-0075)", () => {
  const R = 2.5e-3;
  const v = SPOKED_WHEEL_VISUALIZATION;
  const shoelace = (pts: { x: number; y: number }[]): number => {
    let a = 0;
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      if (q !== undefined) a += p.x * q.y - q.x * p.y;
    });
    return Math.abs(a) / 2;
  };

  it("has five gaps, one between each pair of adjacent spokes, all between the hub and the opening radius", () => {
    const openings = spokedWheelOpenings(R);
    expect(openings).toHaveLength(v.spokeCount);
    for (const opening of openings) {
      for (const p of opening) {
        const r = Math.hypot(p.x, p.y);
        expect(r).toBeGreaterThanOrEqual(R * v.hubRadiusFraction - 1e-12);
        expect(r).toBeLessThanOrEqual(R * v.openingOuterRadiusFraction + 1e-12);
      }
    }
  });

  it("keeps every spoke a constant width: each gap's corner sits half a spoke-width off its spoke's centreline", () => {
    const spacing = (2 * Math.PI) / v.spokeCount;
    const halfWidth = (R * v.spokeWidthFraction) / 2;
    spokedWheelOpenings(R, 0.3).forEach((opening, k) => {
      const first = opening[0];
      const last = opening[opening.length - 1];
      if (first === undefined || last === undefined) throw new Error("empty gap");
      const spoke0 = 0.3 + k * spacing;
      const spoke1 = spoke0 + spacing;
      // Perpendicular distance of a point from a spoke's centreline through the origin.
      const off = (p: { x: number; y: number }, angle: number): number => Math.abs(-Math.sin(angle) * p.x + Math.cos(angle) * p.y);
      expect(off(first, spoke0)).toBeCloseTo(halfWidth, 12);
      expect(off(opening[v.arcSegments] ?? first, spoke1)).toBeCloseTo(halfWidth, 12);
      expect(off(opening[v.arcSegments + 1] ?? last, spoke1)).toBeCloseTo(halfWidth, 12);
      expect(off(last, spoke0)).toBeCloseTo(halfWidth, 12);
    });
  });

  it("stops the gaps well below the label ring, so no gap can cut into a number or a name", () => {
    // Labels sit at labelRadiusFraction and, measured live, reach about 0.06 of the radius either side.
    expect(v.openingOuterRadiusFraction + 0.1).toBeLessThanOrEqual(DIAL_WINDOW_VISUALIZATION.labelRadiusFraction);
  });

  it("lets the opening radius be set (the moon wheel's own, 0.62), and keeps its gaps below the printed phase icon ring", () => {
    const moonOuter = v.moonOpeningOuterRadiusFraction;
    for (const opening of spokedWheelOpenings(3e-3, 0, moonOuter)) {
      for (const p of opening) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(3e-3 * moonOuter + 1e-12);
    }
    expect(moonOuter).toBeGreaterThan(v.openingOuterRadiusFraction);
    // The phase icons occupy ring ± icon radius from the centre outward; the gaps stop clear below that.
    const iconInnerEdge = MOON_PHASE_VISUALIZATION.iconRingRadiusFraction - MOON_PHASE_VISUALIZATION.iconRadiusFraction;
    expect(moonOuter + 0.05).toBeLessThanOrEqual(iconInnerEdge);
  });

  it("builds a disc of the tip radius whose face area is the full circle minus the five gaps, grouped like a cylinder disc", () => {
    const thickness = 0.15e-3;
    const g = createSpokedWheelGeometry(R, thickness);
    g.computeBoundingBox();
    const box = g.boundingBox ?? new THREE.Box3();
    expect(box.max.x).toBeCloseTo(R, 6);
    expect(box.min.y).toBeCloseTo(-R, 6);
    expect(box.max.z).toBeCloseTo(thickness / 2, 9);
    expect(box.min.z).toBeCloseTo(-thickness / 2, 9);
    expect(new Set(g.groups.map((group) => group.materialIndex))).toEqual(new Set([0, 1, 2]));

    // Area of the top (+Z) face: sum of its triangles.
    const pos = g.attributes.position;
    const index = g.index;
    if (pos === undefined) throw new Error("no positions");
    let faceArea = 0;
    const tri = (a: number, b: number, c: number): void => {
      if (!(pos.getZ(a) > 0 && pos.getZ(b) > 0 && pos.getZ(c) > 0)) return;
      faceArea += Math.abs((pos.getX(b) - pos.getX(a)) * (pos.getY(c) - pos.getY(a)) - (pos.getX(c) - pos.getX(a)) * (pos.getY(b) - pos.getY(a))) / 2;
    };
    if (index === null) for (let i = 0; i < pos.count; i += 3) tri(i, i + 1, i + 2);
    else for (let i = 0; i < index.count; i += 3) tri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    const gaps = spokedWheelOpenings(R).reduce((sum, o) => sum + shoelace(o), 0);
    // The disc's own outline is a 64-segment polygon, a hair under the true circle.
    const expected = Math.PI * R * R - gaps;
    expect(Math.abs(faceArea - expected) / expected).toBeLessThan(1e-3);
  });

  it("normalises the cap UVs into the unit square, as the label-ring texture expects", () => {
    const g = createSpokedWheelGeometry(R, 0.15e-3);
    const uv = g.attributes.uv;
    if (uv === undefined) throw new Error("no uvs");
    for (const group of g.groups) {
      if (group.materialIndex === 0) continue;
      for (let i = group.start; i < group.start + group.count; i += 1) {
        expect(uv.getX(i)).toBeGreaterThanOrEqual(-1e-9);
        expect(uv.getX(i)).toBeLessThanOrEqual(1 + 1e-9);
        expect(uv.getY(i)).toBeGreaterThanOrEqual(-1e-9);
        expect(uv.getY(i)).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});

describe("dialMarkerPlacements (ASM-0020, round hour markers)", () => {
  const R = 14.2e-3;
  const placements = dialMarkerPlacements(R);

  it("gives twelve markers: big circles at 12, 3, 6 and 9, and half-size circles at the other eight", () => {
    expect(placements).toHaveLength(12);
    const big = placements.filter((p) => p.big);
    const small = placements.filter((p) => !p.big);
    expect(big.map((p) => p.hour)).toEqual([0, 3, 6, 9]);
    expect(small.map((p) => p.hour)).toEqual([1, 2, 4, 5, 7, 8, 10, 11]);
    for (const p of big) expect(p.radiusMetres).toBeCloseTo(R * DIAL_VISUALIZATION.bigMarkerRadiusFraction, 12);
    for (const p of small) expect(p.radiusMetres).toBeCloseTo((R * DIAL_VISUALIZATION.bigMarkerRadiusFraction) / 2, 12);
  });

  it("puts every marker on one ring inside the dial's edge, 12 at +Y and 3 at −X (the dial is read from its −Z side)", () => {
    for (const p of placements) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(R * (1 - DIAL_VISUALIZATION.markerInsetFraction), 12);
      expect(Math.hypot(p.x, p.y) + p.radiusMetres).toBeLessThan(R);
    }
    const at = (hour: number): { x: number; y: number } => {
      const p = placements.find((m) => m.hour === hour);
      if (p === undefined) throw new Error("missing marker");
      return p;
    };
    expect(at(0).y).toBeGreaterThan(0);
    expect(at(0).x).toBeCloseTo(0, 12);
    expect(at(3).x).toBeLessThan(0);
    expect(at(6).y).toBeLessThan(0);
    expect(at(9).x).toBeGreaterThan(0);
  });

  it("prints the seconds numerals around the seconds hand's pivot: 60 north, 15 east (the dial's right, world −X), 30 south, 45 west", () => {
    const pivot = { x: 9.777e-3, y: -2.7e-3 };
    const ring = 2.85e-3;
    const byText = new Map(secondsNumeralPlacements(pivot, ring).map((n) => [n.text, n]));
    expect(byText.size).toBe(4);
    const at = (text: string): { x: number; y: number } => {
      const n = byText.get(text);
      if (n === undefined) throw new Error(`no numeral ${text}`);
      return n;
    };
    expect(at("60").x).toBeCloseTo(pivot.x, 12);
    expect(at("60").y).toBeCloseTo(pivot.y + ring, 12);
    expect(at("15").x).toBeCloseTo(pivot.x - ring, 12);
    expect(at("15").y).toBeCloseTo(pivot.y, 12);
    expect(at("30").y).toBeCloseTo(pivot.y - ring, 12);
    expect(at("45").x).toBeCloseTo(pivot.x + ring, 12);
    // None are printed on the hour circles any more.
    expect(DIAL_VISUALIZATION.secondsNumerals).toHaveLength(4);
  });
});

describe("date/month label ring moved toward the wheel's edge (follow-up 19)", () => {
  it("places labels at a given radius fraction, defaulting to the shared ring", () => {
    const centre = 512 / 2;
    const edge = DIAL_WINDOW_VISUALIZATION.edgeLabelRadiusFraction;
    for (const placement of discLabelPlacements(["a", "b", "c"], 0, edge)) {
      expect(Math.hypot(placement.x - centre, placement.y - centre)).toBeCloseTo(centre * edge, 6);
    }
    const [defaulted] = discLabelPlacements(["a"]);
    expect(Math.hypot((defaulted?.x ?? 0) - centre, (defaulted?.y ?? 0) - centre)).toBeCloseTo(centre * DIAL_WINDOW_VISUALIZATION.labelRadiusFraction, 6);
  });

  it("sits further out than the shared ring but leaves the text clear of the rim", () => {
    const v = DIAL_WINDOW_VISUALIZATION;
    expect(v.edgeLabelRadiusFraction).toBeGreaterThan(v.labelRadiusFraction);
    // Labels reach about 0.06 of the radius beyond their ring (measured live): the outer edge stays inside the rim.
    expect(v.edgeLabelRadiusFraction + 0.06).toBeLessThan(1);
  });

  it("gives a wider slot, so the fitted font never shrinks below the shared ring's", () => {
    const edge = DIAL_WINDOW_VISUALIZATION.edgeLabelRadiusFraction;
    expect(discLabelSlotArcLengthPx(31, edge)).toBeGreaterThan(discLabelSlotArcLengthPx(31));
    expect(discLabelFittedFontSizePx(400, 31, edge)).toBeGreaterThanOrEqual(discLabelFittedFontSizePx(400, 31));
  });
});

describe("equilateral window pointers (ASM-0076)", () => {
  it("makes all three sides of the pointer triangle the same length", () => {
    const R = 14e-3;
    const { baseWidth, height } = dialWindowPointerSize(R);
    expect(baseWidth).toBeCloseTo(R * DIAL_WINDOW_POINTER_VISUALIZATION.sideFraction, 12);
    const [apex, left, right] = createDialWindowPointerOutline(baseWidth, height);
    if (apex === undefined || left === undefined || right === undefined) throw new Error("bad outline");
    const side = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
    expect(side(left, right)).toBeCloseTo(side(apex, left), 12);
    expect(side(left, right)).toBeCloseTo(side(apex, right), 12);
  });

  it("is shorter than the old 0.04-tall triangle", () => {
    const R = 14e-3;
    expect(dialWindowPointerSize(R).height).toBeLessThan(R * 0.04);
  });
});

describe("hour numerals (follow-up 21)", () => {
  it("are 12 north, 3 east, 6 south and 9 west, each on a big circle", () => {
    const byHour = new Map(DIAL_VISUALIZATION.hourNumerals.map((n) => [n.hour, n.text]));
    expect(byHour.get(0)).toBe("12");
    expect(byHour.get(3)).toBe("3");
    expect(byHour.get(6)).toBe("6");
    expect(byHour.get(9)).toBe("9");
    const placements = dialMarkerPlacements(14e-3);
    for (const n of DIAL_VISUALIZATION.hourNumerals) expect(placements.find((p) => p.hour === n.hour)?.big).toBe(true);
    // The text height fits inside a big circle (radius 0.05 of the dial radius, so 0.1 across).
    expect(DIAL_VISUALIZATION.hourNumeralHeightFraction).toBeLessThan(2 * DIAL_VISUALIZATION.bigMarkerRadiusFraction);
  });
});

describe("createFlutedCylinderGeometry (crown knurl, ASM-0076)", () => {
  it("runs along +X for the requested length, with crests at the full radius and grooves cut the declared depth", () => {
    const radius = 1.4e-3;
    const depth = 0.09;
    const g = createFlutedCylinderGeometry(radius, 1.4e-3, 36, depth);
    g.computeBoundingBox();
    const box = g.boundingBox ?? new THREE.Box3();
    expect(box.max.x - box.min.x).toBeCloseTo(1.4e-3, 9);
    expect(box.min.x).toBeCloseTo(-0.7e-3, 9);
    const pos = g.attributes.position;
    if (pos === undefined) throw new Error("no positions");
    let rMax = 0;
    let rMin = Number.POSITIVE_INFINITY;
    for (let i = 0; i < pos.count; i += 1) {
      const r = Math.hypot(pos.getY(i), pos.getZ(i));
      rMax = Math.max(rMax, r);
      rMin = Math.min(rMin, r);
    }
    expect(rMax).toBeCloseTo(radius, 6);
    expect(rMin).toBeCloseTo(radius * (1 - depth), 6);
  });

  it("has one groove per ridge around the rim", () => {
    const g = createFlutedCylinderGeometry(1e-3, 1e-3, 12, 0.1);
    const pos = g.attributes.position;
    if (pos === undefined) throw new Error("no positions");
    // Count local minima of the rim radius around one end cap's outline (x at its minimum).
    const end = pos.getX(0);
    const ring: { angle: number; r: number }[] = [];
    for (let i = 0; i < pos.count; i += 1) {
      if (Math.abs(pos.getX(i) - end) > 1e-12) continue;
      ring.push({ angle: Math.atan2(pos.getZ(i), pos.getY(i)), r: Math.hypot(pos.getY(i), pos.getZ(i)) });
    }
    const unique = [...new Map(ring.map((p) => [p.angle.toFixed(9), p])).values()].sort((a, b) => a.angle - b.angle);
    let minima = 0;
    unique.forEach((p, i) => {
      const prev = unique[(i - 1 + unique.length) % unique.length];
      const next = unique[(i + 1) % unique.length];
      if (prev !== undefined && next !== undefined && p.r < prev.r - 1e-12 && p.r <= next.r + 1e-12) minima += 1;
    });
    expect(minima).toBe(12);
  });
});

describe("createJewelGeometry (faceted ruby jewels, ASM-0078)", () => {
  const R = 0.5e-3;
  const H = 1.2e-3;
  const radii = (g: ReturnType<typeof createJewelGeometry>): { rMin: number; rMax: number; zMin: number; zMax: number } => {
    const pos = g.attributes.position;
    if (pos === undefined) throw new Error("no positions");
    let rMin = Number.POSITIVE_INFINITY;
    let rMax = 0;
    let zMin = Number.POSITIVE_INFINITY;
    let zMax = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < pos.count; i += 1) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
      zMin = Math.min(zMin, pos.getZ(i));
      zMax = Math.max(zMax, pos.getZ(i));
    }
    return { rMin, rMax, zMin, zMax };
  };

  it("is a ring along Z: outer radius at the girdle, the through hole at its declared fraction, the requested height, centred", () => {
    const { rMin, rMax, zMin, zMax } = radii(createJewelGeometry(R, H));
    expect(rMax).toBeCloseTo(R, 9);
    expect(rMin).toBeCloseTo(R * JEWEL_VISUALIZATION.holeRadiusFraction, 9);
    expect(zMax).toBeCloseTo(H / 2, 9);
    expect(zMin).toBeCloseTo(-H / 2, 9);
  });

  it("with no hole it is a solid stone that reaches the axis (the balance's impulse ruby)", () => {
    const { rMin, rMax } = radii(createJewelGeometry(0.2e-3, 0.35e-3, 0));
    expect(rMin).toBeCloseTo(0, 12);
    expect(rMax).toBeCloseTo(0.2e-3, 9);
  });

  it("has a bevelled crown: the table is narrower than the girdle, so the ends are domed rather than flat cylinder ends", () => {
    const g = createJewelGeometry(R, H);
    const pos = g.attributes.position;
    if (pos === undefined) throw new Error("no positions");
    let tableMax = 0;
    for (let i = 0; i < pos.count; i += 1) {
      if (Math.abs(pos.getZ(i) - H / 2) < 1e-9) tableMax = Math.max(tableMax, Math.hypot(pos.getX(i), pos.getY(i)));
    }
    expect(tableMax).toBeCloseTo(R * JEWEL_VISUALIZATION.tableRadiusFraction, 9);
    expect(tableMax).toBeLessThan(R);
  });

  it("is faceted: few radial segments, not a smooth cylinder", () => {
    const g = createJewelGeometry(R, H);
    // The lathe's own segment count is the facet count.
    const params = g.parameters as { segments: number };
    expect(params.segments).toBe(JEWEL_VISUALIZATION.facetCount);
    expect(JEWEL_VISUALIZATION.facetCount).toBeLessThanOrEqual(16);
  });

  it("keeps a short stone's crowns inside its height (crown capped at a quarter of the height)", () => {
    const { zMin, zMax } = radii(createJewelGeometry(R, 0.4e-3));
    expect(zMax - zMin).toBeCloseTo(0.4e-3, 9);
  });
});

