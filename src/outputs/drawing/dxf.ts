import { dimensionGeometry, DRAWING_LAYERS, type DrawingLayer, type PlanDrawing, type Point } from "./planDrawing";

/** AutoCAD colour index per layer. Presentation only. */
const LAYER_COLOUR: Record<DrawingLayer, number> = { FRAME: 7, PITCH: 5, AXIS: 1, DIMENSION: 3, TEXT: 7, DIAL: 8, KEYLESS: 6 };

const LAYER_NAME = (layer: DrawingLayer): string => `MW_${layer}`;

/**
 * Renders a plan drawing as ASCII DXF (R12, AC1009) in model space at 1:1,
 * units millimetres. Only LINE, CIRCLE and TEXT entities are used, so any
 * DXF reader can open it; dimensions are exploded into lines and text.
 * Notes are written as text below the geometry.
 */
export function renderPlanDxf(drawing: PlanDrawing): string {
  const out: string[] = [];
  const pair = (code: number, value: string | number): void => {
    out.push(String(code), typeof value === "number" ? formatNumber(value) : value);
  };

  pair(0, "SECTION");
  pair(2, "HEADER");
  pair(9, "$ACADVER");
  pair(1, "AC1009");
  pair(9, "$INSUNITS");
  pair(70, 4); // 4 = millimetres
  pair(0, "ENDSEC");

  pair(0, "SECTION");
  pair(2, "TABLES");
  pair(0, "TABLE");
  pair(2, "LTYPE");
  pair(70, 1);
  pair(0, "LTYPE");
  pair(2, "CONTINUOUS");
  pair(70, 0);
  pair(3, "Solid line");
  pair(72, 65);
  pair(73, 0);
  pair(40, 0);
  pair(0, "ENDTAB");
  pair(0, "TABLE");
  pair(2, "LAYER");
  pair(70, DRAWING_LAYERS.length);
  for (const layer of DRAWING_LAYERS) {
    pair(0, "LAYER");
    pair(2, LAYER_NAME(layer));
    pair(70, 0);
    pair(62, LAYER_COLOUR[layer]);
    pair(6, "CONTINUOUS");
  }
  pair(0, "ENDTAB");
  pair(0, "ENDSEC");

  pair(0, "SECTION");
  pair(2, "ENTITIES");
  const line = (layer: DrawingLayer, a: Point, b: Point): void => {
    pair(0, "LINE");
    pair(8, LAYER_NAME(layer));
    pair(10, a.x); pair(20, a.y); pair(30, 0);
    pair(11, b.x); pair(21, b.y); pair(31, 0);
  };
  const text = (layer: DrawingLayer, at: Point, height: number, value: string, rotationDeg = 0, centred = false): void => {
    pair(0, "TEXT");
    pair(8, LAYER_NAME(layer));
    pair(10, at.x); pair(20, at.y); pair(30, 0);
    pair(40, height);
    pair(1, sanitize(value));
    if (rotationDeg !== 0) pair(50, rotationDeg);
    if (centred) {
      pair(72, 1); // centre
      pair(11, at.x); pair(21, at.y); pair(31, 0);
    }
  };

  for (const p of drawing.primitives) {
    switch (p.kind) {
      case "circle":
        pair(0, "CIRCLE");
        pair(8, LAYER_NAME(p.layer));
        pair(10, p.centre.x); pair(20, p.centre.y); pair(30, 0);
        pair(40, p.radius);
        break;
      case "polygon":
        p.points.forEach((q, i) => { line(p.layer, q, p.points[(i + 1) % p.points.length] ?? q); });
        break;
      case "line":
        line(p.layer, p.a, p.b);
        break;
      case "text":
        text(p.layer, p.at, p.height, p.text);
        break;
      case "dimension": {
        const g = dimensionGeometry(p);
        line(p.layer, g.extA[0], g.extA[1]);
        line(p.layer, g.extB[0], g.extB[1]);
        line(p.layer, g.line[0], g.line[1]);
        text(p.layer, g.textAt, p.height, p.text, g.angleDeg, true);
        break;
      }
    }
  }

  if (drawing.bounds !== null) {
    const height = 2.5 / drawing.scale;
    let y = drawing.bounds.min.y - height * 6;
    for (const note of [`${drawing.title} - plan (nominal)`, ...drawing.notes]) {
      text("TEXT", { x: drawing.bounds.min.x, y }, height, note);
      y -= height * 1.6;
    }
  }

  pair(0, "ENDSEC");
  pair(0, "EOF");
  return out.join("\r\n") + "\r\n";
}

function formatNumber(value: number): string {
  // Group codes 60–99 are integers; everything else here is a real.
  return Number.isInteger(value) ? String(value) : value.toFixed(6);
}

/** R12 text is single-line ASCII-safe; replace characters older readers mangle. */
function sanitize(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/—|–/g, "-")
    .replace(/Ø/g, "%%c")
    .replace(/°/g, "%%d")
    .replace(/±/g, "%%p")
    .replace(/§/g, "sec. ")
    .replace(/×/g, "x")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e%]/g, "?");
}
