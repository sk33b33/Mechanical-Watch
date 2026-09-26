import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";
import type { Torque } from "@/units/torque";

export type CouplingId = EntityId<"coupling">;

/**
 * A non-gear connection between two coaxial rotating bodies.
 *
 * - FRICTION_CLUTCH, e.g. a cannon pinion on the centre arbor (REF-ENG §8).
 *   It is deliberately not a gear constraint. In running mode the two
 *   bodies turn together; during hand setting it slips, so they turn
 *   independently. The slip torque is not modeled (ASM-0015).
 * - MAINSPRING, between a barrel arbor (shaftA) and its barrel drum
 *   (shaftB) (REF-ENG §11). It imposes no kinematic constraint. It records
 *   which arbor winds which drum, so the winding direction can be derived
 *   (ASM-0018), and optionally the spring's data for the simplified energy
 *   model (ASM-0026).
 */
export type CouplingKind = "FRICTION_CLUTCH" | "MAINSPRING";

/**
 * The mainspring as data (REF-ENG §11), for the simplified energy model
 * (ASM-0026). Every value is entered, never assumed:
 * - usableTurns: arbor turns (relative to the drum) from let-down to
 *   fully wound;
 * - torque falls linearly from fullyWoundTorque to letDownTorque over
 *   those turns (equal values give the constant-torque model REF-ENG §11
 *   allows when declared);
 * - trainEfficiency: overall efficiency from barrel to escape wheel
 *   (ASM-0002, explicitly configured). Null means none is configured and
 *   torques are the lossless upper bound.
 */
export interface MainspringSpec {
  usableTurns: number;
  fullyWoundTorque: Torque;
  letDownTorque: Torque;
  trainEfficiency: number | null;
}

interface CouplingBase {
  readonly id: CouplingId;
  readonly type: "Coupling";
  name: string;
  shaftAId: ShaftId;
  shaftBId: ShaftId;
}

export interface FrictionClutch extends CouplingBase {
  kind: "FRICTION_CLUTCH";
}

/** shaftA = barrel arbor, shaftB = drum. `spring` is null when the spring's data is unknown. */
export interface MainspringLink extends CouplingBase {
  kind: "MAINSPRING";
  spring: MainspringSpec | null;
}

export type Coupling = FrictionClutch | MainspringLink;

export function createFrictionClutch(name: string, shaftAId: ShaftId, shaftBId: ShaftId): Coupling {
  return { id: createId("coupling"), type: "Coupling", kind: "FRICTION_CLUTCH", name, shaftAId, shaftBId };
}

export function createMainspring(name: string, arborShaftId: ShaftId, drumShaftId: ShaftId, spring: MainspringSpec | null = null): MainspringLink {
  return { id: createId("coupling"), type: "Coupling", kind: "MAINSPRING", name, shaftAId: arborShaftId, shaftBId: drumShaftId, spring };
}

export function mainsprings(couplings: Record<CouplingId, Coupling>): MainspringLink[] {
  return Object.values(couplings).filter((c): c is MainspringLink => c.kind === "MAINSPRING");
}

export const COUPLING_KIND_LABELS: Record<CouplingKind, string> = {
  FRICTION_CLUTCH: "friction clutch",
  MAINSPRING: "mainspring",
};

export function frictionClutches(couplings: Record<CouplingId, Coupling>): FrictionClutch[] {
  return Object.values(couplings).filter((c): c is FrictionClutch => c.kind === "FRICTION_CLUTCH");
}

/** The drum a barrel arbor winds, through a declared mainspring. */
export function mainspringDrumOf(couplings: Record<CouplingId, Coupling>, arborShaftId: ShaftId): ShaftId | null {
  const spring = Object.values(couplings).find((c) => c.kind === "MAINSPRING" && c.shaftAId === arborShaftId);
  return spring?.shaftBId ?? null;
}
