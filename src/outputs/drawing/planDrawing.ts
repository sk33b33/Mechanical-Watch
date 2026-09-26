import { toMillimetres, type Length } from "@/units/length";
import type { Movement } from "@/domain/movement";
import { isCompleteFrame } from "@/assembly/assemblyGeometry";
import { isValidModule, isValidToothCount, meshCentreDistance, pitchDiameter } from "@/math/gearMath";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import type { MovementAnalysis } from "@/analysis/analyzeMovement";

/**
 * A 2D plan drawing of the movement built from the design model: frame
 * outlines, solved axis positions, pitch circles and centre-distance
 * dimensions. It is nominal geometry (MFG-001), with no tooth profiles
 * (REF-ENG §6), and it is not a manufacturing drawing (MFG-002).
 *
 * Coordinates here are plain millimetre numbers (`Point`), not SI
 * `Length`s, because a drawing is an output boundary. The plan is viewed from the bridge side (+Z toward the viewer),
 * x to the right and y up, as in the movement coordinates.
 */

/** A drawing coordinate in millimetres. */
export interface Point {
  x: number;
  y: number;
}

export type DrawingLayer = "FRAME" | "PITCH" | "AXIS" | "DIMENSION" | "TEXT";

export const DRAWING_LAYERS: readonly DrawingLayer[] = ["FRAME", "PITCH", "AXIS", "DIMENSION", "TEXT"];

export type Primitive =
  | { kind: "circle"; layer: DrawingLayer; centre: Point; radius: number }
  | { kind: "polygon"; layer: DrawingLayer; points: Point[] }
  | { kind: "line"; layer: DrawingLayer; a: Point; b: Point }
  | { kind: "text"; layer: DrawingLayer; at: Point; text: string; height: number; align: "left" | "centre" }
  /** An aligned linear dimension between two points, drawn `offset` to their left. */
  | { kind: "dimension"; layer: DrawingLayer; a: Point; b: Point; offset: number; text: string; height: number };

export interface DrawingTableRow {
  cells: string[];
}

export interface PlanDrawing {
  title: string;
  /** Paper scale, e.g. 5 means 5:1. Chosen so the plan fits a page; the model is unaffected. */
  scale: number;
  primitives: Primitive[];
  /** Bounds of the plan geometry in mm, or null if there is nothing to draw. */
  bounds: { min: Point; max: Point } | null;
  notes: string[];
  gearTable: { header: string[]; rows: DrawingTableRow[] };
}

/** Paper text height (mm) and page width the scale is chosen for. Presentation choices, not engineering values. */
export const DRAWING_STYLE = {
  textHeightPaperMm: 2.5,
  dimensionOffsetPaperMm: 6,
  centreMarkPaperMm: 3,
  maxPlanWidthPaperMm: 250,
  scales: [20, 10, 5, 2, 1] as const,
};

const mm = (v: Length | number): number => toMillimetres(v as Length);
const fmt = (v: number, digits = 4): string => v.toFixed(digits);

function boundsOf(points: Point[]): { min: Point; max: Point } | null {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) },
  };
}

const pt = (x: number, y: number): Point => ({ x, y });

export function buildPlanDrawing(movement: Movement, analysis: MovementAnalysis): PlanDrawing {
  const geometry: Primitive[] = [];
  const extent: Point[] = [];

  for (const frame of Object.values(movement.frames)) {
    if (!isCompleteFrame(frame)) continue;
    const o = frame.outline;
    if (o.kind === "CIRCLE") {
      const c = pt(mm(o.centre.x), mm(o.centre.y));
      const r = mm(o.radius);
      geometry.push({ kind: "circle", layer: "FRAME", centre: c, radius: r });
      extent.push(pt(c.x - r, c.y - r), pt(c.x + r, c.y + r));
    } else {
      const points = o.points.map((p) => pt(mm(p.x), mm(p.y)));
      geometry.push({ kind: "polygon", layer: "FRAME", points });
      extent.push(...points);
    }
  }

  const axes = new Map<string, Point>();
  for (const [id, p] of analysis.placement.shaftPositions) {
    const q = pt(mm(p.x), mm(p.y));
    axes.set(id, q);
    extent.push(q);
  }

  const gearRows: DrawingTableRow[] = [];
  const pitchCircles: { centre: Point; radius: number }[] = [];
  for (const gear of Object.values(movement.gears).sort((a, b) => a.name.localeCompare(b.name))) {
    const defined = isValidToothCount(gear.toothCount) && isValidModule(gear.module);
    const d = defined ? mm(pitchDiameter(gear.module, gear.toothCount)) : null;
    gearRows.push({
      cells: [
        gear.name,
        movement.shafts[gear.shaftId]?.name ?? "missing arbor",
        Number.isFinite(gear.toothCount) ? String(gear.toothCount) : "?",
        Number.isFinite(gear.module) ? fmt(mm(gear.module)) : "?",
        d === null ? "?" : fmt(d),
        Number.isFinite(gear.thickness) ? fmt(mm(gear.thickness), 3) : "?",
        Number.isFinite(gear.zCentre) ? fmt(mm(gear.zCentre), 3) : "?",
      ],
    });
    const axis = axes.get(gear.shaftId);
    if (d === null || axis === undefined) continue;
    pitchCircles.push({ centre: axis, radius: d / 2 });
    extent.push(pt(axis.x - d / 2, axis.y - d / 2), pt(axis.x + d / 2, axis.y + d / 2));
  }

  const bounds = boundsOf(extent);
  const width = bounds === null ? 0 : Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
  const scale = DRAWING_STYLE.scales.find((s) => width * s <= DRAWING_STYLE.maxPlanWidthPaperMm) ?? 1;
  const textHeight = DRAWING_STYLE.textHeightPaperMm / scale;
  const mark = DRAWING_STYLE.centreMarkPaperMm / scale;

  for (const c of pitchCircles) geometry.push({ kind: "circle", layer: "PITCH", centre: c.centre, radius: c.radius });

  // Coaxial arbors share one centre mark and one label.
  const byPosition = new Map<string, { at: Point; names: string[] }>();
  for (const [id, a] of axes) {
    const key = `${a.x.toFixed(9)},${a.y.toFixed(9)}`;
    const entry = byPosition.get(key) ?? { at: a, names: [] };
    entry.names.push(movement.shafts[id as keyof Movement["shafts"]]?.name ?? "");
    byPosition.set(key, entry);
  }
  for (const { at: a, names } of byPosition.values()) {
    geometry.push({ kind: "line", layer: "AXIS", a: pt(a.x - mark, a.y), b: pt(a.x + mark, a.y) });
    geometry.push({ kind: "line", layer: "AXIS", a: pt(a.x, a.y - mark), b: pt(a.x, a.y + mark) });
    geometry.push({ kind: "text", layer: "TEXT", at: pt(a.x + mark * 0.7, a.y + mark * 0.7), text: names.sort().join(" / "), height: textHeight * 0.8, align: "left" });
  }

  // One centre-distance dimension per pair of meshed axis positions.
  const dimensioned = new Set<string>();
  for (const mesh of Object.values(movement.gearMeshes)) {
    const g1 = movement.gears[mesh.drivingGearId];
    const g2 = movement.gears[mesh.drivenGearId];
    if (g1 === undefined || g2 === undefined) continue;
    const a = axes.get(g1.shaftId);
    const b = axes.get(g2.shaftId);
    if (a === undefined || b === undefined) continue;
    // Keyed by position: coaxial arbors (e.g. cannon pinion and hour wheel) would otherwise repeat a dimension.
    const key = [a, b].map((p) => `${p.x.toFixed(9)},${p.y.toFixed(9)}`).sort().join("|");
    if (dimensioned.has(key)) continue;
    dimensioned.add(key);
    const actual = Math.hypot(b.x - a.x, b.y - a.y);
    let text = fmt(actual);
    const defined = isValidToothCount(g1.toothCount) && isValidToothCount(g2.toothCount) && isValidModule(g1.module) && g1.module === g2.module;
    if (defined) {
      const ideal = mm(meshCentreDistance(g1.module, g1.toothCount, g2.toothCount));
      if (Math.abs(actual - ideal) > NUMERICAL_PARAMETERS.centreDistanceToleranceMetres * 1000) text += ` (ideal ${fmt(ideal)})`;
    }
    geometry.push({ kind: "dimension", layer: "DIMENSION", a, b, offset: DRAWING_STYLE.dimensionOffsetPaperMm / scale, text, height: textHeight });
  }

  return {
    title: movement.name,
    scale,
    primitives: geometry,
    bounds,
    notes: [
      "Plan viewed from the bridge side (+Z toward the viewer). Dimensions in mm.",
      "Nominal geometry from the design model; tolerances are not shown on this plan (MFG-001).",
      "Circles on gears are pitch circles (d = m z, REF-ENG §5.1). Tooth profiles are not defined (REF-ENG §6).",
      "Not a manufacturing drawing: manufacturing readiness requires validation evidence (MFG-002).",
      ...(movement.isTeachingDemo ? ["Teaching demo: dimensions are illustrative, not a production caliber (ASM-0009)."] : []),
    ],
    gearTable: {
      header: ["Gear", "Arbor", "z", "m (mm)", "Pitch Ø (mm)", "Thickness (mm)", "Mid-plane z (mm)"],
      rows: gearRows,
    },
  };
}

/** Geometry of an aligned dimension: extension lines, dimension line and text anchor. Shared by the renderers. */
export function dimensionGeometry(d: Extract<Primitive, { kind: "dimension" }>): {
  extA: [Point, Point];
  extB: [Point, Point];
  line: [Point, Point];
  textAt: Point;
  /** Text angle in degrees, kept readable (−90, 90]. */
  angleDeg: number;
} {
  const dx = d.b.x - d.a.x;
  const dy = d.b.y - d.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const a2 = pt(d.a.x + nx * d.offset, d.a.y + ny * d.offset);
  const b2 = pt(d.b.x + nx * d.offset, d.b.y + ny * d.offset);
  const overshoot = d.height * 0.4;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  return {
    extA: [d.a, pt(a2.x + nx * overshoot, a2.y + ny * overshoot)],
    extB: [d.b, pt(b2.x + nx * overshoot, b2.y + ny * overshoot)],
    line: [a2, b2],
    textAt: pt((a2.x + b2.x) / 2 + nx * d.height * 0.3, (a2.y + b2.y) / 2 + ny * d.height * 0.3),
    angleDeg: angle,
  };
}
