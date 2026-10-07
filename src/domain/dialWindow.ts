import type { Length } from "@/units/length";
import type { Vec2 } from "@/math/vec2";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { DialId } from "./dial";

export type DialWindowId = EntityId<"dialWindow">;

/**
 * A circular cutout in a dial, through which one of the movement's disc
 * complications (`MoonPhase`, `DateComplication`, `MonthComplication`,
 * `LeapYearComplication` — see `src/domain/discComplication.ts`) is
 * visible from the dial side. This is the display concept Phase 8.6
 * scoped ("dial windows or sub-dials") but never actually built —
 * without it, every disc complication sits behind the dial (closer to
 * the mainplate) with the dial's own opaque disc fully occluding it, so
 * the only way to read a complication's value at all was the
 * inspector's own "Current position" text row.
 *
 * `centre`/`radius` are in the same movement-plan (x, y) coordinates as
 * everything else — not relative to the dial's own centre — matching
 * how every other plan-positioned entity in this project is declared.
 * Circular only: a deliberate simplification of a real date window's
 * usual small-rectangle shape (ASM-0051), the same "visual only, not a
 * manufacturing claim" treatment this project already gives other
 * cosmetic geometry (ASM-0005, ASM-0020).
 *
 * A window makes nothing happen kinematically — it is a pure display
 * entity, read only by geometry/rendering and by DIALWIN-001/002
 * (`src/validation/rules/dialWindowRules.ts`), which check that it
 * actually overlaps its referenced complication's own disc; a window
 * that doesn't is a real design error (a hole showing nothing, or
 * showing dial material where a disc should be), not a kinematic one.
 */
export interface DialWindow {
  readonly id: DialWindowId;
  readonly type: "DialWindow";
  name: string;
  dialId: DialId;
  /** The disc complication shown through this window — a MoonPhase, DateComplication, MonthComplication or LeapYearComplication id. */
  complicationId: EntityId;
  centre: Vec2;
  radius: Length;
}

export interface CreateDialWindowParams {
  name: string;
  dialId: DialId;
  complicationId: EntityId;
  centre: Vec2;
  radius: Length;
}

export function createDialWindow(params: CreateDialWindowParams): DialWindow {
  return { ...params, id: createId("dialWindow"), type: "DialWindow" };
}
