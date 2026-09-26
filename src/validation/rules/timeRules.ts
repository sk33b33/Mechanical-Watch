import type { HandFunction, Shaft } from "@/domain/shaft";
import { HAND_PERIOD_SECONDS, formatPeriod, periodSeconds } from "@/kinematics/timeDisplay";
import { handSettingState } from "@/kinematics/solveGearTrain";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

const HAND_ORDER: HandFunction[] = ["HOURS", "MINUTES", "SECONDS"];
const HAND_LABEL: Record<HandFunction, string> = { HOURS: "hours", MINUTES: "minutes", SECONDS: "seconds" };

function nearlyEqual(a: number, b: number): boolean {
  const tolerance = NUMERICAL_PARAMETERS.solverRelativeTolerance;
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

function formatHours(seconds: number): string {
  return seconds >= 7200 ? `${(seconds / 3600).toFixed(4)} h` : seconds >= 120 ? `${(seconds / 60).toFixed(4)} min` : `${seconds.toFixed(4)} s`;
}

/**
 * Time display (ASM-0014): TIME-001 one shaft per hand; TIME-002 the hand
 * ratios must match a 12-hour dial and turn the same way; TIME-003 a
 * nominal-time drive needs a minutes hand; TIME-004 reports hand rates
 * under a prescribed drive; SET-001 the hands must be settable without
 * turning the going train (REF-ENG §8).
 */
export const timeRules: Rule = ({ movement, train }) => {
  const issues: ValidationIssue[] = [];
  const byHand = new Map<HandFunction, Shaft[]>();
  for (const shaft of Object.values(movement.shafts)) {
    if (shaft.hand === null) continue;
    byHand.set(shaft.hand, [...(byHand.get(shaft.hand) ?? []), shaft]);
  }

  for (const hand of HAND_ORDER) {
    const shafts = byHand.get(hand) ?? [];
    if (shafts.length > 1) {
      issues.push(
        issue("TIME-001", `duplicate-${hand}`, "error", "L2_KINEMATIC", shafts.map((s) => s.id),
          `More than one shaft carries the ${HAND_LABEL[hand]} hand (${shafts.map((s) => s.name).join(", ")}).`, ["ASM-0014"]),
      );
    }
  }

  if (movement.drive?.kind === "NOMINAL_TIME" && (byHand.get("MINUTES") ?? []).length === 0) {
    issues.push(
      issue("TIME-003", "no-minutes-hand", "error", "L2_KINEMATIC", [],
        "Nominal-time drive needs a shaft that carries the minutes hand.", ["ASM-0014"]),
    );
  }

  const single = (hand: HandFunction): Shaft | undefined => {
    const shafts = byHand.get(hand) ?? [];
    return shafts.length === 1 ? shafts[0] : undefined;
  };
  const present = HAND_ORDER.map((h) => ({ hand: h, shaft: single(h) })).filter(
    (p): p is { hand: HandFunction; shaft: Shaft } => p.shaft !== undefined,
  );
  const reference = present.find((p) => p.hand === "MINUTES") ?? present[0];

  if (reference !== undefined) {
    const refOmega = train.shaftAngularVelocity.get(reference.shaft.id);
    if (refOmega !== undefined && refOmega !== 0) {
      for (const other of present) {
        if (other === reference) continue;
        const omega = train.shaftAngularVelocity.get(other.shaft.id);
        if (omega === undefined) continue;
        const expected = HAND_PERIOD_SECONDS[reference.hand] / HAND_PERIOD_SECONDS[other.hand];
        const actual = omega / refOmega;
        if (nearlyEqual(actual, expected)) continue;
        // The period this hand would have if the reference hand ran at its nominal rate.
        const impliedPeriod = actual === 0 ? Number.POSITIVE_INFINITY : HAND_PERIOD_SECONDS[reference.hand] / Math.abs(actual);
        const direction = actual < 0 ? " and turns the opposite way" : "";
        issues.push(
          issue("TIME-002", `${other.hand}-vs-${reference.hand}`, "error", "L2_KINEMATIC", [other.shaft.id, reference.shaft.id],
            `The ${HAND_LABEL[other.hand]} hand (${other.shaft.name}) would take ${formatHours(impliedPeriod)} per revolution when the ${HAND_LABEL[reference.hand]} hand keeps time (should be ${formatHours(HAND_PERIOD_SECONDS[other.hand])})${direction}.`,
            ["ASM-0014", "REF-ENG §5.3"]),
        );
      }

      if (movement.drive?.kind === "PRESCRIBED") {
        const nominal = HAND_PERIOD_SECONDS[reference.hand];
        const period = periodSeconds(refOmega);
        issues.push(
          issue("TIME-004", "drive-rate", "info", "L2_KINEMATIC", [reference.shaft.id],
            `At this prescribed drive the ${HAND_LABEL[reference.hand]} hand turns ${formatPeriod(refOmega)}, ${refOmega > 0 ? "clockwise" : "anticlockwise"} from the dial (${(nominal / period).toFixed(3)}× nominal). Use the nominal-time drive to run at time rate.`,
            ["ASM-0014"]),
        );
      }
    }
  }

  if (byHand.has("MINUTES")) {
    const setting = handSettingState(movement);
    if (setting.status === "UNAVAILABLE" && setting.reason !== "NO_MINUTES_HAND") {
      const minutes = single("MINUTES");
      issues.push(
        issue("SET-001", setting.reason, "warning", "L2_KINEMATIC", minutes === undefined ? [] : [minutes.id],
          setting.reason === "NO_ISOLATING_CLUTCH"
            ? "The hands cannot be set on their own: no friction clutch separates the minutes hand from the rest of the train."
            : "Setting the hands would turn the prescribed drive shaft: it is geared to the minutes hand without a slipping clutch in between.",
          ["REF-ENG §8", "ASM-0015"]),
      );
    }
  }
  return issues;
};
