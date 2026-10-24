import type { Movement } from "@/domain/movement";
import type { Shaft, ShaftId } from "@/domain/shaft";
import type { GearTrainSolution } from "@/kinematics/solveGearTrain";
import { beatFrequency } from "@/kinematics/escapement";
import { formatPeriod } from "@/kinematics/timeDisplay";
import { isValidToothCount } from "@/math/gearMath";
import { windowsPerRevolution } from "@/domain/moonPhase";

/**
 * The drive chain as a diagram (follow-up 32), generated from the domain model and the solved gear
 * train, never drawn by hand: every part (arbor, with its gears), every connection (gear mesh, friction
 * clutch, mainspring, escapement lock, calendar jump) and every speed comes from the design. Pure; the
 * SVG is drawn from it in `src/app/panels/chainDiagram.ts`.
 *
 * Simplification (ASM-0086): the diagram is a map of what is connected to what, with the solved running
 * speeds (L2 kinematic). It says nothing about torque, friction or whether a real spring could drive it.
 */

export type ChainNodeKind = "SPRING" | "ARBOR" | "ESCAPEMENT" | "CALENDAR" | "ISOLATED";
export type ChainEdgeKind = "MESH" | "CLUTCH" | "SPRING" | "ESCAPE" | "JUMP";

export interface ChainNode {
  id: string;
  kind: ChainNodeKind;
  title: string;
  /** What the part carries, one line each (gears and their tooth counts, complication facts). */
  lines: string[];
  /** The shaft's own solved speed, or null when it has none (a jump-driven star, the spring). */
  speed: string | null;
  /** A short role tag: "Minute hand", "Moon-phase disc"… */
  badges: string[];
  /** The domain entity to select when the node is clicked, or null. */
  entityId: string | null;
  /** Columns count steps from the mainspring; null before layout. */
  column: number;
  row: number;
  x: number;
  y: number;
}

export interface ChainEdge {
  from: string;
  to: string;
  kind: ChainEdgeKind;
  /** "10 : 30" for a mesh (driving : driven teeth), a few words for the others. */
  label: string;
}

/**
 * LEFT_RIGHT: one column per step from the mainspring, read across (the on-screen diagram).
 * TOP_DOWN: the same steps as rows, read down, so the whole chain fits the width of a portrait page.
 */
export type ChainOrientation = "LEFT_RIGHT" | "TOP_DOWN";

export interface ChainDiagram {
  orientation: ChainOrientation;
  nodes: ChainNode[];
  edges: ChainEdge[];
  width: number;
  height: number;
  /** Plain-language answer to "is everything connected": null when all parts hang off the mainspring. */
  disconnected: string[];
  columnCount: number;
}

export const CHAIN_LAYOUT = {
  nodeWidth: 214,
  lineHeight: 15,
  nodePaddingTop: 26,
  nodePaddingBottom: 10,
  columnGap: 112,
  rowGap: 18,
  /** TOP_DOWN: room between one level and the next for the connection labels, and between neighbours on a level. */
  levelGap: 56,
  siblingGap: 28,
  margin: 20,
} as const;

const HAND_LABELS = { HOURS: "Hour hand", MINUTES: "Minute hand", SECONDS: "Seconds hand" } as const;

function nodeHeight(node: Pick<ChainNode, "lines" | "speed" | "badges">): number {
  const L = CHAIN_LAYOUT;
  const rows = node.lines.length + (node.speed === null ? 0 : 1) + (node.badges.length > 0 ? 1 : 0);
  return L.nodePaddingTop + rows * L.lineHeight + L.nodePaddingBottom;
}

export function chainNodeHeight(node: ChainNode): number {
  return nodeHeight(node);
}

export function buildChainDiagram(movement: Movement, train: GearTrainSolution, orientation: ChainOrientation = "LEFT_RIGHT"): ChainDiagram {
  const nodes = new Map<string, ChainNode>();
  const edges: ChainEdge[] = [];
  const blank = { column: -1, row: 0, x: 0, y: 0 } as const;

  // Shafts that belong to an escapement are drawn inside its one node.
  const inEscapement = new Set<ShaftId>();
  for (const e of Object.values(movement.escapements)) {
    inEscapement.add(e.palletArborShaftId);
    inEscapement.add(e.balanceShaftId);
  }

  const shaftNode = (s: Shaft): ChainNode => {
    const gears = Object.values(movement.gears).filter((g) => g.shaftId === s.id);
    const omega = train.shaftAngularVelocity.get(s.id);
    const badges: string[] = [];
    if (s.hand !== null) badges.push(HAND_LABELS[s.hand]);
    return {
      id: s.id, kind: "ARBOR", title: s.name, entityId: s.id, badges,
      lines: gears.length === 0 ? [] : gears.map((g) => `${g.name} · ${String(g.toothCount)} teeth`),
      speed: omega === undefined || omega === 0 ? null : formatPeriod(omega),
      ...blank,
    };
  };
  for (const s of Object.values(movement.shafts)) if (!inEscapement.has(s.id)) nodes.set(s.id, shaftNode(s));

  const nodeOfShaft = (id: ShaftId): ChainNode | undefined => nodes.get(id);
  const addEdge = (from: string, to: string, kind: ChainEdgeKind, label: string): void => {
    if (nodes.has(from) && nodes.has(to) && from !== to) edges.push({ from, to, kind, label });
  };

  // Gear meshes: driving : driven teeth, between the arbors the two gears sit on.
  const seenMesh = new Set<string>();
  for (const mesh of Object.values(movement.gearMeshes)) {
    const a = movement.gears[mesh.drivingGearId];
    const b = movement.gears[mesh.drivenGearId];
    if (a === undefined || b === undefined) continue;
    const key = `${a.shaftId}>${b.shaftId}`;
    if (seenMesh.has(key)) continue;
    seenMesh.add(key);
    addEdge(a.shaftId, b.shaftId, "MESH", `${String(a.toothCount)} : ${String(b.toothCount)}`);
  }

  // Couplings: the friction clutch (cannon pinion on the centre arbor) and the mainspring.
  for (const c of Object.values(movement.couplings)) {
    if (c.kind === "FRICTION_CLUTCH") {
      addEdge(c.shaftAId, c.shaftBId, "CLUTCH", "friction clutch");
    } else {
      // The spring turns the drum and is wound through the barrel arbor.
      const springId = `spring:${c.id}`;
      nodes.set(springId, {
        id: springId, kind: "SPRING", title: c.name === "" ? "Mainspring" : c.name, entityId: c.id,
        lines: c.spring === null ? ["spring data not entered"] : [`${String(c.spring.usableTurns)} usable turns`],
        speed: null, badges: ["Energy source"], ...blank,
      });
      addEdge(springId, c.shaftBId, "SPRING", "drives");
      addEdge(c.shaftAId, springId, "SPRING", "winds");
    }
  }

  // The escapement: one node fed from the escape arbor.
  for (const e of Object.values(movement.escapements)) {
    const omega = train.shaftAngularVelocity.get(e.escapeArborShaftId);
    const beats = omega !== undefined && omega !== 0 && isValidToothCount(e.escapeWheel.toothCount) ? beatFrequency(omega, e.escapeWheel.toothCount) : null;
    const id = `escapement:${e.id}`;
    nodes.set(id, {
      id, kind: "ESCAPEMENT", title: e.name === "" ? "Escapement" : e.name, entityId: e.id,
      lines: [`Escape wheel · ${String(e.escapeWheel.toothCount)} teeth`, "Pallet fork + balance wheel"],
      speed: beats === null ? null : `${beats.toFixed(2)} beats per second`,
      badges: ["Governs the train"], ...blank,
    });
    addEdge(e.escapeArborShaftId, id, "ESCAPE", "locks and releases");
  }

  // Calendar and moon: driven by jumps (or, for the moon, by gears), not by a continuous arbor.
  for (const moon of Object.values(movement.moonPhases)) {
    const n = nodeOfShaft(moon.shaftId);
    if (n !== undefined) {
      n.badges.push("Moon-phase disc");
      n.lines.push(`${String(windowsPerRevolution(moon.windowCount))} moon image(s) on the disc`);
    }
  }
  const markStar = (shaftId: ShaftId, title: string, line: string): void => {
    const n = nodeOfShaft(shaftId);
    if (n === undefined) return;
    n.kind = "CALENDAR";
    n.title = title;
    n.lines.push(line);
  };
  for (const d of Object.values(movement.dateComplications)) {
    markStar(d.starShaftId, d.name, `${String(d.starToothCount)}-position star`);
    addEdge(d.driveShaftId, d.starShaftId, "JUMP", "1 step per turn");
  }
  for (const m of Object.values(movement.monthComplications)) {
    const date = movement.dateComplications[m.dateComplicationId];
    markStar(m.starShaftId, m.name, "12-position star");
    if (date !== undefined) addEdge(date.starShaftId, m.starShaftId, "JUMP", "at month end");
  }
  const monthStarOf = (id: string): ShaftId | undefined => movement.monthComplications[id as keyof typeof movement.monthComplications]?.starShaftId;
  for (const l of Object.values(movement.leapYearComplications)) {
    markStar(l.wheelShaftId, l.name, "4-position wheel");
    const from = monthStarOf(l.monthComplicationId);
    if (from !== undefined) addEdge(from, l.wheelShaftId, "JUMP", "each Dec → Jan");
  }
  for (const s of Object.values(movement.seasonComplications)) {
    markStar(s.wheelShaftId, s.name, "4-position wheel");
    const from = monthStarOf(s.monthComplicationId);
    if (from !== undefined) addEdge(from, s.wheelShaftId, "JUMP", "each quarter");
  }
  const digits = Object.values(movement.yearDigitComplications);
  if (digits.length > 0) {
    const id = "yearDigits";
    nodes.set(id, {
      id, kind: "CALENDAR", title: "Year digits", entityId: digits[0]?.id ?? null,
      lines: [`${String(digits.length)} digit barrel(s), ones → thousands`], speed: null, badges: [], ...blank,
    });
    const from = monthStarOf(digits[0]?.monthComplicationId ?? "");
    if (from !== undefined) addEdge(from, id, "JUMP", "Dec → Jan, carry");
  }

  // Columns: steps from the mainspring (or, without one, from the first part), over every connection.
  const adjacency = new Map<string, string[]>();
  for (const id of nodes.keys()) adjacency.set(id, []);
  for (const e of edges) {
    adjacency.get(e.from)?.push(e.to);
    adjacency.get(e.to)?.push(e.from);
  }
  const roots = [...nodes.values()].filter((n) => n.kind === "SPRING").map((n) => n.id);
  if (roots.length === 0) {
    const first = nodes.keys().next();
    if (first.done !== true) roots.push(first.value);
  }
  const column = new Map<string, number>();
  const queue: string[] = [];
  for (const r of roots) { column.set(r, 0); queue.push(r); }
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    for (const next of adjacency.get(id) ?? []) {
      if (!column.has(next)) { column.set(next, (column.get(id) ?? 0) + 1); queue.push(next); }
    }
  }
  const disconnected = [...nodes.values()].filter((n) => !column.has(n.id)).map((n) => n.title);
  const reachedColumns = Math.max(-1, ...column.values()) + 1;
  for (const n of nodes.values()) {
    n.column = column.get(n.id) ?? reachedColumns; // anything not connected goes in a last column
    if (!column.has(n.id)) n.kind = "ISOLATED";
  }

  // Rows within a column: ordered by where their neighbours in earlier columns sit, to keep lines short.
  const byColumn = new Map<number, ChainNode[]>();
  for (const n of nodes.values()) byColumn.set(n.column, [...(byColumn.get(n.column) ?? []), n]);
  const columnIndexes = [...byColumn.keys()].sort((a, b) => a - b);
  for (const c of columnIndexes) {
    const members = byColumn.get(c) ?? [];
    const score = (n: ChainNode): number => {
      const earlier = (adjacency.get(n.id) ?? []).map((id) => nodes.get(id)).filter((m): m is ChainNode => m !== undefined && m.column < n.column);
      return earlier.length === 0 ? Number.MAX_SAFE_INTEGER : earlier.reduce((sum, m) => sum + m.row, 0) / earlier.length;
    };
    members.sort((a, b) => score(a) - score(b) || a.title.localeCompare(b.title));
    members.forEach((n, i) => { n.row = i; });
  }

  // Coordinates.
  const L = CHAIN_LAYOUT;
  let width = 0;
  let height = 0;
  if (orientation === "LEFT_RIGHT") {
    for (const c of columnIndexes) {
      let y = L.margin;
      for (const n of byColumn.get(c) ?? []) {
        n.x = L.margin + c * (L.nodeWidth + L.columnGap);
        n.y = y;
        y += nodeHeight(n) + L.rowGap;
        width = Math.max(width, n.x + L.nodeWidth + L.margin);
      }
      height = Math.max(height, y - L.rowGap + L.margin);
    }
  } else {
    let y = L.margin;
    for (const c of columnIndexes) {
      const members = byColumn.get(c) ?? [];
      const levelHeight = Math.max(0, ...members.map(nodeHeight));
      members.forEach((n, i) => {
        n.x = L.margin + i * (L.nodeWidth + L.siblingGap);
        n.y = y;
        width = Math.max(width, n.x + L.nodeWidth + L.margin);
      });
      y += levelHeight + L.levelGap;
    }
    height = y - L.levelGap + L.margin;
  }
  return { orientation, nodes: [...nodes.values()], edges, width, height, disconnected, columnCount: columnIndexes.length };
}
