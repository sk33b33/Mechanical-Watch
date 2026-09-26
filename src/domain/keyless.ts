import type { Length } from "@/units/length";
import type { Angle } from "@/units/angle";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { GearId } from "./gear";

export type KeylessWorksId = EntityId<"keyless">;

/** A toothed element on the stem: a pitch model like any gear (REF-ENG §6). */
export interface StemPinion {
  toothCount: number;
  module: Length;
}

/**
 * The keyless works: crown, stem, winding pinion and sliding pinion, plus
 * references to the ordinary wheels they engage (REF-ENG §8 for the
 * setting side, §11 for winding).
 *
 * The stem is the one axis that is not perpendicular to the mainplate: it
 * lies in a plane parallel to it (an exception to ASM-0006, see ASM-0019).
 * Its plan line passes through the crown wheel's solved axis, in
 * `stemDirection` (from +X, counter-clockwise seen from +Z; pointing out
 * toward the crown), at height `stemHeight`.
 *
 * Stem pinions are pitch models. Each engages its wheel at a right angle,
 * at the wheel's pitch circle on the crown side of the wheel's axis
 * (ASM-0019):
 * - the winding pinion turns freely on the stem and always engages the
 *   crown wheel. When the stem is in (winding position) its ratchet
 *   (Breguet) teeth couple it to the sliding pinion in one direction only;
 * - the sliding pinion turns with the stem. When the stem is pulled out
 *   (setting position) the yoke moves it to engage the setting wheel.
 *
 * The setting lever, yoke, their springs and the ratchet teeth' form are
 * represented only by those two stem positions (ASM-0019). The click
 * holds `ratchetGearId` against turning back; the direction it allows is
 * derived from the mainspring (ASM-0018).
 */
export interface KeylessWorks {
  readonly id: KeylessWorksId;
  readonly type: "KeylessWorks";
  name: string;
  stemDirection: Angle;
  stemHeight: Length;
  windingPinion: StemPinion;
  slidingPinion: StemPinion;
  crownWheelGearId: GearId;
  settingWheelGearId: GearId;
  ratchetGearId: GearId;
}

export interface CreateKeylessParams {
  name: string;
  stemDirection: Angle;
  stemHeight: Length;
  windingPinion: StemPinion;
  slidingPinion: StemPinion;
  crownWheelGearId: GearId;
  settingWheelGearId: GearId;
  ratchetGearId: GearId;
}

export function createKeylessWorks(params: CreateKeylessParams): KeylessWorks {
  return { ...params, id: createId("keyless"), type: "KeylessWorks" };
}

/** Two stem positions. The going train keeps running in both (no stop-seconds, ASM-0015). */
export type StemPosition = "WINDING" | "SETTING";

/** Ids for the two rotating bodies on a stem, used alongside shaft ids in kinematics and simulation. */
export type StemBodyId = `${KeylessWorksId}/STEM` | `${KeylessWorksId}/WINDING_PINION`;

export function stemBodyId(id: KeylessWorksId, body: "STEM" | "WINDING_PINION"): StemBodyId {
  return `${id}/${body}`;
}
