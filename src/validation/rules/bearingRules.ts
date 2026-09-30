import {
  endshake,
  frameZRange,
  isCompleteFrame,
  isPositiveLength,
  outlineContains,
  outlineProblems,
  shaftSupport,
  sideShake,
  type DerivedLength,
} from "@/assembly/assemblyGeometry";
import { escapementShaftIds } from "@/domain/escapement";
import type { Frame } from "@/domain/frame";
import type { ShaftEnd } from "@/domain/shaft";
import { toMillimetres } from "@/units/length";
import type { ValidationIssue } from "../validationIssue";
import { issue, mm, type Rule } from "./context";

/**
 * Informal endshake ceilings for the BRG-006 advisory: forum testimony
 * (SRC-0011), not a published standard. Used only as a low-confidence,
 * informational comparison — exceeding one is not itself wrong, and
 * staying under one is not a guarantee (ASM-0028).
 */
const ENDSHAKE_GUIDANCE_MM = {
  ESCAPEMENT: 0.05,
  TRAIN: 0.1,
} as const;

/**
 * Informal side-shake ceiling for the BRG-007 advisory, keyed to the
 * pivot's own diameter: forum testimony crediting Hans Jendritzki
 * (SRC-0012, corroborated by SRC-0013), not a published standard read
 * directly. Used only as a low-confidence, informational comparison
 * (ASM-0029) — same caveats as ENDSHAKE_GUIDANCE_MM above.
 */
const SIDE_SHAKE_GUIDANCE_MM = {
  SMALL_PIVOT_MAX: 0.3,
  SMALL_PIVOT: 0.01,
  LARGE_PIVOT: 0.02,
} as const;

/** FRAME-001: frames must have a positive thickness, finite height and a real outline. */
export const frameRules: Rule = ({ movement }) => {
  const issues: ValidationIssue[] = [];
  for (const frame of Object.values(movement.frames)) {
    const problems: string[] = [];
    if (!isPositiveLength(frame.thickness)) problems.push("thickness must be a positive length");
    if (!Number.isFinite(frame.zBottom)) problems.push("axial position must be finite");
    problems.push(...outlineProblems(frame.outline));
    for (const problem of problems) {
      issues.push(
        issue("FRAME-001", problem, "error", "L1_GEOMETRIC", [frame.id], `${frame.name}: ${problem}.`, ["ASM-0010"]),
      );
    }
  }
  return issues;
};

function describe(frame: Frame | undefined): string {
  return frame?.name ?? "missing frame";
}

/**
 * BRG-001…BRG-005 and dangling jewel references (ASSY-001). Only applies
 * to PIVOTED shafts, and only when the movement has frames. Without frames it is a free-floating gear
 * sandbox and shafts are not expected to be supported.
 */
export const bearingRules: Rule = ({ movement, placement }) => {
  const issues: ValidationIssue[] = [];

  for (const jewel of Object.values(movement.jewels)) {
    const frame = movement.frames[jewel.frameId];
    const shaft = movement.shafts[jewel.shaftId];
    if (frame === undefined || shaft === undefined) {
      issues.push(
        issue("ASSY-001", "jewel-refs", "error", "L1_GEOMETRIC", [jewel.id],
          `${jewel.name}: refers to a ${frame === undefined ? "frame" : "shaft"} that does not exist.`, []),
      );
      continue;
    }
    const axis = placement.shaftPositions.get(shaft.id);
    if (axis !== undefined && isCompleteFrame(frame) && !outlineContains(frame.outline, axis)) {
      issues.push(
        issue("BRG-002", "outside-frame", "error", "L1_GEOMETRIC", [jewel.id, frame.id, shaft.id],
          `${jewel.name}: ${shaft.name}'s axis lies outside ${frame.name}, so the bearing has no material to sit in.`,
          ["REF-ENG §12"]),
      );
    }
  }

  if (Object.keys(movement.frames).length === 0) {
    return issues;
  }

  const escapementShafts = escapementShaftIds(movement.escapements);
  let known = 0;
  let unknown = 0;
  const count = (value: DerivedLength): void => {
    if (value.status === "KNOWN") known += 1;
    if (value.status === "UNKNOWN") unknown += 1;
  };

  for (const shaft of Object.values(movement.shafts)) {
    // Studs and carried parts have no bearings of their own (see couplingRules for their checks).
    if (shaft.support.kind !== "PIVOTED") continue;
    const support = shaftSupport(movement, shaft.id);
    for (const duplicate of support.duplicates) {
      issues.push(
        issue("BRG-001", "duplicate", "error", "L1_GEOMETRIC", [shaft.id, duplicate.id],
          `${shaft.name}: more than one ${duplicate.end.toLowerCase()} bearing (${duplicate.name}).`, ["REF-ENG §12"]),
      );
    }
    const missingEnds = (["LOWER", "UPPER"] as const).filter((end) => (end === "LOWER" ? support.lower : support.upper) === null);
    if (missingEnds.length > 0) {
      issues.push(
        issue("BRG-001", "unsupported", "error", "L1_GEOMETRIC", [shaft.id],
          `${shaft.name}: no ${missingEnds.map((e) => e.toLowerCase()).join(" or ")} bearing.`, ["REF-ENG §12"]),
      );
    }
    if (support.lower !== null && support.upper !== null) {
      const lowerFrame = movement.frames[support.lower.frameId];
      const upperFrame = movement.frames[support.upper.frameId];
      if (lowerFrame !== undefined && upperFrame !== undefined) {
        if (lowerFrame.id === upperFrame.id) {
          issues.push(
            issue("BRG-001", "same-frame", "error", "L1_GEOMETRIC", [shaft.id, lowerFrame.id],
              `${shaft.name}: both bearings are in ${lowerFrame.name}.`, ["REF-ENG §12"]),
          );
        } else if (isCompleteFrame(lowerFrame) && isCompleteFrame(upperFrame) && upperFrame.zBottom <= frameZRange(lowerFrame).hi) {
          issues.push(
            issue("BRG-001", "frame-order", "error", "L1_GEOMETRIC", [shaft.id, lowerFrame.id, upperFrame.id],
              `${shaft.name}: upper bearing frame (${describe(upperFrame)}) does not sit above lower bearing frame (${describe(lowerFrame)}).`,
              ["REF-ENG §12", "ASM-0010"]),
          );
        }
      }
    }

    for (const end of ["LOWER", "UPPER"] as ShaftEnd[]) {
      const jewel = end === "LOWER" ? support.lower : support.upper;
      const shake = sideShake(shaft, end, jewel);
      count(shake);
      if (shake.status === "INVALID_INPUT") {
        issues.push(
          issue("BRG-003", `input-${end}`, "error", "L1_GEOMETRIC", [shaft.id],
            `${shaft.name}: ${shake.reason}.`, ["REF-ENG §12"]),
        );
      } else if (shake.status === "KNOWN" && shake.value <= 0) {
        issues.push(
          issue("BRG-003", `no-clearance-${end}`, "error", "L1_GEOMETRIC", [shaft.id, ...(jewel === null ? [] : [jewel.id])],
            `${shaft.name}: ${end.toLowerCase()} pivot does not fit its bearing (side shake ${mm(shake.value)}).`,
            ["REF-ENG §12", "ASM-0013"]),
        );
      } else if (shake.status === "KNOWN" && shaft.pivotDiameter[end] !== null) {
        const pivotMm = toMillimetres(shaft.pivotDiameter[end]);
        const smallPivot = pivotMm <= SIDE_SHAKE_GUIDANCE_MM.SMALL_PIVOT_MAX;
        const guidanceMm = smallPivot ? SIDE_SHAKE_GUIDANCE_MM.SMALL_PIVOT : SIDE_SHAKE_GUIDANCE_MM.LARGE_PIVOT;
        if (toMillimetres(shake.value) > guidanceMm) {
          issues.push(
            issue("BRG-007", `looser-${end}`, "info", "L1_GEOMETRIC", [shaft.id, ...(jewel === null ? [] : [jewel.id])],
              `${shaft.name}: ${end.toLowerCase()} side shake ${mm(shake.value)} is looser than the informal figure for a ` +
                `pivot ${smallPivot ? "up to 0.30 mm" : "over 0.30 mm"} (~${String(guidanceMm)} mm, SRC-0012 — forum ` +
                "testimony crediting Hans Jendritzki, not a published standard read directly; informational only).",
              ["ASM-0029"]),
          );
        }
      }
    }

    const end = endshake(movement, shaft, support);
    count(end);
    if (end.status === "INVALID_INPUT") {
      issues.push(
        issue("BRG-004", "input", "error", "L1_GEOMETRIC", [shaft.id], `${shaft.name}: ${end.reason}.`, ["REF-ENG §12"]),
      );
    } else if (end.status === "KNOWN" && end.value <= 0) {
      issues.push(
        issue("BRG-004", "no-endshake", "error", "L1_GEOMETRIC", [shaft.id],
          `${shaft.name}: shoulder span does not fit between the bearings (endshake ${mm(end.value)}).`,
          ["REF-ENG §12", "ASM-0011"]),
      );
    } else if (end.status === "KNOWN") {
      const isEscapement = escapementShafts.has(shaft.id);
      const guidanceMm = isEscapement ? ENDSHAKE_GUIDANCE_MM.ESCAPEMENT : ENDSHAKE_GUIDANCE_MM.TRAIN;
      if (toMillimetres(end.value) > guidanceMm) {
        issues.push(
          issue("BRG-006", `looser-${isEscapement ? "escapement" : "train"}`, "info", "L1_GEOMETRIC", [shaft.id],
            `${shaft.name}: endshake ${mm(end.value)} is looser than the informal figure reported for ` +
              `${isEscapement ? "escapement" : "train"} parts (~${String(guidanceMm)} mm, SRC-0011 — forum ` +
              "testimony, not a published standard; informational only).",
            ["ASM-0028"]),
        );
      }
    }
  }

  if (known + unknown === 0) return issues;
  issues.push(
    issue("BRG-005", "not-judged", "info", "L1_GEOMETRIC", [],
      `Bearing clearances: ${String(known)} computed, ${String(unknown)} unknown (missing pivot, bore or shoulder dimensions). ` +
        "Side shake (BRG-007, ASM-0029) and endshake (BRG-006, ASM-0028) are each only compared to an informal, " +
        "unconfirmed reference figure — neither is a validated acceptable range.",
      ["REF-ENG §12", "ASM-0011", "ASM-0013", "ASM-0028", "ASM-0029"]),
  );
  return issues;
};
