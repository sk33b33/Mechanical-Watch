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
  balanceRimWidthFraction: 0.1,
  balanceArmWidthMetres: 0.3e-3,
  /** Half-angle between the fork's arms when no pallet geometry is entered (visual only). */
  symbolicPalletHalfAngleRadians: 0.45,
  assumption: "ASM-0012" satisfies AssumptionId,
} as const;

/** Radius of the escape wheel's visual hub hole, in metres (ASM-0012). */
export function escapeWheelHubRadius(tipRadius: number): number {
  return tipRadius * ESCAPEMENT_VISUALIZATION.escapeRootFraction * 0.35;
}

/** 2D outline of the escape wheel's pointed, leaning teeth, centred on the arbor (ASM-0012, visual). */
export function generateEscapeWheelOutline(toothCount: number, tipRadius: number): Point2D[] {
  const v = ESCAPEMENT_VISUALIZATION;
  const root = tipRadius * v.escapeRootFraction;
  const pitch = (2 * Math.PI) / toothCount;
  const points: Point2D[] = [];
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

/** Escape wheel with pointed, leaning teeth (visual), spanning z ∈ [−t/2, t/2]. */
export function createEscapeWheelGeometry(toothCount: number, tipRadius: number, thickness: number): THREE.ExtrudeGeometry {
  const outline = generateEscapeWheelOutline(toothCount, tipRadius);
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
/** A pallet arm from the pallet axis: direction and length to its stone. */
export interface PalletArm {
  angle: number;
  length: number;
}

/**
 * Visual pallet fork. With pallet geometry (ASM-0025) the arms end at the
 * locking points; without it they are spread symbolically toward the
 * escape wheel.
 */
export function createForkGeometry(towardBalance: number, leverLength: number, arms: readonly [PalletArm, PalletArm]): THREE.BufferGeometry[] {
  const v = ESCAPEMENT_VISUALIZATION;
  const bar = (angle: number, length: number, width: number): THREE.BufferGeometry => {
    const g = new THREE.BoxGeometry(length, width, v.forkThicknessMetres);
    g.translate(length / 2, 0, 0);
    g.rotateZ(angle);
    return g;
  };
  const stones = arms.map(({ angle, length }) => {
    const g = new THREE.BoxGeometry(v.palletStoneMetres, v.palletStoneMetres, v.forkThicknessMetres * 1.5);
    g.translate(length * Math.cos(angle), length * Math.sin(angle), 0);
    return g;
  });
  return [bar(towardBalance, leverLength, v.forkWidthMetres), ...arms.map(({ angle, length }) => bar(angle, length, v.forkWidthMetres)), ...stones];
}

/** Symbolic arms when no pallet geometry is given: a fixed visual half-angle either side of the escape direction. */
export function symbolicPalletArms(towardEscape: number, armLength: number): [PalletArm, PalletArm] {
  const spread = ESCAPEMENT_VISUALIZATION.symbolicPalletHalfAngleRadians;
  return [{ angle: towardEscape - spread, length: armLength }, { angle: towardEscape + spread, length: armLength }];
}
