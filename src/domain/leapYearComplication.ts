import type { Length } from "@/units/length";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";
import type { MonthComplicationId } from "./monthComplication";

export type LeapYearComplicationId = EntityId<"leapYearComplication">;

/**
 * Four slots (one normal/normal/normal/leap cycle): a structural fact
 * about a four-year cycle, not a declared per-movement field, same
 * treatment as `MONTHS_PER_YEAR` (`src/kinematics/monthComplication.ts`,
 * ASM-0049).
 */
export const LEAP_YEAR_SLOT_COUNT = 4;

/** Position labels 0–3; position 3 is the leap year, by this entity's own convention (see below). */
export const LEAP_YEAR_LABELS = ["Year 1", "Year 2", "Year 3", "Year 4 (leap)"] as const;

/**
 * How long the leap-year wheel's own real Geneva-drive index stroke
 * (SRC-0047) is played out over, in simulated seconds, once triggered —
 * not derived from any real continuously-rotating driver: this project's
 * simplified jump-chain model (ASM-0048/0049/0050) has no arbor that
 * actually spins once a year, so the real mechanism's indexing-stroke
 * TIMING has no sourced basis here (ASM-0052). The stroke's own SHAPE is
 * real and simulated exactly (`genevaWheelAngle`,
 * `src/kinematics/genevaDrive.ts`, SRC-0047); only this duration is a
 * declared visualization choice, so that real non-uniform motion is
 * visible instead of an instantaneous jump — the same "illustrative, not
 * measured" treatment already given other declared visual constants
 * (e.g. `DIAL_WINDOW_VISUALIZATION`, ASM-0051).
 */
export const LEAP_YEAR_INDEX_STROKE_SECONDS = 0.4;

/**
 * A four-year-cycle (leap-year) indicator wheel, driven entirely by its
 * referenced month complication's own December-to-January wrap — one
 * trigger per calendar year by construction (ASM-0050, Phase 8.4).
 * SRC-0044 (Omega SA, a granted patent): the real mechanism is
 * "controlled directly or indirectly by a rotatable assembly journalled
 * on the month star such assembly including a year cam and a Maltese
 * cross enabling it to effect one revolution every four years" — a
 * cam-plus-Geneva hybrid. This entity models only the Geneva-drive
 * component: the year cam, which would carry the real leap-year logic
 * (e.g. century exceptions), is not modeled, so this repeats a fixed
 * four-year cycle rather than a true Gregorian calendar.
 *
 * Unlike `DateComplication`'s own drive shaft, this mechanism has no
 * continuous arbor of its own: it advances by exactly one Geneva index
 * step (2π / `LEAP_YEAR_SLOT_COUNT`, the real, sourced Geneva-mechanism
 * fact, SRC-0047) each time its referenced month complication's own star
 * wraps from December back to January. The real mechanism's own
 * continuous, non-uniform pin/slot contact motion during that index
 * event IS simulated (`src/simulation/simulationState.ts`'s
 * `SimulationState.genevaStrokes`, played out via `genevaWheelAngle`
 * over `LEAP_YEAR_INDEX_STROKE_SECONDS`) — but only the stroke's real
 * SHAPE, not its real timing, since no continuously-rotating driver
 * exists at this project's year-scale trigger event to derive a real
 * duration from (see `LEAP_YEAR_INDEX_STROKE_SECONDS`'s own doc
 * comment). Also reported as reference figures (YEAR-002).
 *
 * `wheelShaftId` is a separate, declared (FIXED-position) arbor, NOT
 * meshed with anything — same pattern as the date and month stars.
 * Position 0–3, an arbitrary reference like the date/month stars' own
 * zero position; position 3 is the leap year, by this entity's own
 * convention (SRC-0044's real mechanism does not specify which of its
 * four cam positions is which — any single position repeating every
 * fourth trigger is kinematically equivalent).
 */
export interface LeapYearComplication {
  readonly id: LeapYearComplicationId;
  readonly type: "LeapYearComplication";
  name: string;
  monthComplicationId: MonthComplicationId;
  wheelShaftId: ShaftId;
  wheelTipDiameter: Length;
  wheelThickness: Length;
  wheelZCentre: Length;
}

export interface CreateLeapYearComplicationParams {
  name: string;
  monthComplicationId: MonthComplicationId;
  wheelShaftId: ShaftId;
  wheelTipDiameter: Length;
  wheelThickness: Length;
  wheelZCentre: Length;
}

export function createLeapYearComplication(params: CreateLeapYearComplicationParams): LeapYearComplication {
  return { ...params, id: createId("leapYearComplication"), type: "LeapYearComplication" };
}

/** Arbors advanced only by the year-wrap jump mechanism, never by continuous gear-train propagation (KIN-001 exemption, same pattern as `monthStarShaftIds`). */
export function leapYearWheelShaftIds(leapYearComplications: Record<LeapYearComplicationId, LeapYearComplication>): Set<ShaftId> {
  return new Set(Object.values(leapYearComplications).map((y) => y.wheelShaftId));
}
