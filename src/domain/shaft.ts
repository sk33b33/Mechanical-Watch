import type { Length } from "@/units/length";
import type { AngularVelocity } from "@/units/angularVelocity";
import { radiansPerSecond } from "@/units/angularVelocity";
import type { EntityId } from "./ids";
import { createId } from "./ids";

export type ShaftId = EntityId<"shaft">;

/**
 * A shaft's rotational axis. All shafts are parallel and perpendicular to
 * the mainplate, i.e. the viewport Z axis (ASM-0006). Pivots, jewels and
 * bearing clearances are not modeled yet (REF-ENG §12).
 */
export interface Shaft {
  readonly id: ShaftId;
  readonly type: "Shaft";
  name: string;
  /** Position of the shaft's axis within the mainplate plane. */
  position: { x: Length; y: Length };
}

export function createShaft(name: string, position: { x: Length; y: Length }): Shaft {
  return {
    id: createId("shaft"),
    type: "Shaft",
    name,
    position,
  };
}

/** Default angular velocity for a shaft with no driving input or solver result yet. */
export const ZERO_ANGULAR_VELOCITY: AngularVelocity = radiansPerSecond(0);
