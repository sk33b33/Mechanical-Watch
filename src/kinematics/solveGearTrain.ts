import type { AngularVelocity } from "@/units/angularVelocity";
import { radiansPerSecond } from "@/units/angularVelocity";
import { crossedMeshSpeedRatio, meshSpeedRatio, isValidToothCount } from "@/math/gearMath";
import type { Movement } from "@/domain/movement";
import { drivenShaftId, minutesHandShaftId } from "@/domain/movement";
import type { ShaftId } from "@/domain/shaft";
import type { GearId } from "@/domain/gear";
import type { GearMeshId } from "@/domain/gearMesh";
import { frictionClutches, mainspringDrumOf, type CouplingId } from "@/domain/coupling";
import {
  stemBodyId,
  type KeylessWorks,
  type KeylessWorksId,
  type StemBodyId,
  type StemPinion,
  type StemPosition,
} from "@/domain/keyless";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import { nominalHandAngularVelocity } from "./timeDisplay";
import { isDefinedPinion, verticalSide } from "./keylessGeometry";

/**
 * RUNNING: friction clutches are engaged (the two bodies turn together);
 * the crown is at rest and the click holds the ratchet.
 * HAND_SETTING: clutches slip; the minutes-hand side is turned directly by
 * the setting input (for movements without keyless works).
 * WINDING: the crown turns with the stem in; the ratchet (Breguet) teeth
 * drive the winding pinion in the winding direction only (ASM-0019).
 * CROWN_SETTING: the crown turns with the stem out; the sliding pinion
 * drives the setting train and the friction clutch slips.
 * In every mode the going train keeps its running speed: no stop-seconds
 * (hacking) is modeled (ASM-0015).
 */
export type KinematicMode = "RUNNING" | "HAND_SETTING" | "WINDING" | "CROWN_SETTING";

export type KeylessPart = "WINDING_MESH" | "SETTING_MESH" | "RATCHET_TEETH" | "CLICK";

export type ConstraintRef =
  | { kind: "MESH"; meshId: GearMeshId }
  | { kind: "COUPLING"; couplingId: CouplingId }
  | { kind: "KEYLESS"; keylessId: KeylessWorksId; part: KeylessPart };

/** A kinematic body: an ordinary shaft, or one of the stem's bodies. */
export type BodyId = ShaftId | StemBodyId;

export interface GearTrainConflict {
  shaftId: BodyId;
  expected: AngularVelocity;
  computed: AngularVelocity;
  via: ConstraintRef;
}

export type SettingState =
  | { status: "NOT_APPLICABLE" }
  | { status: "ACTIVE"; handSideShaftIds: readonly ShaftId[] }
  | {
      status: "UNAVAILABLE";
      reason: "NO_MINUTES_HAND" | "NO_ISOLATING_CLUTCH" | "WOULD_TURN_DRIVE" | "NO_KEYLESS_WORKS" | "CROWN_NOT_CONNECTED";
    };

export type WindingState =
  | { status: "NOT_APPLICABLE" }
  | { status: "WINDING"; ratchetAngularVelocity: AngularVelocity }
  /** The crown turns the non-winding way: the ratchet teeth ride over each other and nothing is wound. */
  | { status: "SLIPPING" }
  | { status: "UNAVAILABLE"; reason: "NO_KEYLESS_WORKS" | "NO_MAINSPRING" | "DRUM_NOT_RUNNING" | "RATCHET_NOT_CONNECTED" };

export interface GearTrainSolution {
  mode: KinematicMode;
  /** Angular velocity (about +Z) for every shaft reached by an input. */
  shaftAngularVelocity: ReadonlyMap<ShaftId, AngularVelocity>;
  /** Angular velocity of stem bodies, about the stem direction (toward the crown). */
  stemAngularVelocity: ReadonlyMap<StemBodyId, AngularVelocity>;
  /** Shafts no input reaches (unpowered, informational). */
  unreachableShaftIds: readonly ShaftId[];
  /** Two paths disagree about a body's angular velocity (an over-constrained train). */
  conflicts: readonly GearTrainConflict[];
  setting: SettingState;
  winding: WindingState;
  stemPosition: StemPosition;
}

export interface SolveOptions {
  mode: KinematicMode;
  /** Minutes-hand angular velocity while setting directly. Required for HAND_SETTING. */
  settingAngularVelocity?: AngularVelocity;
  /** Crown angular velocity about the stem direction. Required for WINDING and CROWN_SETTING. */
  crownAngularVelocity?: AngularVelocity;
}

interface Edge {
  to: BodyId;
  ratio: number;
  via: ConstraintRef;
}

type Edges = Map<BodyId, Edge[]>;

interface EdgeOptions {
  clutchesEngaged: boolean;
  stemPosition: StemPosition;
  ratchetTeethEngaged: boolean;
}

const FREE_HANDS: EdgeOptions = { clutchesEngaged: false, stemPosition: "WINDING", ratchetTeethEngaged: false };

function nearlyEqual(a: number, b: number): boolean {
  const tolerance = NUMERICAL_PARAMETERS.solverRelativeTolerance;
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

/** The keyless works the crown input acts on (validation reports more than one, KEY-001). */
export function primaryKeyless(movement: Movement): KeylessWorks | null {
  return Object.values(movement.keylessWorks)[0] ?? null;
}

/** Adjacency of the kinematic graph for a given engagement state. */
function buildEdges(movement: Movement, options: EdgeOptions): Edges {
  const edges: Edges = new Map();
  const add = (from: BodyId, to: BodyId, ratio: number, via: ConstraintRef): void => {
    const list = edges.get(from);
    const edge = { to, ratio, via };
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
    add(a.shaftId, b.shaftId, meshSpeedRatio(a.toothCount, b.toothCount), via);
    add(b.shaftId, a.shaftId, meshSpeedRatio(b.toothCount, a.toothCount), via);
  }
  if (options.clutchesEngaged) {
    // A mainspring imposes no kinematic constraint (ASM-0007, ASM-0018).
    for (const coupling of frictionClutches(movement.couplings)) {
      if (coupling.shaftAId === coupling.shaftBId) continue;
      const via: ConstraintRef = { kind: "COUPLING", couplingId: coupling.id };
      add(coupling.shaftAId, coupling.shaftBId, 1, via);
      add(coupling.shaftBId, coupling.shaftAId, 1, via);
    }
  }
  for (const keyless of Object.values(movement.keylessWorks)) {
    const stem = stemBodyId(keyless.id, "STEM");
    const windingPinion = stemBodyId(keyless.id, "WINDING_PINION");
    // Right-angle meshes (ASM-0019): ω_wheel = s (z_pinion / z_wheel) ω_pinion.
    const crossed = (pinionBody: BodyId, pinion: StemPinion, wheelId: GearId, part: KeylessPart): void => {
      const wheel = movement.gears[wheelId];
      if (wheel === undefined || !isDefinedPinion(pinion) || !isValidToothCount(wheel.toothCount)) return;
      const side = verticalSide(keyless.stemHeight, wheel);
      if (side === null) return;
      const via: ConstraintRef = { kind: "KEYLESS", keylessId: keyless.id, part };
      add(pinionBody, wheel.shaftId, crossedMeshSpeedRatio(pinion.toothCount, wheel.toothCount, side), via);
      add(wheel.shaftId, pinionBody, crossedMeshSpeedRatio(wheel.toothCount, pinion.toothCount, side), via);
    };
    crossed(windingPinion, keyless.windingPinion, keyless.crownWheelGearId, "WINDING_MESH");
    if (options.stemPosition === "SETTING") crossed(stem, keyless.slidingPinion, keyless.settingWheelGearId, "SETTING_MESH");
    if (options.ratchetTeethEngaged && options.stemPosition === "WINDING") {
      const via: ConstraintRef = { kind: "KEYLESS", keylessId: keyless.id, part: "RATCHET_TEETH" };
      add(stem, windingPinion, 1, via);
      add(windingPinion, stem, 1, via);
    }
  }
  return edges;
}

/** Breadth-first propagation from a queue of bodies whose velocities are known. */
function spread(
  queue: BodyId[],
  edges: Edges,
  velocities: Map<BodyId, AngularVelocity>,
  conflicts: GearTrainConflict[],
): void {
  for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
    const w = velocities.get(current);
    if (w === undefined) continue;
    for (const edge of edges.get(current) ?? []) {
      // "+ 0" turns −0 (a stationary body through a negative ratio) into 0.
      const computed = radiansPerSecond(w * edge.ratio + 0);
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

/** Propagation from seed velocities, in seed order. A seed already set is skipped. Deterministic. */
function propagate(
  seeds: readonly [BodyId, AngularVelocity][],
  edges: Edges,
  velocities: Map<BodyId, AngularVelocity>,
  conflicts: GearTrainConflict[],
): void {
  for (const [seed, omega] of seeds) {
    if (velocities.has(seed)) continue;
    velocities.set(seed, omega);
    spread([seed], edges, velocities, conflicts);
  }
}

/** Bodies connected to `start` through the given edges (the start itself included). */
function component(start: BodyId, edges: Edges): Set<BodyId> {
  const seen = new Set<BodyId>([start]);
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

function handSideState(movement: Movement, handSide: Set<BodyId>): Exclude<SettingState, { status: "NOT_APPLICABLE" }> {
  const isolated = frictionClutches(movement.couplings).some(
    (c) => handSide.has(c.shaftAId) !== handSide.has(c.shaftBId),
  );
  if (!isolated) return { status: "UNAVAILABLE", reason: "NO_ISOLATING_CLUTCH" };
  if (movement.drive?.kind === "PRESCRIBED" && handSide.has(movement.drive.shaftId)) {
    return { status: "UNAVAILABLE", reason: "WOULD_TURN_DRIVE" };
  }
  return { status: "ACTIVE", handSideShaftIds: [...handSide].filter((id): id is ShaftId => id in movement.shafts) };
}

/**
 * Whether the minutes hand can be turned directly without turning the rest
 * of the running train: its gear-connected group must be separated from
 * the rest by at least one friction clutch, and must not contain a
 * prescribed drive shaft.
 */
export function handSettingState(movement: Movement): Exclude<SettingState, { status: "NOT_APPLICABLE" }> {
  const minutes = minutesHandShaftId(movement);
  if (minutes === null) return { status: "UNAVAILABLE", reason: "NO_MINUTES_HAND" };
  return handSideState(movement, component(minutes, buildEdges(movement, FREE_HANDS)));
}

/**
 * Whether the crown, pulled out, sets the hands: the sliding pinion's
 * train must reach the minutes hand (KEY-004) and be isolated from the
 * going train by a friction clutch.
 */
export function crownSettingState(movement: Movement): Exclude<SettingState, { status: "NOT_APPLICABLE" }> {
  const keyless = primaryKeyless(movement);
  if (keyless === null) return { status: "UNAVAILABLE", reason: "NO_KEYLESS_WORKS" };
  const minutes = minutesHandShaftId(movement);
  if (minutes === null) return { status: "UNAVAILABLE", reason: "NO_MINUTES_HAND" };
  const handSide = component(minutes, buildEdges(movement, { ...FREE_HANDS, stemPosition: "SETTING" }));
  if (!handSide.has(stemBodyId(keyless.id, "STEM"))) return { status: "UNAVAILABLE", reason: "CROWN_NOT_CONNECTED" };
  return handSideState(movement, handSide);
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
 * The click holds each ratchet still (except one being wound). If the
 * running train already turns a ratchet, that is reported as a conflict:
 * the click would stop the train.
 */
function holdRatchets(
  movement: Movement,
  edges: Edges,
  velocities: Map<BodyId, AngularVelocity>,
  conflicts: GearTrainConflict[],
  beingWound: KeylessWorksId | null,
): void {
  for (const keyless of Object.values(movement.keylessWorks)) {
    if (keyless.id === beingWound) continue;
    const ratchet = movement.gears[keyless.ratchetGearId];
    if (ratchet === undefined) continue;
    const existing = velocities.get(ratchet.shaftId);
    if (existing !== undefined && !nearlyEqual(existing, 0)) {
      conflicts.push({
        shaftId: ratchet.shaftId,
        expected: radiansPerSecond(0),
        computed: existing,
        via: { kind: "KEYLESS", keylessId: keyless.id, part: "CLICK" },
      });
      continue;
    }
    propagate([[ratchet.shaftId, radiansPerSecond(0)]], edges, velocities, conflicts);
  }
}

/** Stem bodies nothing else turns are at rest (the crown is released). */
function restStems(movement: Movement, edges: Edges, velocities: Map<BodyId, AngularVelocity>, conflicts: GearTrainConflict[]): void {
  for (const keyless of Object.values(movement.keylessWorks)) {
    propagate(
      [[stemBodyId(keyless.id, "STEM"), radiansPerSecond(0)], [stemBodyId(keyless.id, "WINDING_PINION"), radiansPerSecond(0)]],
      edges, velocities, conflicts,
    );
  }
}

/**
 * Direction check for winding: with the winding pinion turning at
 * +1 rad/s, how does the ratchet turn, and which way winds the mainspring?
 * The arbor winds the spring when it turns the way the drum runs (ASM-0018).
 */
function windingResponse(
  movement: Movement,
  keyless: KeylessWorks,
  runningVelocities: ReadonlyMap<BodyId, AngularVelocity>,
): { ratchetPerPinion: number; windingSign: number } | Extract<WindingState, { status: "UNAVAILABLE" }> {
  const ratchet = movement.gears[keyless.ratchetGearId];
  if (ratchet === undefined) return { status: "UNAVAILABLE", reason: "RATCHET_NOT_CONNECTED" };
  const drum = mainspringDrumOf(movement.couplings, ratchet.shaftId);
  if (drum === null) return { status: "UNAVAILABLE", reason: "NO_MAINSPRING" };
  const drumOmega = runningVelocities.get(drum);
  if (drumOmega === undefined || drumOmega === 0) return { status: "UNAVAILABLE", reason: "DRUM_NOT_RUNNING" };
  const trial = new Map<BodyId, AngularVelocity>();
  propagate([[stemBodyId(keyless.id, "WINDING_PINION"), radiansPerSecond(1)]], buildEdges(movement, FREE_HANDS), trial, []);
  const ratchetOmega = trial.get(ratchet.shaftId);
  if (ratchetOmega === undefined || ratchetOmega === 0) return { status: "UNAVAILABLE", reason: "RATCHET_NOT_CONNECTED" };
  return { ratchetPerPinion: ratchetOmega, windingSign: Math.sign(drumOmega) };
}

/**
 * Deterministic kinematic solve (L2): propagates angular velocity stage
 * by stage through meshes (REF-ENG §5.3, §7), right-angle stem meshes
 * (ASM-0019) and, when engaged, friction clutches (ratio 1, REF-ENG §8)
 * and the stem's ratchet teeth. Rigid bodies and ideal meshes (ASM-0001),
 * prescribed kinematic inputs (ASM-0007).
 */
export function solveGearTrain(movement: Movement, options: SolveOptions = { mode: "RUNNING" }): GearTrainSolution {
  const velocities = new Map<BodyId, AngularVelocity>();
  const conflicts: GearTrainConflict[] = [];
  const runningEdges = buildEdges(movement, { clutchesEngaged: true, stemPosition: "WINDING", ratchetTeethEngaged: false });
  const seed = driveSeed(movement);
  propagate(seed === null ? [] : [seed], runningEdges, velocities, conflicts);

  let setting: SettingState = { status: "NOT_APPLICABLE" };
  let winding: WindingState = { status: "NOT_APPLICABLE" };
  let finalEdges = runningEdges;
  let beingWound: KeylessWorksId | null = null;
  const keyless = primaryKeyless(movement);
  const crownOmega = options.crownAngularVelocity;
  const crownTurning = crownOmega !== undefined && Number.isFinite(crownOmega) && crownOmega !== 0;

  switch (options.mode) {
    case "RUNNING":
      break;
    case "HAND_SETTING": {
      setting = handSettingState(movement);
      const settingOmega = options.settingAngularVelocity;
      const minutes = minutesHandShaftId(movement);
      if (setting.status === "ACTIVE" && minutes !== null && settingOmega !== undefined && Number.isFinite(settingOmega)) {
        // The going train keeps its running speeds; the hand side is re-driven by the setting input.
        for (const id of setting.handSideShaftIds) velocities.delete(id);
        propagate([[minutes, settingOmega]], buildEdges(movement, FREE_HANDS), velocities, conflicts);
      }
      break;
    }
    case "CROWN_SETTING": {
      setting = crownSettingState(movement);
      finalEdges = buildEdges(movement, { ...FREE_HANDS, stemPosition: "SETTING" });
      if (setting.status === "ACTIVE" && keyless !== null && crownTurning) {
        for (const id of setting.handSideShaftIds) velocities.delete(id);
        propagate([[stemBodyId(keyless.id, "STEM"), crownOmega]], finalEdges, velocities, conflicts);
      } else {
        // Crown out but not driving the hands: the stem idles with the setting train.
        spread([...velocities.keys()], buildEdges(movement, { clutchesEngaged: true, stemPosition: "SETTING", ratchetTeethEngaged: false }), velocities, conflicts);
      }
      break;
    }
    case "WINDING": {
      if (keyless === null) {
        winding = { status: "UNAVAILABLE", reason: "NO_KEYLESS_WORKS" };
        break;
      }
      if (!crownTurning) break;
      const response = windingResponse(movement, keyless, velocities);
      if ("status" in response) {
        winding = response;
      } else {
        const ratchetOmega = crownOmega * response.ratchetPerPinion;
        winding = Math.sign(ratchetOmega) === response.windingSign
          ? { status: "WINDING", ratchetAngularVelocity: radiansPerSecond(ratchetOmega) }
          : { status: "SLIPPING" };
      }
      if (winding.status === "WINDING") beingWound = keyless.id;
      finalEdges = buildEdges(movement, { clutchesEngaged: true, stemPosition: "WINDING", ratchetTeethEngaged: beingWound !== null });
      propagate([[stemBodyId(keyless.id, "STEM"), crownOmega]], finalEdges, velocities, conflicts);
      break;
    }
  }
  holdRatchets(movement, finalEdges, velocities, conflicts, beingWound);
  restStems(movement, finalEdges, velocities, conflicts);

  const shaftAngularVelocity = new Map<ShaftId, AngularVelocity>();
  const stemAngularVelocity = new Map<StemBodyId, AngularVelocity>();
  for (const [id, omega] of velocities) {
    if (id in movement.shafts) shaftAngularVelocity.set(id as ShaftId, omega);
    else stemAngularVelocity.set(id as StemBodyId, omega);
  }
  const unreachableShaftIds = (Object.keys(movement.shafts) as ShaftId[]).filter((id) => !shaftAngularVelocity.has(id));
  const stemPosition: StemPosition = options.mode === "CROWN_SETTING" ? "SETTING" : "WINDING";
  return { mode: options.mode, shaftAngularVelocity, stemAngularVelocity, unreachableShaftIds, conflicts, setting, winding, stemPosition };
}

/** The crown direction (±1 about the stem direction) that winds, or null if winding is not derivable. */
export function windingCrownSense(movement: Movement): 1 | -1 | null {
  const probe = solveGearTrain(movement, { mode: "WINDING", crownAngularVelocity: radiansPerSecond(1) });
  if (probe.winding.status === "WINDING") return 1;
  if (probe.winding.status === "SLIPPING") return -1;
  return null;
}

/** The crown direction that moves the hands forward (clockwise from the dial), or null if crown setting is unavailable. */
export function handsForwardCrownSense(movement: Movement): 1 | -1 | null {
  const minutes = minutesHandShaftId(movement);
  if (minutes === null) return null;
  const probe = solveGearTrain(movement, { mode: "CROWN_SETTING", crownAngularVelocity: radiansPerSecond(1) });
  const omega = probe.shaftAngularVelocity.get(minutes);
  if (probe.setting.status !== "ACTIVE" || omega === undefined || omega === 0) return null;
  return omega > 0 ? 1 : -1;
}
