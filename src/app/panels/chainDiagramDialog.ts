import type { AppStore } from "@/app/store";
import type { EntityId } from "@/domain/ids";
import { buildChainDiagram, CHAIN_LAYOUT, chainNodeHeight, type ChainDiagram, type ChainNode } from "@/analysis/chainDiagram";

export interface ChainDiagramDialog {
  open(): void;
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

/** The line for one connection: from the side of the earlier column to the side of the later one. */
function edgePath(from: ChainNode, to: ChainNode): { d: string; mid: { x: number; y: number } } {
  const W = CHAIN_LAYOUT.nodeWidth;
  const fromMid = from.y + chainNodeHeight(from) / 2;
  const toMid = to.y + chainNodeHeight(to) / 2;
  if (from.column === to.column) {
    // Same column: join the facing top/bottom edges with a short bow out to the left.
    const upper = from.y <= to.y ? from : to;
    const lower = upper === from ? to : from;
    const x = upper.x + W / 2;
    const y1 = upper.y + chainNodeHeight(upper);
    const y2 = lower.y;
    return { d: `M ${String(x)} ${String(y1)} L ${String(x)} ${String(y2)}`, mid: { x, y: (y1 + y2) / 2 } };
  }
  const forward = from.column < to.column;
  const x1 = forward ? from.x + W : from.x;
  const x2 = forward ? to.x : to.x + W;
  const bend = (x2 - x1) / 2;
  const d = `M ${String(x1)} ${String(fromMid)} C ${String(x1 + bend)} ${String(fromMid)}, ${String(x2 - bend)} ${String(toMid)}, ${String(x2)} ${String(toMid)}`;
  return { d, mid: { x: (x1 + x2) / 2, y: (fromMid + toMid) / 2 } };
}

function drawDiagram(diagram: ChainDiagram, onPick: (entityId: string) => void): SVGSVGElement {
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
    const { d, mid } = edgePath(from, to);
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
    header.append(title, fit, close);
    dialog.appendChild(header);

    const diagram = buildChainDiagram(store.movement, store.analysis.train);
    const summary = document.createElement("div");
    summary.className = `projects-note ${diagram.disconnected.length === 0 ? "muted" : "issue-error"}`;
    summary.dataset.testid = "chain-summary";
    summary.textContent = diagram.nodes.length === 0
      ? "There is nothing to connect yet: add arbors and gears."
      : diagram.disconnected.length === 0
        ? `All ${String(diagram.nodes.length)} parts are connected to the mainspring through one chain.`
        : `Not connected to the mainspring: ${diagram.disconnected.join(", ")}.`;
    dialog.appendChild(summary);

    const legend = document.createElement("div");
    legend.className = "chain-legend muted";
    legend.textContent = "Solid line: gears meshing, labelled driving : driven teeth. Dotted: friction clutch. Dashed arrow: a jump link (one step at a time). Amber arrow: spring and escapement. Click a part to select it.";
    dialog.appendChild(legend);

    const scroller = document.createElement("div");
    scroller.className = "chain-scroll";
    if (diagram.nodes.length > 0) {
      const drawing = drawDiagram(diagram, (entityId) => {
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
    caveat.textContent = "A map of connections with the solved running speeds (L2 kinematic, an approximation). It says nothing about torque, friction or whether a real spring could drive it: that needs physical validation.";
    dialog.appendChild(caveat);
  };

  return {
    open() {
      render();
      dialog.showModal();
    },
  };
}
