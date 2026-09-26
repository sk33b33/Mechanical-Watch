import { dimensionGeometry, DRAWING_STYLE, type DrawingLayer, type PlanDrawing, type Point } from "./planDrawing";

export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Line styles per layer, in paper millimetres. Presentation only. */
const LAYER_STYLE: Record<DrawingLayer, string> = {
  FRAME: 'stroke="#000" stroke-width="0.35" fill="none"',
  PITCH: 'stroke="#1f5fa8" stroke-width="0.18" fill="none" stroke-dasharray="4 1 0.6 1"',
  AXIS: 'stroke="#000" stroke-width="0.18" fill="none"',
  DIMENSION: 'stroke="#000" stroke-width="0.13" fill="none"',
  TEXT: 'fill="#000"',
  DIAL: 'stroke="#555" stroke-width="0.2" fill="none" stroke-dasharray="2 1.2"',
  KEYLESS: 'stroke="#7a3fb0" stroke-width="0.3" fill="none"',
  ESCAPEMENT: 'stroke="#a8741a" stroke-width="0.3" fill="none"',
};

const n = (v: number): string => (Math.round(v * 1000) / 1000).toString();

/**
 * Renders a plan drawing as a standalone SVG sized in paper millimetres,
 * so it prints at its stated scale. Layout: title, plan, notes, gear table.
 */
export function renderPlanSvg(drawing: PlanDrawing, options: { generatedAt: string }): string {
  const font = DRAWING_STYLE.textHeightPaperMm;
  const margin = 10;
  const s = drawing.scale;
  const b = drawing.bounds;
  const dimMargin = (DRAWING_STYLE.dimensionOffsetPaperMm + 2 * font) / s; // room for dimensions outside the geometry, in model mm
  const planW = b === null ? 80 : (b.max.x - b.min.x + 2 * dimMargin) * s;
  const planH = b === null ? 20 : (b.max.y - b.min.y + 2 * dimMargin) * s;

  const header = drawing.gearTable.header;
  const rows = drawing.gearTable.rows.map((r) => r.cells);
  const charW = font * 0.55;
  const colW = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)) * charW + 3);
  const tableW = colW.reduce((a, c) => a + c, 0);
  const rowH = font * 1.8;

  const pageW = Math.max(planW, tableW, 170) + 2 * margin;
  const titleH = font * 5;
  const notesH = drawing.notes.length * font * 1.6 + font;
  const tableH = (rows.length + 1) * rowH;
  const pageH = margin + titleH + planH + notesH + tableH + 2 * margin;

  const ox = margin + (pageW - 2 * margin - planW) / 2;
  const oy = margin + titleH;
  const X = (p: Point): number => (b === null ? ox : ox + (p.x - b.min.x + dimMargin) * s);
  const Y = (p: Point): number => (b === null ? oy : oy + (b.max.y - p.y + dimMargin) * s);

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${n(pageW)}mm" height="${n(pageH)}mm" viewBox="0 0 ${n(pageW)} ${n(pageH)}" font-family="Helvetica, Arial, sans-serif">`);
  out.push(`<rect x="0" y="0" width="${n(pageW)}" height="${n(pageH)}" fill="#fff"/>`);
  out.push(`<text x="${n(margin)}" y="${n(margin + font * 1.6)}" font-size="${n(font * 1.6)}" font-weight="bold">${escapeXml(drawing.title)} — plan (nominal)</text>`);
  out.push(`<text x="${n(margin)}" y="${n(margin + font * 3.4)}" font-size="${n(font)}">Scale ${String(s)}:1 · mm · generated ${escapeXml(options.generatedAt)} · not a manufacturing drawing (MFG-002)</text>`);

  if (b === null) {
    out.push(`<text x="${n(ox)}" y="${n(oy + font * 2)}" font-size="${n(font)}">Nothing to draw: no complete frames and no placed arbors.</text>`);
  }

  for (const p of drawing.primitives) {
    const style = LAYER_STYLE[p.layer];
    switch (p.kind) {
      case "circle":
        out.push(`<circle cx="${n(X(p.centre))}" cy="${n(Y(p.centre))}" r="${n(p.radius * s)}" ${style}/>`);
        break;
      case "polygon":
        out.push(`<polygon points="${p.points.map((q) => `${n(X(q))},${n(Y(q))}`).join(" ")}" ${style}/>`);
        break;
      case "line":
        out.push(`<line x1="${n(X(p.a))}" y1="${n(Y(p.a))}" x2="${n(X(p.b))}" y2="${n(Y(p.b))}" ${style}/>`);
        break;
      case "text":
        out.push(`<text x="${n(X(p.at))}" y="${n(Y(p.at))}" font-size="${n(p.height * s)}" text-anchor="${p.align === "centre" ? "middle" : "start"}" ${style}>${escapeXml(p.text)}</text>`);
        break;
      case "dimension": {
        const g = dimensionGeometry(p);
        const line = (a: Point, c: Point): string => `<line x1="${n(X(a))}" y1="${n(Y(a))}" x2="${n(X(c))}" y2="${n(Y(c))}" ${style}/>`;
        out.push(line(g.extA[0], g.extA[1]), line(g.extB[0], g.extB[1]), line(g.line[0], g.line[1]));
        // Arrowheads in paper space, pointing outward to the extension lines.
        const [a2, b2] = g.line;
        const ax = X(a2), ay = Y(a2), bx = X(b2), by = Y(b2);
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const ux = (bx - ax) / len, uy = (by - ay) / len;
        const head = Math.min(2, len / 3), half = head * 0.3;
        const arrow = (tx: number, ty: number, dx: number, dy: number): string =>
          `<polygon points="${n(tx)},${n(ty)} ${n(tx + dx * head - dy * half)},${n(ty + dy * head + dx * half)} ${n(tx + dx * head + dy * half)},${n(ty + dy * head - dx * half)}" fill="#000"/>`;
        out.push(arrow(ax, ay, ux, uy), arrow(bx, by, -ux, -uy));
        // SVG's y axis points down, so a counter-clockwise model angle is a negative SVG rotation.
        out.push(`<text x="${n(X(g.textAt))}" y="${n(Y(g.textAt))}" font-size="${n(p.height * s)}" text-anchor="middle" transform="rotate(${n(-g.angleDeg)} ${n(X(g.textAt))} ${n(Y(g.textAt))})" fill="#000">${escapeXml(p.text)}</text>`);
        break;
      }
    }
  }

  let y = oy + planH + font * 1.5;
  for (const note of drawing.notes) {
    out.push(`<text x="${n(margin)}" y="${n(y)}" font-size="${n(font * 0.9)}">${escapeXml(note)}</text>`);
    y += font * 1.6;
  }

  y += font * 0.5;
  const drawRow = (cells: readonly string[], bold: boolean): void => {
    let x = margin;
    cells.forEach((cell, i) => {
      out.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(colW[i] ?? 10)}" height="${n(rowH)}" fill="none" stroke="#000" stroke-width="0.13"/>`);
      out.push(`<text x="${n(x + 1.5)}" y="${n(y + rowH * 0.68)}" font-size="${n(font)}"${bold ? ' font-weight="bold"' : ""}>${escapeXml(cell)}</text>`);
      x += colW[i] ?? 10;
    });
    y += rowH;
  };
  drawRow(header, true);
  for (const r of rows) drawRow(r, false);

  out.push("</svg>");
  return out.join("\n");
}
