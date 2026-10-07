import { toMillimetres, type Length } from "@/units/length";
import { radians, toDegrees, type Angle } from "@/units/angle";
import { radiansPerSecond, toRpm, type AngularVelocity } from "@/units/angularVelocity";
import type { Movement } from "@/domain/movement";
import type { EntityId } from "@/domain/ids";
import type { Shaft } from "@/domain/shaft";
import type { Gear } from "@/domain/gear";
import type { Jewel } from "@/domain/jewel";
import type { Frame } from "@/domain/frame";
import type { GearMesh } from "@/domain/gearMesh";
import type { KeylessWorks, StemPinion } from "@/domain/keyless";
import type { Dial } from "@/domain/dial";
import type { Escapement } from "@/domain/escapement";
import type { MoonPhase } from "@/domain/moonPhase";
import { windowsPerRevolution } from "@/domain/moonPhase";
import { impliedLunationDays, lunationDriftMinutes, SYNODIC_MONTH_DAYS } from "@/kinematics/moonPhase";
import type { DateComplication } from "@/domain/dateComplication";
import type { MonthComplication } from "@/domain/monthComplication";
import { GREGORIAN_MONTH_LENGTHS, MONTHS_PER_YEAR } from "@/kinematics/monthComplication";
import { LEAP_YEAR_SLOT_COUNT, type LeapYearComplication } from "@/domain/leapYearComplication";
import type { DialWindow } from "@/domain/dialWindow";
import { findDiscComplication } from "@/domain/discComplication";
import { genevaDriverMotionAngle, genevaLambda, genevaWheelAdvanceAngle, genevaWheelAngularVelocity } from "@/kinematics/genevaDrive";
import { toBeatsPerHour } from "@/units/frequency";
import { balanceFrequency, beatFrequency, beatsPerEscapeRevolution, impulseFraction } from "@/kinematics/escapement";
import { isochronismAdjustedRate, MIDDLE_TEMPERATURE_CELSIUS, temperatureAdjustedRate, USUAL_TEMPERATURE_RANGE_CELSIUS } from "@/kinematics/balance";
import { summarizeBalance } from "@/kinematics/balanceSummary";
import { summarizeEnergy } from "@/kinematics/energySummary";
import { crescentHalfAngle, dropClearance, forkActingLength, forkRatio, guardPointClearance, hornClearance, impulseAngle, isHalfToothSpan, spanAngle, suggestedRubyPinWidth, tangentialCentreDistance, toothDrawAngle, toothWidthAngle, wheelAngleBudgetPerBeat } from "@/kinematics/palletGeometry";
import { distance } from "@/math/vec2";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import { toNewtonMillimetres } from "@/units/torque";
import { toMicrojoules } from "@/units/energy";
import { toMicronewtonMillimetresPerRadian, toMilligramSquareCentimetres } from "@/units/rotational";
import {
  clockPositionFromDial,
  crownSenseText,
  SETTING_UNAVAILABLE_TEXT,
  summarizeKeyless,
  WINDING_UNAVAILABLE_TEXT,
} from "@/kinematics/keylessSummary";
import { nominalOf, TOLERANCED_DIMENSION_LABELS, type Tolerance } from "@/domain/tolerance";
import { isValidModule, isValidToothCount, meshCentreDistance, meshSpeedRatio, pitchDiameter } from "@/math/gearMath";
import { frameZRange, gearZRange, isCompleteFrame, shaftSupport, type DerivedLength } from "@/assembly/assemblyGeometry";
import { COVERAGE_LABELS, endshakeStack, meshCentreDistanceStack, sideShakeStack, type StackResult } from "@/assembly/toleranceAnalysis";
import { formatPeriod } from "@/kinematics/timeDisplay";
import type { MovementAnalysis } from "@/analysis/analyzeMovement";
import type { ReferenceId, ValidationIssue, ValidationLevel } from "@/validation/validationIssue";

/**
 * Per-part engineering records built from the design model and its
 * analysis. Every derived value names its equation, model level and
 * references (reference/derived/DERIVED_VALUES.md), and displays values
 * rounded only here, at the output boundary.
 */

export interface ReportValue {
  label: string;
  /** Display text, rounded for reading. */
  text: string;
  /** The unrounded SI value, or null when not a single number or not known. */
  si: number | null;
  equation?: string;
  level: ValidationLevel;
  references: ReferenceId[];
}

export interface ToleranceRow {
  dimension: string;
  nominal: string;
  limits: string;
  distribution: string;
  source: string;
  scope: string;
}

export type ComponentKind = "Frame" | "Arbor" | "Gear" | "Bearing" | "Keyless works" | "Dial" | "Escapement" | "Moon phase" | "Date" | "Month" | "Leap year" | "Window";

export interface ComponentReport {
  id: EntityId;
  name: string;
  kind: ComponentKind;
  /** e.g. "Bridge", "Hole jewel", "Pivoted arbor". */
  description: string;
  parameters: ReportValue[];
  derived: ReportValue[];
  tolerances: ToleranceRow[];
  issues: ValidationIssue[];
}

// ---- formatting (display only) -----------------------------------------------

export function mmText(value: number, digits = 4): string {
  return Number.isFinite(value) ? `${toMillimetres(value as Length).toFixed(digits)} mm` : "not a finite number";
}

export function optionalMmText(value: Length | null): string {
  return value === null ? "unknown" : mmText(value);
}

function entered(label: string, text: string, si: number | null = null): ReportValue {
  return { label, text, si, level: "L1_GEOMETRIC", references: [] };
}

function lengthParam(label: string, value: Length | null): ReportValue {
  return entered(label, optionalMmText(value), value);
}

function derivedLength(label: string, value: DerivedLength, equation: string, references: ReferenceId[]): ReportValue {
  const text =
    value.status === "KNOWN" ? mmText(value.value) : value.status === "UNKNOWN" ? `unknown (needs ${value.missing.join(", ")})` : `invalid input (${value.reason})`;
  return { label, text, si: value.status === "KNOWN" ? value.value : null, equation, level: "L1_GEOMETRIC", references };
}

function stackValue(label: string, result: StackResult, references: ReferenceId[]): ReportValue | null {
  if (result.status !== "KNOWN" || result.stack.coverage === "NONE") return null;
  const { stack } = result;
  return {
    label,
    text: `${mmText(stack.min)} … ${mmText(stack.max)} (${COVERAGE_LABELS[stack.coverage]})`,
    si: stack.min,
    equation: "worst case: each input at its limit that minimises / maximises the result",
    level: "L1_GEOMETRIC",
    references: [...references, "REF-ENG §14", "ASM-0017"],
  };
}

export function angularVelocityValues(omega: AngularVelocity | undefined): ReportValue[] {
  if (omega === undefined) {
    return [{ label: "Angular velocity", text: "unpowered (not reached by the drive)", si: null, level: "L2_KINEMATIC", references: [] }];
  }
  return [
    {
      label: "Angular velocity",
      text: `${toRpm(omega).toFixed(6)} rev/min`,
      si: omega,
      equation: "ω2 = ω1 × (−z1 / z2), stage by stage from the drive",
      level: "L2_KINEMATIC",
      references: ["REF-ENG §5.3", "ASM-0001", "ASM-0007"],
    },
    {
      label: "Period",
      text: formatPeriod(omega),
      si: omega === 0 ? null : (2 * Math.PI) / Math.abs(omega),
      equation: "T = 2π / |ω|",
      level: "L2_KINEMATIC",
      references: [],
    },
    {
      label: "Direction seen from the dial",
      text: omega === 0 ? "stationary" : omega > 0 ? "clockwise" : "counter-clockwise",
      si: null,
      level: "L2_KINEMATIC",
      references: ["ASM-0014"],
    },
  ];
}

function toleranceRows(movement: Movement, entityId: EntityId): ToleranceRow[] {
  return Object.values(movement.tolerances)
    .filter((t) => t.entityId === entityId)
    .map((t: Tolerance) => {
      const nominal = nominalOf(movement, t.entityId, t.dimension);
      const known = nominal !== null && nominal !== undefined;
      return {
        dimension: TOLERANCED_DIMENSION_LABELS[t.dimension],
        nominal: known ? mmText(nominal) : "unknown",
        limits: known ? `${mmText(nominal + t.lowerDeviation)} … ${mmText(nominal + t.upperDeviation)}` : "—",
        distribution: t.distribution === "NOT_STATED" ? "not stated" : t.distribution.toLowerCase(),
        source: t.source ?? "none given",
        scope: t.validationScope.trim() === "" ? "not stated" : t.validationScope,
      };
    });
}

function issuesFor(analysis: MovementAnalysis, id: EntityId): ValidationIssue[] {
  return analysis.issues.filter((i) => i.entityIds.includes(id));
}

// ---- per kind ----------------------------------------------------------------

function frameReport(movement: Movement, analysis: MovementAnalysis, frame: Frame): ComponentReport {
  const outline = frame.outline;
  const range = frameZRange(frame);
  return {
    id: frame.id,
    name: frame.name,
    kind: "Frame",
    description: frame.kind === "MAINPLATE" ? "Mainplate" : "Bridge",
    parameters: [
      entered("Outline", outline.kind === "CIRCLE"
        ? `circle, Ø ${mmText(outline.radius * 2, 3)} at (${mmText(outline.centre.x, 3)}, ${mmText(outline.centre.y, 3)})`
        : `polygon, ${String(outline.points.length)} points`),
      lengthParam("Underside height", frame.zBottom),
      lengthParam("Thickness", frame.thickness),
    ],
    derived: [
      {
        label: "Top height",
        text: isCompleteFrame(frame) ? mmText(range.hi) : "needs complete frame dimensions",
        si: isCompleteFrame(frame) ? range.hi : null,
        equation: "underside + thickness",
        level: "L1_GEOMETRIC",
        references: ["ASM-0010"],
      },
    ],
    tolerances: toleranceRows(movement, frame.id),
    issues: issuesFor(analysis, frame.id),
  };
}

const SUPPORT_LABEL: Record<Shaft["support"]["kind"], string> = {
  PIVOTED: "Pivoted arbor",
  STUD: "Turns on a stud",
  CARRIED: "Carried on another arbor",
};

function placementText(movement: Movement, shaft: Shaft): string {
  const p = shaft.placement;
  switch (p.kind) {
    case "FIXED":
      return `fixed at (${mmText(p.position.x, 3)}, ${mmText(p.position.y, 3)})`;
    case "MESH_POLAR": {
      const ref = movement.shafts[p.referenceShaftId]?.name ?? "missing arbor";
      return `at the ideal centre distance from ${ref}, ${toDegrees(p.angle).toFixed(3)}° from +X`;
    }
    case "COAXIAL":
      return `coaxial with ${movement.shafts[p.referenceShaftId]?.name ?? "missing arbor"}`;
  }
}

function shaftReport(movement: Movement, analysis: MovementAnalysis, shaft: Shaft): ComponentReport {
  const axis = analysis.placement.shaftPositions.get(shaft.id);
  const parameters: ReportValue[] = [
    entered("Placement", placementText(movement, shaft)),
    entered("Support", shaft.support.kind === "STUD"
      ? `stud in ${movement.frames[shaft.support.frameId]?.name ?? "missing frame"}`
      : SUPPORT_LABEL[shaft.support.kind]),
    entered("Hand", shaft.hand === null ? "none" : shaft.hand.toLowerCase()),
  ];
  const axisValue: ReportValue = {
    label: "Axis position",
    text: axis === undefined ? "unresolved" : `(${mmText(axis.x)}, ${mmText(axis.y)})`,
    si: null,
    level: "L1_GEOMETRIC",
    references: shaft.placement.kind === "MESH_POLAR" ? ["REF-ENG §5.2", "ASM-0006"] : ["ASM-0006"],
  };
  if (shaft.placement.kind === "MESH_POLAR") axisValue.equation = "reference axis + a (cos θ, sin θ), a = m (z1 + z2) / 2";
  const derived: ReportValue[] = [axisValue, ...angularVelocityValues(analysis.train.shaftAngularVelocity.get(shaft.id))];

  if (shaft.support.kind === "PIVOTED") {
    parameters.push(
      lengthParam("Lower pivot Ø", shaft.pivotDiameter.LOWER),
      lengthParam("Upper pivot Ø", shaft.pivotDiameter.UPPER),
      lengthParam("Shoulder span", shaft.shoulderSpan),
    );
    if (Object.keys(movement.frames).length > 0) {
      const support = shaftSupport(movement, shaft.id);
      const lower = sideShakeStack(movement, shaft, "LOWER", support.lower);
      const upper = sideShakeStack(movement, shaft, "UPPER", support.upper);
      const end = endshakeStack(movement, shaft, support);
      const nominal = (r: StackResult): DerivedLength =>
        r.status === "KNOWN" ? { status: "KNOWN", value: r.stack.nominal } : r;
      derived.push(
        derivedLength("Side shake, lower", nominal(lower), "bore − pivot Ø (diametral)", ["REF-ENG §12", "ASM-0013"]),
        derivedLength("Side shake, upper", nominal(upper), "bore − pivot Ø (diametral)", ["REF-ENG §12", "ASM-0013"]),
        derivedLength("Endshake", nominal(end), "upper frame underside − lower frame top − shoulder span", ["REF-ENG §12", "ASM-0011"]),
      );
      for (const extra of [
        stackValue("Side shake, lower (tolerances)", lower, ["ASM-0013"]),
        stackValue("Side shake, upper (tolerances)", upper, ["ASM-0013"]),
        stackValue("Endshake (tolerances)", end, ["ASM-0011"]),
      ]) {
        if (extra !== null) derived.push(extra);
      }
    }
  }
  return {
    id: shaft.id,
    name: shaft.name,
    kind: "Arbor",
    description: SUPPORT_LABEL[shaft.support.kind],
    parameters,
    derived,
    tolerances: toleranceRows(movement, shaft.id),
    issues: issuesFor(analysis, shaft.id),
  };
}

function gearReport(movement: Movement, analysis: MovementAnalysis, gear: Gear): ComponentReport {
  const defined = isValidToothCount(gear.toothCount) && isValidModule(gear.module);
  const range = gearZRange(gear);
  const d = defined ? pitchDiameter(gear.module, gear.toothCount) : null;
  return {
    id: gear.id,
    name: gear.name,
    kind: "Gear",
    description: `on ${movement.shafts[gear.shaftId]?.name ?? "missing arbor"}`,
    parameters: [
      entered("Tooth count", Number.isFinite(gear.toothCount) ? String(gear.toothCount) : "not set", gear.toothCount),
      lengthParam("Module", gear.module),
      lengthParam("Thickness", gear.thickness),
      lengthParam("Mid-plane height", gear.zCentre),
      entered("Profile model", gear.profileModel === "PITCH_MODEL" ? "pitch model (no tooth flank)" : gear.profileModel),
      entered("Pressure angle", gear.pressureAngle === null ? "not modeled" : `${toDegrees(gear.pressureAngle).toFixed(3)}°`),
    ],
    derived: [
      {
        label: "Pitch diameter",
        text: d === null ? "needs a valid tooth count and module" : mmText(d),
        si: d,
        equation: "d = m z",
        level: "L1_GEOMETRIC",
        references: ["REF-ENG §5.1"],
      },
      {
        label: "Axial extent",
        text: Number.isFinite(range.lo) && Number.isFinite(range.hi) ? `${mmText(range.lo)} … ${mmText(range.hi)}` : "not defined",
        si: null,
        equation: "mid-plane ± thickness / 2",
        level: "L1_GEOMETRIC",
        references: [],
      },
      ...angularVelocityValues(analysis.train.shaftAngularVelocity.get(gear.shaftId)),
    ],
    tolerances: toleranceRows(movement, gear.id),
    issues: issuesFor(analysis, gear.id),
  };
}

function jewelReport(movement: Movement, analysis: MovementAnalysis, jewel: Jewel): ComponentReport {
  const shaft = movement.shafts[jewel.shaftId];
  const shake = shaft === undefined ? null : sideShakeStack(movement, shaft, jewel.end, jewel);
  const derived: ReportValue[] = [];
  if (shake !== null) {
    derived.push(derivedLength("Side shake", shake.status === "KNOWN" ? { status: "KNOWN", value: shake.stack.nominal } : shake,
      "bore − pivot Ø (diametral)", ["REF-ENG §12", "ASM-0013"]));
    const tol = stackValue("Side shake (tolerances)", shake, ["ASM-0013"]);
    if (tol !== null) derived.push(tol);
  }
  return {
    id: jewel.id,
    name: jewel.name,
    kind: "Bearing",
    description: jewel.kind === "HOLE_JEWEL" ? "Hole jewel" : "Plain hole",
    parameters: [
      entered("Supports", `${shaft?.name ?? "missing arbor"}, ${jewel.end.toLowerCase()} end`),
      entered("In frame", movement.frames[jewel.frameId]?.name ?? "missing frame"),
      lengthParam("Bore Ø", jewel.boreDiameter),
    ],
    derived,
    tolerances: toleranceRows(movement, jewel.id),
    issues: issuesFor(analysis, jewel.id),
  };
}

function pinionText(p: StemPinion): string {
  const defined = isValidToothCount(p.toothCount) && isValidModule(p.module);
  return `z = ${Number.isFinite(p.toothCount) ? String(p.toothCount) : "?"}, m = ${mmText(p.module)}, pitch Ø ${defined ? mmText(pitchDiameter(p.module, p.toothCount)) : "?"}`;
}

function keylessReport(movement: Movement, analysis: MovementAnalysis, keyless: KeylessWorks): ComponentReport {
  const summary = summarizeKeyless(movement, keyless, analysis.placement);
  const wheelName = (id: KeylessWorks["crownWheelGearId"]): string => movement.gears[id]?.name ?? "not chosen";
  const engagementValues = (label: string, e: typeof summary.winding): ReportValue[] =>
    e === null
      ? [{ label: `${label}: engagement`, text: "needs defined teeth, modules, heights and placed wheels", si: null, level: "L1_GEOMETRIC", references: ["ASM-0019"] }]
      : [
          { label: `${label}: wheel axis off the stem line`, text: mmText(e.planOffset), si: e.planOffset, equation: "perpendicular plan distance from the stem line", level: "L1_GEOMETRIC", references: ["ASM-0019"] },
          { label: `${label}: height error`, text: mmText(e.heightError), si: e.heightError, equation: "|stem height − wheel mid-plane| − pinion pitch radius", level: "L1_GEOMETRIC", references: ["ASM-0019"] },
        ];
  const derived: ReportValue[] = [
    {
      label: "Crown position",
      text: Number.isFinite(keyless.stemDirection) ? `${clockPositionFromDial(keyless.stemDirection).toFixed(2)} o'clock seen from the dial` : "—",
      si: null,
      level: "L1_GEOMETRIC",
      references: ["ASM-0014"],
    },
    ...engagementValues("Winding pinion", summary.winding),
    ...engagementValues("Sliding pinion", summary.setting),
    {
      label: "Winding direction",
      text: summary.windingSense === null
        ? `not derivable: ${summary.windingUnavailable === null ? "unknown" : WINDING_UNAVAILABLE_TEXT[summary.windingUnavailable]}`
        : `${crownSenseText(summary.windingSense)}; the other way the ratchet teeth slip`,
      si: null,
      equation: "the arbor must turn the way the drum runs",
      level: "L2_KINEMATIC",
      references: ["ASM-0018", "ASM-0019"],
    },
    {
      label: "Ratchet per crown revolution (winding)",
      text: summary.ratchetPerCrown === null ? "—" : `${summary.ratchetPerCrown.toFixed(6)} rev`,
      si: summary.ratchetPerCrown,
      equation: "right-angle stage z_pinion / z_crown wheel, then parallel stages",
      level: "L2_KINEMATIC",
      references: ["ASM-0019", "REF-ENG §5.3"],
    },
    {
      label: "Hands forward when the crown turns",
      text: summary.handsForwardSense === null
        ? `unavailable: ${summary.settingState.status === "UNAVAILABLE" ? SETTING_UNAVAILABLE_TEXT[summary.settingState.reason] : "—"}`
        : crownSenseText(summary.handsForwardSense),
      si: null,
      level: "L2_KINEMATIC",
      references: ["ASM-0015", "ASM-0019"],
    },
    {
      label: "Minutes hand per crown revolution (setting)",
      text: summary.minutesPerCrown === null ? "—" : `${summary.minutesPerCrown.toFixed(6)} rev`,
      si: summary.minutesPerCrown,
      equation: "right-angle stage z_sliding pinion / z_setting wheel, then parallel stages",
      level: "L2_KINEMATIC",
      references: ["ASM-0019", "REF-ENG §5.3", "REF-ENG §8"],
    },
  ];
  return {
    id: keyless.id,
    name: keyless.name,
    kind: "Keyless works",
    description: "crown, stem, winding and sliding pinions",
    parameters: [
      entered("Stem direction", Number.isFinite(keyless.stemDirection) ? `${toDegrees(keyless.stemDirection).toFixed(3)}° from +X` : "not set"),
      lengthParam("Stem axis height", keyless.stemHeight),
      entered("Winding pinion", pinionText(keyless.windingPinion)),
      entered("Sliding pinion (setting teeth)", pinionText(keyless.slidingPinion)),
      entered("Crown wheel", wheelName(keyless.crownWheelGearId)),
      entered("Setting wheel", wheelName(keyless.settingWheelGearId)),
      entered("Ratchet wheel (held by the click)", wheelName(keyless.ratchetGearId)),
      entered("Setting lever and yoke", "represented by the two stem positions only (ASM-0019)"),
    ],
    derived,
    tolerances: [],
    issues: issuesFor(analysis, keyless.id),
  };
}

function dialReport(movement: Movement, analysis: MovementAnalysis, dial: Dial): ComponentReport {
  const back = dial.faceHeight + dial.thickness;
  return {
    id: dial.id,
    name: dial.name,
    kind: "Dial",
    description: "flat disc on the dial side",
    parameters: [
      entered("Centred on", movement.shafts[dial.centreShaftId]?.name ?? "not chosen"),
      lengthParam("Diameter", dial.diameter),
      lengthParam("Thickness", dial.thickness),
      lengthParam("Face height", dial.faceHeight),
    ],
    derived: [
      { label: "Back height", text: Number.isFinite(back) ? mmText(back) : "—", si: Number.isFinite(back) ? back : null, equation: "face + thickness", level: "L1_GEOMETRIC", references: ["ASM-0020"] },
    ],
    tolerances: [],
    issues: issuesFor(analysis, dial.id),
  };
}

function moonPhaseReport(movement: Movement, analysis: MovementAnalysis, moon: MoonPhase): ComponentReport {
  const omega = analysis.train.shaftAngularVelocity.get(moon.shaftId);
  const windows = windowsPerRevolution(moon.windowCount);
  const impliedDays = omega === undefined ? null : impliedLunationDays(omega, windows);
  return {
    id: moon.id,
    name: moon.name,
    kind: "Moon phase",
    description: "continuous gear-train disc (no jumper/cam mechanism)",
    parameters: [
      entered("Mounted on", movement.shafts[moon.shaftId]?.name ?? "not chosen"),
      lengthParam("Diameter", moon.diameter),
      lengthParam("Thickness", moon.thickness),
      lengthParam("Face height", moon.faceHeight),
      entered("Moon images", moon.windowCount === "DOUBLE" ? "Double (two, 180° apart)" : "Single (one)"),
    ],
    derived: [
      ...angularVelocityValues(omega),
      {
        label: "Implied lunation",
        text: impliedDays === null ? "not driven" : `${impliedDays.toFixed(3)} days`,
        si: impliedDays,
        equation: "disc revolution period ÷ moon images per revolution",
        level: "L2_KINEMATIC",
        references: ["ASM-0047"],
      },
      {
        label: "Drift vs. the real synodic month",
        text: impliedDays === null ? "—" : `${(lunationDriftMinutes(impliedDays) >= 0 ? "+" : "")}${lunationDriftMinutes(impliedDays).toFixed(1)} min / lunation`,
        si: impliedDays === null ? null : lunationDriftMinutes(impliedDays),
        equation: `implied lunation − ${SYNODIC_MONTH_DAYS.toFixed(5)} days`,
        level: "L2_KINEMATIC",
        references: ["ASM-0047", "SRC-0046"],
      },
    ],
    tolerances: [],
    issues: issuesFor(analysis, moon.id),
  };
}

function dateComplicationReport(movement: Movement, analysis: MovementAnalysis, date: DateComplication): ComponentReport {
  const omega = analysis.train.shaftAngularVelocity.get(date.driveShaftId);
  const toothCountValid = Number.isInteger(date.starToothCount) && date.starToothCount > 0;
  return {
    id: date.id,
    name: date.name,
    kind: "Date",
    description: "jump mechanism (one step per drive revolution, no jumper/cam mechanism modeled)",
    parameters: [
      entered("Drive arbor", movement.shafts[date.driveShaftId]?.name ?? "not chosen"),
      entered("Star arbor", movement.shafts[date.starShaftId]?.name ?? "not chosen"),
      entered("Star tooth count", toothCountValid ? String(date.starToothCount) : "not set", toothCountValid ? date.starToothCount : null),
      lengthParam("Star tip diameter", date.starTipDiameter),
      lengthParam("Star thickness", date.starThickness),
      lengthParam("Star mid-plane height", date.starZCentre),
    ],
    derived: [
      {
        label: "Implied jump period",
        text: omega === undefined || omega === 0 ? "not driven" : formatPeriod(omega),
        si: omega === undefined || omega === 0 ? null : (2 * Math.PI) / Math.abs(omega),
        equation: "T = 2π / |ω_drive|, versus one day for a standard date mechanism",
        level: "L2_KINEMATIC",
        references: ["ASM-0048", "SRC-0042"],
      },
      {
        label: "Jump step",
        text: toothCountValid ? `${(360 / date.starToothCount).toFixed(2)}°` : "—",
        si: toothCountValid ? (2 * Math.PI) / date.starToothCount : null,
        equation: "2π / starToothCount",
        level: "L2_KINEMATIC",
        references: ["ASM-0048"],
      },
    ],
    tolerances: [],
    issues: issuesFor(analysis, date.id),
  };
}

function monthComplicationReport(movement: Movement, analysis: MovementAnalysis, month: MonthComplication): ComponentReport {
  const date = movement.dateComplications[month.dateComplicationId];
  const shortMonths = GREGORIAN_MONTH_LENGTHS.filter((days) => days < 31);
  return {
    id: month.id,
    name: month.name,
    kind: "Month",
    description: "driven entirely by the referenced date complication's own jumps, one step per month (no drive arbor of its own)",
    parameters: [
      entered("Date complication", date?.name ?? "not chosen"),
      entered("Star arbor", movement.shafts[month.starShaftId]?.name ?? "not chosen"),
      lengthParam("Star tip diameter", month.starTipDiameter),
      lengthParam("Star thickness", month.starThickness),
      lengthParam("Star mid-plane height", month.starZCentre),
    ],
    derived: [
      {
        label: "Jump step",
        text: `${(360 / MONTHS_PER_YEAR).toFixed(2)}°`,
        si: (2 * Math.PI) / MONTHS_PER_YEAR,
        equation: "2π / MONTHS_PER_YEAR",
        level: "L2_KINEMATIC",
        references: ["ASM-0049"],
      },
      {
        label: "Months needing a date-star correction",
        text: `${String(shortMonths.length)} of ${String(MONTHS_PER_YEAR)} (all but 31-day months)`,
        si: shortMonths.length,
        equation: "count of GREGORIAN_MONTH_LENGTHS < 31; February fixed at 28 days — a leap-year complication, where present (Phase 8.4), tracks the 4-year cycle as an indicator only and is not wired back into this count",
        level: "L2_KINEMATIC",
        references: ["ASM-0049"],
      },
    ],
    tolerances: [],
    issues: issuesFor(analysis, month.id),
  };
}

function leapYearComplicationReport(movement: Movement, analysis: MovementAnalysis, year: LeapYearComplication): ComponentReport {
  const month = movement.monthComplications[year.monthComplicationId];
  const n = LEAP_YEAR_SLOT_COUNT;
  const lambda = genevaLambda(n);
  const peakRatio = genevaWheelAngularVelocity(radiansPerSecond(1), radians(0), n);
  return {
    id: year.id,
    name: year.name,
    kind: "Leap year",
    description: "driven entirely by the referenced month complication's own December-to-January wrap, one step per calendar year (no drive arbor of its own)",
    parameters: [
      entered("Month complication", month?.name ?? "not chosen"),
      entered("Wheel arbor", movement.shafts[year.wheelShaftId]?.name ?? "not chosen"),
      lengthParam("Wheel tip diameter", year.wheelTipDiameter),
      lengthParam("Wheel thickness", year.wheelThickness),
      lengthParam("Wheel mid-plane height", year.wheelZCentre),
    ],
    derived: [
      {
        label: "Jump step",
        text: `${toDegrees(genevaWheelAdvanceAngle(n)).toFixed(0)}°`,
        si: genevaWheelAdvanceAngle(n),
        equation: `2π / ${String(n)} (LEAP_YEAR_SLOT_COUNT)`,
        level: "L2_KINEMATIC",
        references: ["ASM-0050"],
      },
      {
        label: "Reference Geneva driver motion sweep",
        text: `${toDegrees(genevaDriverMotionAngle(n)).toFixed(0)}° (of a real single-pin ${String(n)}-slot drive, not simulated)`,
        si: genevaDriverMotionAngle(n),
        equation: "π(n − 2) / n (SRC-0047)",
        level: "L2_KINEMATIC",
        references: ["ASM-0050", "SRC-0047"],
      },
      {
        label: "Reference no-shock pin-radius ratio λ",
        text: lambda.toFixed(4),
        si: lambda,
        equation: "sin(π / n) (SRC-0047)",
        level: "L2_KINEMATIC",
        references: ["ASM-0050", "SRC-0047"],
      },
      {
        label: "Reference peak wheel/driver speed ratio",
        text: peakRatio.toFixed(3),
        si: peakRatio,
        equation: "λ(cos α − λ) / (1 + λ² − 2λ cos α), at α = 0 (mid-stroke, SRC-0047)",
        level: "L2_KINEMATIC",
        references: ["ASM-0050", "SRC-0047"],
      },
    ],
    tolerances: [],
    issues: issuesFor(analysis, year.id),
  };
}

function dialWindowReport(movement: Movement, analysis: MovementAnalysis, win: DialWindow): ComponentReport {
  const dial = movement.dials[win.dialId];
  const complication = findDiscComplication(movement, win.complicationId);
  const discCentre = complication === undefined ? undefined : analysis.placement.shaftPositions.get(complication.shaftId);
  const gap = discCentre === undefined || complication === undefined
    ? null
    : (win.radius + complication.discRadius - distance(win.centre, discCentre)) as Length;
  return {
    id: win.id,
    name: win.name,
    kind: "Window",
    description: "a circular cutout in the dial, through which a disc complication becomes visible (no kinematic effect of its own)",
    parameters: [
      entered("Dial", dial?.name ?? "not chosen"),
      entered("Shows", complication?.name ?? "not chosen"),
      lengthParam("Centre X", win.centre.x),
      lengthParam("Centre Y", win.centre.y),
      lengthParam("Radius", win.radius),
    ],
    derived: [
      {
        label: "Overlap with the complication's own disc",
        text: gap === null ? "not resolved" : gap > 0 ? `${(toMillimetres(gap)).toFixed(2)} mm radial margin` : "does not overlap (DIALWIN-002)",
        si: gap,
        equation: "window radius + disc radius − centre distance",
        level: "L1_GEOMETRIC",
        references: ["ASM-0051"],
      },
    ],
    tolerances: [],
    issues: issuesFor(analysis, win.id),
  };
}

function escapementReport(movement: Movement, analysis: MovementAnalysis, esc: Escapement): ComponentReport {
  const w = esc.escapeWheel;
  const b = esc.balance;
  const shaftName = (id: Escapement["escapeArborShaftId"]): string => movement.shafts[id]?.name ?? "not chosen";
  const omega = analysis.train.shaftAngularVelocity.get(esc.escapeArborShaftId);
  const teethValid = isValidToothCount(w.toothCount);
  const beats = omega !== undefined && omega !== 0 && teethValid ? beatFrequency(omega, w.toothCount) : null;
  const fraction = impulseFraction(b.amplitude, b.liftAngle);
  const dyn = summarizeBalance(movement, esc);
  const angleText = (a: Angle): string => (Number.isFinite(a) ? `${toDegrees(a).toFixed(1)}°` : "not set");
  const pg = esc.pallets;
  const span = pg !== null && teethValid && isHalfToothSpan(pg.spanTeeth) ? spanAngle(w.toothCount, pg.spanTeeth) : null;
  const needed = span === null ? null : tangentialCentreDistance((w.tipDiameter / 2) as Length, span);
  const impulse = pg === null ? null : impulseAngle(esc.leverAngle, pg.lockAngle, pg.runAngle);
  const ratio = forkRatio(b.liftAngle, esc.leverAngle);
  const forkLength = b.impulseRadius !== null ? forkActingLength(b.impulseRadius, ratio) : null;
  const palletParameters: ReportValue[] = pg === null
    ? [entered("Pallet geometry", "not specified (locking not checked)")]
    : [
        entered("Pallet span", Number.isFinite(pg.spanTeeth) ? `${String(pg.spanTeeth)} teeth` : "not set", pg.spanTeeth),
        entered("Pallet type", pg.kind === "EQUIDISTANT" ? "Equidistant" : "Circular"),
        entered("Lock angle", angleText(pg.lockAngle), pg.lockAngle),
        entered("Draw angle", angleText(pg.drawAngle), pg.drawAngle),
        entered("Run angle", angleText(pg.runAngle), pg.runAngle),
        entered("Drop angle (wheel-side)", angleText(pg.dropAngle), pg.dropAngle),
        entered("Pallet width (wheel-side)", angleText(pg.widthAngle), pg.widthAngle),
        entered("Ruby-pin entry freedom", pg.rubyPinEntryFreedom === null ? "unknown" : angleText(pg.rubyPinEntryFreedom), pg.rubyPinEntryFreedom),
        entered("Ruby-pin slot shake", pg.rubyPinSlotShake === null ? "unknown" : angleText(pg.rubyPinSlotShake), pg.rubyPinSlotShake),
        entered("Guard-point freedom", pg.guardPointFreedom === null ? "unknown" : angleText(pg.guardPointFreedom), pg.guardPointFreedom),
        entered("Guard-point radius", optionalMmText(pg.guardPointRadius), pg.guardPointRadius),
        entered("Horn freedom", pg.hornFreedom === null ? "unknown" : angleText(pg.hornFreedom), pg.hornFreedom),
      ];
  const budget = teethValid ? wheelAngleBudgetPerBeat(w.toothCount) : null;
  const tooth = pg !== null && teethValid ? toothWidthAngle(w.toothCount, pg.widthAngle, pg.dropAngle) : null;
  const dropValid = pg !== null && budget !== null && Number.isFinite(pg.dropAngle) && pg.dropAngle > 0 && pg.dropAngle < budget;
  const widthValid = pg !== null && Number.isFinite(pg.widthAngle) && pg.widthAngle > 0;
  const toothValid = tooth !== null && (w.toothKind === "RATCHET" ? tooth >= -NUMERICAL_PARAMETERS.angleZeroToleranceRadians : tooth > 0);
  const partitionValid = dropValid && widthValid && toothValid;
  const clearance = pg !== null && partitionValid ? dropClearance((w.tipDiameter / 2) as Length, pg.dropAngle) : null;
  const toothDraw = pg !== null && Number.isFinite(pg.drawAngle) && pg.drawAngle > 0 ? toothDrawAngle(pg.drawAngle) : null;
  const suggestedWidth = pg !== null && Number.isFinite(esc.leverAngle) && esc.leverAngle > 0 ? suggestedRubyPinWidth(esc.leverAngle) : null;
  const guardClearance = pg !== null && pg.guardPointFreedom !== null && pg.guardPointFreedom > 0 && pg.guardPointRadius !== null
    ? guardPointClearance(pg.guardPointRadius, pg.guardPointFreedom) : null;
  const at = { pallet: analysis.placement.shaftPositions.get(esc.palletArborShaftId), balance: analysis.placement.shaftPositions.get(esc.balanceShaftId) };
  const centreDistance = at.pallet !== undefined && at.balance !== undefined ? distance(at.pallet, at.balance) : null;
  const crescentHalf = pg !== null && b.rollerKind === "SINGLE" && b.rollerRadius !== null && b.rollerRadius > 0
    && b.impulseRadius !== null && b.impulseRadius > 0 && pg.guardPointFreedom !== null && pg.guardPointFreedom > 0
    && centreDistance !== null && forkLength !== null
    ? crescentHalfAngle(centreDistance, esc.leverAngle, pg.guardPointFreedom, forkLength, b.impulseRadius, b.rollerRadius) : null;
  const hornClearanceValue = pg !== null && pg.hornFreedom !== null && pg.hornFreedom > 0 && forkLength !== null
    ? hornClearance(forkLength, pg.hornFreedom) : null;
  const palletDerived: ReportValue[] = pg === null ? [] : [
    { label: "Pallet span angle", text: span === null ? "—" : `${toDegrees(span).toFixed(2)}°`, si: span, equation: "span × 2π / z", level: "L1_GEOMETRIC", references: ["ASM-0025"] },
    { label: "Pallet arbor distance for tangential locking", text: needed === null ? "—" : mmText(needed), si: needed, equation: "R_tip / cos(span angle / 2)", level: "L1_GEOMETRIC", references: ["ASM-0025"] },
    { label: "Lever impulse angle", text: impulse === null || !Number.isFinite(impulse) ? "—" : `${toDegrees(impulse).toFixed(2)}°`, si: impulse !== null && Number.isFinite(impulse) ? impulse : null, equation: "lever − lock − run", level: "L1_GEOMETRIC", references: ["ASM-0025"] },
    { label: "Fork ratio", text: ratio === null ? "—" : ratio.toFixed(3), si: ratio, equation: "lift angle / lever angle", level: "L1_GEOMETRIC", references: ["ASM-0025"] },
    { label: "Fork acting length (derived)", text: forkLength === null ? "—" : mmText(forkLength), si: forkLength, equation: "impulse radius × fork ratio", level: "L1_GEOMETRIC", references: ["ASM-0041"] },
    { label: "Suggested ruby-pin width (derived)", text: suggestedWidth === null ? "—" : `${toDegrees(suggestedWidth).toFixed(2)}°`, si: suggestedWidth, equation: "lever angle / 2", level: "L1_GEOMETRIC", references: ["ASM-0042"] },
    { label: "Escape-tooth locking face (derived)", text: toothDraw === null ? "—" : `${toDegrees(toothDraw).toFixed(2)}°`, si: toothDraw, equation: "2 × draw", level: "L1_GEOMETRIC", references: ["ASM-0039"] },
    { label: "Wheel-angle budget per beat", text: budget === null ? "—" : `${toDegrees(budget).toFixed(2)}°`, si: budget, equation: "π / escapeTeeth", level: "L1_GEOMETRIC", references: ["ASM-0021", "ASM-0036"] },
    { label: "Escape-tooth width (derived)", text: tooth === null ? "—" : `${toDegrees(tooth).toFixed(2)}°`, si: tooth, equation: "budget − pallet width − drop", level: "L1_GEOMETRIC", references: ["ASM-0037"] },
    { label: "Drop clearance at tip circle", text: clearance === null ? "—" : mmText(clearance), si: clearance, equation: "tip radius × drop angle", level: "L1_GEOMETRIC", references: ["ASM-0036"] },
    { label: "Guard-point clearance (derived)", text: guardClearance === null ? "—" : mmText(guardClearance), si: guardClearance, equation: "guard-point radius × guard-point freedom", level: "L1_GEOMETRIC", references: ["ASM-0043"] },
    { label: "Crescent opening, single roller (derived)", text: crescentHalf === null ? "—" : `${(toDegrees(crescentHalf) * 2).toFixed(2)}°`, si: crescentHalf === null ? null : radians(crescentHalf * 2), equation: "2 × |guard-point direction − ruby-pin direction| at the balance centre", level: "L1_GEOMETRIC", references: ["ASM-0044"] },
    { label: "Horn clearance (derived)", text: hornClearanceValue === null ? "—" : mmText(hornClearanceValue), si: hornClearanceValue, equation: "fork acting length × horn freedom", level: "L1_GEOMETRIC", references: ["ASM-0045"] },
  ];
  const energy = summarizeEnergy(movement, analysis.train);
  const en = energy?.escapement?.id === esc.id ? energy : null;
  const spec = en?.spec ?? null;
  const hoursText = (sec: number | null): string => (sec === null ? "—" : `${(sec / 3600).toFixed(2)} h`);
  const energyParameters: ReportValue[] = [
    entered("Escapement efficiency", esc.escapementEfficiency === null ? "unknown" : esc.escapementEfficiency.toFixed(3), esc.escapementEfficiency),
    entered("Balance quality factor Q", b.qualityFactor === null ? "unknown" : b.qualityFactor.toFixed(1), b.qualityFactor),
    ...(en === null ? [] : [
      entered("Mainspring", spec === null
        ? `${en.spring.name}: data unknown`
        : `${en.spring.name}: ${String(spec.usableTurns)} turns, ${toNewtonMillimetres(spec.fullyWoundTorque).toFixed(3)} → ${toNewtonMillimetres(spec.letDownTorque).toFixed(3)} N·mm, train efficiency ${spec.trainEfficiency === null ? "not configured" : spec.trainEfficiency.toFixed(3)}`),
    ]),
  ];
  const L3 = "L3_SIMPLIFIED_DYNAMIC" as const;
  const energyDerived: ReportValue[] = en === null ? [] : [
    { label: "Power reserve", text: hoursText(en.reserveSeconds), si: en.reserveSeconds, equation: "usable turns / (|ω_drum| / 2π)", level: "L2_KINEMATIC", references: ["ASM-0026", "REF-ENG §11"] },
    { label: "Escape wheel torque, fully wound", text: en.escapeTorqueFull === null ? "—" : `${(toNewtonMillimetres(en.escapeTorqueFull) * 1000).toFixed(4)} µN·m${en.lossless ? " (lossless upper bound)" : ""}`, si: en.escapeTorqueFull, equation: "T_drum |ω_drum / ω_escape| η_train", level: L3, references: ["ASM-0026", "ASM-0002"] },
    { label: "Escape wheel torque, let down", text: en.escapeTorqueLetDown === null ? "—" : `${(toNewtonMillimetres(en.escapeTorqueLetDown) * 1000).toFixed(4)} µN·m${en.lossless ? " (lossless upper bound)" : ""}`, si: en.escapeTorqueLetDown, equation: "T_drum |ω_drum / ω_escape| η_train", level: L3, references: ["ASM-0026", "ASM-0002"] },
    { label: "Energy per beat to the balance, fully wound", text: en.deliveredPerBeatFull === null ? "—" : `${toMicrojoules(en.deliveredPerBeatFull).toFixed(5)} µJ`, si: en.deliveredPerBeatFull, equation: "T_escape × π / z × η_escapement", level: L3, references: ["ASM-0026", "ASM-0021"] },
    { label: "Predicted amplitude, fully wound → let down", text: en.amplitudeFull === null || en.amplitudeLetDown === null ? `needs ${en.missingForAmplitude.join(", ")}` : `${toDegrees(en.amplitudeFull).toFixed(1)}° → ${toDegrees(en.amplitudeLetDown).toFixed(1)}°`, si: en.amplitudeFull, equation: "A = √(2 Q E_beat / (π k))", level: L3, references: ["ASM-0026", "ASM-0024"] },
    { label: "Running reserve (until the balance cannot unlock)", text: hoursText(en.runningReserveSeconds), si: en.runningReserveSeconds, equation: "reserve × (turns − stop wind) / turns, stop where A = lift / 2", level: L3, references: ["ASM-0026"] },
  ];
  return {
    id: esc.id,
    name: esc.name,
    kind: "Escapement",
    description: "SIMPLIFIED ESCAPEMENT MODEL (Swiss lever, kinematic)",
    parameters: [
      entered("Escape arbor", shaftName(esc.escapeArborShaftId)),
      entered("Escape wheel teeth", Number.isFinite(w.toothCount) ? String(w.toothCount) : "not set", w.toothCount),
      entered("Escape tooth kind", w.toothKind === "RATCHET" ? "Ratchet (English)" : "Club"),
      lengthParam("Escape wheel tip Ø", w.tipDiameter),
      lengthParam("Escape wheel thickness", w.thickness),
      lengthParam("Escape wheel mid-plane", w.zCentre),
      entered("Pallet arbor", shaftName(esc.palletArborShaftId)),
      entered("Lever angle", angleText(esc.leverAngle), esc.leverAngle),
      entered("Balance staff", shaftName(esc.balanceShaftId)),
      lengthParam("Balance Ø", b.diameter),
      lengthParam("Balance thickness", b.thickness),
      lengthParam("Balance mid-plane", b.zCentre),
      entered("Balance amplitude (declared)", angleText(b.amplitude), b.amplitude),
      entered("Lift angle", angleText(b.liftAngle), b.liftAngle),
      entered("Balance inertia", b.inertia === null ? "unknown" : `${toMilligramSquareCentimetres(b.inertia).toFixed(3)} mg·cm²`, b.inertia),
      entered("Hairspring stiffness", b.hairspringStiffness === null ? "unknown" : `${toMicronewtonMillimetresPerRadian(b.hairspringStiffness).toFixed(3)} µN·mm/rad`, b.hairspringStiffness),
      entered("Isochronism coefficient", b.isochronismCoefficient === null ? "unmodeled" : `${(b.isochronismCoefficient * (Math.PI / 180)).toFixed(3)} s/day per °`, b.isochronismCoefficient),
      entered("Temperature coefficient", b.temperatureCoefficient === null ? "unmodeled" : `${b.temperatureCoefficient.toFixed(3)} s/day per °C`, b.temperatureCoefficient),
      entered("Impulse radius", optionalMmText(b.impulseRadius), b.impulseRadius),
      entered("Roller kind", b.rollerKind === "SINGLE" ? "Single" : "Double"),
      entered("Roller radius", optionalMmText(b.rollerRadius), b.rollerRadius),
      ...palletParameters,
      ...energyParameters,
    ],
    derived: [
      { label: "Beats per escape revolution", text: teethValid ? String(beatsPerEscapeRevolution(w.toothCount)) : "—", si: teethValid ? beatsPerEscapeRevolution(w.toothCount) : null, equation: "2 z", level: "L2_KINEMATIC", references: ["ASM-0021"] },
      { label: "Beat rate", text: beats === null ? "not derived (escape arbor not driven)" : `${toBeatsPerHour(beats).toFixed(0)} beats/h`, si: beats, equation: "|ω| / 2π × 2 z", level: "L2_KINEMATIC", references: ["ASM-0021", "REF-ENG §9"] },
      { label: "Required balance frequency", text: beats === null ? "—" : `${balanceFrequency(beats).toFixed(4)} Hz`, si: beats === null ? null : balanceFrequency(beats), equation: "beat rate / 2", level: "L2_KINEMATIC", references: ["ASM-0021", "ASM-0022"] },
      { label: "Impulse window", text: fraction === null ? "—" : `${(fraction * 100).toFixed(2)} % of each beat`, si: fraction, equation: "(2/π) asin(lift / 2 amplitude)", level: "L2_KINEMATIC", references: ["ASM-0022", "ASM-0023"] },
      { label: "Free balance frequency", text: dyn.freeFrequency === null ? "needs inertia and stiffness" : `${dyn.freeFrequency.toFixed(4)} Hz`, si: dyn.freeFrequency, equation: "f = √(k / I) / 2π", level: "L3_SIMPLIFIED_DYNAMIC", references: ["ASM-0024", "REF-ENG §10"] },
      { label: "Balance frequency for nominal time", text: dyn.nominalFrequency === null ? "—" : `${dyn.nominalFrequency.toFixed(4)} Hz`, si: dyn.nominalFrequency, equation: "from the escape arbor's speed at nominal time", level: "L2_KINEMATIC", references: ["ASM-0021"] },
      { label: "Hairspring stiffness for nominal time", text: dyn.stiffnessForNominal === null ? "—" : `${toMicronewtonMillimetresPerRadian(dyn.stiffnessForNominal).toFixed(3)} µN·mm/rad`, si: dyn.stiffnessForNominal, equation: "k = I (2π f)²", level: "L3_SIMPLIFIED_DYNAMIC", references: ["ASM-0024"] },
      { label: movement.drive?.kind === "BALANCE" ? "Predicted daily rate (balance governs)" : "Daily rate if the balance governed", text: dyn.dailyRate === null ? "—" : `${dyn.dailyRate >= 0 ? "+" : ""}${dyn.dailyRate.toFixed(2)} s/day`, si: dyn.dailyRate, equation: "(f / f_nominal − 1) × 86 400", level: "L3_SIMPLIFIED_DYNAMIC", references: ["ASM-0024"] },
      ...(b.isochronismCoefficient === null || dyn.dailyRate === null || en?.amplitudeFull == null || en.amplitudeLetDown === null ? [] : [{
        label: "Isochronism-adjusted rate, fully wound → let down",
        text: [
          isochronismAdjustedRate(dyn.dailyRate, b.isochronismCoefficient, en.amplitudeFull, b.amplitude),
          isochronismAdjustedRate(dyn.dailyRate, b.isochronismCoefficient, en.amplitudeLetDown, b.amplitude),
        ].map((v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} s/day`).join(" → "),
        si: isochronismAdjustedRate(dyn.dailyRate, b.isochronismCoefficient, en.amplitudeFull, b.amplitude),
        equation: "dailyRate + c·(amplitude − declared amplitude)",
        level: "L3_SIMPLIFIED_DYNAMIC" as const,
        references: ["ASM-0034" as const],
      }]),
      ...(b.temperatureCoefficient === null || dyn.dailyRate === null ? [] : [{
        label: `Temperature-adjusted rate, ${String(USUAL_TEMPERATURE_RANGE_CELSIUS.low)}°C → ${String(USUAL_TEMPERATURE_RANGE_CELSIUS.high)}°C`,
        text: [
          temperatureAdjustedRate(dyn.dailyRate, b.temperatureCoefficient, USUAL_TEMPERATURE_RANGE_CELSIUS.low),
          temperatureAdjustedRate(dyn.dailyRate, b.temperatureCoefficient, USUAL_TEMPERATURE_RANGE_CELSIUS.high),
        ].map((v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} s/day`).join(" → "),
        si: temperatureAdjustedRate(dyn.dailyRate, b.temperatureCoefficient, USUAL_TEMPERATURE_RANGE_CELSIUS.low),
        equation: `dailyRate + c·(temperature − ${String(MIDDLE_TEMPERATURE_CELSIUS)}°C)`,
        level: "L3_SIMPLIFIED_DYNAMIC" as const,
        references: ["ASM-0046" as const],
      }]),
      ...palletDerived,
      ...energyDerived,
      { label: "Rate accuracy", text: "not modeled; requires physical validation", si: null, level: "L2_KINEMATIC", references: ["REF-ENG §9", "REF-ENG §10"] },
    ],
    tolerances: [],
    issues: issuesFor(analysis, esc.id),
  };
}

const byName = <T extends { name: string }>(a: T, b: T): number => a.name.localeCompare(b.name);

/** Reports for every part, grouped frames → arbors → gears → bearings → keyless works → dial, each sorted by name. */
export function componentReports(movement: Movement, analysis: MovementAnalysis): ComponentReport[] {
  return [
    ...Object.values(movement.frames).sort(byName).map((f) => frameReport(movement, analysis, f)),
    ...Object.values(movement.shafts).sort(byName).map((s) => shaftReport(movement, analysis, s)),
    ...Object.values(movement.gears).sort(byName).map((g) => gearReport(movement, analysis, g)),
    ...Object.values(movement.jewels).sort(byName).map((j) => jewelReport(movement, analysis, j)),
    ...Object.values(movement.keylessWorks).sort(byName).map((k) => keylessReport(movement, analysis, k)),
    ...Object.values(movement.dials).sort(byName).map((d) => dialReport(movement, analysis, d)),
    ...Object.values(movement.escapements).sort(byName).map((e) => escapementReport(movement, analysis, e)),
    ...Object.values(movement.moonPhases).sort(byName).map((m) => moonPhaseReport(movement, analysis, m)),
    ...Object.values(movement.dateComplications).sort(byName).map((d) => dateComplicationReport(movement, analysis, d)),
    ...Object.values(movement.monthComplications).sort(byName).map((m) => monthComplicationReport(movement, analysis, m)),
    ...Object.values(movement.leapYearComplications).sort(byName).map((y) => leapYearComplicationReport(movement, analysis, y)),
    ...Object.values(movement.dialWindows).sort(byName).map((w) => dialWindowReport(movement, analysis, w)),
  ];
}

// ---- gear train --------------------------------------------------------------

export interface MeshReport {
  id: string;
  driving: string;
  driven: string;
  z1: number;
  z2: number;
  module: string;
  /** −z1/z2, or null when the gears are not defined or their modules differ. */
  ratio: number | null;
  idealCentreDistance: number | null;
  actualCentreDistance: number | null;
  /** Worst case over declared tolerances (module, a FIXED shaft's own position, ASM-0027); null when nothing is toleranced. */
  centreDistanceTolerance: string | null;
}

export function meshReports(movement: Movement, analysis: MovementAnalysis): MeshReport[] {
  return Object.values(movement.gearMeshes).map((mesh: GearMesh) => {
    const a = movement.gears[mesh.drivingGearId];
    const b = movement.gears[mesh.drivenGearId];
    const defined =
      a !== undefined && b !== undefined &&
      isValidToothCount(a.toothCount) && isValidToothCount(b.toothCount) &&
      isValidModule(a.module) && a.module === b.module;
    const pa = a === undefined ? undefined : analysis.placement.shaftPositions.get(a.shaftId);
    const pb = b === undefined ? undefined : analysis.placement.shaftPositions.get(b.shaftId);
    const stack = meshCentreDistanceStack(movement, mesh, analysis.placement);
    return {
      id: mesh.id,
      driving: a?.name ?? "missing gear",
      driven: b?.name ?? "missing gear",
      z1: a?.toothCount ?? Number.NaN,
      z2: b?.toothCount ?? Number.NaN,
      module: a === undefined || b === undefined ? "—" : a.module === b.module ? mmText(a.module, 4) : `${mmText(a.module)} / ${mmText(b.module)} (differ)`,
      ratio: defined ? meshSpeedRatio(a.toothCount, b.toothCount) : null,
      idealCentreDistance: defined ? meshCentreDistance(a.module, a.toothCount, b.toothCount) : null,
      actualCentreDistance: pa === undefined || pb === undefined ? null : Math.hypot(pa.x - pb.x, pa.y - pb.y),
      centreDistanceTolerance: stack.status === "KNOWN" && stack.stack.coverage !== "NONE"
        ? `${mmText(stack.stack.min)} … ${mmText(stack.stack.max)} (${COVERAGE_LABELS[stack.stack.coverage]})`
        : null,
    };
  });
}
