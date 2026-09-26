import type { Length } from "@/units/length";
import type { Angle } from "@/units/angle";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";

export type EscapementId = EntityId<"escapement">;

/**
 * A Swiss lever escapement and its balance (REF-ENG §9, §10), modeled as
 * a SIMPLIFIED ESCAPEMENT MODEL at the kinematic level (ESC-001, ESC-002):
 *
 * - the escape wheel turns with its arbor, driven by the going train, and
 *   gives two beats per tooth (ASM-0021, source pending);
 * - the balance swings sinusoidally at a declared amplitude, at the
 *   frequency the train's speed requires (ASM-0022). No inertia,
 *   hairspring torque or damping is modeled, so the amplitude is an input,
 *   never a prediction;
 * - the train is locked between beats and advances during an impulse
 *   window, while the balance is within half the lift angle of its dead
 *   point; the pallet fork crosses from one banking to the other in that
 *   window (ASM-0023). Locking, draw, drop, impact, sliding contact and
 *   banking geometry are not modeled.
 *
 * The pallet arbor and balance staff are ordinary shafts (for placement
 * and bearings), but they oscillate: they must not be gear-driven
 * (ESC-102). The escape wheel is not a gear and has no module.
 */
export interface EscapeWheel {
  toothCount: number;
  tipDiameter: Length;
  thickness: Length;
  zCentre: Length;
}

export interface Balance {
  diameter: Length;
  thickness: Length;
  zCentre: Length;
  /** Declared peak swing either side of the dead point (not predicted). */
  amplitude: Angle;
  /** Balance angle over which the escapement acts (unlocking plus impulse). */
  liftAngle: Angle;
}

export interface Escapement {
  readonly id: EscapementId;
  readonly type: "Escapement";
  name: string;
  kind: "SWISS_LEVER";
  /** ESC-001: the declared model level. Only the simplified kinematic model exists. */
  modelLevel: "SIMPLIFIED_KINEMATIC";
  escapeArborShaftId: ShaftId;
  escapeWheel: EscapeWheel;
  palletArborShaftId: ShaftId;
  /** Total swing of the pallet fork between its two bankings. */
  leverAngle: Angle;
  balanceShaftId: ShaftId;
  balance: Balance;
}

export interface CreateEscapementParams {
  name: string;
  escapeArborShaftId: ShaftId;
  escapeWheel: EscapeWheel;
  palletArborShaftId: ShaftId;
  leverAngle: Angle;
  balanceShaftId: ShaftId;
  balance: Balance;
}

export function createEscapement(params: CreateEscapementParams): Escapement {
  return { ...params, id: createId("escapement"), type: "Escapement", kind: "SWISS_LEVER", modelLevel: "SIMPLIFIED_KINEMATIC" };
}

/** Shafts that oscillate under the escapement rather than turn with the train. */
export function oscillatingShaftIds(escapements: Record<EscapementId, Escapement>): Set<ShaftId> {
  return new Set(Object.values(escapements).flatMap((e) => [e.palletArborShaftId, e.balanceShaftId]));
}
