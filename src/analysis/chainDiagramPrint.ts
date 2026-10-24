/**
 * The printable forms of the drive-chain diagram (follow-up 33, ASM-0086): a standalone page for the
 * browser's Print (set for a portrait A4 sheet, black on white so it prints well without ink-heavy
 * backgrounds) and a standalone SVG file. Both embed the diagram's own markup, drawn from the design, and
 * restate its limits (a map of connections and solved speeds; no torque, friction or physical validation).
 */

/** Print-friendly colours for the diagram's own classes (the on-screen theme is dark). */
export const CHAIN_PRINT_CSS = `
.chain-svg { font-family: Helvetica, Arial, sans-serif; background: #ffffff; }
.chain-node { cursor: default; }
.chain-node-box { fill: #f4f6f8; stroke: #5b6672; stroke-width: 1.2; }
.chain-node-spring .chain-node-box { fill: #fbeed2; stroke: #b9791a; }
.chain-node-escapement .chain-node-box { fill: #f6efce; stroke: #a8902f; }
.chain-node-calendar .chain-node-box { fill: #e3ecfa; stroke: #3d6bb5; }
.chain-node-isolated .chain-node-box { fill: #fbe3e3; stroke: #c43a3a; stroke-dasharray: 4 3; }
.chain-node-title { fill: #111418; font-size: 12px; font-weight: 700; }
.chain-node-line { fill: #3c4650; font-size: 11px; }
.chain-node-speed { fill: #1a7a46; font-size: 11px; }
.chain-node-badge { fill: #9a5a00; font-size: 10.5px; font-weight: 700; }
.chain-edge { stroke: #5b6672; stroke-width: 1.6; fill: none; }
.chain-edge-clutch { stroke-dasharray: 2 4; }
.chain-edge-jump { stroke: #3d6bb5; stroke-dasharray: 6 4; }
.chain-edge-spring, .chain-edge-escape { stroke: #b9791a; }
.chain-arrowhead-jump { fill: #3d6bb5; }
.chain-arrowhead-power { fill: #b9791a; }
.chain-label-bg { fill: #ffffff; stroke: #c3cad1; stroke-width: 0.8; }
.chain-label { fill: #111418; font-size: 10.5px; text-anchor: middle; }
.chain-label-jump { fill: #2b5190; }
.chain-label-spring, .chain-label-escape { fill: #8a5a10; }
`;

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const CHAIN_LEGEND_TEXT =
  "Solid line: gears meshing, labelled driving : driven teeth. Dotted: friction clutch. Dashed arrow: a jump link (one step at a time). Amber arrow: spring and escapement.";

export const CHAIN_CAVEAT_TEXT =
  "A map of connections with the solved running speeds (L2 kinematic, an approximation). It says nothing about torque, friction or whether a real spring could drive it: that needs physical validation.";

export interface ChainPrintInput {
  /** The diagram as SVG markup (a TOP_DOWN drawing, so it fits the page width). */
  svg: string;
  movementName: string;
  summary: string;
  generatedAt: Date;
}

/** A complete HTML page of the diagram, set up for printing on one portrait A4 sheet. */
export function chainPrintDocument(input: ChainPrintInput): string {
  const title = `Drive chain: ${input.movementName}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
html, body { margin: 0; background: #fff; color: #111418; font-family: Helvetica, Arial, sans-serif; }
h1 { font-size: 16pt; margin: 0 0 2mm; }
.meta { font-size: 8.5pt; color: #3c4650; margin: 0 0 3mm; }
.summary { font-size: 10pt; font-weight: 600; margin: 0 0 2mm; }
.legend, .caveat { font-size: 8pt; line-height: 1.4; color: #3c4650; margin: 0 0 3mm; }
.diagram svg { display: block; width: 100%; height: auto; max-height: 215mm; }
.caveat { margin-top: 3mm; border-top: 1px solid #c3cad1; padding-top: 2mm; }
${CHAIN_PRINT_CSS}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">Generated ${escapeHtml(input.generatedAt.toISOString())} from the design model. Mechanical Watchmaker 3D.</p>
<p class="summary">${escapeHtml(input.summary)}</p>
<p class="legend">${escapeHtml(CHAIN_LEGEND_TEXT)}</p>
<div class="diagram">${input.svg}</div>
<p class="caveat">${escapeHtml(CHAIN_CAVEAT_TEXT)}</p>
</body>
</html>
`;
}

/** A standalone SVG file of the diagram (own namespace, white background and print colours embedded). */
export function chainStandaloneSvg(svgMarkup: string): string {
  const withNamespace = svgMarkup.includes("xmlns=") ? svgMarkup : svgMarkup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${withNamespace.replace(/(<svg[^>]*>)/, `$1<style>${CHAIN_PRINT_CSS}</style><rect width="100%" height="100%" fill="#ffffff"/>`)}\n`;
}
