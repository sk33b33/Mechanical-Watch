import type { Movement } from "@/domain/movement";
import { numberToHex, type DialColourKey, type HexColour } from "@/domain/appearance";
import type { DateComplicationId } from "@/domain/dateComplication";
import { COLORS } from "@/viewport/viewport";
import {
  DIAL_VISUALIZATION,
  DIAL_WINDOW_VISUALIZATION,
  MOON_PHASE_VISUALIZATION,
  SEASON_VISUALIZATION,
  YEAR_DIGIT_BARREL_VISUALIZATION,
} from "@/geometry/assemblyGeometry3d";

/**
 * The colours the app uses when none is chosen (follow-up 39, ASM-0090), as "#rrggbb": what each Colours
 * button shows until it is changed, and what Reset goes back to. They read the viewport's own constants, so the
 * menu cannot drift from what is drawn.
 */
export function builtInDialColour(key: DialColourKey): HexColour {
  switch (key) {
    case "dial": return numberToHex(COLORS.dial);
    case "hourMarkers": return numberToHex(COLORS.dialMarker);
    case "dialPrint": return DIAL_VISUALIZATION.numeralColor;
    case "secondsHand": return numberToHex(COLORS.hand.SECONDS);
    case "minuteHand": return numberToHex(COLORS.hand.MINUTES);
    case "hourHand": return numberToHex(COLORS.hand.HOURS);
  }
}

/** The built-in body and text colours of a wheel a dial window shows (a year display is the four barrels as one). */
export function builtInWheelColours(movement: Movement, complicationId: string): { body: HexColour; text: HexColour } {
  if (movement.moonPhases[complicationId as keyof typeof movement.moonPhases] !== undefined) {
    return { body: numberToHex(COLORS.moonPhase), text: MOON_PHASE_VISUALIZATION.moonColor };
  }
  const date = movement.dateComplications[complicationId as DateComplicationId];
  if (date !== undefined) {
    return { body: numberToHex(date.display === "DAY_OF_WEEK" ? COLORS.weekdayStar : COLORS.dateStar), text: DIAL_WINDOW_VISUALIZATION.textColor };
  }
  if (movement.monthComplications[complicationId as keyof typeof movement.monthComplications] !== undefined) {
    return { body: numberToHex(COLORS.monthStar), text: DIAL_WINDOW_VISUALIZATION.textColor };
  }
  if (movement.leapYearComplications[complicationId as keyof typeof movement.leapYearComplications] !== undefined) {
    return { body: numberToHex(COLORS.leapYearWheel), text: DIAL_WINDOW_VISUALIZATION.textColor };
  }
  if (movement.seasonComplications[complicationId as keyof typeof movement.seasonComplications] !== undefined) {
    return { body: numberToHex(COLORS.seasonWheel), text: SEASON_VISUALIZATION.iconColor };
  }
  return { body: YEAR_DIGIT_BARREL_VISUALIZATION.backgroundColor, text: YEAR_DIGIT_BARREL_VISUALIZATION.textColor };
}
