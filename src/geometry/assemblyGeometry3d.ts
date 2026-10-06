import * as THREE from "three";
import type { Outline } from "@/domain/frame";
import type { AssumptionId } from "@/reference/assumptions";
import type { Point2D } from "./gearOutline";

/**
 * Placeholder visual sizes for parts whose dimensions are unknown or not
 * modeled (ASM-0012). These are only used to draw them. Validation never
 * reads them.
 */
export const ASSEMBLY_VISUALIZATION = {
  arborRadiusMetres: 0.15e-3,
  jewelOuterRadiusMetres: 0.5e-3,
  assumption: "ASM-0012" satisfies AssumptionId,
} as const;

/**
 * Hands are not part of the engineering model (ASM-0016): they are drawn
 * only to show each hand arbor's simulated angle. Pointing along +Y at
 * angle 0 means 12 o'clock. Lengths, widths and stacking gaps are visual.
 */
export const HAND_VISUALIZATION = {
  HOURS: { lengthMetres: 5e-3, widthMetres: 0.6e-3, gapBelowMovementMetres: 0.6e-3 },
  MINUTES: { lengthMetres: 8e-3, widthMetres: 0.4e-3, gapBelowMovementMetres: 0.9e-3 },
  SECONDS: { lengthMetres: 3e-3, widthMetres: 0.2e-3, gapBelowMovementMetres: 0.6e-3 },
  thicknessMetres: 0.08e-3,
  assumption: "ASM-0016" satisfies AssumptionId,
} as const;

/**
 * Keyless parts drawn at placeholder sizes (ASM-0012): the stem, the crown
 * and the pinions' thickness are not modeled. The pinions' pitch
 * diameters are the model's; their tooth shapes are visual (ASM-0005).
 * Pulling the crown out and the sliding pinion's travel are shown by
 * visual offsets only (ASM-0019).
 */
export const KEYLESS_VISUALIZATION = {
  stemRadiusMetres: 0.35e-3,
  crownRadiusMetres: 1.4e-3,
  crownLengthMetres: 1.4e-3,
  crownGapMetres: 0.6e-3,
  pinionThicknessMetres: 0.35e-3,
  pulledOutMetres: 0.6e-3,
  slidingPinionTravelMetres: 0.3e-3,
  stemInnerOverhangMetres: 0.6e-3,
  assumption: "ASM-0012" satisfies AssumptionId,
} as const;

/** Hour markers drawn on the dial face; visual only (ASM-0020). */
export const DIAL_VISUALIZATION = {
  markerLengthFraction: 0.1,
  markerWidthMetres: 0.35e-3,
  markerThicknessMetres: 0.03e-3,
  assumption: "ASM-0020" satisfies AssumptionId,
} as const;

type HandKind = keyof Omit<typeof HAND_VISUALIZATION, "thicknessMetres" | "assumption">;

/** 2D outline of a hand's tapered blade (not the hub hole), pointing +Y from the axis (ASM-0016, visual). */
export function generateHandOutline(hand: HandKind): Point2D[] {
  const { lengthMetres: l, widthMetres: w } = HAND_VISUALIZATION[hand];
  const tail = l * 0.18;
  return [
    { x: -w / 2, y: -tail },
    { x: w / 2, y: -tail },
    { x: w * 0.3, y: l },
    { x: -w * 0.3, y: l },
  ];
}

/** Radius of a hand's visual hub hole, in metres (ASM-0016). */
export function handHubRadius(hand: HandKind): number {
  return HAND_VISUALIZATION[hand].widthMetres * 0.2;
}

/** A tapered hand along +Y from the axis, with a short tail, spanning z ∈ [0, thickness]. */
export function createHandGeometry(hand: HandKind): THREE.ExtrudeGeometry {
  const outline = generateHandOutline(hand);
  const shape = new THREE.Shape();
  outline.forEach(({ x, y }, i) => { if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
  shape.closePath();
  const hub = new THREE.Path();
  shape.holes.push(hub);
  hub.absarc(0, 0, handHubRadius(hand), 0, Math.PI * 2, true);
  return new THREE.ExtrudeGeometry(shape, { depth: HAND_VISUALIZATION.thicknessMetres, bevelEnabled: false });
}

export function outlineShape(outline: Outline): THREE.Shape {
  const shape = new THREE.Shape();
  if (outline.kind === "CIRCLE") {
    shape.absarc(outline.centre.x, outline.centre.y, outline.radius, 0, Math.PI * 2, false);
    return shape;
  }
  const [first, ...rest] = outline.points;
  if (first === undefined) return shape;
  shape.moveTo(first.x, first.y);
  for (const p of rest) shape.lineTo(p.x, p.y);
  shape.closePath();
  return shape;
}

/** Slab geometry spanning z ∈ [0, thickness]; position it at the frame's zBottom. */
export function createFrameGeometry(outline: Outline, thickness: number): THREE.ExtrudeGeometry {
  return new THREE.ExtrudeGeometry(outlineShape(outline), {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 64,
  });
}

/** Cylinder along Z spanning [zLo, zHi], centred on the local origin in x/y. */
export function createZCylinder(radius: number, zLo: number, zHi: number, segments = 24): THREE.CylinderGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, zHi - zLo, segments);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, (zLo + zHi) / 2);
  return geometry;
}

/**
 * Escapement parts are drawn only to show the simplified model's motion
 * (ASM-0023): the escape wheel's tooth form, the fork's shape and the
 * balance's rim and arms are visual (ASM-0012). Only the escape wheel's
 * tooth count and tip diameter and the balance's diameter, thickness and
 * height come from the model.
 */
export const ESCAPEMENT_VISUALIZATION = {
  escapeRootFraction: 0.72,
  escapeToothLeanFraction: 0.35,
  forkWidthMetres: 0.25e-3,
  forkThicknessMetres: 0.15e-3,
  palletStoneMetres: 0.35e-3,
  palletStoneDepthMetres: 0.45e-3,
  /** Smallest angular tooth width ever drawn, so a ratchet tooth's near-zero `toothWidthAngle` (ASM-0038) still renders as a valid, non-degenerate sliver rather than a zero-area polygon (ASM-0040). Not a claim about the true tooth shape. */
  minToothWidthRadians: 0.01,
  balanceRimWidthFraction: 0.1,
  balanceArmWidthMetres: 0.3e-3,
  /** Half-angle between the fork's arms when no pallet geometry is entered (visual only). */
  symbolicPalletHalfAngleRadians: 0.45,
  /**
   * Ruby pin's own drawn size (ASM-0012): its position (impulse radius from
   * the balance centre) and the roller's own radius (`Balance.rollerRadius`)
   * come from the model when entered (ASM-0041, ASM-0044, 7.1.5.6); the
   * pin's own small cylinder size is cosmetic, the same visual-only
   * convention as `palletStoneMetres`. The roller's crescent notch and the
   * fork's horn jaws are not drawn — their physical outline isn't
   * derivable from the declared angular openings alone (ASM-0044, ASM-0045).
   */
  rubyPinRadiusMetres: 0.2e-3,
  rubyPinThicknessMetres: 0.35e-3,
  assumption: "ASM-0012" satisfies AssumptionId,
} as const;

/** Radius of the escape wheel's visual hub hole, in metres (ASM-0012). */
export function escapeWheelHubRadius(tipRadius: number): number {
  return tipRadius * ESCAPEMENT_VISUALIZATION.escapeRootFraction * 0.35;
}

/**
 * Where a ray from `from` (at radius |from| from the origin), leaning
 * `lean` off the inward radial, meets the circle of `targetRadius` —
 * the nearest forward intersection, or null when the lean is too steep
 * for the ray to reach that circle at all (ASM-0040). Used to build a
 * locking face whose direction is the model's own declared/derived
 * draw angle, not an arbitrary visual lean.
 */
export function rayCircleInward(from: Point2D, lean: number, targetRadius: number): Point2D | null {
  const r = Math.hypot(from.x, from.y);
  const dir = Math.atan2(from.y, from.x) + Math.PI + lean;
  const ux = Math.cos(dir);
  const uy = Math.sin(dir);
  const b = from.x * ux + from.y * uy;
  const c = r * r - targetRadius * targetRadius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const t = -b - Math.sqrt(discriminant);
  if (t < 0) return null;
  return { x: from.x + t * ux, y: from.y + t * uy };
}

/**
 * The escape tooth's own geometry (ASM-0038, ASM-0039, ASM-0040), when
 * pallet geometry is entered: its angular width at the tip
 * (`toothWidthAngle`) and the lean of its locking face off the radial
 * at the locking corner (`toothDrawAngle`, conventionally double the
 * pallet's draw). Without this, `generateEscapeWheelOutline` falls back
 * to the earlier purely cosmetic shape.
 */
export interface EscapeToothFace {
  toothWidthAngle: number;
  toothDrawAngle: number;
}

/**
 * 2D outline of the escape wheel's teeth, centred on the arbor. With
 * `face` given, each tooth is a quadrilateral: a flat top of
 * `toothWidthAngle` at the tip circle, a plain radial trailing edge
 * down to the root, and a locking edge leaning `toothDrawAngle` off the
 * radial at the locking corner — found exactly via `rayCircleInward`,
 * not an arbitrary visual lean (ASM-0040). This still simplifies away
 * Playtner's (SRC-0036) true lifting-face curvature, the engaging/
 * disengaging asymmetry and the real/primitive-circle correction (also
 * out of scope in ASM-0039); it is a straight-edged approximation using
 * the model's own derived angles, not a claim of manufacturing fidelity.
 * Without `face` (no pallet geometry entered, nothing to derive from),
 * falls back to the earlier purely cosmetic leaning-trapezoid shape
 * (ASM-0012).
 */
export function generateEscapeWheelOutline(toothCount: number, tipRadius: number, face?: EscapeToothFace): Point2D[] {
  const v = ESCAPEMENT_VISUALIZATION;
  const root = tipRadius * v.escapeRootFraction;
  const pitch = (2 * Math.PI) / toothCount;
  const points: Point2D[] = [];
  if (face === undefined) {
    for (let i = 0; i < toothCount; i += 1) {
      const a = i * pitch;
      const tip = a + pitch * v.escapeToothLeanFraction;
      const profile: [number, number][] = [
        [root * Math.cos(a), root * Math.sin(a)],
        [tipRadius * Math.cos(tip), tipRadius * Math.sin(tip)],
        [root * Math.cos(a + pitch * 0.55), root * Math.sin(a + pitch * 0.55)],
      ];
      for (const [x, y] of profile) points.push({ x, y });
    }
    return points;
  }
  const width = Math.max(face.toothWidthAngle, v.minToothWidthRadians);
  for (let i = 0; i < toothCount; i += 1) {
    const aLock = i * pitch;
    const lockCorner: Point2D = { x: tipRadius * Math.cos(aLock), y: tipRadius * Math.sin(aLock) };
    const heelCorner: Point2D = { x: tipRadius * Math.cos(aLock + width), y: tipRadius * Math.sin(aLock + width) };
    const root1 = rayCircleInward(lockCorner, face.toothDrawAngle, root) ?? { x: root * Math.cos(aLock), y: root * Math.sin(aLock) };
    const root2: Point2D = { x: root * Math.cos(aLock + width), y: root * Math.sin(aLock + width) };
    points.push(root1, lockCorner, heelCorner, root2);
  }
  return points;
}

/** Escape wheel with pointed, leaning teeth (visual), spanning z ∈ [−t/2, t/2]. */
export function createEscapeWheelGeometry(toothCount: number, tipRadius: number, thickness: number, face?: EscapeToothFace): THREE.ExtrudeGeometry {
  const outline = generateEscapeWheelOutline(toothCount, tipRadius, face);
  const shape = new THREE.Shape();
  outline.forEach(({ x, y }, i) => { if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
  shape.closePath();
  const hub = new THREE.Path();
  hub.absarc(0, 0, escapeWheelHubRadius(tipRadius), 0, Math.PI * 2, true);
  shape.holes.push(hub);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.translate(0, 0, -thickness / 2);
  return geometry;
}

/** Radius of the balance rim's inner edge, in metres (ASM-0012). */
export function balanceRimInnerRadius(radius: number): number {
  return radius * (1 - ESCAPEMENT_VISUALIZATION.balanceRimWidthFraction);
}

/** Half-length and half-width of the balance's two arms, in metres (ASM-0012). */
export function balanceArmHalfExtents(radius: number): { halfLength: number; halfWidth: number } {
  const v = ESCAPEMENT_VISUALIZATION;
  return { halfLength: radius * (1 - v.balanceRimWidthFraction / 2), halfWidth: v.balanceArmWidthMetres / 2 };
}

/** Balance rim and two arms (visual), spanning z ∈ [−t/2, t/2]. */
export function createBalanceGeometry(radius: number, thickness: number): THREE.BufferGeometry[] {
  const rim = new THREE.Shape();
  rim.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const inner = new THREE.Path();
  inner.absarc(0, 0, balanceRimInnerRadius(radius), 0, Math.PI * 2, true);
  rim.holes.push(inner);
  const rimGeometry = new THREE.ExtrudeGeometry(rim, { depth: thickness, bevelEnabled: false, curveSegments: 48 });
  rimGeometry.translate(0, 0, -thickness / 2);
  const { halfLength, halfWidth } = balanceArmHalfExtents(radius);
  const arms = new THREE.BoxGeometry(halfLength * 2, halfWidth * 2, thickness * 0.8);
  return [rimGeometry, arms];
}

/**
 * Pallet fork (visual): a lever from the pallet arbor toward the balance
 * staff, and two arms toward the escape wheel ending in pallet stones.
 * Directions are angles from +X in the plan; lengths in metres.
 */
/**
 * A pallet arm from the pallet axis: direction and length to its stone,
 * and the stone's own locking-face direction (same frame as `angle`).
 * `faceAngle` is null when there is nothing to derive it from (no pallet
 * geometry, or draw not positive, ASM-0040) — the stone then draws as a
 * plain square (ASM-0012), as it always used to.
 */
export interface PalletArm {
  angle: number;
  length: number;
  faceAngle: number | null;
}

/**
 * 2D outline of a pallet stone (ASM-0040), in the pallet's own local
 * frame (same convention as `PalletArm`): a quadrilateral whose near
 * edge is the locking face, through the locking point, in direction
 * `arm.faceAngle` (ASM-0039 — the model's own declared/derived draw,
 * not an arbitrary lean); the far edge is the same face swept straight
 * back along the arm by a fixed visual depth. Falls back to a plain
 * square, centred on the locking point, when `arm.faceAngle` is null.
 */
export function generatePalletStoneOutline(arm: PalletArm): Point2D[] {
  const v = ESCAPEMENT_VISUALIZATION;
  const centre: Point2D = { x: arm.length * Math.cos(arm.angle), y: arm.length * Math.sin(arm.angle) };
  if (arm.faceAngle === null) {
    const hw = v.palletStoneMetres / 2;
    return [
      { x: centre.x - hw, y: centre.y - hw },
      { x: centre.x + hw, y: centre.y - hw },
      { x: centre.x + hw, y: centre.y + hw },
      { x: centre.x - hw, y: centre.y + hw },
    ];
  }
  const hw = v.palletStoneMetres / 2;
  const fx = Math.cos(arm.faceAngle);
  const fy = Math.sin(arm.faceAngle);
  const bx = Math.cos(arm.angle);
  const by = Math.sin(arm.angle);
  const faceA: Point2D = { x: centre.x + hw * fx, y: centre.y + hw * fy };
  const faceB: Point2D = { x: centre.x - hw * fx, y: centre.y - hw * fy };
  const bodyA: Point2D = { x: faceA.x - v.palletStoneDepthMetres * bx, y: faceA.y - v.palletStoneDepthMetres * by };
  const bodyB: Point2D = { x: faceB.x - v.palletStoneDepthMetres * bx, y: faceB.y - v.palletStoneDepthMetres * by };
  return [faceA, faceB, bodyB, bodyA];
}

/**
 * Visual pallet fork. With pallet geometry (ASM-0025) the arms end at the
 * locking points, and the stones are real wedge shapes oriented by draw
 * (ASM-0040); without it they are spread symbolically toward the escape
 * wheel with plain square stones.
 */
export function createForkGeometry(towardBalance: number, leverLength: number, arms: readonly [PalletArm, PalletArm]): THREE.BufferGeometry[] {
  const v = ESCAPEMENT_VISUALIZATION;
  const bar = (angle: number, length: number, width: number): THREE.BufferGeometry => {
    const g = new THREE.BoxGeometry(length, width, v.forkThicknessMetres);
    g.translate(length / 2, 0, 0);
    g.rotateZ(angle);
    return g;
  };
  const stones = arms.map((arm) => {
    const outline = generatePalletStoneOutline(arm);
    const shape = new THREE.Shape();
    outline.forEach(({ x, y }, i) => { if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
    shape.closePath();
    const depth = v.forkThicknessMetres * 1.5;
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  });
  return [bar(towardBalance, leverLength, v.forkWidthMetres), ...arms.map(({ angle, length }) => bar(angle, length, v.forkWidthMetres)), ...stones];
}

/** Symbolic arms when no pallet geometry is given: a fixed visual half-angle either side of the escape direction. */
export function symbolicPalletArms(towardEscape: number, armLength: number): [PalletArm, PalletArm] {
  const spread = ESCAPEMENT_VISUALIZATION.symbolicPalletHalfAngleRadians;
  return [{ angle: towardEscape - spread, length: armLength, faceAngle: null }, { angle: towardEscape + spread, length: armLength, faceAngle: null }];
}
