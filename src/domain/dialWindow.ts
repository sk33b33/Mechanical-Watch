import type { Length } from "@/units/length";
import type { Vec2 } from "@/math/vec2";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { DialId } from "./dial";

export type DialWindowId = EntityId<"dialWindow">;

/**
 * A window's own cutout shape, centred on its own `centre` — a deliberate
 * simplification of the full range of real date/month/year window shapes
 * (ASM-0051, same "visual only, not a manufacturing claim" treatment this
 * project already gives other cosmetic geometry, ASM-0005, ASM-0020):
 * - CIRCLE: a real simple-date aperture is usually round.
 * - RECTANGLE (axis-aligned, `width` along X and `height` along Y): a
 *   real month/year indicator window is usually a small rectangle — wide
 *   enough to show a word ("January") or a short label ("Year 4"), which
 *   a fixed-radius circle cannot do without either clipping the text or
 *   being wide enough to reveal its neighbours on the ring.
 */
export type DialWindowOutline =
  | { kind: "CIRCLE"; radius: Length }
  | { kind: "RECTANGLE"; width: Length; height: Length };

/**
 * A cutout in a dial, through which one of the movement's disc
 * complications (`MoonPhase`, `DateComplication`, `MonthComplication`,
 * `LeapYearComplication`, `SeasonComplication`, `YearDigitComplication` — see
 * `src/domain/discComplication.ts`) is visible from the dial side.
 * This is the display concept Phase 8.6
 * scoped ("dial windows or sub-dials") but never actually built —
 * without it, every disc complication sits behind the dial (closer to
 * the mainplate) with the dial's own opaque disc fully occluding it, so
 * the only way to read a complication's value at all was the
 * inspector's own "Current position" text row.
 *
 * `centre` is in the same movement-plan (x, y) coordinates as everything
 * else — not relative to the dial's own centre — matching how every
 * other plan-positioned entity in this project is declared.
 *
 * A window makes nothing happen kinematically — it is a pure display
 * entity, read only by geometry/rendering and by DIALWIN-001/002
 * (`src/validation/rules/dialWindowRules.ts`), which check that it
 * actually overlaps its referenced complication's own disc; a window
 * that doesn't is a real design error (a hole showing nothing, or
 * showing dial material where a disc should be), not a kinematic one.
 */
/**
 * A fixed index mark printed on the dial itself, just outside a window's
 * own edge, naming which position is "current" — needed only when the
 * window is large enough to show more than one position's own printed
 * art/label at once (e.g. a window sized to a whole disc, ASM-0069-style:
 * SeasonComplication's own window, which shows the full four-wedge
 * season illustration rather than catching one short text label at a
 * time the way date/month/leap-year's own small windows already do).
 * `"NORTH"` is the only direction modeled: the position reads at the
 * window's own north edge, the same "north = the position currently
 * shown" convention `windowAbove` already uses for every small, offset
 * disc window (`src/app/teachingMovement.ts`) — this just makes that
 * convention visible on a window too big to make it obvious by itself.
 */
export type DialWindowPointer = "NORTH";

export interface DialWindow {
  readonly id: DialWindowId;
  readonly type: "DialWindow";
  name: string;
  dialId: DialId;
  /** The disc complication shown through this window — a MoonPhase, DateComplication, MonthComplication, LeapYearComplication, SeasonComplication or YearDigitComplication id. */
  complicationId: EntityId;
  centre: Vec2;
  outline: DialWindowOutline;
  /** A fixed reading-position index mark on the dial, or null for none (the usual case — a small window that already catches only one position). */
  pointer: DialWindowPointer | null;
  /**
   * Fixed lunar-phase marks printed on the dial in a ring around a circular moon-phase window (ASM-0072): new, first quarter,
   * full and last quarter, at the positions a moon image occupies at each phase. False (the usual case) for none.
   */
  phaseMarks: boolean;
}

export interface CreateDialWindowParams {
  name: string;
  dialId: DialId;
  complicationId: EntityId;
  centre: Vec2;
  outline: DialWindowOutline;
  pointer?: DialWindowPointer | null;
  phaseMarks?: boolean;
}

export function createDialWindow(params: CreateDialWindowParams): DialWindow {
  return { pointer: null, phaseMarks: false, ...params, id: createId("dialWindow"), type: "DialWindow" };
}
