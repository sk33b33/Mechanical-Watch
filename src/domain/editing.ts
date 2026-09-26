import { millimetres } from "@/units/length";
import type { EntityId } from "./ids";
import { createMovement, type Movement } from "./movement";
import { createFrame, type Frame, type FrameId, type FrameKind, type Outline } from "./frame";
import { createShaft, type Shaft, type ShaftEnd, type ShaftId } from "./shaft";
import { createGear, type Gear, type GearId } from "./gear";
import { createGearMesh, type GearMesh, type GearMeshId } from "./gearMesh";
import { createJewel, type BearingKind, type Jewel, type JewelId } from "./jewel";

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
 * - a shaft owns its gears and bearings (and is no longer the drive);
 * - a gear owns the meshes it takes part in.
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

  if (id in movement.frames) frames.add(id as FrameId);
  if (id in movement.shafts) shafts.add(id as ShaftId);
  if (id in movement.gears) gears.add(id as GearId);
  if (id in movement.gearMeshes) meshes.add(id as GearMeshId);
  if (id in movement.jewels) jewels.add(id as JewelId);

  for (const gear of Object.values(movement.gears)) {
    if (shafts.has(gear.shaftId)) gears.add(gear.id);
  }
  for (const jewel of Object.values(movement.jewels)) {
    if (shafts.has(jewel.shaftId) || frames.has(jewel.frameId)) jewels.add(jewel.id);
  }
  for (const mesh of Object.values(movement.gearMeshes)) {
    if (gears.has(mesh.drivingGearId) || gears.has(mesh.drivenGearId)) meshes.add(mesh.id);
  }

  const removed = new Set<string>([...frames, ...shafts, ...gears, ...meshes, ...jewels]);
  return {
    movement: {
      ...movement,
      frames: without(movement.frames, removed),
      shafts: without(movement.shafts, removed),
      gears: without(movement.gears, removed),
      gearMeshes: without(movement.gearMeshes, removed),
      jewels: without(movement.jewels, removed),
      drivingShaftId:
        movement.drivingShaftId !== null && removed.has(movement.drivingShaftId) ? null : movement.drivingShaftId,
    },
    removedIds: [...removed] as EntityId[],
  };
}
