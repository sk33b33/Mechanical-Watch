import type { EntityId } from "./ids";
import type { Movement } from "./movement";
import type { Gear, GearId } from "./gear";
import type { Shaft, ShaftId } from "./shaft";
import type { Frame, FrameId } from "./frame";
import type { Jewel, JewelId } from "./jewel";

export type SelectableEntity = Gear | Shaft | Frame | Jewel;

export function findEntity(movement: Movement, id: EntityId): SelectableEntity | undefined {
  return (
    movement.gears[id as GearId] ??
    movement.shafts[id as ShaftId] ??
    movement.frames[id as FrameId] ??
    movement.jewels[id as JewelId]
  );
}
