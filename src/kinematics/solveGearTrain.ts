import type { AngularVelocity } from "@/units/angularVelocity";
import { radiansPerSecond } from "@/units/angularVelocity";
import { meshSpeedRatio, isValidToothCount } from "@/math/gearMath";
import type { Movement } from "@/domain/movement";
import { drivenShaftId, minutesHandShaftId } from "@/domain/movement";
import type { ShaftId } from "@/domain/shaft";
import type { GearMeshId } from "@/domain/gearMesh";
import type { CouplingId } from "@/domain/coupling";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import { nominalHandAngularVelocity } from "./timeDisplay";

/**
 * RUNNING: friction clutches are engaged (the two bodies turn together).
 * HAND_SETTING: clutches slip; the minutes-hand side is turned by the
 * setting input while the going train keeps its running speed (no stop
 * seconds / hacking is modeled, ASM-0015).
 */
export type KinematicMode = "RUNNING" | "HAND_SETTING";

export type ConstraintRef = { kind: "MESH"; meshId: GearMeshId } | { kind: "COUPLING"; couplingId: CouplingId };

export interface GearTrainConflict {
  shaftId: ShaftId;
  expected: AngularVelocity;
  computed: AngularVelocity;
  via: ConstraintRef;
}

export type SettingState =
  | { status: "NOT_APPLICABLE" }
  | { status: "ACTIVE"; handSideShaftIds: readonly ShaftId[] }
  | { status: "UNAVAILABLE"; reason: "NO_MINUTES_HAND" | "NO_ISOLATING_CLUTCH" | "WOULD_TURN_DRIVE" };

export interface GearTrainSolution {
  mode: KinematicMode;
  /** Angular velocity for every shaft reached by an input. */
  shaftAngularVelocity: ReadonlyMap<ShaftId, AngularVelocity>;
  /** Shafts no input reaches (unpowered, informational). */
  unreachableShaftIds: readonly ShaftId[];
  /** Two paths disagree about a shaft's angular velocity (an over-constrained train). */
  conflicts: readonly GearTrainConflict[];
  setting: SettingState;
}

export interface SolveOptions {
  mode: KinematicMode;
  /** Minutes-hand angular velocity while setting. Required for HAND_SETTING. */
  settingAngularVelocity?: AngularVelocity;
}

interface Edge {
  to: ShaftId;
  ratio: number;
  via: ConstraintRef;
}

function nearlyEqual(a: number, b: number): boolean {
  const tolerance = NUMERICAL_PARAMETERS.solverRelativeTolerance;
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Adjacency of the kinematic graph: meshes always, engaged clutches optionally. */
function buildEdges(movement: Movement, clutchesEngaged: boolean): Map<ShaftId, Edge[]> {
  const edges = new Map<ShaftId, Edge[]>();
  const add = (from: ShaftId, edge: Edge): void => {
    const list = edges.get(from);
    if (list === undefined) edges.set(from, [edge]);
    else list.push(edge);
  };
  for (const mesh of Object.values(movement.gearMeshes)) {
    const a = movement.gears[mesh.drivingGearId];
    const b = movement.gears[mesh.drivenGearId];
    // A gear with invalid parameters cannot mesh; validation reports it. Treat it as impassable.
    if (a === undefined || b === undefined || !isValidToothCount(a.toothCount) || !isValidToothCount(b.toothCount)) continue;
    if (a.shaftId === b.shaftId) continue;
    const via: ConstraintRef = { kind: "MESH", meshId: mesh.id };
    add(a.shaftId, { to: b.shaftId, ratio: meshSpeedRatio(a.toothCount, b.toothCount), via });
    add(b.shaftId, { to: a.shaftId, ratio: meshSpeedRatio(b.toothCount, a.toothCount), via });
  }
  if (clutchesEngaged) {
    for (const coupling of Object.values(movement.couplings)) {
      if (coupling.shaftAId === coupling.shaftBId) continue;
      const via: ConstraintRef = { kind: "COUPLING", couplingId: coupling.id };
      add(coupling.shaftAId, { to: coupling.shaftBId, ratio: 1, via });
      add(coupling.shaftBId, { to: coupling.shaftAId, ratio: 1, via });
    }
  }
  return edges;
}

/** Breadth-first propagation from seed velocities, in seed order. Deterministic. */
function propagate(
  seeds: readonly [ShaftId, AngularVelocity][],
  edges: Map<ShaftId, Edge[]>,
  velocities: Map<ShaftId, AngularVelocity>,
  conflicts: GearTrainConflict[],
): void {
  for (const [seed, omega] of seeds) {
    if (velocities.has(seed)) continue;
    velocities.set(seed, omega);
    const queue: ShaftId[] = [seed];
    for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
      const w = velocities.get(current);
      if (w === undefined) continue;
      for (const edge of edges.get(current) ?? []) {
        const computed = radiansPerSecond(w * edge.ratio);
        const existing = velocities.get(edge.to);
        if (existing === undefined) {
          velocities.set(edge.to, computed);
          queue.push(edge.to);
        } else if (!nearlyEqual(existing, computed)) {
          conflicts.push({ shaftId: edge.to, expected: existing, computed, via: edge.via });
        }
      }
    }
  }
}

/** Shafts connected to `start` through the given edges (the start itself included). */
function component(start: ShaftId, edges: Map<ShaftId, Edge[]>): Set<ShaftId> {
  const seen = new Set<ShaftId>([start]);
  const queue = [start];
  for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
    for (const edge of edges.get(current) ?? []) {
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return seen;
}

/**
 * Whether the minutes hand can be turned without turning the rest of the
 * running train: its gear-connected group must be separated from the rest
 * by at least one friction clutch, and must not contain a prescribed
 * drive shaft.
 */
export function handSettingState(movement: Movement): Exclude<SettingState, { status: "NOT_APPLICABLE" }> {
  const minutes = minutesHandShaftId(movement);
  if (minutes === null) return { status: "UNAVAILABLE", reason: "NO_MINUTES_HAND" };
  const handSide = component(minutes, buildEdges(movement, false));
  const isolated = Object.values(movement.couplings).some(
    (c) => handSide.has(c.shaftAId) !== handSide.has(c.shaftBId),
  );
  if (!isolated) return { status: "UNAVAILABLE", reason: "NO_ISOLATING_CLUTCH" };
  if (movement.drive?.kind === "PRESCRIBED" && handSide.has(movement.drive.shaftId)) {
    return { status: "UNAVAILABLE", reason: "WOULD_TURN_DRIVE" };
  }
  return { status: "ACTIVE", handSideShaftIds: [...handSide] };
}

function driveSeed(movement: Movement): [ShaftId, AngularVelocity] | null {
  const drive = movement.drive;
  const shaftId = drivenShaftId(movement);
  if (drive === null || shaftId === null) return null;
  const omega = drive.kind === "PRESCRIBED" ? drive.angularVelocity : nominalHandAngularVelocity("MINUTES");
  // SIM-001: a non-finite drive is reported by validation, never propagated.
  return Number.isFinite(omega) ? [shaftId, omega] : null;
}

/**
 * Deterministic kinematic solve (L2): propagates angular velocity stage
 * by stage through meshes (REF-ENG §5.3, §7) and, in running mode,
 * engaged friction clutches (ratio 1, REF-ENG §8). Rigid shafts and ideal
 * meshes (ASM-0001), parallel axes (ASM-0006), prescribed kinematic
 * input (ASM-0007).
 */
export function solveGearTrain(movement: Movement, options: SolveOptions = { mode: "RUNNING" }): GearTrainSolution {
  const velocities = new Map<ShaftId, AngularVelocity>();
  const conflicts: GearTrainConflict[] = [];
  const seed = driveSeed(movement);
  propagate(seed === null ? [] : [seed], buildEdges(movement, true), velocities, conflicts);

  let setting: SettingState = { status: "NOT_APPLICABLE" };
  if (options.mode === "HAND_SETTING") {
    setting = handSettingState(movement);
    const settingOmega = options.settingAngularVelocity;
    const minutes = minutesHandShaftId(movement);
    if (setting.status === "ACTIVE" && minutes !== null && settingOmega !== undefined && Number.isFinite(settingOmega)) {
      // The going train keeps its running speeds; the hand side is re-driven by the setting input.
      for (const id of setting.handSideShaftIds) velocities.delete(id);
      propagate([[minutes, settingOmega]], buildEdges(movement, false), velocities, conflicts);
    }
  }

  const unreachableShaftIds = (Object.keys(movement.shafts) as ShaftId[]).filter((id) => !velocities.has(id));
  return { mode: options.mode, shaftAngularVelocity: velocities, unreachableShaftIds, conflicts, setting };
}
