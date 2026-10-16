import type { Length } from "@/units/length";
import type { Angle } from "@/units/angle";
import type { Vec2 } from "@/math/vec2";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { MonthComplicationId } from "./monthComplication";

export type YearDigitComplicationId = EntityId<"yearDigitComplication">;

/**
 * Which decimal digit of a 4-digit year a `YearDigitComplication` shows.
 * Ordered least-to-most significant, the order carry propagates in
 * (`digitsToAdvance`, `src/kinematics/yearDigitComplication.ts`).
 */
export const YEAR_DIGIT_PLACES = ["ONES", "TENS", "HUNDREDS", "THOUSANDS"] as const;
export type YearDigitPlace = (typeof YEAR_DIGIT_PLACES)[number];

/** 0-9: a structural fact about decimal digits, not a declared per-movement field. */
export const YEAR_DIGIT_SLOT_COUNT = 10;

/** Position labels 0-9, shared by every digit wheel regardless of its own `digitPlace`. */
export const YEAR_DIGIT_LABELS = Array.from({ length: YEAR_DIGIT_SLOT_COUNT }, (_, i) => String(i));

/**
 * A "drum clock" year display: four decimal-digit barrel segments —
 * ones, tens, hundreds, thousands — all referencing the same
 * `MonthComplication` and all triggered by its December-to-January
 * wrap, the same event `LeapYearComplication`'s own Geneva wheel
 * already fires on.
 *
 * Raised directly by the user ("add a drum clock for the current
 * year"), then revised twice more directly by the user: first to a
 * genuinely drum-shaped body with a digit wrapped around its own
 * lateral surface (Phase 8.13), then — after the user supplied a photo
 * of a real mechanical tally-counter and explained the "4 gears" they
 * were still seeing was this project's own vertical-shaft convention
 * fighting a part that is supposed to look and turn like a real
 * counter roller — to this shape (Phase 8.15): a literal
 * horizontal-axis barrel, the user's own explicit, informed choice
 * after being told it breaks ASM-0006 (every `Shaft` axis vertical)
 * and needs a declared exception, the same one `KeylessWorks`'s own
 * stem already has (ASM-0019).
 *
 * Like the stem, this is NOT a `Shaft` — it has no `wheelShaftId`. Each
 * segment declares its own horizontal rotation axis directly:
 * `axleOrigin` (a point in the movement plane the axis passes
 * through), `axleDirection` (the axis's own direction in that plane,
 * from +X counter-clockwise seen from +Z — the same convention
 * `KeylessWorks.stemDirection` already uses) and `axleHeight` (the
 * axis's own Z height). A real multi-digit barrel shares one straight
 * axle; here each segment declares its own copy of that line rather
 * than referencing one shared axle entity, the same "declared
 * independently, not cross-validated" convention every other
 * dimension in this domain already follows (e.g. all four segments'
 * `barrelDiameter` are independently declared even though a real
 * design sets them equal) — a movement that gives its four segments
 * different axle lines is not rejected, just not a straight barrel
 * anymore.
 *
 * No sourced real mechanism (patent or manufacturer description) for
 * a wristwatch "year" complication built from decimal digit-roller
 * wheels has been found, so this still only models the net kinematic
 * effect the user described, declared rather than invented: the jump
 * stays instantaneous (no claimed stroke shape to simulate), and
 * decimal carry between declared places (`digitsToAdvance`,
 * `src/kinematics/yearDigitComplication.ts`) is unchanged from the
 * vertical-axis version — only the rotation's own real-world axis and
 * the geometry/rendering around it changed, not the kinematics.
 *
 * There is no sourced way for a watch to know the real calendar year
 * on its own, so — matching how `DateComplication` always starts at
 * day 1 and `MonthComplication` always starts at January —
 * `startDigit` is each segment's own independently declared starting
 * digit, set once like a real digit wheel would be set by hand.
 */
export interface YearDigitComplication {
  readonly id: YearDigitComplicationId;
  readonly type: "YearDigitComplication";
  name: string;
  monthComplicationId: MonthComplicationId;
  digitPlace: YearDigitPlace;
  /** This segment's own declared starting digit (0-9), independent of the other three. */
  startDigit: number;
  /** A point in the movement plane this segment's own horizontal rotation axis passes through. */
  axleOrigin: Vec2;
  /** Direction of this segment's own rotation axis in the movement plane, from +X counter-clockwise seen from +Z (ASM-0019's own convention). */
  axleDirection: Angle;
  /** Z height of this segment's own rotation axis. */
  axleHeight: Length;
  /** This segment's own cylindrical diameter. */
  barrelDiameter: Length;
  /** How long this segment is along its own axle. */
  segmentLength: Length;
}

export interface CreateYearDigitComplicationParams {
  name: string;
  monthComplicationId: MonthComplicationId;
  digitPlace: YearDigitPlace;
  startDigit: number;
  axleOrigin: Vec2;
  axleDirection: Angle;
  axleHeight: Length;
  barrelDiameter: Length;
  segmentLength: Length;
}

export function createYearDigitComplication(params: CreateYearDigitComplicationParams): YearDigitComplication {
  return { ...params, id: createId("yearDigitComplication"), type: "YearDigitComplication" };
}
