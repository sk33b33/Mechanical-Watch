import type { Length } from "@/units/length";
import type { AngularVelocity } from "@/units/angularVelocity";
import { radiansPerSecond } from "@/units/angularVelocity";
import type { EntityId } from "./ids";
import { createId } from "./ids";

export type ShaftId = EntityId<"shaft">;

/**
 * A shaft's rotational axis. Assumption: all shafts in a movement are
 * parallel, oriented perpendicular to the mainplate (the Z axis in the
 * viewport). This matches a conventional watch movement layout and is
 * an explicit simplification (see docs/MASTER_BUILD_PROMPT.md).
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
