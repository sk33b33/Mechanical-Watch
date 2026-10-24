import type { AppStore } from "@/app/store";
import type { EntityId } from "@/domain/ids";
import { CHAIN_CAVEAT_TEXT, CHAIN_LEGEND_TEXT, chainPrintDocument, chainStandaloneSvg } from "@/analysis/chainDiagramPrint";
import { buildChainDiagram, CHAIN_LAYOUT, chainNodeHeight, type ChainDiagram, type ChainNode } from "@/analysis/chainDiagram";

export interface ChainDiagramDialog {
  open(): void;
}

function summaryText(diagram: ChainDiagram): string {
  return diagram.nodes.length === 0
    ? "There is nothing to connect yet: add arbors and gears."
    : diagram.disconnected.length === 0
      ? `All ${String(diagram.nodes.length)} parts are connected to the mainspring through one chain.`
      : `Not connected to the mainspring: ${diagram.disconnected.join(", ")}.`;
}

/** Prints through a hidden frame, so no pop-up is needed (and none can be blocked). */
function printHtml(html: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  frame.srcdoc = html;
  frame.addEventListener("load", () => {
    const win = frame.contentWindow;
    if (win === null) { frame.remove(); return; }
    win.addEventListener("afterprint", () => { frame.remove(); });
    win.focus();
    win.print();
    // Browsers that never fire afterprint: clean the frame up later.
    window.setTimeout(() => { frame.remove(); }, 120_000);
  });
  document.body.appendChild(frame);
}

function downloadText(filename: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => { URL.revokeObjectURL(url); }, 10_000);
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  return el;
}

function text(x: number, y: number, content: string, className: string): SVGTextElement {
  const el = svg("text", { x: String(x), y: String(y), class: className });
  el.textContent = content;
  return el;
}

/** The line for one connection, from the side of `from` facing `to` to the side of `to` facing `from`. */
function edgePath(diagram: ChainDiagram, from: ChainNode, to: ChainNode): { d: string; mid: { x: number; y: number } } {
  const W = CHAIN_LAYOUT.nodeWidth;
  const fromH = chainNodeHeight(from);
  const toH = chainNodeHeight(to);
  const n = (v: number): string => String(v);
  if (diagram.orientation === "TOP_DOWN") {
    if (from.column === to.column) {
      // Neighbours on one level: a straight line between their facing sides.
      const left = from.x <= to.x ? from : to;
      const right = left === from ? to : from;
      const y = left.y + chainNodeHeight(left) / 2;
      const x1 = left.x + W;
      const x2 = right.x;
      return { d: `M ${n(from === left ? x1 : x2)} ${n(y)} L ${n(from === left ? x2 : x1)} ${n(y)}`, mid: { x: (x1 + x2) / 2, y } };
    }
    const down = from.column < to.column;
    const x1 = from.x + W / 2;
    const y1 = down ? from.y + fromH : from.y;
    const x2 = to.x + W / 2;
    const y2 = down ? to.y : to.y + toH;
    const bend = (y2 - y1) / 2;
    return { d: `M ${n(x1)} ${n(y1)} C ${n(x1)} ${n(y1 + bend)}, ${n(x2)} ${n(y2 - bend)}, ${n(x2)} ${n(y2)}`, mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } };
  }
  const fromMid = from.y + fromH / 2;
  const toMid = to.y + toH / 2;
  if (from.column === to.column) {
    // Same column: join the facing top/bottom edges.
    const upper = from.y <= to.y ? from : to;
    const lower = upper === from ? to : from;
    const x = upper.x + W / 2;
    const y1 = upper.y + chainNodeHeight(upper);
    const y2 = lower.y;
    return { d: `M ${n(x)} ${n(y1)} L ${n(x)} ${n(y2)}`, mid: { x, y: (y1 + y2) / 2 } };
  }
  const forward = from.column < to.column;
  const x1 = forward ? from.x + W : from.x;
  const x2 = forward ? to.x : to.x + W;
  const bend = (x2 - x1) / 2;
  return { d: `M ${n(x1)} ${n(fromMid)} C ${n(x1 + bend)} ${n(fromMid)}, ${n(x2 - bend)} ${n(toMid)}, ${n(x2)} ${n(toMid)}`, mid: { x: (x1 + x2) / 2, y: (fromMid + toMid) / 2 } };
}

export function drawChainDiagram(diagram: ChainDiagram, onPick: (entityId: string) => void): SVGSVGElement {
  const root = svg("svg", {
    class: "chain-svg", width: String(diagram.width), height: String(diagram.height),
    viewBox: `0 0 ${String(diagram.width)} ${String(diagram.height)}`, role: "img",
    "aria-label": "Drive chain: how every part of the movement is connected",
  });
  const defs = svg("defs");
  for (const kind of ["jump", "power"] as const) {
    const marker = svg("marker", { id: `chain-arrow-${kind}`, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" });
    marker.appendChild(svg("path", { d: "M 0 0 L 10 5 L 0 10 z", class: `chain-arrowhead chain-arrowhead-${kind}` }));
    defs.appendChild(marker);
  }
  root.appendChild(defs);

  const byId = new Map(diagram.nodes.map((n) => [n.id, n]));
  const edgeLayer = svg("g");
  const labelLayer = svg("g");
  for (const edge of diagram.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from === undefined || to === undefined) continue;
    const { d, mid } = edgePath(diagram, from, to);
    const path = svg("path", { d, class: `chain-edge chain-edge-${edge.kind.toLowerCase()}`, fill: "none" });
    if (edge.kind === "JUMP") path.setAttribute("marker-end", "url(#chain-arrow-jump)");
    if (edge.kind === "ESCAPE" || edge.kind === "SPRING") path.setAttribute("marker-end", "url(#chain-arrow-power)");
    const title = svg("title");
    title.textContent = `${from.title} → ${to.title}: ${edge.label}`;
    path.appendChild(title);
    edgeLayer.appendChild(path);
    const width = Math.max(30, edge.label.length * 6.4 + 10);
    labelLayer.appendChild(svg("rect", { x: String(mid.x - width / 2), y: String(mid.y - 9), width: String(width), height: "16", rx: "3", class: "chain-label-bg" }));
    labelLayer.appendChild(text(mid.x, mid.y + 3, edge.label, `chain-label chain-label-${edge.kind.toLowerCase()}`));
  }
  root.append(edgeLayer, labelLayer);

  const L = CHAIN_LAYOUT;
  for (const node of diagram.nodes) {
    const h = chainNodeHeight(node);
    const g = svg("g", { class: `chain-node chain-node-${node.kind.toLowerCase()}`, transform: `translate(${String(node.x)} ${String(node.y)})`, tabindex: "0", role: "button" });
    g.setAttribute("aria-label", `${node.title}. ${node.lines.join(". ")}`);
    g.appendChild(svg("rect", { width: String(L.nodeWidth), height: String(h), rx: "7", class: "chain-node-box" }));
    g.appendChild(text(10, 17, node.title, "chain-node-title"));
    let y = L.nodePaddingTop + 8;
    for (const line of node.lines) { g.appendChild(text(10, y, line, "chain-node-line")); y += L.lineHeight; }
    if (node.speed !== null) { g.appendChild(text(10, y, node.speed, "chain-node-speed")); y += L.lineHeight; }
    if (node.badges.length > 0) g.appendChild(text(10, y, node.badges.join(" · "), "chain-node-badge"));
    const pick = (): void => { if (node.entityId !== null) onPick(node.entityId); };
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(); } });
    root.appendChild(g);
  }
  return root;
}

/**
 * The drive chain as a diagram (follow-up 32, ASM-0086): every part of the current design and what drives
 * what, generated from the model and the solved gear train, so it always matches the design. Click a part to select it.
 */
export function mountChainDiagramDialog(root: HTMLElement, store: AppStore): ChainDiagramDialog {
  const dialog = document.createElement("dialog");
  dialog.className = "projects-dialog chain-dialog";
  root.appendChild(dialog);

  let fitToWindow = false;
  const render = (): void => {
    dialog.innerHTML = "";
    const header = document.createElement("div");
    header.className = "projects-header";
    const title = document.createElement("strong");
    title.textContent = "Drive chain: how everything is connected";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.addEventListener("click", () => { dialog.close(); });
    const fit = document.createElement("button");
    fit.type = "button";
    fit.title = "Scale the whole diagram to the window, or show it at full size and scroll";
    fit.addEventListener("click", () => { fitToWindow = !fitToWindow; render(); });
    fit.textContent = fitToWindow ? "Full size" : "Fit to window";
    const printable = (): { svg: string; summary: string } => {
      // A top-down drawing, so the whole chain fits the width of a portrait page.
      const topDown = buildChainDiagram(store.movement, store.analysis.train, "TOP_DOWN");
      const drawing = drawChainDiagram(topDown, () => undefined);
      drawing.setAttribute("width", "100%");
      drawing.removeAttribute("height");
      return { svg: new XMLSerializer().serializeToString(drawing), summary: summaryText(topDown) };
    };
    const print = document.createElement("button");
    print.type = "button";
    print.textContent = "Print…";
    print.title = "Print the diagram on one portrait A4 sheet (black on white)";
    print.dataset.testid = "chain-print";
    print.addEventListener("click", () => {
      const { svg: markup, summary: text } = printable();
      printHtml(chainPrintDocument({ svg: markup, movementName: store.movement.name, summary: text, generatedAt: new Date() }));
    });
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "Download SVG";
    save.title = "Save the diagram as an SVG file (black on white)";
    save.dataset.testid = "chain-download";
    save.addEventListener("click", () => {
      downloadText("drive-chain.svg", chainStandaloneSvg(printable().svg), "image/svg+xml");
    });
    header.append(title, print, save, fit, close);
    dialog.appendChild(header);

    const diagram = buildChainDiagram(store.movement, store.analysis.train);
    const summary = document.createElement("div");
    summary.className = `projects-note ${diagram.disconnected.length === 0 ? "muted" : "issue-error"}`;
    summary.dataset.testid = "chain-summary";
    summary.textContent = summaryText(diagram);
    dialog.appendChild(summary);

    const legend = document.createElement("div");
    legend.className = "chain-legend muted";
    legend.textContent = `${CHAIN_LEGEND_TEXT} Click a part to select it.`;
    dialog.appendChild(legend);

    const scroller = document.createElement("div");
    scroller.className = "chain-scroll";
    if (diagram.nodes.length > 0) {
      const drawing = drawChainDiagram(diagram, (entityId) => {
        store.select(entityId as EntityId);
        dialog.close();
      });
      if (fitToWindow) {
        // Scales with the dialog (the viewBox keeps the proportions); text gets small on a long chain.
        drawing.setAttribute("width", "100%");
        drawing.removeAttribute("height");
      }
      scroller.appendChild(drawing);
    }
    dialog.appendChild(scroller);

    const caveat = document.createElement("div");
    caveat.className = "projects-note muted";
    caveat.textContent = CHAIN_CAVEAT_TEXT;
    dialog.appendChild(caveat);
  };

  return {
    open() {
      render();
      dialog.showModal();
    },
  };
}
