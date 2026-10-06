import type { EntityId } from "./ids";
import type { Movement } from "./movement";
import type { Gear, GearId } from "./gear";
import type { Shaft, ShaftId } from "./shaft";
import type { Frame, FrameId } from "./frame";
import type { Jewel, JewelId } from "./jewel";
import type { KeylessWorks, KeylessWorksId } from "./keyless";
import type { Dial, DialId } from "./dial";
import type { Escapement, EscapementId } from "./escapement";
import type { MoonPhase, MoonPhaseId } from "./moonPhase";
import type { DateComplication, DateComplicationId } from "./dateComplication";
import type { MonthComplication, MonthComplicationId } from "./monthComplication";
import type { LeapYearComplication, LeapYearComplicationId } from "./leapYearComplication";

export type SelectableEntity = Gear | Shaft | Frame | Jewel | KeylessWorks | Dial | Escapement | MoonPhase | DateComplication | MonthComplication | LeapYearComplication;

export function findEntity(movement: Movement, id: EntityId): SelectableEntity | undefined {
  return (
    movement.gears[id as GearId] ??
    movement.shafts[id as ShaftId] ??
    movement.frames[id as FrameId] ??
    movement.jewels[id as JewelId] ??
    movement.keylessWorks[id as KeylessWorksId] ??
    movement.dials[id as DialId] ??
    movement.escapements[id as EscapementId] ??
    movement.moonPhases[id as MoonPhaseId] ??
    movement.dateComplications[id as DateComplicationId] ??
    movement.monthComplications[id as MonthComplicationId] ??
    movement.leapYearComplications[id as LeapYearComplicationId]
  );
}
