import type { Movement } from "@/domain/movement";
import type { EntityId } from "@/domain/ids";
import { findDiscComplication } from "@/domain/discComplication";
import { updateDialWindow } from "@/domain/movement";
import type { AssumptionId } from "@/reference/assumptions";
import { solvePlacement } from "@/kinematics/solvePlacement";
import { toMillimetres, metres } from "@/units/length";
import type { Vec2 } from "@/math/vec2";
import { moveWheelBy, wheelGroupOf } from "./moveWheel";

/**
 * "Fix chain" (follow-up 35, ASM-0087): tidy the dial after edits, as a plan the user sees before it is
 * applied. These are declared tidy-up choices, not a sourced or manufacturing clearance.
 */
export const CHAIN_FIX = {
  /** The least gap left between two wheel discs, and between a wheel and the dial's edge. */
  clearanceGapMetres: 0.3e-3,
  /** Passes of separating and pulling in, before giving up on a conflict that does not settle. */
  maxPasses: 20,
  /** Moves smaller than this are not worth listing (numerical noise). */
  toleranceMetres: 1e-7,
  assumption: "ASM-0087" satisfies AssumptionId,
} as const;

export type ChainFixKind = "RECENTRE_WINDOW" | "SEPARATE_WHEELS" | "KEEP_INSIDE_DIAL";

export interface ChainFixChange {
  kind: ChainFixKind;
  /** The part that moves (a wheel or a window), by name. */
  partName: string;
  /** Plain-language reason, with the numbers. */
  reason: string;
  /** How far it moves, in millimetres. */
  distanceMillimetres: number;
}

export interface ChainFixPlan {
  /** The design with every change applied (apply it only on confirmation). */
  movement: Movement;
  changes: ChainFixChange[];
  /** Conflicts it could not settle, named. */
  unresolved: string[];
}

interface WheelDisc { id: EntityId; name: string; centre: Vec2; radius: number }

function wheelDiscs(movement: Movement, positions: ReadonlyMap<string, Vec2>): WheelDisc[] {
  const ids: EntityId[] = [
    ...Object.keys(movement.dateComplications), ...Object.keys(movement.monthComplications),
    ...Object.keys(movement.leapYearComplications), ...Object.keys(movement.seasonComplications),
  ] as EntityId[];
  const discs: WheelDisc[] = [];
  for (const id of ids) {
    const ref = findDiscComplication(movement, id);
    if (ref?.position.kind !== "SHAFT") continue;
    const centre = positions.get(ref.position.shaftId);
    if (centre === undefined || !Number.isFinite(ref.discRadius) || ref.discRadius <= 0) continue;
    discs.push({ id, name: ref.name, centre, radius: ref.discRadius });
  }
  return discs;
}

function positionsOf(movement: Movement): Map<string, Vec2> {
  return new Map(solvePlacement(movement).shaftPositions);
}

/**
 * Plans the tidy-up. `lastMovedId` (the wheel the user just moved) is the one that gives way when two
 * wheels overlap; otherwise the smaller wheel gives way.
 */
export function planChainFix(movement: Movement, lastMovedId: EntityId | null = null): ChainFixPlan {
  const g = CHAIN_FIX.clearanceGapMetres;
  const startPositions = positionsOf(movement);
  const startDiscs = wheelDiscs(movement, startPositions);
  const reasons = new Map<EntityId, Set<string>>();
  const unresolved = new Set<string>();
  const note = (id: EntityId, text: string): void => {
    const set = reasons.get(id) ?? new Set<string>();
    set.add(text);
    reasons.set(id, set);
  };

  let current = movement;

  // 1. A whole-wheel window must be centred on its wheel's axis (a window that was set off to one side on
  //    purpose, a rectangle or a small aperture, is left alone).
  const recentred: ChainFixChange[] = [];
  const positions0 = positionsOf(current);
  for (const window of Object.values(current.dialWindows)) {
    const ref = findDiscComplication(current, window.complicationId);
    if (ref?.position.kind !== "SHAFT" || window.outline.kind !== "CIRCLE") continue;
    if (window.outline.radius < ref.discRadius * (1 - 1e-6)) continue;
    const axis = positions0.get(ref.position.shaftId);
    if (axis === undefined) continue;
    const off = Math.hypot(window.centre.x - axis.x, window.centre.y - axis.y);
    if (off <= CHAIN_FIX.toleranceMetres) continue;
    current = updateDialWindow(current, window.id, { centre: { x: metres(axis.x), y: metres(axis.y) } });
    recentred.push({
      kind: "RECENTRE_WINDOW", partName: window.name, distanceMillimetres: toMillimetres(metres(off)),
      reason: `${window.name} was ${toMillimetres(metres(off)).toFixed(2)} mm off the axis of ${ref.name}; it is centred on it again.`,
    });
  }

  // 2. Separate overlapping wheels and keep them inside the dial, until nothing moves.
  const dial = Object.values(current.dials)[0];
  for (let pass = 0; pass < CHAIN_FIX.maxPasses; pass += 1) {
    let moved = false;
    const positions = positionsOf(current);
    const discs = wheelDiscs(current, positions);
    for (let i = 0; i < discs.length; i += 1) {
      for (let j = i + 1; j < discs.length; j += 1) {
        const a = discs[i];
        const b = discs[j];
        if (a === undefined || b === undefined) continue;
        const d = Math.hypot(a.centre.x - b.centre.x, a.centre.y - b.centre.y);
        const need = a.radius + b.radius + g;
        if (d >= need - CHAIN_FIX.toleranceMetres) continue;
        const [mover, other] = a.id === lastMovedId ? [a, b] : b.id === lastMovedId ? [b, a] : a.radius <= b.radius ? [a, b] : [b, a];
        const push = need - d;
        const ux = d === 0 ? 1 : (mover.centre.x - other.centre.x) / d;
        const uy = d === 0 ? 0 : (mover.centre.y - other.centre.y) / d;
        const next = moveWheelBy(current, mover.id, ux * push, uy * push);
        if (next === null) { unresolved.add(`${mover.name} overlaps ${other.name} and cannot be moved`); continue; }
        current = next;
        moved = true;
        note(mover.id, `moved ${(push * 1000).toFixed(2)} mm away from ${other.name} (their discs overlapped or were under ${(g * 1000).toFixed(1)} mm apart)`);
        break;
      }
      if (moved) break;
    }
    if (!moved && dial !== undefined) {
      const dialCentre = positionsOf(current).get(dial.centreShaftId);
      const dialRadius = dial.diameter / 2;
      if (dialCentre !== undefined && Number.isFinite(dialRadius)) {
        for (const disc of wheelDiscs(current, positionsOf(current))) {
          const dd = Math.hypot(disc.centre.x - dialCentre.x, disc.centre.y - dialCentre.y);
          const excess = dd + disc.radius + g - dialRadius;
          if (excess <= CHAIN_FIX.toleranceMetres || dd === 0) continue;
          const next = moveWheelBy(current, disc.id, ((dialCentre.x - disc.centre.x) / dd) * excess, ((dialCentre.y - disc.centre.y) / dd) * excess);
          if (next === null) { unresolved.add(`${disc.name} is too near the dial's edge and cannot be moved`); continue; }
          current = next;
          moved = true;
          note(disc.id, `pulled ${(excess * 1000).toFixed(2)} mm toward the dial's centre (it was within ${(g * 1000).toFixed(1)} mm of the edge or beyond it)`);
          break;
        }
      }
    }
    if (!moved) break;
    if (pass === CHAIN_FIX.maxPasses - 1) unresolved.add(`Some wheels still conflict after ${String(CHAIN_FIX.maxPasses)} passes; move one by hand`);
  }

  // Report each wheel that moved once, with the distance it really moved.
  const endPositions = positionsOf(current);
  const wheelChanges: ChainFixChange[] = [];
  for (const disc of startDiscs) {
    const group = wheelGroupOf(current, disc.id);
    const shaftId = group?.shaftIds[0];
    const before = shaftId === undefined ? undefined : startPositions.get(shaftId);
    const after = shaftId === undefined ? undefined : endPositions.get(shaftId);
    if (before === undefined || after === undefined) continue;
    const distance = Math.hypot(after.x - before.x, after.y - before.y);
    if (distance <= CHAIN_FIX.toleranceMetres) continue;
    const text = [...(reasons.get(disc.id) ?? [])].join("; ");
    const kind: ChainFixKind = text.includes("dial's") ? "KEEP_INSIDE_DIAL" : "SEPARATE_WHEELS";
    wheelChanges.push({ kind, partName: disc.name, distanceMillimetres: toMillimetres(metres(distance)), reason: `${disc.name} ${text === "" ? "moves" : text}; its windows move with it.` });
  }
  return { movement: current, changes: [...recentred, ...wheelChanges], unresolved: [...unresolved] };
}
