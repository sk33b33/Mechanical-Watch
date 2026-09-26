import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";

export type CouplingId = EntityId<"coupling">;

/**
 * A non-gear connection between two coaxial rotating bodies.
 *
 * - FRICTION_CLUTCH, e.g. a cannon pinion on the centre arbor (REF-ENG §8).
 *   It is deliberately not a gear constraint. In running mode the two
 *   bodies turn together; during hand setting it slips, so they turn
 *   independently. The slip torque is not modeled (ASM-0015).
 * - MAINSPRING, between a barrel arbor (shaftA) and its barrel drum
 *   (shaftB) (REF-ENG §11). It imposes no kinematic constraint, because
 *   the spring's energy and torque are not modeled (ASM-0007). It records
 *   which arbor winds which drum, so the winding direction can be derived
 *   (ASM-0018).
 */
export type CouplingKind = "FRICTION_CLUTCH" | "MAINSPRING";

export interface Coupling {
  readonly id: CouplingId;
  readonly type: "Coupling";
  kind: CouplingKind;
  name: string;
  shaftAId: ShaftId;
  shaftBId: ShaftId;
}

export function createFrictionClutch(name: string, shaftAId: ShaftId, shaftBId: ShaftId): Coupling {
  return { id: createId("coupling"), type: "Coupling", kind: "FRICTION_CLUTCH", name, shaftAId, shaftBId };
}

export function createMainspring(name: string, arborShaftId: ShaftId, drumShaftId: ShaftId): Coupling {
  return { id: createId("coupling"), type: "Coupling", kind: "MAINSPRING", name, shaftAId: arborShaftId, shaftBId: drumShaftId };
}

export const COUPLING_KIND_LABELS: Record<CouplingKind, string> = {
  FRICTION_CLUTCH: "friction clutch",
  MAINSPRING: "mainspring",
};

export function frictionClutches(couplings: Record<CouplingId, Coupling>): Coupling[] {
  return Object.values(couplings).filter((c) => c.kind === "FRICTION_CLUTCH");
}

/** The drum a barrel arbor winds, through a declared mainspring. */
export function mainspringDrumOf(couplings: Record<CouplingId, Coupling>, arborShaftId: ShaftId): ShaftId | null {
  const spring = Object.values(couplings).find((c) => c.kind === "MAINSPRING" && c.shaftAId === arborShaftId);
  return spring?.shaftBId ?? null;
}
