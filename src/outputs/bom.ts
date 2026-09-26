import type { Movement } from "@/domain/movement";
import type { EntityId } from "@/domain/ids";
import type { Shaft } from "@/domain/shaft";
import { isValidModule, isValidToothCount, pitchDiameter } from "@/math/gearMath";
import { mmText, optionalMmText } from "./componentReport";

/**
 * Bill of materials generated from the design model. Each row is one
 * modeled part (quantity 1: the model has no instancing). Material,
 * finish and supplier are not modeled, so they are reported as not
 * specified rather than guessed. A friction clutch is a joint between
 * parts, not a part, so it appears as a note on the arbor it belongs to.
 */
export interface BomRow {
  /** Hierarchical item number, e.g. "3" for an arbor, "3.1" for a gear on it. */
  item: string;
  depth: 0 | 1;
  entityId: EntityId;
  name: string;
  type: string;
  quantity: number;
  specification: string;
  location: string;
  material: string;
  tolerances: string;
  notes: string;
}

export const BOM_COLUMNS: readonly { key: keyof BomRow; label: string }[] = [
  { key: "item", label: "Item" },
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "quantity", label: "Qty" },
  { key: "specification", label: "Specification (nominal)" },
  { key: "location", label: "Location" },
  { key: "material", label: "Material" },
  { key: "tolerances", label: "Tolerances" },
  { key: "notes", label: "Notes" },
];

const NOT_SPECIFIED = "not specified (not modeled)";
const byName = <T extends { name: string }>(a: T, b: T): number => a.name.localeCompare(b.name);

function toleranceSummary(movement: Movement, entityId: EntityId): string {
  const count = Object.values(movement.tolerances).filter((t) => t.entityId === entityId).length;
  return count === 0 ? "nominal only" : `${String(count)} declared`;
}

function arborType(shaft: Shaft): string {
  switch (shaft.support.kind) {
    case "PIVOTED":
      return "Arbor (pivoted)";
    case "STUD":
      return "Arbor (on stud)";
    case "CARRIED":
      return "Arbor (carried)";
  }
}

export function buildBom(movement: Movement): BomRow[] {
  const rows: BomRow[] = [];
  let item = 0;
  const row = (r: Omit<BomRow, "quantity" | "material">): void => {
    rows.push({ ...r, quantity: 1, material: NOT_SPECIFIED });
  };

  for (const frame of Object.values(movement.frames).sort(byName)) {
    item += 1;
    row({
      item: String(item), depth: 0, entityId: frame.id, name: frame.name,
      type: frame.kind === "MAINPLATE" ? "Mainplate" : "Bridge",
      specification: `${frame.outline.kind === "CIRCLE" ? `Ø ${mmText(frame.outline.radius * 2, 3)}` : `${String(frame.outline.points.length)}-point outline`}, thickness ${mmText(frame.thickness, 3)}`,
      location: `underside at ${mmText(frame.zBottom, 3)}`,
      tolerances: toleranceSummary(movement, frame.id),
      notes: "flat slab; pillars, screws and recesses not modeled (ASM-0010)",
    });
  }

  for (const shaft of Object.values(movement.shafts).sort(byName)) {
    item += 1;
    const clutches = Object.values(movement.couplings).filter((c) => c.shaftAId === shaft.id || c.shaftBId === shaft.id);
    const other = (c: (typeof clutches)[number]): string =>
      movement.shafts[c.shaftAId === shaft.id ? c.shaftBId : c.shaftAId]?.name ?? "missing arbor";
    row({
      item: String(item), depth: 0, entityId: shaft.id, name: shaft.name, type: arborType(shaft),
      specification: shaft.support.kind === "PIVOTED"
        ? `pivots Ø ${optionalMmText(shaft.pivotDiameter.LOWER)} / ${optionalMmText(shaft.pivotDiameter.UPPER)}, shoulder span ${optionalMmText(shaft.shoulderSpan)}`
        : "no pivots of its own",
      location: shaft.support.kind === "STUD" ? `stud in ${movement.frames[shaft.support.frameId]?.name ?? "missing frame"}` : "",
      tolerances: toleranceSummary(movement, shaft.id),
      notes: [
        ...(shaft.hand === null ? [] : [`carries the ${shaft.hand.toLowerCase()} hand (hand not modeled, ASM-0016)`]),
        ...clutches.map((c) => c.kind === "FRICTION_CLUTCH"
          ? `friction clutch with ${other(c)} (ASM-0015)`
          : c.shaftAId === shaft.id ? `winds the mainspring of ${other(c)} (ASM-0018)` : `driven by its mainspring from ${other(c)} (ASM-0018)`),
      ].join("; "),
    });
    let sub = 0;
    for (const gear of Object.values(movement.gears).filter((g) => g.shaftId === shaft.id).sort(byName)) {
      sub += 1;
      const defined = isValidToothCount(gear.toothCount) && isValidModule(gear.module);
      row({
        item: `${String(item)}.${String(sub)}`, depth: 1, entityId: gear.id, name: gear.name, type: "Gear",
        specification: `z = ${Number.isFinite(gear.toothCount) ? String(gear.toothCount) : "?"}, m = ${mmText(gear.module)}, pitch Ø ${defined ? mmText(pitchDiameter(gear.module, gear.toothCount)) : "?"}, thickness ${mmText(gear.thickness, 3)}`,
        location: `mid-plane at ${mmText(gear.zCentre, 3)}`,
        tolerances: "nominal only",
        notes: gear.profileModel === "PITCH_MODEL" ? "pitch model: tooth profile not defined (REF-ENG §6)" : "",
      });
    }
  }

  for (const jewel of Object.values(movement.jewels).sort(byName)) {
    item += 1;
    row({
      item: String(item), depth: 0, entityId: jewel.id, name: jewel.name,
      type: jewel.kind === "HOLE_JEWEL" ? "Hole jewel" : "Plain hole",
      specification: `bore Ø ${optionalMmText(jewel.boreDiameter)}; outer size not modeled (ASM-0012)`,
      location: `${movement.frames[jewel.frameId]?.name ?? "missing frame"}, ${movement.shafts[jewel.shaftId]?.name ?? "missing arbor"} ${jewel.end.toLowerCase()}`,
      tolerances: toleranceSummary(movement, jewel.id),
      notes: jewel.kind === "PLAIN_HOLE" ? "a hole in the frame, not a separate part" : "",
    });
  }
  for (const keyless of Object.values(movement.keylessWorks).sort(byName)) {
    item += 1;
    const parent = String(item);
    row({
      item: parent, depth: 0, entityId: keyless.id, name: keyless.name, type: "Keyless works",
      specification: `stem at ${Number.isFinite(keyless.stemHeight) ? mmText(keyless.stemHeight, 3) : "?"} height`,
      location: "",
      tolerances: "nominal only",
      notes: "assembly of the parts below (ASM-0019)",
    });
    const pinion = (p: typeof keyless.windingPinion): string => {
      const defined = isValidToothCount(p.toothCount) && isValidModule(p.module);
      return `z = ${Number.isFinite(p.toothCount) ? String(p.toothCount) : "?"}, m = ${mmText(p.module)}, pitch Ø ${defined ? mmText(pitchDiameter(p.module, p.toothCount)) : "?"}`;
    };
    const parts: [string, string, string, string][] = [
      ["Stem", "Stem", "diameter and length not modeled (ASM-0012)", "two positions: in (winding), out (setting)"],
      ["Crown", "Crown", "not modeled (ASM-0012)", ""],
      ["Winding pinion", "Stem pinion", pinion(keyless.windingPinion), "turns freely on the stem; ratchet teeth to the sliding pinion (form not modeled)"],
      ["Sliding pinion", "Stem pinion", pinion(keyless.slidingPinion), "turns with the stem; setting teeth listed"],
      ["Setting lever and yoke", "Lever", "not modeled", "represented by the stem position only (ASM-0019)"],
      ["Click and click spring", "Click", "not modeled", "holds the ratchet wheel; modeled as a one-way hold only"],
    ];
    parts.forEach(([name, type, specification, notes], i) => {
      row({ item: `${parent}.${String(i + 1)}`, depth: 1, entityId: keyless.id, name, type, specification, location: "", tolerances: "nominal only", notes });
    });
  }

  for (const esc of Object.values(movement.escapements).sort(byName)) {
    item += 1;
    const parent = String(item);
    row({
      item: parent, depth: 0, entityId: esc.id, name: esc.name, type: "Escapement (simplified model)",
      specification: "Swiss lever, kinematic only (ESC-001)", location: "", tolerances: "nominal only",
      notes: "assembly of the parts below; contact, locking and balance dynamics not modeled (ESC-002)",
    });
    const w = esc.escapeWheel;
    const b = esc.balance;
    const shaftName = (id: typeof esc.escapeArborShaftId): string => movement.shafts[id]?.name ?? "no arbor";
    const parts: [string, string, string, string, string][] = [
      ["Escape wheel", "Escape wheel", `z = ${Number.isFinite(w.toothCount) ? String(w.toothCount) : "?"}, tip Ø ${mmText(w.tipDiameter)}, thickness ${mmText(w.thickness, 3)}`, `on ${shaftName(esc.escapeArborShaftId)}, mid-plane ${mmText(w.zCentre, 3)}`, "tooth form not modeled (drawn visually)"],
      ["Pallet fork", "Lever", "shape not modeled", `on ${shaftName(esc.palletArborShaftId)}`, "only its swing between bankings is modeled (ASM-0023)"],
      ["Pallet stones", "Jewel", "not modeled", "", "impulse and locking faces not modeled"],
      ["Balance", "Balance", `Ø ${mmText(b.diameter, 3)}, thickness ${mmText(b.thickness, 3)}`, `on ${shaftName(esc.balanceShaftId)}, mid-plane ${mmText(b.zCentre, 3)}`, "inertia not modeled (ASM-0022)"],
      ["Hairspring", "Spring", "not modeled", "", "no restoring torque modeled (ASM-0022)"],
      ["Roller and impulse pin", "Roller", "not modeled", "", ""],
    ];
    parts.forEach(([name, type, specification, location, notes], i) => {
      row({ item: `${parent}.${String(i + 1)}`, depth: 1, entityId: esc.id, name, type, specification, location, tolerances: "nominal only", notes });
    });
  }

  for (const dial of Object.values(movement.dials).sort(byName)) {
    item += 1;
    row({
      item: String(item), depth: 0, entityId: dial.id, name: dial.name, type: "Dial",
      specification: `Ø ${mmText(dial.diameter, 3)}, thickness ${mmText(dial.thickness, 3)}`,
      location: `face at ${mmText(dial.faceHeight, 3)}, centred on ${movement.shafts[dial.centreShaftId]?.name ?? "no arbor"}`,
      tolerances: "nominal only",
      notes: "flat disc; feet, holes and printing not modeled (ASM-0020)",
    });
  }
  return rows;
}

/** RFC 4180 CSV. Values are quoted when they contain a comma, quote or line break. */
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const cell = (value: string | number): string => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function bomCsv(movement: Movement): string {
  const rows = buildBom(movement);
  return toCsv(BOM_COLUMNS.map((c) => c.label), rows.map((r) => BOM_COLUMNS.map((c) => r[c.key])));
}
