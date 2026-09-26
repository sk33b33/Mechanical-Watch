import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";

export type CouplingId = EntityId<"coupling">;

/**
 * A friction clutch between two coaxial rotating bodies, such as a cannon
 * pinion on the centre arbor (REF-ENG §8). It is deliberately not a gear
 * constraint. In running mode the two bodies turn together; during hand
 * setting it slips, so they turn independently. The slip torque is not
 * modeled (ASM-0015).
 */
export interface Coupling {
  readonly id: CouplingId;
  readonly type: "Coupling";
  kind: "FRICTION_CLUTCH";
  name: string;
  shaftAId: ShaftId;
  shaftBId: ShaftId;
}

export function createFrictionClutch(name: string, shaftAId: ShaftId, shaftBId: ShaftId): Coupling {
  return { id: createId("coupling"), type: "Coupling", kind: "FRICTION_CLUTCH", name, shaftAId, shaftBId };
}
