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
/**
 * Which escape-tooth form (ASM-0038, SRC-0036 "The Lift" / "Specifications
 * for Lever Escapement"). CLUB: the tooth has its own impulse face, lift
 * shared between tooth and pallet (Playtner's own worked example, "wheel
 * teeth of the 'club' form"); the derived `toothWidthAngle` must be
 * positive. RATCHET (English): "a metal point passing over a jeweled
 * plane" — the entire lift is on the (wider) pallet, so the tooth is
 * effectively a bare point and `toothWidthAngle` may be zero.
 */
export type ToothKind = "CLUB" | "RATCHET";

export interface EscapeWheel {
  toothCount: number;
  /** Tooth form (ASM-0038). Changes what counts as a valid tooth/pallet/drop partition (ESC-106). */
  toothKind: ToothKind;
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
  /**
   * Distance from the balance staff to the face of the ruby pin (ASM-0041,
   * SRC-0036 "The Fork and Roller Action"): "the ruby pin, or strictly
   * speaking, the 'impulse radius,' is a lever arm, whose length is
   * measured from the center of the balance staff to the face of the ruby
   * pin". Entered directly, like `inertia`/`hairspringStiffness`: no roller
   * or ruby-pin geometry is used to derive it. The fork's own real acting
   * length is derived from it, not declared (`forkActingLength`, ESC-109).
   * Null when unknown.
   */
  impulseRadius: Length | null;
}

/**
 * Which of the two classical constructions places the locking points
 * (ASM-0037, SRC-0036 "Equidistant vs. Circular"). EQUIDISTANT: both
 * lockings lie on one locking circle struck from the pallet centre,
 * unlocking exactly on the tangent to the escape wheel's tip circle (this
 * is what `tangentialCentreDistance`/`lockingPoints` already construct —
 * also called the "tangential" escapement). CIRCULAR: two separate locking
 * circles giving equal lifting lever arms on both pallets, but unlocking
 * off the tangent by an amount that depends on the pallet width — not yet
 * implemented (no closed-form offset has been derived from SRC-0036 yet).
 */
export type PalletKind = "EQUIDISTANT" | "CIRCULAR";

/**
 * Simplified pallet geometry (ASM-0025), optional. The pallets lock on the
 * escape wheel's tip circle at two points `spanTeeth` pitches apart,
 * placed for tangential locking. The lever's total swing between bankings
 * is lock + impulse + run.
 */
export interface PalletGeometry {
  /** Pitches between the entry and exit locking points; k + ½ for two beats per tooth (ASM-0021). */
  spanTeeth: number;
  /** Which locking-point construction (ASM-0037). Only EQUIDISTANT is implemented. */
  kind: PalletKind;
  /** Lever rotation needed to unlock. */
  lockAngle: Angle;
  /**
   * The pallet's locking face: its inclination from the radial line
   * between the escape axis and the locking point (ASM-0039, SRC-0036
   * "The Draw" — "the locking planes... are inclined 12° from EB, and
   * FB", EB/FB being radii from the escape center through the locking
   * points). This incline is what pulls the lever onto its banking; must
   * be positive. The escape tooth's own locking face is derived from it,
   * not declared (`toothDrawAngle`, conventionally double, ESC-108).
   */
  drawAngle: Angle;
  /** Lever rotation from full lock to the banking. */
  runAngle: Angle;
  /**
   * Escape-wheel-side free rotation between one pallet's tooth releasing
   * and the next tooth landing on the other pallet's locking face (ASM-0036,
   * SRC-0036). Unlike lock/draw/run (lever-side), drop is measured at the
   * escape wheel's own axis: two beats per tooth (ASM-0021) gives each beat
   * a wheel-angle budget of half the tooth pitch (π / escapeTeeth), shared
   * between the tooth's own width, the pallet's width and drop — so drop
   * must be positive and strictly less than that budget (ESC-106).
   */
  dropAngle: Angle;
  /**
   * Escape-wheel-side width of the pallet's acting face (ASM-0037, SRC-0036),
   * the same angle frame as `dropAngle`. Together with drop it determines
   * the escape tooth's own width as the remainder of the per-beat wheel-angle
   * budget (`toothWidthAngle`); both must be positive (ESC-106).
   */
  widthAngle: Angle;
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
