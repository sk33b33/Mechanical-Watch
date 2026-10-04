import type { Length } from "@/units/length";
import type { Angle } from "@/units/angle";
import type { MomentOfInertia, TorsionalStiffness } from "@/units/rotational";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";

export type EscapementId = EntityId<"escapement">;

/**
 * A Swiss lever escapement and its balance (REF-ENG §9, §10), modeled as
 * a SIMPLIFIED ESCAPEMENT MODEL at the kinematic level (ESC-001, ESC-002):
 *
 * - the escape wheel turns with its arbor, driven by the going train, and
 *   gives two beats per tooth (ASM-0021, SRC-0016/SRC-0017);
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
  /**
   * Simplified dynamic model (L3, ASM-0024), optional: the balance's moment
   * of inertia about its staff and the hairspring's torsional stiffness.
   * Null when unknown; the model then stays kinematic. Entered directly:
   * no material or hairspring geometry is used to derive them.
   */
  inertia: MomentOfInertia | null;
  hairspringStiffness: TorsionalStiffness | null;
  /**
   * Quality factor of the balance oscillation (energy loss per period =
   * 2π E / Q), for the energy model (ASM-0026). A loss property that can
   * only come from measurement or a source; null when unknown.
   */
  qualityFactor: number | null;
  /**
   * Declared/measured rate sensitivity to amplitude (s/day per radian of
   * amplitude deviation from `amplitude` above), for a first-order
   * isochronism-error correction (L3, ASM-0034). There is no universal
   * value: a real spring's amplitude dependence ("circular error", REF-ENG
   * §10) comes from its own terminal-curve geometry and must be measured or
   * sourced per movement. Null when unknown; the balance then stays
   * isochronous by construction (ASM-0024).
   */
  isochronismCoefficient: number | null;
}

/**
 * Simplified pallet geometry (ASM-0025), optional. The pallets lock on the
 * escape wheel's tip circle at two points `spanTeeth` pitches apart,
 * placed for tangential locking. The lever's total swing between bankings
 * is lock + impulse + run.
 */
export interface PalletGeometry {
  /** Pitches between the entry and exit locking points; k + ½ for two beats per tooth (ASM-0021). */
  spanTeeth: number;
  /** Lever rotation needed to unlock. */
  lockAngle: Angle;
  /** Angle of the locking face that pulls the lever onto its banking; must be positive. */
  drawAngle: Angle;
  /** Lever rotation from full lock to the banking. */
  runAngle: Angle;
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
  /** Null when the pallet geometry is not given: the escapement stays a timing model only. */
  pallets: PalletGeometry | null;
  /**
   * Share of the escape wheel's energy that reaches the balance (ASM-0026).
   * A loss property that can only come from measurement or a source;
   * null when unknown.
   */
  escapementEfficiency: number | null;
}

export interface CreateEscapementParams {
  name: string;
  escapeArborShaftId: ShaftId;
  escapeWheel: EscapeWheel;
  palletArborShaftId: ShaftId;
  leverAngle: Angle;
  balanceShaftId: ShaftId;
  balance: Balance;
  pallets: PalletGeometry | null;
  escapementEfficiency: number | null;
}

export function createEscapement(params: CreateEscapementParams): Escapement {
  return { ...params, id: createId("escapement"), type: "Escapement", kind: "SWISS_LEVER", modelLevel: "SIMPLIFIED_KINEMATIC" };
}

/** Shafts that oscillate under the escapement rather than turn with the train. */
export function oscillatingShaftIds(escapements: Record<EscapementId, Escapement>): Set<ShaftId> {
  return new Set(Object.values(escapements).flatMap((e) => [e.palletArborShaftId, e.balanceShaftId]));
}

/**
 * All shafts belonging to the escapement (escape wheel, pallet arbor,
 * balance staff), used to tell "escapement parts" from train wheels for
 * the endshake advisory (BRG-006, ASM-0028). Unlike `oscillatingShaftIds`,
 * this includes the escape arbor, which turns with the train but is
 * still an "escapement part" in that sense.
 */
export function escapementShaftIds(escapements: Record<EscapementId, Escapement>): Set<ShaftId> {
  return new Set(Object.values(escapements).flatMap((e) => [e.escapeArborShaftId, e.palletArborShaftId, e.balanceShaftId]));
}
