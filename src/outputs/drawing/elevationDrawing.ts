import type { Length } from "@/units/length";
import type { Movement } from "@/domain/movement";
import type { MovementAnalysis } from "@/analysis/analyzeMovement";
import { arborZRange, frameZRange, isCompleteFrame, isPositiveLength, shaftSupport } from "@/assembly/assemblyGeometry";
import { endshakeStack } from "@/assembly/toleranceAnalysis";
import { isValidModule, isValidToothCount, pitchDiameter } from "@/math/gearMath";
import {
  axisPositionsMm,
  boundsOf,
  DRAWING_STYLE,
  fitScale,
  fmt,
  mm,
  pt,
  type DrawingTableRow,
  type PlanDrawing,
  type Point,
  type Primitive,
} from "./planDrawing";

/**
 * An elevation of the movement's axial (Z) stack, projected orthographically
 * onto the X-Z plane (looking along Y): horizontal is X, vertical is Z, the
 * shaft-axis direction (ASM-0006). Parts at different Y overlap in this
 * view, as in any single-direction orthographic elevation; this is the
 * only projection direction offered (a display limitation, not an
 * engineering one). It is nominal geometry (MFG-001): gear bodies are
 * shown at pitch diameter, since no tooth profile is defined (REF-ENG §6),
 * and it is not a manufacturing drawing (MFG-002).
 *
 * The keyless works and dial hand pipes are not shown: the stem runs in
 * the X-Y plane at an arbitrary angle, so it has no single faithful
 * elevation in this projection.
 */
export function buildElevationDrawing(movement: Movement, analysis: MovementAnalysis): PlanDrawing {
  const geometry: Primitive[] = [];
  const extent: Point[] = [];
  const axes = axisPositionsMm(analysis);

  const frameTable: DrawingTableRow[] = [];
  const completeFrames = Object.values(movement.frames).filter(isCompleteFrame);
  for (const frame of [...completeFrames].sort((a, b) => a.zBottom - b.zBottom)) {
    const z = frameZRange(frame);
    const zLo = mm(z.lo);
    const zHi = mm(z.hi);
    const o = frame.outline;
    const xMin = o.kind === "CIRCLE" ? mm(o.centre.x) - mm(o.radius) : Math.min(...o.points.map((p) => mm(p.x)));
    const xMax = o.kind === "CIRCLE" ? mm(o.centre.x) + mm(o.radius) : Math.max(...o.points.map((p) => mm(p.x)));
    geometry.push({
      kind: "polygon", layer: "FRAME",
      points: [pt(xMin, zLo), pt(xMax, zLo), pt(xMax, zHi), pt(xMin, zHi)],
    });
    extent.push(pt(xMin, zLo), pt(xMax, zHi));
    frameTable.push({ cells: [frame.name, fmt(mm(frame.zBottom), 3), fmt(mm(frame.thickness), 3), fmt(zHi, 3)] });
  }

  // Arbors: a centreline over the axial span the shaft actually occupies (bearings and any gears, arborZRange),
  // with each gear's body at pitch diameter (REF-ENG §6 defines no tooth profile) and thickness.
  const shaftLabels: { at: Point; text: string }[] = [];
  for (const shaft of Object.values(movement.shafts)) {
    const axis = axes.get(shaft.id);
    const span = arborZRange(movement, shaft.id);
    if (axis === undefined || span === null) continue;
    const zLo = mm(span.lo);
    const zHi = mm(span.hi);
    geometry.push({ kind: "line", layer: "AXIS", a: pt(axis.x, zLo), b: pt(axis.x, zHi) });
    shaftLabels.push({ at: pt(axis.x, zHi), text: shaft.name });
    extent.push(pt(axis.x, zLo), pt(axis.x, zHi));

    for (const gear of Object.values(movement.gears)) {
      if (gear.shaftId !== shaft.id) continue;
      if (!(isValidToothCount(gear.toothCount) && isValidModule(gear.module) && isPositiveLength(gear.thickness) && Number.isFinite(gear.zCentre))) continue;
      const r = mm(pitchDiameter(gear.module, gear.toothCount)) / 2;
      const h = mm(gear.thickness) / 2;
      const zc = mm(gear.zCentre);
      geometry.push({
        kind: "polygon", layer: "GEAR",
        points: [pt(axis.x - r, zc - h), pt(axis.x + r, zc - h), pt(axis.x + r, zc + h), pt(axis.x - r, zc + h)],
      });
      extent.push(pt(axis.x - r, zc - h), pt(axis.x + r, zc + h));
    }
  }

  // Escapement: escape wheel (tip diameter, as drawn on the plan) and balance, each as a body at its thickness.
  for (const esc of Object.values(movement.escapements)) {
    const body = (shaftId: typeof esc.escapeArborShaftId, diameter: Length, thickness: Length, zCentre: Length): void => {
      const axis = axes.get(shaftId);
      if (axis === undefined || !(isPositiveLength(diameter) && isPositiveLength(thickness) && Number.isFinite(zCentre))) return;
      const r = mm(diameter) / 2;
      const h = mm(thickness) / 2;
      const zc = mm(zCentre);
      geometry.push({
        kind: "polygon", layer: "ESCAPEMENT",
        points: [pt(axis.x - r, zc - h), pt(axis.x + r, zc - h), pt(axis.x + r, zc + h), pt(axis.x - r, zc + h)],
      });
      extent.push(pt(axis.x - r, zc - h), pt(axis.x + r, zc + h));
    };
    body(esc.escapeArborShaftId, esc.escapeWheel.tipDiameter, esc.escapeWheel.thickness, esc.escapeWheel.zCentre);
    body(esc.balanceShaftId, esc.balance.diameter, esc.balance.thickness, esc.balance.zCentre);
  }

  // The dial: a hidden (dashed) band below the movement (ASM-0014).
  for (const dial of Object.values(movement.dials)) {
    const axis = axes.get(dial.centreShaftId);
    if (axis === undefined || !isPositiveLength(dial.diameter) || !Number.isFinite(dial.faceHeight) || !Number.isFinite(dial.thickness)) continue;
    const r = mm(dial.diameter) / 2;
    const zLo = mm(dial.faceHeight);
    const zHi = zLo + mm(dial.thickness);
    geometry.push({
      kind: "polygon", layer: "DIAL",
      points: [pt(axis.x - r, zLo), pt(axis.x + r, zLo), pt(axis.x + r, zHi), pt(axis.x - r, zHi)],
    });
    extent.push(pt(axis.x - r, zLo), pt(axis.x + r, zHi));
  }

  // Scale and text size are fixed from the geometry so far (as in the plan drawing); the overall-height
  // dimension added below is drawn at that scale but, like the plan's dimensions, isn't folded back into bounds.
  const bounds = boundsOf(extent);
  const scale = fitScale(bounds);
  const textHeight = DRAWING_STYLE.textHeightPaperMm / scale;
  const gap = DRAWING_STYLE.dimensionOffsetPaperMm / scale;

  for (const label of shaftLabels) {
    geometry.push({ kind: "text", layer: "TEXT", at: pt(label.at.x, label.at.y + textHeight * 0.3), text: label.text, height: textHeight * 0.8, align: "centre" });
  }

  // Bearings: a marker at the jewel's face, flush with its frame's inner face (ASM-0011). A known bore gives its
  // real width; otherwise a placeholder tick, a constant physical size on paper like the plan's axis marks.
  for (const jewel of Object.values(movement.jewels)) {
    const axis = axes.get(jewel.shaftId);
    const frame = movement.frames[jewel.frameId];
    if (axis === undefined || frame === undefined || !isCompleteFrame(frame)) continue;
    const z = mm(jewel.end === "LOWER" ? frameZRange(frame).hi : frame.zBottom);
    const halfWidth = jewel.boreDiameter !== null && isPositiveLength(jewel.boreDiameter) ? mm(jewel.boreDiameter) / 2 : DRAWING_STYLE.centreMarkPaperMm / scale;
    geometry.push({ kind: "line", layer: "JEWEL", a: pt(axis.x - halfWidth, z), b: pt(axis.x + halfWidth, z) });
  }

  // Endshake, where declared tolerances give it a worst case (ASM-0017): a dimension beside the
  // shaft's centreline, spanning its two bearing faces, only where a tolerance actually varies it.
  for (const shaft of Object.values(movement.shafts)) {
    if (shaft.support.kind !== "PIVOTED") continue;
    const axis = axes.get(shaft.id);
    if (axis === undefined) continue;
    const support = shaftSupport(movement, shaft.id);
    const lowerFrame = support.lower === null ? undefined : movement.frames[support.lower.frameId];
    const upperFrame = support.upper === null ? undefined : movement.frames[support.upper.frameId];
    if (lowerFrame === undefined || upperFrame === undefined || !isCompleteFrame(lowerFrame) || !isCompleteFrame(upperFrame)) continue;
    const stack = endshakeStack(movement, shaft, support);
    if (stack.status !== "KNOWN" || stack.stack.coverage === "NONE") continue;
    const zLo = mm(frameZRange(lowerFrame).hi);
    const zHi = mm(upperFrame.zBottom);
    geometry.push({
      kind: "dimension", layer: "DIMENSION",
      a: pt(axis.x, zLo), b: pt(axis.x, zHi), offset: gap,
      text: `endshake ${fmt(mm(stack.stack.min), 3)}…${fmt(mm(stack.stack.max), 3)}`, height: textHeight,
    });
  }

  // Overall height, from the lowest frame face to the highest, dimensioned to the right of the geometry.
  if (completeFrames.length > 0 && bounds !== null) {
    const zLo = Math.min(...completeFrames.map((f) => mm(f.zBottom)));
    const zHi = Math.max(...completeFrames.map((f) => mm(frameZRange(f).hi)));
    const x = bounds.max.x + gap;
    geometry.push({
      kind: "dimension", layer: "DIMENSION",
      a: pt(x, zLo), b: pt(x, zHi), offset: gap,
      text: `${fmt(zHi - zLo, 3)} overall`, height: textHeight,
    });
  }

  return {
    title: movement.name,
    viewLabel: "elevation (X-Z)",
    scale,
    primitives: geometry,
    bounds,
    notes: [
      "Elevation: horizontal is X, vertical is Z (the shaft-axis direction, ASM-0006), an orthographic projection onto the X-Z plane. Parts at different Y overlap in this view; it is the only projection direction offered.",
      "Nominal geometry from the design model (MFG-001). An arbor with a toleranced endshake gets a dimension beside its centreline showing the worst case (REF-ENG §14, ASM-0017); every other dimension shown is nominal only.",
      "Gear and escapement bodies are shown at pitch/tip diameter and thickness; tooth profiles are not defined (REF-ENG §6).",
      "Bearing markers sit flush with their frame's inner face (ASM-0011); their width is the jewel bore when known, else a placeholder tick.",
      "The keyless works, stem and dial hand pipes are not shown: the stem runs in the X-Y plane at an arbitrary angle, so it has no single faithful elevation here.",
      "Not a manufacturing drawing: manufacturing readiness requires validation evidence (MFG-002).",
      ...(movement.isTeachingDemo ? ["Teaching demo: dimensions are illustrative, not a production caliber (ASM-0009)."] : []),
    ],
    gearTable: {
      header: ["Frame", "z bottom (mm)", "Thickness (mm)", "z top (mm)"],
      rows: frameTable,
    },
  };
}
