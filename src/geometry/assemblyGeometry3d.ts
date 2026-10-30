import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Outline } from "@/domain/frame";
import type { MoonPhaseWindowCount } from "@/domain/moonPhase";
import { windowsPerRevolution } from "@/domain/moonPhase";
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
  // Longer than the original 5 / 8 mm (follow-up 30, ASM-0083); plain straight tapered hands again (follow-up 31).
  HOURS: { lengthMetres: 7.5e-3, widthMetres: 0.6e-3, gapBelowMovementMetres: 0.6e-3 },
  MINUTES: { lengthMetres: 11e-3, widthMetres: 0.45e-3, gapBelowMovementMetres: 0.9e-3 },
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
  /** The crown's knurl (follow-up 21, ASM-0076): this many ridges around its rim, each groove cut this fraction of the radius deep. */
  crownRidgeCount: 36,
  crownRidgeDepthFraction: 0.09,
  assumption: "ASM-0012" satisfies AssumptionId,
} as const;

/**
 * Hour markers drawn on the dial face; visual only (ASM-0020, ASM-0093).
 * Round dots (Phase 8.15 follow-up 18, replacing the earlier rectangular
 * bars); since follow-up 46 every hour but 12 is the same round dot and 12 is
 * an upside-down (apex-down) triangle (made half as big again in follow-up 48),
 * with every hour's numeral printed inside its marker. Radii and the inset from the dial's
 * edge are fractions of the dial's own radius, as before. The seconds-scale
 * numerals (60 north, 15 east, 30 south, 45 west) are printed around the
 * seconds hand's own pivot, not on the hour circles.
 */
export const DIAL_VISUALIZATION = {
  /**
   * The size of the 12 o'clock marker as a fraction of the dial radius: the radius of the circle its
   * upside-down triangle is inscribed in. It was 0.05, the old big circle (follow-up 46), and is half as big
   * again at the user's request (follow-up 48).
   */
  bigMarkerRadiusFraction: 0.075,
  /** The eleven round markers' radius as a fraction of the dial radius: all the same, big enough to hold a numeral (follow-up 46). */
  markerRadiusFraction: 0.036,
  /** How far each marker's own centre sits in from the dial's edge, as a fraction of the dial radius. */
  markerInsetFraction: 0.09,
  markerThicknessMetres: 0.03e-3,
  /**
   * The hour markers are applied indices (follow-up 51, ASM-0095): a raised metal body this high above the dial face,
   * with a thinner top layer on it, inset to this fraction of the body's size, so the metal shows as a rim. The hour
   * marker colour (or the lume) is the top layer only; the body keeps the metal finish below.
   */
  indexHeightMetres: 0.3e-3,
  indexTopLayerFraction: 0.72,
  indexTopLayerThicknessMetres: 0.05e-3,
  indexMetalColor: 0xc9ccd2,
  /** How far in front of an index's top layer its numeral is drawn. */
  indexNumeralLiftMetres: 0.01e-3,
  /**
   * Seconds-scale numerals printed on the dial around the seconds hand's own pivot (Phase 8.15
   * follow-up 19: first placed on the big hour circles, then moved to the small seconds hand at
   * the user's correction). `dx`/`dy` are unit steps in the dial plane from the pivot: north is
   * world +Y, and east — the right of the dial as read from its −Z side — is world −X.
   */
  secondsNumerals: [
    { text: "60", dx: 0, dy: 1 },
    { text: "15", dx: -1, dy: 0 },
    { text: "30", dx: 0, dy: -1 },
    { text: "45", dx: 1, dy: 0 },
  ] as readonly { text: string; dx: number; dy: number }[],
  /** How far from the seconds hand's pivot the numerals sit, as a fraction of that hand's own length: just inside its tip. */
  secondsNumeralRingFraction: 0.95,
  /**
   * The hour numerals, one per marker (follow-up 21 printed four inside the big circles; follow-up 46 prints all
   * twelve just inside their markers, because the markers are now too small to hold a numeral). `hour` is the
   * marker's position, 0 at 12 o'clock going clockwise as read from the dial.
   */
  hourNumerals: [
    { hour: 0, text: "12" }, { hour: 1, text: "1" }, { hour: 2, text: "2" }, { hour: 3, text: "3" },
    { hour: 4, text: "4" }, { hour: 5, text: "5" }, { hour: 6, text: "6" }, { hour: 7, text: "7" },
    { hour: 8, text: "8" }, { hour: 9, text: "9" }, { hour: 10, text: "10" }, { hour: 11, text: "11" },
  ] as readonly { hour: number; text: string }[],
  /** Hour numeral text height as a fraction of the dial radius: small enough for a circle and the 12 triangle to hold. */
  hourNumeralHeightFraction: 0.032,
  /** How wide a character is as a multiple of the text height (a two-digit numeral is two of these). */
  hourNumeralWidthPerHeight: 0.62,
  /** The numerals' default colour: pale on the dark markers (the year digits' own text colour, as in follow-up 21). The Colours menu can change it. */
  hourNumeralColor: "#e8e2d0",
  /**
   * The small printed brand line under the big 6 circle (follow-up 30, ASM-0083): black, tiny, on the
   * dial's south axis, with its text centred this fraction of the dial radius from the centre and the
   * given text height — placed so its top clears the 6 circle (whose outer edge is at 0.96 of the radius)
   * and its bottom stops just short of the dial's own edge.
   */
  brand: { text: "RSA MOVT", color: "#000000", heightFraction: 0.024, radiusFraction: 0.98 },
  /** Numeral text height as a fraction of the dial radius. */
  numeralHeightFraction: 0.04,
  numeralColor: "#1a1e22",
  assumption: "ASM-0020" satisfies AssumptionId,
} as const;

export interface DialMarkerPlacement {
  /** 0 = 12 o'clock, going clockwise as read from the dial (ASM-0014). */
  readonly hour: number;
  /** A round dot, or (at 12) an upside-down triangle inscribed in a circle of `radiusMetres`. */
  readonly shape: "CIRCLE" | "TRIANGLE_DOWN";
  /** The dot's radius, or the triangle's circumradius (its apex points at the dial's centre, its base is the far side). */
  readonly radiusMetres: number;
  /** Centre in the dial plane relative to the dial's own centre; world +Y is 12 o'clock and world −X is 3 o'clock (the dial is read from its −Z side). */
  readonly x: number;
  readonly y: number;
}

export interface SecondsNumeralPlacement {
  readonly text: string;
  /** Centre in the same frame as the pivot passed in (world metres). */
  readonly x: number;
  readonly y: number;
}

/**
 * Where the seconds numerals go around the seconds hand's own pivot (ASM-0020, follow-up 19):
 * 60 north, 15 east, 30 south, 45 west, each `ringRadius` from the pivot. Pure geometry.
 */
export function secondsNumeralPlacements(pivot: { x: number; y: number }, ringRadius: number): SecondsNumeralPlacement[] {
  return DIAL_VISUALIZATION.secondsNumerals.map((n) => ({ text: n.text, x: pivot.x + n.dx * ringRadius, y: pivot.y + n.dy * ringRadius }));
}

export interface DialHourNumeralPlacement {
  readonly hour: number;
  readonly text: string;
  /** Centre in the dial plane relative to the dial's own centre (same frame as the markers). */
  readonly x: number;
  readonly y: number;
  /** Text height, metres. */
  readonly height: number;
}

/**
 * Where each hour numeral is printed (ASM-0093): upright, centred in its marker. The 12 triangle's centre is its
 * centroid, which is the centre of the circle it is inscribed in, the same point a circle's numeral uses; the
 * triangle is big enough that a two-digit numeral there stays inside it (a test checks every corner of the box).
 * Pure geometry, no THREE dependency.
 */
export function dialHourNumeralPlacements(dialRadius: number): DialHourNumeralPlacement[] {
  const v = DIAL_VISUALIZATION;
  const height = dialRadius * v.hourNumeralHeightFraction;
  const markers = dialMarkerPlacements(dialRadius);
  return v.hourNumerals.map((numeral) => {
    const marker = markers.find((m) => m.hour === numeral.hour);
    if (marker === undefined) throw new Error(`no hour marker for the numeral ${numeral.text}`);
    return { hour: numeral.hour, text: numeral.text, x: marker.x, y: marker.y, height };
  });
}

/** Where the brand line is printed: centre and text height in metres, relative to the dial's centre. */
export function dialBrandPlacement(dialRadius: number): { text: string; x: number; y: number; height: number } {
  const b = DIAL_VISUALIZATION.brand;
  return { text: b.text, x: 0, y: -dialRadius * b.radiusFraction, height: dialRadius * b.heightFraction };
}

/**
 * Where each of the twelve hour markers goes on a dial of the given
 * radius (ASM-0020, ASM-0093): equal circles at every hour but 12, an
 * upside-down triangle at 12, bigger than the circles, all
 * on one ring `markerInsetFraction` of the radius in from the edge. Hands
 * point +Y at 12 and turn counter-clockwise seen from +Z — clockwise from
 * the dial (ASM-0014) — so hour `h` sits at angle h·π/6 with x = −ρ sin θ.
 * Pure geometry, no THREE dependency.
 */
export function dialMarkerPlacements(dialRadius: number): DialMarkerPlacement[] {
  const v = DIAL_VISUALIZATION;
  const ring = dialRadius * (1 - v.markerInsetFraction);
  const placements: DialMarkerPlacement[] = [];
  for (let hour = 0; hour < 12; hour += 1) {
    const angle = (hour * Math.PI) / 6;
    const twelve = hour === 0;
    placements.push({
      hour,
      shape: twelve ? "TRIANGLE_DOWN" : "CIRCLE",
      radiusMetres: dialRadius * (twelve ? v.bigMarkerRadiusFraction : v.markerRadiusFraction),
      x: -ring * Math.sin(angle),
      y: ring * Math.cos(angle),
    });
  }
  return placements;
}

/**
 * A `DialWindow.pointer` index mark (ASM-0069): a fixed upside-down
 * (apex-down) triangle printed on the dial just outside a window's own
 * edge, naming which position reads as "current" — needed only once a
 * window is big enough to show more than one position at a time (e.g.
 * SeasonComplication's own window, ASM-0069, enlarged to reveal the
 * whole wedge illustration rather than catch one short label). Sized as
 * a fraction of the DIAL's own radius, the same derivation convention
 * `DIAL_VISUALIZATION.markerLengthFraction` already uses for the hour
 * markers, so this mark's size stays proportionate to whatever dial it
 * sits on rather than being a fixed absolute size.
 */
export const DIAL_WINDOW_POINTER_VISUALIZATION = {
  /**
   * Side length of the pointer's own EQUILATERAL triangle (follow-up 21, at the user's request:
   * "make all sides of the triangles equal in length" — the earlier 0.03-wide, 0.04-tall one was
   * too tall), as a fraction of the dial's radius. Base width = side, height = side·√3/2.
   */
  sideFraction: 0.034,
  /** Visible gap between the triangle's own apex and the window's own edge it points at, as a further fraction of the dial radius — enough to read as pointing AT the window, not touching it. */
  gapFraction: 0.01,
  assumption: "ASM-0069" satisfies AssumptionId,
} as const;

/**
 * The pointer triangle's own width and height on a dial of the given radius: equilateral, so
 * all three sides equal `sideFraction` of the radius and the height is side·√3/2 (ASM-0076).
 */
export function dialWindowPointerSize(dialRadius: number): { baseWidth: number; height: number } {
  const side = dialRadius * DIAL_WINDOW_POINTER_VISUALIZATION.sideFraction;
  return { baseWidth: side, height: (side * Math.sqrt(3)) / 2 };
}

/**
 * An upside-down (apex-down) triangle outline for a `DialWindowPointer`
 * (ASM-0069) — apex at the local origin (the end nearest the window it
 * points at), base at local `y = height` (the end farthest from it).
 */
export function createDialWindowPointerOutline(baseWidth: number, height: number): Point2D[] {
  return [
    { x: 0, y: 0 },
    { x: -baseWidth / 2, y: height },
    { x: baseWidth / 2, y: height },
  ];
}

/** Extruded upside-down-triangle mesh geometry for a `DialWindowPointer` (ASM-0069), spanning z ∈ [0, thickness], apex at the local origin. */
export function createDialWindowPointerGeometry(baseWidth: number, height: number, thickness: number): THREE.ExtrudeGeometry {
  const outline = createDialWindowPointerOutline(baseWidth, height);
  const shape = new THREE.Shape();
  outline.forEach(({ x, y }, i) => { if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
}

/**
 * How a jewel is drawn (ASM-0078, visual only, ASM-0004): a faceted ruby ring jewel instead of a
 * plain cylinder (Phase 8.15 follow-up 24, at the user's request). Proportions are fractions of
 * the jewel's outer radius.
 */
export const JEWEL_VISUALIZATION = {
  /** Radial facets around the stone — few, so the flat-shaded faces read as cut facets. */
  facetCount: 24,
  /** Bore radius (the olive hole the pivot runs in) as a fraction of the outer radius; 0 for a solid stone such as the balance's impulse pin. */
  holeRadiusFraction: 0.28,
  /** Where the flat table ends and the bevelled crown begins, as a fraction of the outer radius. */
  tableRadiusFraction: 0.74,
  /** Inner radius of the table: where the funnel into the hole starts, as a fraction of the outer radius. */
  funnelRadiusFraction: 0.5,
  /** Height of each domed crown (table to girdle), as a fraction of the outer radius, capped at a quarter of the stone's height. */
  crownHeightFraction: 0.5,
  /**
   * The crown's bevel steps between the table and the girdle (follow-up 30/31, ASM-0083/0085): each is a
   * ring at this fraction of the outer radius, this fraction of the way down the crown, so the crown is
   * cut as table, star facets, upper-girdle facets and girdle rather than one cone.
   */
  crownSteps: [
    { radiusFraction: 0.87, dropFraction: 0.3 },
    { radiusFraction: 0.95, dropFraction: 0.65 },
  ] as readonly { radiusFraction: number; dropFraction: number }[],
  /**
   * The stone's inner pavilion (follow-up 30, ASM-0083): a faceted double cone inside the stone that shows
   * through it, like a diamond's pavilion. Its facets are half as many as the outer ones so they cross
   * them. Radius at the girdle end as a fraction of the outer radius, and where it narrows to at the
   * mid-plane as a multiple of the hole radius (a solid stone narrows to a point, the culet).
   */
  coreFacetCount: 12,
  coreRadiusFraction: 0.86,
  coreMidHoleFactor: 1.12,
  /** A second, smaller pavilion nested inside the first (follow-up 31): this fraction of the first one's size, with twice the facets, turned half a facet so its edges fall between the outer cone's. */
  innerCoreScale: 0.62,
  /** Ruby red, a glossy, translucent, faintly self-lit stone with a bright clear coat. */
  color: 0xd4264f,
  emissive: 0x5a0a1c,
  emissiveIntensity: 0.4,
  roughness: 0.03,
  opacity: 0.66,
  clearcoat: 1,
  ior: 1.77,
  /** The inner pavilion's glint colour, drawn additively so it sparkles through the stone. */
  coreColor: 0xff8aa6,
  coreOpacity: 0.5,
  assumption: "ASM-0078" satisfies AssumptionId,
} as const;

/**
 * A faceted ring-jewel mesh geometry (ASM-0078): a lathe of the stone's own cross-section — flat
 * table, bevelled crown, straight girdle, and a funnel into the through hole, mirrored at both ends
 * so it reads from either side of the plate. Axis along Z, centred on the origin, `height` long;
 * `holeRadiusFraction` of 0 gives a solid stone. Use with `flatShading` so the facets show.
 */
export function createJewelGeometry(outerRadius: number, height: number, holeRadiusFraction: number = JEWEL_VISUALIZATION.holeRadiusFraction): THREE.LatheGeometry {
  const v = JEWEL_VISUALIZATION;
  const hh = height / 2;
  const crown = Math.min(outerRadius * v.crownHeightFraction, height / 4);
  const rHole = outerRadius * holeRadiusFraction;
  const rFunnel = outerRadius * v.funnelRadiusFraction;
  const rTable = outerRadius * v.tableRadiusFraction;
  const profile: THREE.Vector2[] = [];
  if (rHole > 0) profile.push(new THREE.Vector2(rHole, hh - 0.3 * crown));
  profile.push(new THREE.Vector2(rHole > 0 ? rFunnel : 0, hh));
  profile.push(new THREE.Vector2(rTable, hh));
  for (const step of v.crownSteps) profile.push(new THREE.Vector2(outerRadius * step.radiusFraction, hh - crown * step.dropFraction));
  profile.push(new THREE.Vector2(outerRadius, hh - crown));
  profile.push(new THREE.Vector2(outerRadius, -hh + crown));
  for (const step of [...v.crownSteps].reverse()) profile.push(new THREE.Vector2(outerRadius * step.radiusFraction, -hh + crown * step.dropFraction));
  profile.push(new THREE.Vector2(rTable, -hh));
  profile.push(new THREE.Vector2(rHole > 0 ? rFunnel : 0, -hh));
  if (rHole > 0) profile.push(new THREE.Vector2(rHole, -hh + 0.3 * crown));
  const geometry = new THREE.LatheGeometry(profile, v.facetCount);
  // Lathe revolves about Y; turn that axis to Z.
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/**
 * The inner pavilion of a jewel (follow-up 30, ASM-0083, visual only): a faceted double cone, wide at the
 * two girdle planes and narrowing to the hole wall (or to a point, the culet, for a solid stone) at the
 * mid-plane, so a translucent stone shows a diamond-like structure inside. Same axis and centring as
 * `createJewelGeometry`; half as many facets on the outer cone, so they cross the stone's, plus a smaller nested
 * cone with twice the facets (follow-up 31). Flat-shaded.
 */
export function createJewelCoreGeometry(outerRadius: number, height: number, holeRadiusFraction: number = JEWEL_VISUALIZATION.holeRadiusFraction): THREE.BufferGeometry {
  const v = JEWEL_VISUALIZATION;
  const crown = Math.min(outerRadius * v.crownHeightFraction, height / 4);
  const yGirdle = height / 2 - crown;
  const rMid = outerRadius * holeRadiusFraction * v.coreMidHoleFactor;
  const rEdge = outerRadius * v.coreRadiusFraction;
  // Outer pavilion: a double cone with a slight knee, so each facet is two planes (a bent facet) rather than one.
  const knee = 0.5;
  const kneeRadius = rMid + (rEdge - rMid) * 0.62;
  const outerProfile = [
    new THREE.Vector2(rEdge, yGirdle), new THREE.Vector2(kneeRadius, yGirdle * knee), new THREE.Vector2(rMid, 0),
    new THREE.Vector2(kneeRadius, -yGirdle * knee), new THREE.Vector2(rEdge, -yGirdle),
  ];
  const outer = new THREE.LatheGeometry(outerProfile, v.coreFacetCount);
  // Inner pavilion: nested, smaller, twice the facets, turned half a facet so its edges fall between the outer cone's.
  const inner = new THREE.LatheGeometry(
    [new THREE.Vector2(rEdge * v.innerCoreScale, yGirdle * v.innerCoreScale), new THREE.Vector2(rMid * v.innerCoreScale, 0), new THREE.Vector2(rEdge * v.innerCoreScale, -yGirdle * v.innerCoreScale)],
    v.coreFacetCount * 2,
  );
  inner.rotateY(Math.PI / (v.coreFacetCount * 2));
  const merged = mergeGeometries([outer, inner], false);
  outer.dispose();
  inner.dispose();
  merged.rotateX(Math.PI / 2);
  return merged;
}

/**
 * Printed furniture around a dial window (ASM-0074, visual only, ASM-0004): a thin
 * dark bezel frame hugging the window's edge, and a short caption just below it.
 * Sized as fractions of the DIAL's own radius — the same derivation convention the
 * hour markers and the pointer (`DIAL_WINDOW_POINTER_VISUALIZATION`) use.
 */
export const DIAL_WINDOW_PRINT_VISUALIZATION = {
  /** Bezel width (how far it extends outward from the window's edge) as a fraction of the dial radius. */
  bezelWidthFraction: 0.005,
  /** Caption text height as a fraction of the dial radius. */
  captionHeightFraction: 0.036,
  /** Gap between the window's (or its bezel's) outer edge and the caption's top, as a fraction of the dial radius. */
  captionGapFraction: 0.012,
  captionColor: "#1a1e22",
  /** Canvas height in px the caption is rasterised at (width follows the text's own measured width). */
  captionTexturePx: 128,
  assumption: "ASM-0074" satisfies AssumptionId,
} as const;

/** The window shapes a bezel can frame (a plain-data mirror of the domain outline, so this module stays domain-free). */
export type DialWindowFrameOutline =
  | { readonly kind: "CIRCLE"; readonly radius: number }
  | { readonly kind: "RECTANGLE"; readonly width: number; readonly height: number };

/**
 * Extruded frame hugging a window's own outline from the outside (ASM-0074): the outline
 * grown by `bezelWidth` on every side, with the window's own shape cut out of the middle,
 * spanning z ∈ [0, thickness]. Centred on the local origin.
 */
export function createDialWindowBezelGeometry(outline: DialWindowFrameOutline, bezelWidth: number, thickness: number): THREE.ExtrudeGeometry {
  const outer = new THREE.Shape();
  const inner = new THREE.Path();
  if (outline.kind === "CIRCLE") {
    outer.absarc(0, 0, outline.radius + bezelWidth, 0, Math.PI * 2, false);
    inner.absarc(0, 0, outline.radius, 0, Math.PI * 2, true);
  } else {
    const hw = outline.width / 2;
    const hh = outline.height / 2;
    outer.moveTo(-hw - bezelWidth, -hh - bezelWidth);
    outer.lineTo(hw + bezelWidth, -hh - bezelWidth);
    outer.lineTo(hw + bezelWidth, hh + bezelWidth);
    outer.lineTo(-hw - bezelWidth, hh + bezelWidth);
    outer.closePath();
    inner.moveTo(-hw, -hh);
    inner.lineTo(-hw, hh);
    inner.lineTo(hw, hh);
    inner.lineTo(hw, -hh);
    inner.closePath();
  }
  outer.holes.push(inner);
  return new THREE.ExtrudeGeometry(outer, { depth: thickness, bevelEnabled: false, curveSegments: 48 });
}

/**
 * Where a window's caption sits, relative to the window's own centre, in the dial plane
 * (ASM-0074): centred under the window, its top `captionGap` below the window's (bezel's)
 * southern edge. `southExtent` is the window's own half-height (a rectangle) or radius (a
 * circle), `bezelWidth` how far a bezel adds to it (0 for none).
 */
export function dialWindowCaptionOffset(southExtent: number, bezelWidth: number, captionGap: number, captionHeight: number): { x: number; y: number } {
  return { x: 0, y: -(southExtent + bezelWidth + captionGap + captionHeight / 2) };
}

/**
 * A transparent-background caption texture for a dial window (ASM-0074), or null where no
 * canvas exists. The texture is drawn at a fixed pixel height; `aspect` (width / height) lets
 * the caller size a plane to the dial's own scale.
 */
export function createDialWindowCaptionTexture(text: string, color: string = DIAL_WINDOW_PRINT_VISUALIZATION.captionColor): { texture: THREE.CanvasTexture; aspect: number } | null {
  const v = DIAL_WINDOW_PRINT_VISUALIZATION;
  const height = v.captionTexturePx;
  const fontPx = Math.round(height * 0.78);
  const probe = document.createElement("canvas").getContext("2d");
  if (probe === null) return null;
  probe.font = `bold ${String(fontPx)}px sans-serif`;
  const padding = Math.round(height * 0.2);
  const width = Math.max(height, Math.ceil(probe.measureText(text).width) + 2 * padding);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return null;
  ctx.font = `bold ${String(fontPx)}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return { texture, aspect: width / height };
}

/** The four lunar phases a moon-phase window's fixed marks name (ASM-0072). */
export type MoonPhaseMarkKind = "NEW" | "FIRST_QUARTER" | "FULL" | "LAST_QUARTER";

export interface MoonPhaseMark {
  readonly kind: MoonPhaseMarkKind;
  /** World angle (radians, [0, 2π), CCW from +X seen from +Z) from the window centre at which a moon image sits at this phase. */
  readonly worldAngle: number;
}

/**
 * Where a moon image sits, around its window, at each of the four principal
 * phases (ASM-0072). `moonPhaseFraction` (`src/kinematics/moonPhase.ts`) runs
 * 0 → 1 as an image advances by one image-spacing (2π / n) of the disc, and
 * `moonImageLocalAngle` puts an image straight under the window's own fixed
 * world angle (`windowWorldAngleRadians`, north) at fraction 0.5. So at phase
 * fraction `f` an image sits at `windowWorldAngle + (2π / n)(f − 0.5)`, and —
 * the n images being evenly spaced — one more at every further 2π / n. New moon
 * (f = 0) sits half a spacing before full, first quarter (f = 0.25) a quarter
 * before, last quarter (f = 0.75) a quarter after; for the usual two-image disc
 * (spacing 180°) that is full at north and south, new at east and west, and the
 * quarters on the diagonals. Pure geometry, no canvas/DOM.
 */
export function moonPhaseMarks(imageCount: number): MoonPhaseMark[] {
  if (!(Number.isInteger(imageCount) && imageCount > 0)) return [];
  const spacing = (2 * Math.PI) / imageCount;
  const phases: readonly (readonly [MoonPhaseMarkKind, number])[] = [
    ["NEW", 0],
    ["FIRST_QUARTER", 0.25],
    ["FULL", 0.5],
    ["LAST_QUARTER", 0.75],
  ];
  const marks: MoonPhaseMark[] = [];
  for (const [kind, fraction] of phases) {
    for (let j = 0; j < imageCount; j += 1) {
      const angle = MOON_PHASE_VISUALIZATION.windowWorldAngleRadians + spacing * (fraction - 0.5 + j);
      marks.push({ kind, worldAngle: ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) });
    }
  }
  return marks;
}

/**
 * Sizing of the moon-phase marks (ASM-0072, visual only, ASM-0004): each mark's
 * icon radius and how far out from the window it sits are fractions of the
 * dial's own radius, the same derivation convention `DIAL_WINDOW_POINTER_
 * VISUALIZATION` and the hour markers use.
 */
export const MOON_PHASE_MARK_VISUALIZATION = {
  /** Icon radius as a fraction of the dial's own radius. */
  iconRadiusFraction: 0.018,
  /** Inner radius of an unlit ring, as a fraction of the icon radius. */
  ringInnerFraction: 0.68,
  /** Gap between the window's own edge and the icon's own nearest edge, as a fraction of the dial's own radius. */
  gapFraction: 0.012,
  /**
   * Which side of a quarter icon is lit: +1 puts it on world +X (screen-LEFT when viewed from the dial side, whose
   * camera looks along +Z), −1 on world −X. Southern Hemisphere (declared user context): the waxing first quarter is
   * lit on the left, the waning last quarter on the right — the reverse of the Northern Hemisphere convention.
   */
  firstQuarterLitSide: 1 as 1 | -1,
  assumption: "ASM-0072" satisfies AssumptionId,
} as const;

/**
 * Extruded geometry for one lunar-phase icon (ASM-0072), centred on the local
 * origin, spanning z ∈ [0, thickness]: NEW an unlit ring, FULL a filled disc,
 * and each quarter a ring with its lit half filled. `litSide` is +1/−1 (world
 * +X / −X) and only matters for the quarters.
 */
export function createMoonPhaseMarkGeometry(kind: MoonPhaseMarkKind, radius: number, thickness: number, litSide: 1 | -1): THREE.ExtrudeGeometry {
  const segments = 32;
  const inner = radius * MOON_PHASE_MARK_VISUALIZATION.ringInnerFraction;
  const shapes: THREE.Shape[] = [];
  if (kind === "FULL") {
    const disc = new THREE.Shape();
    disc.absarc(0, 0, radius, 0, Math.PI * 2, false);
    shapes.push(disc);
  } else {
    const ring = new THREE.Shape();
    ring.absarc(0, 0, radius, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    ring.holes.push(hole);
    shapes.push(ring);
    if (kind !== "NEW") {
      // The lit half-disc, a hair inside the ring so the two read as one icon.
      const half = new THREE.Shape();
      const start = litSide === 1 ? -Math.PI / 2 : Math.PI / 2;
      half.absarc(0, 0, inner, start, start + Math.PI, false);
      half.closePath();
      shapes.push(half);
    }
  }
  return new THREE.ExtrudeGeometry(shapes, { depth: thickness, bevelEnabled: false, curveSegments: segments });
}

/**
 * A cylinder with a ridge pattern around its rim (ASM-0076, visual only, ASM-0004): the
 * cross-section is a circle of `radius` whose edge is cut by `ridgeCount` rounded grooves, each
 * `depthFraction` of the radius deep (ridge crests at the full radius). Its axis runs along local
 * +X, centred on the origin, `length` long — the orientation the stem's crown needs.
 */
export function createFlutedCylinderGeometry(radius: number, length: number, ridgeCount: number, depthFraction: number): THREE.ExtrudeGeometry {
  const stepsPerRidge = 6;
  const total = ridgeCount * stepsPerRidge;
  const shape = new THREE.Shape();
  for (let i = 0; i < total; i += 1) {
    const angle = (2 * Math.PI * i) / total;
    // 0 at a ridge crest, 1 at the bottom of a groove, smooth between.
    const groove = (1 - Math.cos(ridgeCount * angle)) / 2;
    const r = radius * (1 - depthFraction * groove);
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  geometry.translate(0, 0, -length / 2);
  // Extrusion runs along local Z; turn it to run along X (z → x).
  geometry.rotateY(Math.PI / 2);
  return geometry;
}

type HandKind = keyof Omit<typeof HAND_VISUALIZATION, "thicknessMetres" | "assumption">;

/**
 * 2D outline of a hand's blade (not the hub hole), pointing +Y from the axis (ASM-0016, visual): a
 * straight tapered blade with a short tail past the pivot. The hour and minute hands end in a point;
 * the seconds hand keeps a narrow flat tip (follow-up 31: plain hands again, replacing the
 * thunderbolts of ASM-0083).
 */
export function generateHandOutline(hand: HandKind): Point2D[] {
  const { lengthMetres: l, widthMetres: w } = HAND_VISUALIZATION[hand];
  const tail = l * 0.18;
  if (hand === "HOURS" || hand === "MINUTES") {
    const shoulder = l * 0.9;
    return [
      { x: -w / 2, y: -tail },
      { x: w / 2, y: -tail },
      { x: w * 0.3, y: shoulder },
      { x: 0, y: l },
      { x: -w * 0.3, y: shoulder },
    ];
  }
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

/** A circular hole punched through a frame slab, in the same movement-plan (x, y) coordinates as the frame's own `outline` (ASM-0056: bearing and screw clearance holes). */
export interface FrameHole {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Slab geometry spanning z ∈ [0, thickness]; position it at the frame's zBottom. */
export function createFrameGeometry(outline: Outline, thickness: number, holes: readonly FrameHole[] = []): THREE.ExtrudeGeometry {
  const shape = outlineShape(outline);
  for (const hole of holes) {
    if (!Number.isFinite(hole.x) || !Number.isFinite(hole.y) || !Number.isFinite(hole.radius) || hole.radius <= 0) continue;
    const path = new THREE.Path();
    path.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, true);
    shape.holes.push(path);
  }
  return new THREE.ExtrudeGeometry(shape, {
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
 * Cylinder along local X, centred at the local origin: the
 * horizontal-axis counterpart to `createZCylinder`, for a part whose
 * own rotation axis lies in the mainplate plane rather than
 * perpendicular to it (ASM-0019's own exception to ASM-0006, used by
 * `src/viewport/keylessMeshes.ts`'s own stem rod/crown — `rod.geometry.
 * rotateZ(Math.PI / 2)` — and by `YEAR_DIGIT_BARREL_VISUALIZATION`,
 * Phase 8.15, whose own doc comment derives the UV-angle relationship
 * this rotation produces).
 */
export function createXAxisCylinder(radius: number, length: number, segments = 24): THREE.CylinderGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments);
  geometry.rotateZ(Math.PI / 2);
  return geometry;
}

/**
 * Gives a dial's geometry UVs that cover its face the way a dial is read (follow-up 50, ASM-0094): `u` runs 0 to 1
 * across the diameter towards the right as seen from the dial side (world −X, the dial being read from its −Z side),
 * `v` 0 to 1 towards its top (world +Y), from the geometry's own x and y about the dial's centre. A dial texture
 * is laid over the face with these, so a picture reads the right way up and a pattern is the same at any dial size.
 */
export function setDialPlanarUv(geometry: THREE.BufferGeometry, radius: number): void {
  const position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    uv[i * 2] = 0.5 - position.getX(i) / (2 * radius);
    uv[i * 2 + 1] = 0.5 + position.getY(i) / (2 * radius);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/**
 * Splits a dial's triangles into two material groups (follow-up 51, ASM-0094): group 0 is the face the dial is read
 * from (triangles facing −Z, the dial being read from its −Z side), group 1 everything else (the back, the rim and
 * the walls of its window cutouts). The surface texture goes on group 0 only, so a dial's sides and back stay
 * smooth. Returns a new non-indexed geometry with the triangles reordered, front first; positions, normals and UVs
 * are carried over unchanged.
 */
export function withDialFaceGroups(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = source.index === null ? source : source.toNonIndexed();
  const names = Object.keys(flat.attributes);
  const position = flat.getAttribute("position");
  const triangles = position.count / 3;
  const front: number[] = [];
  const rest: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < triangles; t += 1) {
    a.fromBufferAttribute(position, t * 3);
    b.fromBufferAttribute(position, t * 3 + 1);
    c.fromBufferAttribute(position, t * 3 + 2);
    const normal = b.sub(a).cross(c.sub(a)).normalize();
    (normal.z < -0.5 ? front : rest).push(t);
  }
  const order = [...front, ...rest];
  const result = new THREE.BufferGeometry();
  for (const name of names) {
    const attribute = flat.getAttribute(name);
    const size = attribute.itemSize;
    const data = new Float32Array(order.length * 3 * size);
    order.forEach((t, k) => {
      for (let v = 0; v < 3; v += 1) for (let s = 0; s < size; s += 1) data[(k * 3 + v) * size + s] = attribute.array[(t * 3 + v) * size + s] ?? 0;
    });
    result.setAttribute(name, new THREE.BufferAttribute(data, size));
  }
  result.addGroup(0, front.length * 3, 0);
  result.addGroup(front.length * 3, rest.length * 3, 1);
  return result;
}

/** A `DialWindow`'s own cutout, already in the disc's local frame (see `createDiscWithHolesGeometry`). */
export type DiscHole =
  | { kind: "CIRCLE"; x: number; y: number; radius: number }
  | { kind: "RECTANGLE"; x: number; y: number; width: number; height: number };

function isValidHole(hole: DiscHole): boolean {
  if (!(Number.isFinite(hole.x) && Number.isFinite(hole.y))) return false;
  return hole.kind === "CIRCLE"
    ? Number.isFinite(hole.radius) && hole.radius > 0
    : Number.isFinite(hole.width) && hole.width > 0 && Number.isFinite(hole.height) && hole.height > 0;
}

/**
 * A disc's outer circle with zero or more holes punched through it
 * (ASM-0051, `DialWindow`) — depth spans z ∈ [0, thickness]; position the
 * mesh at the disc's own zLo afterward, same convention as
 * `createFrameGeometry`. Hole centres are in the same local frame as
 * `radius` (i.e. already relative to the disc's own centre, not
 * movement-plan coordinates — the caller subtracts the disc's own centre
 * first).
 */
export function createDiscWithHolesGeometry(radius: number, thickness: number, holes: readonly DiscHole[]): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  for (const hole of holes) {
    if (!isValidHole(hole)) continue;
    const path = new THREE.Path();
    if (hole.kind === "CIRCLE") {
      path.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, true);
    } else {
      const hw = hole.width / 2;
      const hh = hole.height / 2;
      path.moveTo(hole.x - hw, hole.y - hh);
      path.lineTo(hole.x - hw, hole.y + hh);
      path.lineTo(hole.x + hw, hole.y + hh);
      path.lineTo(hole.x + hw, hole.y - hh);
      path.closePath();
    }
    shape.holes.push(path);
  }
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 64 });
}

/**
 * Position labels painted radially around a disc's rim, for a disc
 * complication's own dial-facing face (ASM-0051) — generated once from
 * the domain model's own declared position count, not re-synchronised
 * per frame: baked onto the rotating disc, the existing kinematic
 * rotation (ASM-0048/0049/0050) carries the right label past a window on
 * its own, the same way a real printed date/month/year ring works. Each
 * label is oriented radially (its own "up" pointing away from the
 * centre), a standard, legible convention for ring-printed numerals —
 * visual only (ASM-0012-style placeholder, no manufacturing claim).
 */
export const DIAL_WINDOW_VISUALIZATION = {
  textureSizePx: 512,
  labelRadiusFraction: 0.72,
  /**
   * Where the date and month wheels' own label rings sit (Phase 8.15 follow-up 19, at the user's
   * request: "move the date numbers and months text closer to the edge of their respective
   * wheels"), as a fraction of the wheel's own radius. Labels extend only a few hundredths of the
   * radius either side of their ring, so 0.86 keeps the outer edge of the text clear of the rim
   * (checked live). The leap-year ring keeps `labelRadiusFraction`: its Geneva slots cut in from
   * the rim.
   */
  edgeLabelRadiusFraction: 0.86,
  /**
   * The BASE font size: used as-is for a low-density ring (4 positions —
   * leap-year, season), and as the starting point `discLabelFittedFontSizePx`
   * scales DOWN from for a denser one (31-position date, 12-position
   * month), never up. See that function's own doc comment.
   */
  fontSizePx: 105,
  /**
   * The fraction of a label's own available circumferential slot
   * (`discLabelSlotArcLengthPx`) its glyph width may fill, leaving a
   * visible gap either side — the same "comfortable, clearly
   * non-touching gap" standard `YEAR_DIGIT_BARREL_VISUALIZATION.fontSizePx`
   * was independently tuned to (Phase 8.15 follow-up 3: 105px there gave
   * an 11-run, ~28px-gap result judged comfortable, out of a 102.4px
   * slot — a ratio of ≈0.73).
   */
  labelFillFraction: 0.75,
  /** A defensive floor only: no real label set here needs it (the densest real case, 31-position date, fits at ≈26px); guards a pathological future configuration from scaling to an unreadable or non-positive size. */
  minFontSizePx: 16,
  textColor: "#1a1e22",
  /**
   * An opaque fill behind the glyphs. `MeshStandardMaterial.map` is not
   * alpha-blended unless the material is also marked `transparent`, so an
   * unpainted (fully transparent) canvas pixel still contributes its RGB
   * — black — to the lit result; left unfilled, that multiplies almost
   * the entire disc toward black instead of leaving it the complication's
   * own base colour, with only the glyphs reading dark. A light,
   * near-white fill keeps the rest of the disc at its own colour (white
   * multiplies as a no-op) and gives `textColor` real contrast, the same
   * way a real printed numeral sits on bare metal.
   */
  backgroundColor: "#eee8da",
  assumption: "ASM-0051" satisfies AssumptionId,
} as const;

/**
 * Real bug (ASM-0068), reported live: a date/month/season window
 * consistently showed a label diametrically OPPOSITE the disc's own
 * currently-indicated position — month's window read "Jul" while
 * `MonthComplication`'s own `starPosition`-derived "Current position"
 * reported "January" (exactly 6 of 12 months, a half turn, apart);
 * season's equivalent pointer read "WI" (Winter) against a true "SU"
 * (Summer) — exactly 2 of 4 quarters, again a half turn. Root cause,
 * derived from `discCapCanvasAngleForMeshAngle`'s own verified reflection
 * (`canvas angle θ → mesh angle −π/2 − θ`, not a rotation) and
 * `windowAbove`'s own "+Y = north = current reading position"
 * convention (`src/app/teachingMovement.ts`): label `i`, drawn at
 * `discLabelPlacements`' own default canvas angle `(i/n)·2π` (no
 * correction), lands — once `shaftAngle = i·(2π/n)` is applied, the
 * angle at which label `i` IS the disc's own logically current one — at
 * world angle `(−π/2 − (i/n)·2π) + i·(2π/n) = −π/2` (south), not the
 * window's own `+π/2` (north): the two `(i/n)·2π` terms cancel
 * algebraically regardless of `i`, leaving a constant, label-independent
 * `π` (half-turn) gap between where the window sits and where the
 * logically-current label actually lands — exactly the discrepancy
 * found live, for any `i`. (Fully correct alignment never depended on
 * `i`, so this went unnoticed: `createDiscLabelTexture`'s own doc
 * comment previously reasoned "a label only needs to pass under *some*
 * fixed window at *roughly* even intervals" — true for a PLAUSIBLE
 * reading, but not a CORRECT one against the domain's own reported
 * index.)
 *
 * `discLabelPlacements`'/`createDiscLabelTexture`'s own default
 * `canvasAngleOffset` (0) is left unchanged — a pure geometry function
 * should not silently bake in a specific window's own placement
 * assumption — so each caller that wants its currently-indicated label
 * to land at a north-positioned window passes this constant explicitly,
 * the same "declared, not implicit" convention the leap-year wheel's own
 * slot-avoidance offset already follows. Does NOT apply to the leap-year
 * wheel (whose own offset is independently derived to dodge its real
 * Geneva slot cutouts, a different and unrelated constraint) or to
 * moon-phase (no discrete labels at all, synced instead via
 * `moonImageLocalAngle`).
 *
 * NOTE (ASM-0071): the claim above that the two `(i/n)·2π` terms cancel
 * "regardless of `i`" was wrong in sign and only ever checked at `i = 0`;
 * this constant fixes the half-turn at position 0 only. The per-position
 * direction is `DISC_LABEL_RING_DIRECTION`, below.
 */
export const DISC_LABEL_CURRENT_AT_NORTH_OFFSET_RADIANS = -Math.PI;

/**
 * Real bug (ASM-0071), reported live after "Set to browser time" first put
 * a calendar wheel on a non-zero position (it reads October, the 20th): the
 * window's own DOM "Currently shows" said October while the wheel's own
 * north label read April (month), "4" against "Year 2" (leap-year) and "AU"
 * against Spring (season) — always the label `−i` for a true position `i`.
 * Every earlier live check (and the half-turn derivation above) was made at
 * position 0 only, where `i = −i`, so a ring laid out in the wrong DIRECTION
 * could not show. Measured on the real render: the canvas angle sitting at
 * the window's north DEcreases by one slot (2π/n) per position as the disc
 * advances, so for label `i` to be the one at north when the position is `i`
 * the ring must be laid out the opposite way round — label `k` at canvas
 * angle `−(k/n)·2π + offset`. The direction is applied here, in one named
 * constant, to every label ring (`discLabelPlacements`, `createSeasonTexture`).
 * Consequence, a real mechanical fact and not a styling choice: as the disc
 * advances one step the next label arrives at the window, so the labels run
 * counter-clockwise as seen from the dial side.
 */
export const DISC_LABEL_RING_DIRECTION = -1;

export interface DiscLabelPlacement {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  /** Rotation to apply before drawing, so the label's own "up" points away from the disc centre. */
  readonly rotation: number;
}

/**
 * The pure layout math behind {@link createDiscLabelTexture}, split out so
 * it can be unit tested without a DOM `canvas` (this project's test
 * environment has none) — evenly spaced around the rim at
 * `labelRadiusFraction`, each oriented radially per ASM-0051's own doc
 * comment above.
 *
 * `canvasAngleOffset` rotates the whole ring in canvas-drawing space
 * (added to each label's own `(i / n) · 2π` angle), default 0 — the
 * date/month discs never pass it, so their own layout is unchanged.
 * `createGenevaWheelGeometry`'s own rim slots (ASM-0050) cut the leap-year
 * wheel's material away in four angular bands; left at the default ring
 * phase, those bands land exactly under each label (`baseAngle` and the
 * `(i / n) · 2π` label phase both start at angle 0, and the reflection
 * `discCapCanvasAngleForMeshAngle` is its own inverse on a 4-fold-symmetric
 * set — see that function's own doc comment — so it maps the label set
 * onto itself rather than off of it), so every label is drawn onto
 * material that the slot cutting already removed — invisible regardless of
 * the texture's own content. The viewport passes a `baseAngle`-derived
 * offset there (half a slot's own spacing) to centre each label between
 * two slots instead.
 */
export function discLabelPlacements(labels: readonly string[], canvasAngleOffset = 0, labelRadiusFraction: number = DIAL_WINDOW_VISUALIZATION.labelRadiusFraction): DiscLabelPlacement[] {
  const v = DIAL_WINDOW_VISUALIZATION;
  const centre = v.textureSizePx / 2;
  const labelRadius = centre * labelRadiusFraction;
  return labels.map((label, i) => {
    const angle = DISC_LABEL_RING_DIRECTION * (i / labels.length) * Math.PI * 2 + canvasAngleOffset;
    return {
      label,
      x: centre + labelRadius * Math.cos(angle),
      y: centre + labelRadius * Math.sin(angle),
      rotation: angle + Math.PI / 2,
    };
  });
}

/**
 * The circumferential space (canvas px) available to each of `labelCount`
 * evenly spaced labels around the ring `discLabelPlacements` lays out —
 * the full ring circumference (`2π × labelRadius`) divided by the count.
 * Pure geometry, no canvas/DOM dependency, so it is unit-testable the same
 * way `discLabelPlacements` already is.
 */
export function discLabelSlotArcLengthPx(labelCount: number, labelRadiusFraction: number = DIAL_WINDOW_VISUALIZATION.labelRadiusFraction): number {
  const v = DIAL_WINDOW_VISUALIZATION;
  const labelRadius = (v.textureSizePx / 2) * labelRadiusFraction;
  return (2 * Math.PI * labelRadius) / labelCount;
}

/**
 * The font size (canvas px, bold sans-serif) a disc's own label ring must
 * actually draw at so its widest label fits its own slot
 * (`discLabelSlotArcLengthPx`) with a visible gap either side — a real,
 * live bug otherwise (reported directly: "check the numbers for the date
 * gear it looks clumped up together... check the month text gear for the
 * same bug"). `DIAL_WINDOW_VISUALIZATION.fontSizePx` (105px) was tuned
 * once, apparently against the lowest-density rings (leap-year/season, 4
 * positions, 1-2 characters) and never re-checked against a denser one.
 * Measured directly against the real rendered canvas at that 105px base
 * (`ctx.measureText`, the same "verified against real pixel data"
 * standard the year-digit barrel's own font-size fix already used):
 * - date (31 numeric positions, up to 2 digits): widest label ("24") is
 *   113.4px wide, in a 37.4px slot — nearly 3× overflow.
 * - month (12 three-letter abbreviations): widest label ("May") is
 *   196.9px wide, in a 96.5px slot — roughly 2× overflow.
 * - leap-year/season (4 positions, 1-2 characters): widest label ("WI")
 *   measures only 57-144px against a 289.5px slot — comfortably under,
 *   confirming the 105px base was never actually wrong for THOSE rings.
 *
 * Rather than hand-tune a second constant per complication (which would
 * silently drift out of sync again the next time a label set changes —
 * e.g. `starToothCount`), this scales the base font size down only as
 * far as the real measured glyph width demands, leaving
 * `DIAL_WINDOW_VISUALIZATION.labelFillFraction` (0.75) of the slot as
 * the glyph's own target width; low-density rings clamp at `scale = 1`
 * (unchanged). `maxLabelWidthAtBaseFontPx` must be measured by the
 * caller (`createDiscLabelTexture`, the only place with a real canvas
 * context to call `ctx.measureText` on — this function itself stays
 * pure/DOM-free so it can be unit tested directly).
 */
export function discLabelFittedFontSizePx(maxLabelWidthAtBaseFontPx: number, labelCount: number, labelRadiusFraction: number = DIAL_WINDOW_VISUALIZATION.labelRadiusFraction): number {
  const v = DIAL_WINDOW_VISUALIZATION;
  if (!(maxLabelWidthAtBaseFontPx > 0) || !(labelCount > 0)) return v.fontSizePx;
  const slotArc = discLabelSlotArcLengthPx(labelCount, labelRadiusFraction);
  const scale = Math.min(1, (slotArc * v.labelFillFraction) / maxLabelWidthAtBaseFontPx);
  return Math.max(v.minFontSizePx, v.fontSizePx * scale);
}

/**
 * Colours the user has chosen for what is painted on a wheel's face (follow-up 39, ASM-0090): `background` is the
 * disc face itself and `text` the labels, digits or icons printed on it. Either left out is the built-in colour.
 */
export interface DiscInk {
  background?: string;
  text?: string;
}

export function createDiscLabelTexture(labels: readonly string[], canvasAngleOffset = 0, labelRadiusFraction: number = DIAL_WINDOW_VISUALIZATION.labelRadiusFraction, ink: DiscInk = {}): THREE.CanvasTexture | null {
  if (labels.length === 0) return null;
  const v = DIAL_WINDOW_VISUALIZATION;
  const canvas = document.createElement("canvas");
  canvas.width = v.textureSizePx;
  canvas.height = v.textureSizePx;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return null;
  ctx.fillStyle = ink.background ?? v.backgroundColor;
  ctx.fillRect(0, 0, v.textureSizePx, v.textureSizePx);
  ctx.fillStyle = ink.text ?? v.textColor;
  ctx.font = `bold ${String(v.fontSizePx)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxLabelWidthAtBaseFontPx = Math.max(
    ...labels.map((label) => {
      const m = ctx.measureText(label);
      return m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    }),
  );
  const fittedFontSizePx = discLabelFittedFontSizePx(maxLabelWidthAtBaseFontPx, labels.length, labelRadiusFraction);
  ctx.font = `bold ${String(fittedFontSizePx)}px sans-serif`;
  for (const placement of discLabelPlacements(labels, canvasAngleOffset, labelRadiusFraction)) {
    ctx.save();
    ctx.translate(placement.x, placement.y);
    ctx.rotate(placement.rotation);
    ctx.fillText(placement.label, 0, 0);
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * The season wheel's own quadrant art (ASM-0058): four equal wedges, each
 * tinted and carrying a simple seasonal icon plus its own position label,
 * requested directly by the user ("cut the gear into 4 equal pieces and
 * add some art representing each season in their respective quarter").
 * Purely decorative (ASM-0004) — generic sun/leaf/snowflake/flower glyphs,
 * not sourced from any real watch's own dial art (no four-seasons
 * indicator with this specific iconography has been found), the same
 * "declared, not invented" visual treatment the moon-phase illustration
 * (ASM-0055) and disc label ring (ASM-0051) already have. Index-matched
 * to `SEASON_LABELS`' own fixed Q1–Q4 order (Summer/Autumn/Winter/Spring,
 * ASM-0057, the user's own declared Southern Hemisphere convention) —
 * this function is specific to the season wheel, not a generic N-wedge
 * drawer, the same way `createMoonPhaseTexture` is specific to moon phase.
 */
export const SEASON_VISUALIZATION = {
  /** Wedge background tints, index-matched to SEASON_LABELS (Summer/Autumn/Winter/Spring) — declared colour choices, not a real dial's own enamel or print. */
  wedgeColors: ["#f3cf6b", "#d98b4a", "#cfe3ee", "#bfe0a8"] as const,
  iconColor: "#2a2a2a",
  iconRadiusFraction: 0.44,
  labelRadiusFraction: 0.82,
  fontSizePx: 105,
  dividerColor: "#4a4642",
  dividerWidthPx: 4,
  assumption: "ASM-0058" satisfies AssumptionId,
} as const;

/**
 * The canvas angle of each boundary between adjacent season wedges,
 * offset by half a wedge's own angular width from the first wedge's own
 * centre (angle 0) — so each wedge is centred on its own label rather
 * than straddling two of them, the same half-slot-offset convention
 * `createGenevaWheelGeometry`'s own rim slots already use relative to the
 * disc label ring (see `discLabelPlacements`'s own doc comment). Split
 * out, like `discLabelPlacements`, so it can be unit tested without a DOM
 * canvas.
 */
export function seasonWedgeBoundaryAngles(count: number): number[] {
  const step = (Math.PI * 2) / count;
  return Array.from({ length: count }, (_, i) => i * step + step / 2);
}

function drawSunIcon(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  const r = size * 0.32;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.07;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  const rayInner = r * 1.35;
  const rayOuter = r * 2.1;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(rayInner * Math.cos(a), rayInner * Math.sin(a));
    ctx.lineTo(rayOuter * Math.cos(a), rayOuter * Math.sin(a));
    ctx.stroke();
  }
}

function drawLeafIcon(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  const h = size * 0.85;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.bezierCurveTo(h * 0.45, -h * 0.2, h * 0.45, h * 0.2, 0, h / 2);
  ctx.bezierCurveTo(-h * 0.45, h * 0.2, -h * 0.45, -h * 0.2, 0, -h / 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = size * 0.035;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.42);
  ctx.lineTo(0, h * 0.42);
  ctx.stroke();
}

function drawSnowflakeIcon(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  const r = size * 0.42;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.06;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(-r * dx, -r * dy);
    ctx.lineTo(r * dx, r * dy);
    ctx.stroke();
    for (const sign of [-1, 1] as const) {
      const tipX = r * dx * sign;
      const tipY = r * dy * sign;
      for (const branchSign of [-1, 1] as const) {
        const branchAngle = a + (branchSign * Math.PI) / 4;
        const branch = r * 0.4;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - sign * branch * Math.cos(branchAngle), tipY - sign * branch * Math.sin(branchAngle));
        ctx.stroke();
      }
    }
  }
}

function drawFlowerIcon(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  const petalRadius = size * 0.18;
  const orbit = size * 0.22;
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(orbit * Math.cos(a), orbit * Math.sin(a), petalRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#fffdf5";
  ctx.beginPath();
  ctx.arc(0, 0, petalRadius * 0.75, 0, Math.PI * 2);
  ctx.fill();
}

/** Index-matched to `SEASON_LABELS` (Summer/Autumn/Winter/Spring, ASM-0057). */
const SEASON_ICON_DRAWERS: readonly ((ctx: CanvasRenderingContext2D, size: number, color: string) => void)[] = [
  drawSunIcon,
  drawLeafIcon,
  drawSnowflakeIcon,
  drawFlowerIcon,
];

export function createSeasonTexture(labels: readonly string[], canvasAngleOffset = 0, ink: DiscInk = {}): THREE.CanvasTexture | null {
  if (labels.length === 0) return null;
  const v = SEASON_VISUALIZATION;
  const size = DIAL_WINDOW_VISUALIZATION.textureSizePx;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return null;
  const centre = size / 2;
  const outerRadius = centre;

  // Four equal wedges (ASM-0058), cutting the disc as requested; dividers sit at the
  // half-slot-offset boundary between adjacent labels, same convention as the Geneva wheel's own
  // rim slots relative to its labels. `canvasAngleOffset` (default 0, same convention as
  // `discLabelPlacements`) rotates the whole wedge ring in canvas-drawing space — the caller
  // passes `DISC_LABEL_CURRENT_AT_NORTH_OFFSET_RADIANS` (ASM-0068) so the currently-indicated
  // quarter actually lands at the dial window's own north-positioned pointer, not diametrically
  // opposite it.
  const boundaries = seasonWedgeBoundaryAngles(labels.length).map((a) => a + canvasAngleOffset);
  // Wedge `i` is centred on its own label's angle (laid out in `DISC_LABEL_RING_DIRECTION`, ASM-0071)
  // and spans half a slot either side of it; the boundary SET is the same either way round.
  const halfSlot = Math.PI / labels.length;
  for (let i = 0; i < labels.length; i += 1) {
    const centreAngle = DISC_LABEL_RING_DIRECTION * (i / labels.length) * Math.PI * 2 + canvasAngleOffset;
    const start = centreAngle - halfSlot;
    const end = centreAngle + halfSlot;
    ctx.fillStyle = ink.background ?? v.wedgeColors[i % v.wedgeColors.length] ?? DIAL_WINDOW_VISUALIZATION.backgroundColor;
    ctx.beginPath();
    ctx.moveTo(centre, centre);
    ctx.arc(centre, centre, outerRadius, start, end);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = v.dividerColor;
  ctx.lineWidth = v.dividerWidthPx;
  for (const boundary of boundaries) {
    ctx.beginPath();
    ctx.moveTo(centre, centre);
    ctx.lineTo(centre + outerRadius * Math.cos(boundary), centre + outerRadius * Math.sin(boundary));
    ctx.stroke();
  }

  // One simple icon plus the position label per wedge, both oriented radially — the same "own up
  // points away from the disc centre" convention `discLabelPlacements` already uses.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${String(v.fontSizePx)}px sans-serif`;
  for (let i = 0; i < labels.length; i += 1) {
    const angle = DISC_LABEL_RING_DIRECTION * (i / labels.length) * Math.PI * 2 + canvasAngleOffset;
    const rotation = angle + Math.PI / 2;
    const draw = SEASON_ICON_DRAWERS[i % SEASON_ICON_DRAWERS.length];

    ctx.save();
    ctx.translate(centre + v.iconRadiusFraction * centre * Math.cos(angle), centre + v.iconRadiusFraction * centre * Math.sin(angle));
    ctx.rotate(rotation);
    draw?.(ctx, size * 0.11, ink.text ?? v.iconColor);
    ctx.restore();

    ctx.save();
    ctx.translate(centre + v.labelRadiusFraction * centre * Math.cos(angle), centre + v.labelRadiusFraction * centre * Math.sin(angle));
    ctx.rotate(rotation);
    ctx.fillStyle = ink.text ?? v.iconColor;
    ctx.fillText(labels[i] ?? "", 0, 0);
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * A moon-phase disc's own sky-and-moon illustration (ASM-0055, Phase
 * 8.9 follow-up). `MoonPhase` was built (Phase 8.1) with "moon/star
 * artwork is not modeled, only the disc itself" as a deliberate scope
 * cut — the kinematics (`moonPhaseFraction`, already correct and
 * tested) had nothing to show through the dial window built later
 * (Phase 8.6). SRC-0045 (a granted patent, Fig. 4) confirms the real,
 * conventional design this draws: a dark sky with one or two pale moon
 * images (`DOUBLE`, two 180° apart, the teaching movement's own
 * choice; `SINGLE`, one, per `windowsPerRevolution`).
 *
 * The phase reveal itself needs no new simulation code at all: the
 * dial window (`DialWindow`, Phase 8.6) is already a *fixed* aperture
 * offset from the disc's own rotation axis, and the disc already
 * rotates correctly (same `applyKinematicRotation()` every other
 * shaft uses) — painting a moon image at the right position and
 * letting ordinary 3D occlusion do the rest reproduces the same
 * optical trick the real mechanism's own window uses: as two circles
 * (the fixed window, the moving moon image) slide past each other,
 * their overlap traces new moon → crescent → full → crescent → new
 * moon, exactly matching `moonPhaseFraction`'s own 0↔0.5↔0 cycle.
 *
 * Getting the two circles' sizes/positions to actually produce that
 * clean reveal (full overlap at the real full-moon instant, zero
 * overlap at the real new-moon instant) is the one genuinely new piece
 * of math here — see `moonImageLocalAngle`'s own doc comment for the
 * derivation. It depends on `windowWorldAngleRadians` matching the
 * dial window's own actual position: every dial window in this
 * project is placed via `windowAbove` (`src/app/teachingMovement.ts`),
 * i.e. straight up (+Y) from its complication's own arbor — if a
 * window were ever placed elsewhere, this constant (and the teaching
 * movement's own window radius/offset, tuned to match it exactly)
 * would need to move with it.
 */
export const MOON_PHASE_VISUALIZATION = {
  /** The dial window's own fixed world angle relative to its complication's arbor — "straight up" (+Y), matching `windowAbove` (`src/app/teachingMovement.ts`). */
  windowWorldAngleRadians: Math.PI / 2,
  /** Each moon image's own centre, as a fraction of the disc's own radius. */
  moonPositionRadiusFraction: 0.4,
  /** Each moon image's own radius, as a fraction of the disc's own radius. */
  moonImageRadiusFraction: 0.25,
  skyColor: "#12223a",
  moonColor: "#f0ead9",
  starColor: "#cfd8e6",
  /**
   * The printed phase series (ASM-0073): this many evenly spaced phases
   * (new, waxing crescent, first quarter, waxing gibbous, full, waning
   * gibbous, last quarter, waning crescent) per image-spacing of the disc,
   * repeated once per moon image, replacing the two plain moon discs the
   * texture used to carry.
   */
  phasesPerImage: 8,
  /** Radius of the ring the phase icons sit on, as a fraction of the disc's own radius. */
  iconRingRadiusFraction: 0.84,
  /** Each phase icon's own radius, as a fraction of the disc's own radius. */
  iconRadiusFraction: 0.115,
  /**
   * Fixed, declared star positions (fraction of the disc's own radius,
   * angle in radians, dot radius in px at `DIAL_WINDOW_VISUALIZATION`'s
   * own texture size) — decorative only (ASM-0004), not a real star
   * chart or a claim about any actual night sky.
   */
  starPositions: [
    { radiusFraction: 0.85, angle: 0.4, sizePx: 3 },
    { radiusFraction: 0.65, angle: 1.1, sizePx: 2 },
    { radiusFraction: 0.9, angle: 2.0, sizePx: 2 },
    { radiusFraction: 0.7, angle: 2.8, sizePx: 3 },
    { radiusFraction: 0.5, angle: 3.5, sizePx: 2 },
    { radiusFraction: 0.88, angle: 4.1, sizePx: 2 },
    { radiusFraction: 0.6, angle: 4.9, sizePx: 3 },
    { radiusFraction: 0.78, angle: 5.6, sizePx: 2 },
    { radiusFraction: 0.45, angle: 6.0, sizePx: 2 },
    { radiusFraction: 0.93, angle: 1.6, sizePx: 2 },
  ] as readonly { radiusFraction: number; angle: number; sizePx: number }[],
  assumption: "ASM-0055" satisfies AssumptionId,
} as const;

/**
 * The angle (radians, in the disc's own local frame) that puts the
 * `k`-th of `n` evenly-spaced moon images exactly under the dial
 * window at that image's own full-moon instant.
 *
 * Derived from `moonPhaseFraction`'s own convention
 * (`src/kinematics/moonPhase.ts`): fraction = (turns × n) mod 1, so
 * fraction = 0.5 (full moon) at `shaftAngle = 2π(k + 0.5)/n` for each
 * `k` in `[0, n)`. A world-frame feature painted at local angle `a`
 * appears at world angle `a + shaftAngle` once the shaft group
 * rotates (the same convention `createGenevaWheelGeometry`'s own
 * `baseAngle` relies on). Setting that equal to the window's own fixed
 * world angle and solving for `a` gives this formula. For `n = 2`
 * (`DOUBLE`), this places the two images at local 0 and π — exactly
 * "two moon images 180° apart" (SRC-0045's own Fig. 4) — for any
 * `windowWorldAngleRadians`, not just the teaching movement's own
 * choice of "straight up".
 */
export function moonImageLocalAngle(k: number, n: number): number {
  return MOON_PHASE_VISUALIZATION.windowWorldAngleRadians - (2 * Math.PI * (k + 0.5)) / n;
}

/**
 * Where to draw a feature on a disc's own texture canvas so it lands at
 * a *chosen mesh-local angle* once mapped onto `createZCylinder`'s own
 * −Z (dial-facing) cap (ASM-0051's convention).
 *
 * `createDiscLabelTexture`'s own ring of labels, drawn at `centre +
 * radius·(cos θ, sin θ)`, works for date/month/leap-year because a
 * label only needs to pass under *some* fixed window at *roughly* even
 * intervals — correctness there never depended on one label landing at
 * one exact angle. The moon-phase reveal does: a moon image must align
 * with the dial window at one *exact* instant (`moonImageLocalAngle`'s
 * own derivation). Naively drawing at canvas angle θ expecting it to
 * land at mesh-local angle θ is wrong: `createZCylinder`'s own −Z-cap
 * UV formula (`u = 0.5 − y/2r`, `v = 0.5 − x/2r`, empirically derived
 * — see `reshapeCapGroupsForDiscMaterials`'s own doc comment for the
 * same formula used on the leap-year wheel) is a *reflection*, not a
 * rotation: a feature drawn at canvas angle θ actually lands at mesh
 * angle `−π/2 − θ` (verified directly against a real built disc's own
 * vertex UVs, not just algebra). Reflections are their own inverse, so
 * solving for the canvas angle that lands at a desired mesh angle `a`
 * gives the same formula back: `θ = −π/2 − a`.
 */
export function discCapCanvasAngleForMeshAngle(meshAngle: number): number {
  return -Math.PI / 2 - meshAngle;
}

/**
 * The dark-sky-and-printed-phase-series texture for a `MoonPhase` disc's own
 * dial-facing face (ASM-0055, ASM-0073: the two plain moon images it used to
 * carry were replaced by `moonPhaseIconPlacements`' phase icons) — see `MOON_PHASE_VISUALIZATION`'s own
 * doc comment for the sourcing and the reveal mechanism,
 * `moonImageLocalAngle` for where each image must sit (in true
 * mesh-local terms), and `discCapCanvasAngleForMeshAngle` for why that
 * angle must be transformed before it is usable as a canvas-drawing
 * angle.
 */
export interface MoonPhaseIconPlacement {
  /** Phase fraction 0-1 this icon shows, in `moonPhaseFraction`'s own convention (0 new, 0.5 full). */
  readonly phase: number;
  /** Canvas-drawing angle of the icon's own centre on the ring, radians. */
  readonly canvasAngle: number;
}

/**
 * Where each printed phase icon goes on a moon disc's texture (ASM-0073): one
 * series of `phasesPerImage` phases per moon image, so a `DOUBLE` disc carries
 * the whole series twice, half a turn apart.
 *
 * The icon of phase `p` must sit under the window's north reading position
 * exactly when `moonPhaseFraction` reads `p`, i.e. when the disc arbor has
 * turned `φ = 2π(p + k) / n` (any of the `n` equivalent copies `k`). Where a
 * canvas feature lands under rotation is the same disc-cap mapping every label
 * ring already depends on, and that was calibrated against the real render
 * (`DISC_LABEL_RING_DIRECTION`, ASM-0071): a label placed at canvas angle
 * `−φ + DISC_LABEL_CURRENT_AT_NORTH_OFFSET_RADIANS` reads at north when the
 * disc has turned `φ`. So the icon sits at that same angle, and its phase then
 * advances through the series in the same direction the disc turns.
 */
export function moonPhaseIconPlacements(imageCount: number): MoonPhaseIconPlacement[] {
  if (!(Number.isInteger(imageCount) && imageCount > 0)) return [];
  const perImage = MOON_PHASE_VISUALIZATION.phasesPerImage;
  const placements: MoonPhaseIconPlacement[] = [];
  for (let k = 0; k < imageCount; k += 1) {
    for (let j = 0; j < perImage; j += 1) {
      const phase = j / perImage;
      const turned = (2 * Math.PI * (phase + k)) / imageCount;
      placements.push({ phase, canvasAngle: -turned + DISC_LABEL_CURRENT_AT_NORTH_OFFSET_RADIANS });
    }
  }
  return placements;
}

/**
 * The lit part of a moon of phase fraction `phase` (0 new, 0.5 full, 1 new
 * again), as a polygon in an icon's own frame (x right, y down, unit up = −y,
 * radius `radius`) — empty for a new moon. Waxing phases (0 < phase < 0.5) are
 * lit on the LEFT, waning (0.5 < phase < 1) on the RIGHT as seen by the viewer:
 * the declared Southern Hemisphere convention (ASM-0072/0073), the reverse of
 * the Northern one.
 *
 * The lit region is bounded by the lit-side limb (a half circle) and the
 * terminator, a half ellipse whose equatorial offset is `radius·cos(2π·phase)`
 * toward the lit side (full semicircle at the quarters, bulging past the centre
 * for gibbous phases): its area fraction is the textbook illuminated fraction
 * `(1 − cos 2π·phase) / 2`.
 */
export function moonPhaseLitPolygon(phase: number, radius: number, samples = 48): Point2D[] {
  const wrapped = ((phase % 1) + 1) % 1;
  if (wrapped === 0) return [];
  const waxing = wrapped <= 0.5;
  const side = waxing ? -1 : 1; // lit-side x sign: left for waxing, right for waning
  const terminatorOffset = side * radius * Math.cos(2 * Math.PI * wrapped);
  const points: Point2D[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = -Math.PI / 2 + (Math.PI * i) / samples; // top → bottom along the lit limb
    points.push({ x: side * radius * Math.cos(t), y: radius * Math.sin(t) });
  }
  for (let i = 0; i <= samples; i += 1) {
    const t = Math.PI / 2 - (Math.PI * i) / samples; // bottom → top along the terminator
    points.push({ x: terminatorOffset * Math.cos(t), y: radius * Math.sin(t) });
  }
  return points;
}

export function createMoonPhaseTexture(windowCount: MoonPhaseWindowCount, ink: DiscInk = {}): THREE.CanvasTexture | null {
  const v = MOON_PHASE_VISUALIZATION;
  const size = DIAL_WINDOW_VISUALIZATION.textureSizePx;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return null;
  const centre = size / 2;

  ctx.fillStyle = ink.background ?? v.skyColor;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = v.starColor;
  for (const star of v.starPositions) {
    const x = centre + star.radiusFraction * centre * Math.cos(star.angle);
    const y = centre + star.radiusFraction * centre * Math.sin(star.angle);
    ctx.beginPath();
    ctx.arc(x, y, star.sizePx, 0, Math.PI * 2);
    ctx.fill();
  }

  // The printed phase series (ASM-0073): each icon is drawn in its own frame with "up" pointing
  // away from the disc centre, the same convention `discLabelPlacements` already uses, so a
  // quarter lit on the left reads as lit on the viewer's left when it passes under the window.
  const ringRadiusPx = v.iconRingRadiusFraction * centre;
  const iconRadiusPx = v.iconRadiusFraction * centre;
  for (const placement of moonPhaseIconPlacements(windowsPerRevolution(windowCount))) {
    ctx.save();
    ctx.translate(centre + ringRadiusPx * Math.cos(placement.canvasAngle), centre + ringRadiusPx * Math.sin(placement.canvasAngle));
    ctx.rotate(placement.canvasAngle + Math.PI / 2);
    // Only the lit part is printed: no dark disc or outline completes the moon (follow-up 41), so the
    // unlit part is simply the disc's own sky colour and a new moon prints nothing.
    const lit = moonPhaseLitPolygon(placement.phase, iconRadiusPx);
    if (lit.length > 0) {
      ctx.fillStyle = ink.text ?? v.moonColor;
      ctx.beginPath();
      lit.forEach(({ x, y }, i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * A leap-year wheel's own visual linkage to its driving month star
 * (ASM-0052, Phase 8.9): radial slots cut into the wheel's own rim, so it
 * reads as an actual Geneva (Maltese-cross) wheel rather than a plain
 * disc. The driver pin/carrier assembly itself is built inline in
 * `src/viewport/viewport.ts` (not a dedicated geometry function here,
 * since both are just small `createZCylinder` cylinders), and visibly
 * swings into one slot during each index stroke
 * (`src/simulation/simulationState.ts`'s `genevaStrokes`), parking at
 * its entry position between strokes. Slot depth/width are declared
 * visualization choices, not derived from any sourced manufacturing
 * clearance — same "visual only" treatment already given escape teeth
 * and pallet stones (ASM-0004, ASM-0039, ASM-0040). The locking-disc
 * contact surface itself (the crescent recess a real Geneva wheel's rim
 * also carries, `genevaLockingDiscRadiusRatio`) is not drawn, only
 * reported numerically (YEAR-002) — this models the slots only.
 */
export const GENEVA_WHEEL_VISUALIZATION = {
  /** Each slot's own angular half-width, in radians. */
  slotHalfWidthRadians: 0.1,
  /** How far a slot cuts in, as a fraction of the wheel's own tip radius. */
  slotInnerRadiusFraction: 0.5,
  /** Central bore, as a fraction of the wheel's own tip radius. */
  hubRadiusFraction: 0.18,
  /** The driver pin's own drawn radius, in metres — cosmetic, like `ESCAPEMENT_VISUALIZATION.palletStoneMetres`. */
  pinRadiusMetres: 0.15e-3,
  /** The driver's own carrier disc radius, as a multiple of the pin's own orbit radius (λ × centre distance), just enough to visually contain the pin's full sweep. */
  driverCarrierRadiusFactor: 1.25,
  assumption: "ASM-0052" satisfies AssumptionId,
} as const;

/**
 * A disc of `tipRadius` with `slotCount` radial notches cut into its rim
 * (ASM-0050), each centred at `baseAngle + k·(2π / slotCount)` in the
 * wheel's own local (pre-rotation) frame — so that whichever slot is
 * `baseAngle` itself lines up with the driver direction at shaftAngle 0,
 * every other slot automatically lines up too at every subsequent dwell
 * position, since the slots and the index step share the same angular
 * spacing (2π / slotCount) by construction. Depth [0, thickness];
 * position the mesh at the wheel's own zLo afterward, same convention as
 * `createEscapeWheelGeometry`.
 */
export function createGenevaWheelGeometry(tipRadius: number, thickness: number, slotCount: number, baseAngle: number): THREE.ExtrudeGeometry {
  const v = GENEVA_WHEEL_VISUALIZATION;
  const innerRadius = tipRadius * v.slotInnerRadiusFraction;
  const spacing = (2 * Math.PI) / slotCount;
  const shape = new THREE.Shape();
  for (let k = 0; k < slotCount; k += 1) {
    const centreAngle = baseAngle + k * spacing;
    const leftAngle = centreAngle - v.slotHalfWidthRadians;
    const rightAngle = centreAngle + v.slotHalfWidthRadians;
    const nextLeftAngle = baseAngle + (k + 1) * spacing - v.slotHalfWidthRadians;
    const leftPoint: Point2D = { x: tipRadius * Math.cos(leftAngle), y: tipRadius * Math.sin(leftAngle) };
    if (k === 0) shape.moveTo(leftPoint.x, leftPoint.y); else shape.lineTo(leftPoint.x, leftPoint.y);
    shape.lineTo(innerRadius * Math.cos(centreAngle), innerRadius * Math.sin(centreAngle));
    shape.lineTo(tipRadius * Math.cos(rightAngle), tipRadius * Math.sin(rightAngle));
    shape.absarc(0, 0, tipRadius, rightAngle, nextLeftAngle, false);
  }
  shape.closePath();
  const hub = new THREE.Path();
  hub.absarc(0, 0, tipRadius * v.hubRadiusFraction, 0, Math.PI * 2, true);
  shape.holes.push(hub);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 64 });
  geometry.translate(0, 0, -thickness / 2);
  reshapeCapGroupsForDiscMaterials(geometry, tipRadius);
  return geometry;
}

/**
 * The open five-spoke look of the date and month wheels (ASM-0075, visual only,
 * ASM-0004): a hub, `spokeCount` constant-width spokes and gaps between them, all
 * inside a solid outer rim that keeps the printed label ring whole. Every size is
 * a fraction of the wheel's own tip radius. The gaps stop at
 * `openingOuterRadiusFraction`, below the inner edge of the label band
 * (labels sit at `DIAL_WINDOW_VISUALIZATION.labelRadiusFraction` = 0.72 of the
 * radius and extend a few hundredths either side), so no gap ever cuts into a number
 * or a name.
 */
export const SPOKED_WHEEL_VISUALIZATION = {
  spokeCount: 5,
  /** Each spoke's own (constant) width, as a fraction of the tip radius. */
  spokeWidthFraction: 0.13,
  /** The solid central hub the spokes meet in. */
  hubRadiusFraction: 0.2,
  /** Where the gaps stop, outward: the solid rim runs from here to the tip. */
  openingOuterRadiusFraction: 0.58,
  /**
   * The moon wheel's own gap limit (follow-up 20): its printed phase icons occupy 0.725-0.955 of the
   * radius (`MOON_PHASE_VISUALIZATION` ring 0.84, icon radius 0.115), so the gaps stop well below that.
   */
  moonOpeningOuterRadiusFraction: 0.62,
  /** Segments used to approximate each gap's own inner and outer circular edge. */
  arcSegments: 14,
  assumption: "ASM-0075" satisfies AssumptionId,
} as const;

/**
 * The gaps between a spoked wheel's spokes, as polygons in the wheel's own frame
 * (ASM-0075): gap `k` lies between the spokes at `baseAngle + k·2π/n` and
 * `baseAngle + (k+1)·2π/n`, bounded inside by the hub circle and outside by the
 * opening radius, with straight, parallel-to-the-spoke sides one half spoke-width
 * off each spoke's centreline. Pure geometry, no THREE dependency.
 */
export function spokedWheelOpenings(
  tipRadius: number,
  baseAngle = 0,
  openingOuterRadiusFraction: number = SPOKED_WHEEL_VISUALIZATION.openingOuterRadiusFraction,
  hubRadiusFraction: number = SPOKED_WHEEL_VISUALIZATION.hubRadiusFraction,
): Point2D[][] {
  const v = SPOKED_WHEEL_VISUALIZATION;
  const n = v.spokeCount;
  const spacing = (2 * Math.PI) / n;
  const rIn = tipRadius * hubRadiusFraction;
  const rOut = tipRadius * openingOuterRadiusFraction;
  const halfWidth = (tipRadius * v.spokeWidthFraction) / 2;
  const edgeAngle = (radius: number): number => Math.asin(halfWidth / radius);
  const openings: Point2D[][] = [];
  for (let k = 0; k < n; k += 1) {
    const a0 = baseAngle + k * spacing;
    const a1 = a0 + spacing;
    const outerFrom = a0 + edgeAngle(rOut);
    const outerTo = a1 - edgeAngle(rOut);
    const innerFrom = a1 - edgeAngle(rIn);
    const innerTo = a0 + edgeAngle(rIn);
    const points: Point2D[] = [];
    for (let i = 0; i <= v.arcSegments; i += 1) {
      const a = outerFrom + ((outerTo - outerFrom) * i) / v.arcSegments;
      points.push({ x: rOut * Math.cos(a), y: rOut * Math.sin(a) });
    }
    for (let i = 0; i <= v.arcSegments; i += 1) {
      const a = innerFrom + ((innerTo - innerFrom) * i) / v.arcSegments;
      points.push({ x: rIn * Math.cos(a), y: rIn * Math.sin(a) });
    }
    openings.push(points);
  }
  return openings;
}

/**
 * Extruded geometry for a five-spoke date or month wheel (ASM-0075): a solid disc of
 * `tipRadius` with `spokedWheelOpenings` cut through it, depth [0, thickness] shifted to
 * be centred on z = 0 (position the mesh at the wheel's own zCentre, the same convention
 * `createGenevaWheelGeometry` uses). Its cap groups and UVs are reshaped to
 * `CylinderGeometry`'s own convention (`reshapeCapGroupsForDiscMaterials`), so the same
 * `discMaterials` label ring paints onto it exactly as on a plain `createZCylinder` disc.
 */
export function createSpokedWheelGeometry(tipRadius: number, thickness: number, baseAngle = 0, openingOuterRadiusFraction: number = SPOKED_WHEEL_VISUALIZATION.openingOuterRadiusFraction): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, tipRadius, 0, Math.PI * 2, false);
  for (const opening of spokedWheelOpenings(tipRadius, baseAngle, openingOuterRadiusFraction)) {
    const hole = new THREE.Path();
    opening.forEach(({ x, y }, i) => { if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y); });
    hole.closePath();
    shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 64 });
  geometry.translate(0, 0, -thickness / 2);
  reshapeCapGroupsForDiscMaterials(geometry, tipRadius);
  return geometry;
}

/**
 * `ExtrudeGeometry`'s own default material groups are `[caps (front and
 * back combined), sides]` — not `CylinderGeometry`'s `[sides, +Z cap, −Z
 * cap]` that `discMaterials` (`src/viewport/viewport.ts`) is built
 * around to put a position-label texture on the dial-facing (−Z) cap
 * only (ASM-0051). Passed an `ExtrudeGeometry`'s default groups,
 * `discMaterials`'s 3-entry array silently never reaches the labeled
 * entry: index 0 (plain) lands on the combined caps group, index 1
 * (also plain) lands on the sides, and index 2 (the actual label
 * texture) matches no group at all, so nothing ever renders it.
 *
 * Fixing the groups alone is not enough, either: `ExtrudeGeometry`'s own
 * default UVs are each cap vertex's raw local (x, y) position (in
 * metres, so values like ±0.0015), not `CylinderGeometry`'s own caps,
 * which normalize radius into the unit square `createDiscLabelTexture`
 * draws its ring of labels into. Left as-is, the whole label texture
 * gets sampled from the razor-thin sliver of UV space between 0 and
 * ~0.003 — invisible in practice. This also rewrites each cap's own UVs
 * to match `CylinderGeometry`'s own formula exactly (empirically
 * derived from a built `createZCylinder` disc: −Z cap `u = 0.5 − y/2r`,
 * `v = 0.5 − x/2r`; +Z cap the same `u`, `v` sign-flipped), so a wheel
 * built from this function reads identically to the date/month discs
 * that already use `createZCylinder` + `discMaterials` correctly.
 *
 * `createGenevaWheelGeometry` is this project's only `ExtrudeGeometry`
 * used with `discMaterials`, so both fixes live here rather than in
 * `discMaterials` itself: split the combined caps group back into its
 * own front/back halves (found by where the caps run's own z value
 * changes — `ExtrudeGeometry` lays the front cap down as one contiguous
 * triangle run and the back cap as a second, not interleaved, so a
 * single scan for the first z change finds the exact boundary), relabel
 * all three groups to match `CylinderGeometry`'s own index convention,
 * and rewrite each cap's own UVs in place.
 */
function reshapeCapGroupsForDiscMaterials(geometry: THREE.ExtrudeGeometry, tipRadius: number): void {
  const [capsGroup, sidesGroup] = geometry.groups;
  if (capsGroup === undefined || sidesGroup === undefined) return;
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (position === undefined || uv === undefined) return;
  const firstCapZ = position.getZ(capsGroup.start);
  let splitAt = capsGroup.start + capsGroup.count;
  for (let i = capsGroup.start; i < capsGroup.start + capsGroup.count; i += 3) {
    if (position.getZ(i) !== firstCapZ) {
      splitAt = i;
      break;
    }
  }
  // CylinderGeometry/discMaterials convention: index 1 is the +Z cap (plain), index 2 is the
  // −Z cap (dial-facing, carries the label texture — ASM-0014/ASM-0051).
  const firstCapMaterialIndex = firstCapZ < 0 ? 2 : 1;
  const secondCapMaterialIndex = firstCapMaterialIndex === 2 ? 1 : 2;
  geometry.groups = [
    { start: sidesGroup.start, count: sidesGroup.count, materialIndex: 0 },
    { start: capsGroup.start, count: splitAt - capsGroup.start, materialIndex: firstCapMaterialIndex },
    { start: splitAt, count: capsGroup.start + capsGroup.count - splitAt, materialIndex: secondCapMaterialIndex },
  ];
  for (const group of geometry.groups) {
    if (group.materialIndex !== 1 && group.materialIndex !== 2) continue;
    const vSign = group.materialIndex === 2 ? -1 : 1;
    for (let i = group.start; i < group.start + group.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      uv.setXY(i, 0.5 - y / (2 * tipRadius), 0.5 + vSign * (x / (2 * tipRadius)));
    }
  }
  uv.needsUpdate = true;
}

/**
 * A date complication's own visual linkage to its continuously-driven
 * arbor (ASM-0053, Phase 8.9): a small cam disc fixed to the drive
 * shaft's own axis (so it turns for free with the shaft's own already-
 * simulated continuous rotation, no new tracking needed) and a jumper
 * rod from a fixed pivot to a point on the star's own rim, which tracks
 * the star's own already-simulated `shaftAngle` exactly — not an
 * invented motion, a real position read each frame
 * (`src/viewport/viewport.ts`'s `dateJumperLinkages`). The cam is drawn
 * as a plain disc, not SRC-0042's own undisclosed cam profile, and the
 * rod as a rigid lever, not a real flexible spring blade — both visual
 * only (ASM-0004), the same treatment as the escapement's own symbolic
 * pallet arms. Since this project's jump mechanisms (ASM-0048) still
 * jump the star's own angle instantaneously (no sourced release-velocity
 * profile to play out, unlike the Geneva drive's real β(α), ASM-0050),
 * the rod snaps together with the star rather than easing — a true
 * depiction of the real mechanism's own character (a real date's
 * midnight jump is also effectively instantaneous to the eye), not a
 * shortcut.
 */
export const DATE_LINKAGE_VISUALIZATION = {
  /** The cam disc's own radius, as a fraction of the distance between the drive shaft and the star. */
  camRadiusFraction: 0.35,
  /** Where the jumper's nose rides on the star's own rim, as a fraction of the star's own tip radius. */
  noseRadiusFraction: 0.85,
  /** The jumper's own fixed pivot, this many star-tip-radii out from the star's centre, in the direction away from the drive shaft. */
  pivotDistanceFraction: 1.2,
  rodWidthMetres: 0.2e-3,
  rodThicknessMetres: 0.12e-3,
  pivotKnobRadiusMetres: 0.18e-3,
  noseKnobRadiusMetres: 0.15e-3,
  assumption: "ASM-0053" satisfies AssumptionId,
} as const;

/**
 * A unit-length rod: a thin box with one end (the pivot) at the local
 * origin, extending along local +X. Scale `mesh.scale.x` to the actual
 * pivot-to-tip distance and set `mesh.rotation.z` to point it, both
 * recomputed every frame for a tip that moves (e.g. `DATE_LINKAGE_
 * VISUALIZATION`'s jumper rod) — the same "unit shape, scaled and
 * oriented per frame" technique a billboard or bone link uses, cheaper
 * than rebuilding geometry every tick.
 */
export function createRodGeometry(width: number, thickness: number): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(1, width, thickness);
  geometry.translate(0.5, 0, 0);
  return geometry;
}

/**
 * A month complication's own visual linkage to the date complication that
 * drives it (ASM-0054, Phase 8.9). Unlike `DateComplication` (which has a
 * continuously-driven arbor of its own to hang a cam on, ASM-0053) or
 * `LeapYearComplication` (whose real Geneva-drive motion has a sourced
 * closed-form shape, ASM-0050), a month complication has no continuous
 * arbor at all — it only ever advances in the same instant the date
 * star's own jump lands on day 1 (`stepSimulation`'s `monthCorrection`,
 * `src/simulation/simulationState.ts`) — and SRC-0043 (the sourced real
 * mechanism) describes its own drive member only as a "declutching drive
 * wheel set" that engages the month star's teeth at month-end and is
 * otherwise "occup[ying] a first position in which it has no effect,"
 * with no numeric engagement geometry or timing given.
 *
 * With no continuous member to animate and no sourced motion to play,
 * this draws the declutch wheel in its own idle (disengaged) position
 * only, never animated — the same "park at rest rather than invent motion
 * with no basis" treatment the leap-year driver pin already gets between
 * its own real strokes. It sits just clear of the month star's own rim,
 * offset toward the date star (the real wheel set's own kinematic
 * connection point, SRC-0043), so it reads as "linked to this star, not
 * currently engaged" rather than a contact-geometry claim. Position and
 * size are both DERIVED from the date/month stars' own already-declared
 * positions and the month star's own tip diameter — no new `ShaftId`, no
 * new domain fields, no new simulation state.
 */
export const MONTH_LINKAGE_VISUALIZATION = {
  /** The declutch wheel's own radius, as a fraction of the month star's own tip radius. */
  wheelRadiusFraction: 0.3,
  /** The visible gap between the wheel's own rim and the month star's own rim, showing it disengaged. */
  clearanceMetres: 0.3e-3,
  assumption: "ASM-0054" satisfies AssumptionId,
} as const;

/**
 * A year-digit barrel segment's own geometry (Phase 8.15): a literal
 * horizontal-axis cylinder, built with `CylinderGeometry`'s own default
 * side UV then `geometry.rotateZ(Math.PI / 2)` — the SAME axis-moving
 * transform `src/viewport/keylessMeshes.ts`'s own stem rod/crown already
 * use (`rod.geometry.rotateZ(Math.PI / 2)`), not `createZCylinder`'s own
 * `rotateX(π/2)` (that keeps a vertical axis; this needs a horizontal
 * one). Raised directly by the user, who revised this complication
 * twice already (a flat disc, then a vertical drum with a lateral
 * texture) before explaining what was still wrong: this project's own
 * vertical-shaft convention (ASM-0006) was fighting a part that is
 * supposed to look and turn like a real mechanical tally-counter's
 * roller — "the numbers should turn horizontally when facing the
 * dial." Told directly that a literal horizontal axis breaks ASM-0006
 * and needs a declared exception, the user chose it anyway: the same
 * exception `KeylessWorks`'s own stem already has (ASM-0019), now
 * extended to a second part. `YearDigitComplication` is therefore NOT a
 * `Shaft` (`src/domain/yearDigitComplication.ts`): each segment declares
 * its own `axleOrigin`/`axleDirection`/`axleHeight` directly, the same
 * "declared placement, no generic Shaft" pattern `KeylessWorks` already
 * uses for its own stem line.
 *
 * Mirroring `buildStemMeshes`'s own convention exactly: a `root` group
 * positioned at `axleOrigin`/`axleHeight` with `root.rotation.z =
 * axleDirection` (orienting local +X along the declared axle direction
 * — local Z stays world Z always, since this is a rotation about Z
 * only), and a child `spin` group — added to `root` with no further
 * transform of its own — whose `rotation.x` is driven every frame from
 * the live simulated angle (`SimulationState.yearDigitAngle`). The
 * segment mesh itself (radius `barrelDiameter / 2`, length
 * `segmentLength`, axis along local X after `rotateZ(π/2)`) is a child
 * of `spin`.
 *
 * This is what makes the digit genuinely face the dial for the first
 * time (Phase 8.13's vertical drum could only ever show its digits from
 * the SIDE, never through a straight-down dial window, since its own
 * rotation axis was parallel to the camera's own viewing axis in that
 * view — see `yearDigitBarrelRestAngle`'s own doc comment for the
 * derivation of which local angle now faces it instead).
 */
export const YEAR_DIGIT_BARREL_VISUALIZATION = {
  /**
   * The mesh-local angle (around the `spin` group's own local X, i.e.
   * the segment's own rotation axis) that faces the dial — local −Z,
   * since `root`'s own one-time `rotation.z` (which points local X
   * along the declared `axleDirection`) never tilts local Z away from
   * world Z. A structural FACT of this geometry's own construction
   * (derived in `yearDigitBarrelRestAngle`'s own doc comment), not a
   * free design choice the way the now-removed vertical drum's own
   * `frontAngleRadians` was.
   */
  dialFacingLocalAngleRadians: -Math.PI / 2,
  /**
   * Each of the 10 digits gets an equal 1024px-wide-canvas / 10 =
   * 102.4px-wide slot around the circumference. Because every glyph is
   * painted rotated ±90° (`textRotationRadians`), it is the font's own
   * CAP HEIGHT, not its advance width, that consumes this slot's own
   * width — at 160px that cap height alone nearly filled the slot, so
   * adjacent digits merged into one unbroken ink run with no visible
   * gap at all (reported live, "the numbers on the barrel are touching
   * each other"; confirmed by scanning the real rendered canvas for
   * contiguous ink runs: 160px gave 2 runs across all 10 digits, a 3px
   * gap, versus 11 separate runs with a ~28px gap at this value — the
   * same "verified against real pixel data" standard this project's
   * own angle-math functions already hold themselves to). 105px keeps
   * a comfortable, clearly non-touching gap while staying legible.
   *
   * Phase 8.15 follow-up 7 ("I can barely see the year") raised this to
   * 125px: the cap-height extent (≈89px, measured with `ctx.measureText`)
   * still leaves a visible gap inside the 102.4px slot, and the year
   * window was first sized (0.235mm tall) between that glyph extent
   * (≈0.218mm) and the 0.251mm slot arc; follow-up 8 enlarged only the
   * window (now 0.4mm) and left this font and the barrel as they are. Going
   * larger here would merge adjacent digits; the barrel diameter itself is
   * capped by the mainplate-to-dial clearance.
   */
  fontSizePx: 125,
  /**
   * Each digit glyph is painted rotated by this many radians (canvas
   * `ctx.rotate` convention: positive turns the glyph clockwise, since
   * canvas Y grows downward) before being wrapped onto the barrel's own
   * lateral surface. Needed because the canvas's own "up" direction
   * (toward row 0, the glyph's own natural upright orientation) maps,
   * through `cylinderXAxisCanvasUForLocalAngle`'s own θ = π/2 − a
   * convention and `createXAxisCylinder`'s `rotateZ(π/2)`, to the
   * barrel's own AXIAL direction (local X, the segment's own length),
   * not a radial "up" — so with no correction a glyph renders rotated
   * 90° clockwise from upright. Raised directly by the user on first
   * seeing the barrel render ("the numbers are not upright... rotate
   * the numbers on the barrel 45° to the left"): the direction (left,
   * i.e. counter-clockwise) was correct, but 45° only partly corrected
   * it — confirmed empirically with an unambiguous test glyph ("F")
   * rendered through the real pipeline at 0°, 45° and 90°, matching a
   * 90° correction exactly, not 45°; the user's own estimate by eye
   * undershot the real angle. A declared visual correction (ASM-0004),
   * not a re-derivation of the UV mapping itself.
   */
  textRotationRadians: -Math.PI / 2,
  /** Pale numerals on a dark barrel body, matching the mechanical tally-counter reference photo the user provided directly, whose own digit rollers read as dark bodies with light printed numerals. */
  textColor: "#ffffff",
  /** Fraction of the numerals' own colour the digit strip emits on its own (ASM-0074), so they read through the dial window rather than dimly. */
  emissiveIntensity: 0.7,
  backgroundColor: "#1c1915",
  dividerColor: "#3a342c",
  dividerWidthPx: 3,
  assumption: "ASM-0064" satisfies AssumptionId,
} as const;

/**
 * The mesh-local angle (around the `spin` group's own local X) at which
 * digit `d` (0 to `digitCount − 1`) must be painted so that, once the
 * segment's own already-simulated angle is applied (`rotation.x = d ×
 * 2π/digitCount` for whichever digit is currently showing,
 * `yearDigitStepAngle()`, `src/simulation/simulationState.ts`), digit
 * `d` itself faces `YEAR_DIGIT_BARREL_VISUALIZATION.dialFacingLocalAngleRadians`
 * — true for every `d`, not just the segment's own starting one, since
 * `(rest − d·step) + d·step = rest` for all `d` (rotating a point at
 * local angle `α` by `φ` about local X moves it to `α + φ`, the
 * standard right-hand convention `THREE.Object3D.rotation.x` already
 * uses). Digits therefore run around the barrel in the OPPOSITE sense
 * to increasing rotation — the same way a real mechanical counter's own
 * printed digits must run backwards around its rim for them to appear
 * in forward (0, 1, 2, …) reading order as the drum turns forward.
 * `digit` need not be an integer (the texture painter below also calls
 * this at `digit + 0.5` to place a divider between two digits).
 */
export function yearDigitBarrelRestAngle(digit: number, digitCount: number): number {
  const step = (Math.PI * 2) / digitCount;
  const twoPi = Math.PI * 2;
  return (((YEAR_DIGIT_BARREL_VISUALIZATION.dialFacingLocalAngleRadians - digit * step) % twoPi) + twoPi) % twoPi;
}

/**
 * The lateral-surface canvas-drawing angle (`θ`, with `u = θ / 2π`) that
 * lands a feature at a chosen *mesh-local* angle (around the `spin`
 * group's own local X) on a `geometry.rotateZ(Math.PI / 2)`-built
 * horizontal cylinder (`YEAR_DIGIT_BARREL_VISUALIZATION`) — the
 * horizontal-axis counterpart to `discCapCanvasAngleForMeshAngle`'s own
 * −Z-cap reflection formula for a vertical one.
 *
 * Derived by tracking `CylinderGeometry`'s own pre-rotation side vertex
 * (the installed three.js source's own `generateTorso`: `x = r·sinθ,
 * y = height-axis, z = r·cosθ`, `θ = u·2π`, UV `(u, 1−v)`) through
 * `rotateZ(π/2)` (`x′ = −y, y′ = x`, so `x′ = −(height-axis), y′ =
 * r·sinθ, z′ = r·cosθ` — the axis moves from local Y to local X,
 * confirmed against `src/viewport/keylessMeshes.ts`'s own identical
 * `rotateZ(π/2)` convention for the stem rod). The point's own angle
 * around local X, measured `atan2(z, y)`, is therefore `atan2(r·cosθ,
 * r·sinθ) = π/2 − θ`. Solving for `θ` given a desired local angle `a`
 * gives `θ = π/2 − a`, which this function returns as a normalized
 * `u = θ / 2π`.
 */
export function cylinderXAxisCanvasUForLocalAngle(localAngleAroundX: number): number {
  const theta = Math.PI / 2 - localAngleAroundX;
  const u = theta / (Math.PI * 2);
  return u - Math.floor(u);
}

/**
 * The lateral-surface digit strip for a year-digit barrel
 * (`YEAR_DIGIT_BARREL_VISUALIZATION`, ASM-0064): a plain background
 * band with `digitCount` digits painted around it at
 * `yearDigitBarrelRestAngle`'s own positions, plus a thin divider at
 * the half-digit boundary between each pair (the same half-slot-offset
 * convention `seasonWedgeBoundaryAngles` already uses). Every digit and
 * divider is drawn three times, at `u`, `u − 1` and `u + 1`: the canvas
 * is a flat strip but the surface it wraps onto is a closed loop, so a
 * digit whose own centre falls near the `u = 0`/`u = 1` seam (there is
 * always exactly one) must still appear whole, split across both edges
 * of the canvas, not clipped by it. `digitCount` is passed in, not
 * imported from `src/domain/yearDigitComplication.ts` (this geometry
 * module has no dependency on any domain module), the same "pure
 * function of its own inputs" convention `createGenevaWheelGeometry`'s
 * own `slotCount` parameter already follows.
 */
export function createYearDigitBarrelTexture(digitCount: number, ink: DiscInk = {}): THREE.CanvasTexture | null {
  const v = YEAR_DIGIT_BARREL_VISUALIZATION;
  const width = 1024;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return null;
  ctx.fillStyle = ink.background ?? v.backgroundColor;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = ink.text ?? v.textColor;
  ctx.font = `bold ${String(v.fontSizePx)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = v.dividerColor;
  ctx.lineWidth = v.dividerWidthPx;
  for (let digit = 0; digit < digitCount; digit += 1) {
    const u = cylinderXAxisCanvasUForLocalAngle(yearDigitBarrelRestAngle(digit, digitCount));
    const dividerU = cylinderXAxisCanvasUForLocalAngle(yearDigitBarrelRestAngle(digit + 0.5, digitCount));
    for (const offset of [-1, 0, 1]) {
      ctx.save();
      ctx.translate((u + offset) * width, height / 2);
      ctx.rotate(v.textRotationRadians);
      ctx.fillText(String(digit), 0, 0);
      ctx.restore();
      const dividerX = (dividerU + offset) * width;
      ctx.beginPath();
      ctx.moveTo(dividerX, 0);
      ctx.lineTo(dividerX, height);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  // sRGB-tagged so the emissive term (ASM-0074) reads the dark body and pale numerals at their
  // painted colours instead of treating the canvas as linear light (which washes the body grey).
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A year-digit barrel's own visual linkage to the movement (Phase
 * 8.15, carried over unchanged from Phase 8.13's own ASM-0061): a small
 * declutch wheel, idle/disengaged, the same shape and treatment
 * `MONTH_LINKAGE_VISUALIZATION` (ASM-0054) already gives the month
 * star's own link to the date star that drives it — drawn once, in its
 * own rest position, never animated.
 *
 * Only the ones-place segment gets a drawn link to the month star. The
 * other three (tens, hundreds, thousands) are not mechanically chained
 * to the ones segment or to each other in this project's own domain
 * model — `digitsToAdvance` (`src/kinematics/yearDigitComplication.ts`)
 * advances every qualifying segment in the SAME simulated instant the
 * month star wraps, not via one segment's own rotation stepping the
 * next (the way some real multi-digit mechanical counters are built,
 * with a one-tooth carry pinion between each pair of wheels — no source
 * for this specific drum-clock design has been found either way) —
 * drawing a tooth-engagement link between consecutive digit segments
 * would imply a real inter-segment gearing this project does not model.
 * This small declutch wheel itself stays an ordinary vertical-axis
 * `createZCylinder`, the same as before: it is not part of the barrel's
 * own rotating assembly, just a static marker anchored near it.
 */
export const YEAR_DIGIT_LINKAGE_VISUALIZATION = {
  /** The declutch wheel's own radius, as a fraction of the ones-place segment's own barrel radius. */
  wheelRadiusFraction: 0.3,
  /** The visible gap between the wheel's own rim and the ones-place segment's own rim, showing it disengaged. */
  clearanceMetres: 0.3e-3,
  assumption: "ASM-0065" satisfies AssumptionId,
} as const;

/**
 * A year-digit barrel's own enclosing housing (Phase 8.15, carried over
 * from Phase 8.14's own ASM-0062, rebuilt for the horizontal axis):
 * raised directly by the user, who supplied a photo of a real
 * mechanical tally-counter ("remove the 4 gears for the year timer and
 * create something like this... connected somehow to the movement") —
 * four digit rollers sitting close together inside a dark housing, with
 * thin dividers between columns, visibly mounted rather than floating
 * free.
 *
 * Built entirely in the barrel's own local frame (the SAME `root` group
 * every segment's own geometry is positioned relative to, i.e. local X
 * along the shared `axleDirection`, local Z = world Z always): a back
 * wall (local Z, the side away from the dial), two end walls (local X,
 * the ends of the whole segment run) and two side walls (local Y, the
 * sides perpendicular to the barrel's own length) — five of the six
 * faces of a box, leaving only the local −Z face (the one facing the
 * dial, `YEAR_DIGIT_BARREL_VISUALIZATION.dialFacingLocalAngleRadians`)
 * open: the real counter's own "window" is just the ordinary fact that
 * a solid cylinder's own far side is hidden from the viewer, the same
 * way any other part in this viewport already is — no separate reveal
 * geometry is needed to get that. Divider bars between adjacent
 * segments complete the look. Entirely visual (ASM-0004) and, like
 * `MONTH_LINKAGE_VISUALIZATION`, derived each rebuild from the
 * segments' own already-declared positions and dimensions — no new
 * domain field, no `ShaftId` (there is none to have), no new simulation
 * state.
 */
export const YEAR_DIGIT_HOUSING_VISUALIZATION = {
  /**
   * Clearance between a segment's own rim/end and the housing's own
   * inner wall face. Smaller than the vertical-axis drum's own margin
   * (0.3mm, Phase 8.14) because `barrelDiameter` now also sets the
   * housing's own Z-extent (the circular cross-section lies in the
   * local Y-Z plane for a horizontal-axis barrel, unlike the vertical
   * drum, where diameter only set the flat XY footprint and a separate,
   * small `thickness` set the Z-extent) — the total margin+wall
   * overhead now competes directly with `barrelDiameter` for the same
   * z-clearance a design's own mainplate/dial gap allows (ASSY-002-style
   * reasoning, not yet an automated check for this one axis), so it is
   * kept proportionally smaller to leave more of that gap for the
   * barrel itself.
   */
  marginMetres: 0.12e-3,
  wallThicknessMetres: 0.12e-3,
  dividerWidthMetres: 0.15e-3,
  housingColor: 0x16140f,
  /**
   * The housing's own static mounting bracket (never animated, same
   * treatment as `YEAR_DIGIT_LINKAGE_VISUALIZATION`): a rigid vertical
   * post from the housing's own back wall up to the mainplate's own
   * underside — the explicit "connection to the movement" the user
   * asked for, additional to (not a replacement for) the ones-segment's
   * own kinematic link to the month star above. Built in WORLD Z (not
   * the housing's own local frame): a plain vertical post reads as
   * "mounted to the plate" regardless of which way the barrel itself
   * points.
   */
  bracketWidthMetres: 0.3e-3,
  assumption: "ASM-0066" satisfies AssumptionId,
} as const;

/** One year-digit barrel segment's own position along its shared axle and length, as `yearDigitBarrelAlongBounds`/`yearDigitBarrelDividerPositions` need it. */
export interface YearDigitBarrelSegment {
  /** This segment's own centre, projected onto the shared axle direction (`yearDigitAxleProjection`) — a signed scalar distance, not a point. */
  readonly along: number;
  /** This segment's own length along the shared axle. */
  readonly length: number;
}

/**
 * A point's own signed distance along a declared direction (the
 * standard dot product with the direction's own unit vector) — how
 * `src/viewport/viewport.ts` reduces each year-digit segment's own 2D
 * `axleOrigin` to the single scalar `yearDigitBarrelAlongBounds`/
 * `yearDigitBarrelDividerPositions` need, so the housing/dividers work
 * for a barrel declared along ANY `axleDirection`, not only one
 * aligned with the world X axis.
 */
export function yearDigitAxleProjection(point: Point2D, direction: number): number {
  return point.x * Math.cos(direction) + point.y * Math.sin(direction);
}

export interface YearDigitBarrelAlongBounds {
  readonly min: number;
  readonly max: number;
}

/**
 * The housing's own extent along the shared axle
 * (`YEAR_DIGIT_HOUSING_VISUALIZATION`, ASM-0066): the span of every
 * segment's own declared length, expanded by `margin` on each end —
 * derived from the model's own already-declared positions and lengths,
 * not an invented size. `null` for an empty group (nothing to enclose).
 */
export function yearDigitBarrelAlongBounds(segments: readonly YearDigitBarrelSegment[], margin: number): YearDigitBarrelAlongBounds | null {
  if (segments.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const segment of segments) {
    min = Math.min(min, segment.along - segment.length / 2);
    max = Math.max(max, segment.along + segment.length / 2);
  }
  return { min: min - margin, max: max + margin };
}

/**
 * The along-axle position of a divider bar between each pair of
 * adjacent segments (by along-axle order), one fewer bar than there
 * are segments — the midpoint between each pair's own centres, the
 * same "derived from the model's own declared positions" convention
 * `yearDigitBarrelAlongBounds` follows. Sorts a copy of `segments`; the
 * input order does not matter.
 */
export function yearDigitBarrelDividerPositions(segments: readonly { along: number }[]): number[] {
  const alongs = segments.map((segment) => segment.along).sort((a, b) => a - b);
  const midpoints: number[] = [];
  for (let i = 0; i + 1 < alongs.length; i += 1) {
    const a = alongs[i];
    const b = alongs[i + 1];
    if (a === undefined || b === undefined) continue;
    midpoints.push((a + b) / 2);
  }
  return midpoints;
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
export function createEscapeWheelGeometry(toothCount: number, tipRadius: number, thickness: number, face?: EscapeToothFace, spoked = false): THREE.ExtrudeGeometry {
  const outline = generateEscapeWheelOutline(toothCount, tipRadius, face);
  const shape = new THREE.Shape();
  outline.forEach(({ x, y }, i) => { if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
  shape.closePath();
  const hub = new THREE.Path();
  hub.absarc(0, 0, escapeWheelHubRadius(tipRadius), 0, Math.PI * 2, true);
  shape.holes.push(hub);
  // An open five-spoke wheel (follow-up 25, ASM-0079): gaps between a hub ring around the arbor bore and
  // a solid ring under the teeth, laid out like the gears' own (ASM-0077) against the tooth root radius.
  if (spoked) {
    const root = tipRadius * ESCAPEMENT_VISUALIZATION.escapeRootFraction;
    const hubFraction = (escapeWheelHubRadius(tipRadius) * ESCAPE_SPOKE_HUB_CLEARANCE) / root;
    for (const opening of spokedWheelOpenings(root, Math.PI / 2, 1 - GEAR_RIM_FRACTION_FOR_SPOKES, hubFraction)) {
      const gap = new THREE.Path();
      opening.forEach(({ x, y }, i) => { if (i === 0) gap.moveTo(x, y); else gap.lineTo(x, y); });
      gap.closePath();
      shape.holes.push(gap);
    }
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.translate(0, 0, -thickness / 2);
  return geometry;
}

/** The solid ring under the teeth of a spoked wheel, as a fraction of the root radius — the same 20% the spoked gears use (ASM-0077). */
const GEAR_RIM_FRACTION_FOR_SPOKES = 0.2;
/** How much bigger than the arbor bore the hub ring the spokes meet in is, so the bore is never cut through (ASM-0079). */
const ESCAPE_SPOKE_HUB_CLEARANCE = 1.5;

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
