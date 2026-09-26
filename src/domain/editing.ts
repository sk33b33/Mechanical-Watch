import { millimetres } from "@/units/length";
import type { EntityId } from "./ids";
import { createMovement, type Movement } from "./movement";
import { createFrame, type Frame, type FrameId, type FrameKind, type Outline } from "./frame";
import { createShaft, type Shaft, type ShaftEnd, type ShaftId } from "./shaft";
import { createGear, type Gear, type GearId } from "./gear";
import { createGearMesh, type GearMesh, type GearMeshId } from "./gearMesh";
import { createJewel, type BearingKind, type Jewel, type JewelId } from "./jewel";
import { createFrictionClutch, createMainspring, type Coupling, type CouplingId } from "./coupling";
import { createKeylessWorks, type KeylessWorks } from "./keyless";
import { createDial, type Dial } from "./dial";
import { createEscapement, type Escapement } from "./escapement";
import { radians } from "@/units/angle";
import type { ToleranceId } from "./tolerance";

/**
 * Structural editing: creating and deleting parts.
 *
 * New parts start with every dimension and position empty (NaN for
 * required values, null for optional ones). Nothing is guessed; validation
 * lists what is missing. Only identity, references and names are filled in.
 */

const EMPTY = millimetres(Number.NaN);

export function createEmptyMovement(name = "Untitled movement"): Movement {
  return createMovement(name, false);
}

/** "Arbor 1", "Arbor 2", … skipping names already in use. */
export function nextName(existing: Iterable<{ name: string }>, base: string): string {
  const taken = new Set([...existing].map((e) => e.name));
  for (let n = 1; ; n += 1) {
    const name = `${base} ${String(n)}`;
    if (!taken.has(name)) return name;
  }
}

export function emptyOutline(kind: Outline["kind"]): Outline {
  return kind === "CIRCLE"
    ? { kind, centre: { x: EMPTY, y: EMPTY }, radius: EMPTY }
    : { kind, points: [] };
}

export function newFrame(movement: Movement, kind: FrameKind): Frame {
  return createFrame({
    kind,
    name: nextName(Object.values(movement.frames), kind === "MAINPLATE" ? "Mainplate" : "Bridge"),
    outline: emptyOutline(kind === "MAINPLATE" ? "CIRCLE" : "POLYGON"),
    zBottom: EMPTY,
    thickness: EMPTY,
  });
}

export function newShaft(movement: Movement): Shaft {
  return createShaft(nextName(Object.values(movement.shafts), "Arbor"), {
    kind: "FIXED",
    position: { x: EMPTY, y: EMPTY },
  });
}

export function newGear(movement: Movement, shaftId: ShaftId): Gear {
  return createGear({
    name: nextName(Object.values(movement.gears), "Gear"),
    toothCount: Number.NaN,
    module: EMPTY,
    thickness: EMPTY,
    zCentre: EMPTY,
    shaftId,
  });
}

export function newGearMesh(drivingGearId: GearId, drivenGearId: GearId): GearMesh {
  return createGearMesh(drivingGearId, drivenGearId);
}

export function newFrictionClutch(movement: Movement, shaftAId: ShaftId, shaftBId: ShaftId): Coupling {
  const a = movement.shafts[shaftAId]?.name ?? "?";
  const b = movement.shafts[shaftBId]?.name ?? "?";
  return createFrictionClutch(`Friction clutch ${a} / ${b}`, shaftAId, shaftBId);
}

export function newMainspring(movement: Movement, arborShaftId: ShaftId, drumShaftId: ShaftId): Coupling {
  const drum = movement.shafts[drumShaftId]?.name ?? "?";
  return createMainspring(`Mainspring of ${drum}`, arborShaftId, drumShaftId);
}

/** Keyless works with every dimension empty and no wheels chosen yet (KEY-001 lists what is missing). */
export function newKeylessWorks(movement: Movement): KeylessWorks {
  const none = "" as GearId;
  return createKeylessWorks({
    name: nextName(Object.values(movement.keylessWorks), "Keyless works"),
    stemDirection: radians(Number.NaN),
    stemHeight: EMPTY,
    windingPinion: { toothCount: Number.NaN, module: EMPTY },
    slidingPinion: { toothCount: Number.NaN, module: EMPTY },
    crownWheelGearId: none,
    settingWheelGearId: none,
    ratchetGearId: none,
  });
}

/** A dial with every dimension empty and no centre arbor chosen yet (DIAL-001 lists what is missing). */
export function newDial(movement: Movement): Dial {
  return createDial({
    name: nextName(Object.values(movement.dials), "Dial"),
    centreShaftId: "" as ShaftId,
    diameter: EMPTY,
    thickness: EMPTY,
    faceHeight: EMPTY,
  });
}

/** An escapement with every dimension empty and no arbors chosen yet (ESC-101 lists what is missing). */
export function newEscapement(movement: Movement): Escapement {
  const none = "" as ShaftId;
  const angle = radians(Number.NaN);
  return createEscapement({
    name: nextName(Object.values(movement.escapements), "Escapement"),
    escapeArborShaftId: none,
    escapeWheel: { toothCount: Number.NaN, tipDiameter: EMPTY, thickness: EMPTY, zCentre: EMPTY },
    palletArborShaftId: none,
    leverAngle: angle,
    balanceShaftId: none,
    balance: { diameter: EMPTY, thickness: EMPTY, zCentre: EMPTY, amplitude: angle, liftAngle: angle, inertia: null, hairspringStiffness: null },
  });
}

export function newJewel(movement: Movement, shaftId: ShaftId, end: ShaftEnd, frameId: FrameId, kind: BearingKind = "HOLE_JEWEL"): Jewel {
  const shaftName = movement.shafts[shaftId]?.name ?? "Arbor";
  return createJewel({ name: `${shaftName} ${end.toLowerCase()} jewel`, kind, frameId, shaftId, end });
}

function without<K extends string, V>(record: Record<K, V>, ids: ReadonlySet<string>): Record<K, V> {
  return Object.fromEntries(Object.entries(record).filter(([id]) => !ids.has(id))) as Record<K, V>;
}

export interface RemovalResult {
  movement: Movement;
  /** Everything removed: the entity itself plus the parts it owned. */
  removedIds: EntityId[];
}

/**
 * Removes an entity together with the parts it owns:
 * - a frame owns the bearings seated in it;
 * - a shaft owns its gears, bearings and clutches (and is no longer the drive);
 * - a gear owns the meshes it takes part in;
 * - every entity owns the tolerances declared on its dimensions.
 * The keyless works, the dial and the escapement own nothing: removing a wheel they refer
 * to leaves the reference in place for validation to report.
 * References that are not ownership, such as another shaft's placement
 * constraint pointing at a removed shaft or mesh, are left in place and
 * reported by validation (ASSY-001). Nothing else is changed silently.
 */
export function removeEntity(movement: Movement, id: EntityId): RemovalResult {
  const frames = new Set<FrameId>();
  const shafts = new Set<ShaftId>();
  const gears = new Set<GearId>();
  const meshes = new Set<GearMeshId>();
  const jewels = new Set<JewelId>();
  const couplings = new Set<CouplingId>();

  if (id in movement.frames) frames.add(id as FrameId);
  if (id in movement.shafts) shafts.add(id as ShaftId);
  if (id in movement.gears) gears.add(id as GearId);
  if (id in movement.gearMeshes) meshes.add(id as GearMeshId);
  if (id in movement.jewels) jewels.add(id as JewelId);
  if (id in movement.couplings) couplings.add(id as CouplingId);

  for (const gear of Object.values(movement.gears)) {
    if (shafts.has(gear.shaftId)) gears.add(gear.id);
  }
  for (const jewel of Object.values(movement.jewels)) {
    if (shafts.has(jewel.shaftId) || frames.has(jewel.frameId)) jewels.add(jewel.id);
  }
  for (const mesh of Object.values(movement.gearMeshes)) {
    if (gears.has(mesh.drivingGearId) || gears.has(mesh.drivenGearId)) meshes.add(mesh.id);
  }
  for (const coupling of Object.values(movement.couplings)) {
    if (shafts.has(coupling.shaftAId) || shafts.has(coupling.shaftBId)) couplings.add(coupling.id);
  }

  const tolerances = new Set<ToleranceId>();
  if (id in movement.tolerances) tolerances.add(id as ToleranceId);
  const owners = new Set<string>([...frames, ...shafts, ...jewels]);
  for (const tolerance of Object.values(movement.tolerances)) {
    if (owners.has(tolerance.entityId)) tolerances.add(tolerance.id);
  }

  const others = new Set<string>();
  if (id in movement.keylessWorks || id in movement.dials || id in movement.escapements) others.add(id);

  const removed = new Set<string>([...frames, ...shafts, ...gears, ...meshes, ...jewels, ...couplings, ...tolerances, ...others]);
  const drive = movement.drive;
  return {
    movement: {
      ...movement,
      frames: without(movement.frames, removed),
      shafts: without(movement.shafts, removed),
      gears: without(movement.gears, removed),
      gearMeshes: without(movement.gearMeshes, removed),
      jewels: without(movement.jewels, removed),
      couplings: without(movement.couplings, removed),
      tolerances: without(movement.tolerances, removed),
      keylessWorks: without(movement.keylessWorks, removed),
      dials: without(movement.dials, removed),
      escapements: without(movement.escapements, removed),
      drive: drive?.kind === "PRESCRIBED" && removed.has(drive.shaftId) ? null : drive,
    },
    removedIds: [...removed] as EntityId[],
  };
}
