import { distance } from "@/math/vec2";
import { isValidModule, isValidToothCount, pitchDiameter } from "@/math/gearMath";
import type { EntityId } from "@/domain/ids";
import type { Gear } from "@/domain/gear";
import type { StemPinion } from "@/domain/keyless";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import { crownSettingState, solveGearTrain } from "@/kinematics/solveGearTrain";
import { stemEngagement, stemLine, verticalSide } from "@/kinematics/keylessGeometry";
import { WINDING_UNAVAILABLE_TEXT } from "@/kinematics/keylessSummary";
import { radiansPerSecond } from "@/units/angularVelocity";
import { frameZRange, gearZRange, isCompleteFrame, outlineOverlapsCircle, zOverlaps } from "@/assembly/assemblyGeometry";
import type { ValidationIssue } from "../validationIssue";
import { issue, mm, type Rule } from "./context";

const TOLERANCE = NUMERICAL_PARAMETERS.centreDistanceToleranceMetres;

/**
 * KEY-001…KEY-004 (keyless works). KEY-003's "the running train turns the
 * ratchet" case is reported from the solver's click conflict in
 * kinematicRules.
 */
export const keylessRules: Rule = ({ movement, placement }) => {
  const issues: ValidationIssue[] = [];
  const all = Object.values(movement.keylessWorks);
  if (all.length > 1) {
    issues.push(
      issue("KEY-001", "several", "error", "L1_GEOMETRIC", all.map((k) => k.id),
        `The movement has ${String(all.length)} keyless works; one is expected, and the crown acts on the first (${all[0]?.name ?? ""}).`,
        ["ASM-0019"]),
    );
  }

  for (const keyless of all) {
    const refs: [string, Gear | undefined][] = [
      ["crown wheel", movement.gears[keyless.crownWheelGearId]],
      ["setting wheel", movement.gears[keyless.settingWheelGearId]],
      ["ratchet wheel", movement.gears[keyless.ratchetGearId]],
    ];
    const missing = refs.filter(([, g]) => g === undefined).map(([label]) => label);
    if (missing.length > 0) {
      issues.push(
        issue("KEY-001", "missing-wheel", "error", "L1_GEOMETRIC", [keyless.id],
          `${keyless.name}: its ${missing.join(", ")} ${missing.length === 1 ? "does" : "do"} not exist. Choose the wheel${missing.length === 1 ? "" : "s"} in the inspector.`, []),
      );
    }
    const [crownWheel, settingWheel, ratchet] = refs.map(([, g]) => g);
    if (crownWheel !== undefined && crownWheel.shaftId === ratchet?.shaftId) {
      issues.push(
        issue("KEY-001", "crown-on-ratchet-arbor", "error", "L1_GEOMETRIC", [keyless.id, crownWheel.id, keyless.ratchetGearId],
          `${keyless.name}: the crown wheel and the ratchet wheel are on the same arbor; the crown wheel must drive the ratchet through a mesh.`,
          ["REF-ENG §11"]),
      );
    }
    if (crownWheel !== undefined && crownWheel.id === settingWheel?.id) {
      issues.push(
        issue("KEY-001", "same-wheel", "error", "L1_GEOMETRIC", [keyless.id, crownWheel.id],
          `${keyless.name}: the crown wheel and the setting wheel are the same gear.`, ["ASM-0019"]),
      );
    }
    const pinions: [string, StemPinion][] = [["winding pinion", keyless.windingPinion], ["sliding pinion", keyless.slidingPinion]];
    for (const [label, pinion] of pinions) {
      if (!isValidToothCount(pinion.toothCount)) {
        issues.push(
          issue("KEY-001", `teeth-${label}`, "error", "L1_GEOMETRIC", [keyless.id],
            `${keyless.name}: the ${label}'s tooth count must be a positive whole number.`, ["REF-ENG §5.6"]),
        );
      }
      if (!isValidModule(pinion.module)) {
        issues.push(
          issue("KEY-001", `module-${label}`, "error", "L1_GEOMETRIC", [keyless.id],
            `${keyless.name}: the ${label}'s module must be a positive length.`, ["REF-ENG §5.6"]),
        );
      }
    }
    if (!Number.isFinite(keyless.stemDirection) || !Number.isFinite(keyless.stemHeight)) {
      issues.push(
        issue("KEY-001", "stem", "error", "L1_GEOMETRIC", [keyless.id],
          `${keyless.name}: the stem needs a finite direction and height.`, ["ASM-0019"]),
      );
    }

    // KEY-002: each right-angle engagement.
    const line = stemLine(movement, keyless, placement);
    const engagements: [string, StemPinion, Gear | undefined][] = [
      ["winding pinion", keyless.windingPinion, crownWheel],
      ["sliding pinion", keyless.slidingPinion, settingWheel],
    ];
    for (const [label, pinion, wheel] of engagements) {
      if (wheel === undefined || !isValidToothCount(pinion.toothCount) || !isValidModule(pinion.module)) continue;
      const ids: EntityId[] = [keyless.id, wheel.id];
      if (isValidModule(wheel.module) && pinion.module !== wheel.module) {
        issues.push(
          issue("KEY-002", `module-${label}`, "error", "L1_GEOMETRIC", ids,
            `${keyless.name}: the ${label} (module ${mm(pinion.module)}) and ${wheel.name} (module ${mm(wheel.module)}) cannot mesh; modules must match.`,
            ["REF-ENG §5.6", "ASM-0019"]),
        );
      }
      if (Number.isFinite(keyless.stemHeight) && Number.isFinite(wheel.zCentre) && verticalSide(keyless.stemHeight, wheel) === null) {
        issues.push(
          issue("KEY-002", `level-${label}`, "error", "L1_GEOMETRIC", ids,
            `${keyless.name}: the stem axis is level with ${wheel.name}'s mid-plane, so the ${label} cannot engage it at a right angle.`,
            ["ASM-0019"]),
        );
        continue;
      }
      if (line === null) continue;
      const engagement = stemEngagement(line, keyless.stemHeight, pinion, wheel, placement);
      if (engagement === null) continue;
      if (engagement.planOffset > TOLERANCE) {
        issues.push(
          issue("KEY-002", `offset-${label}`, "error", "L1_GEOMETRIC", ids,
            `${keyless.name}: ${wheel.name}'s axis is ${mm(engagement.planOffset)} off the stem line. A right-angle mesh needs the stem to pass over the wheel's axis.`,
            ["ASM-0019"]),
        );
      }
      if (Math.abs(engagement.heightError) > TOLERANCE) {
        const r = pitchDiameter(pinion.module, pinion.toothCount) / 2;
        issues.push(
          issue("KEY-002", `height-${label}`, "error", "L1_GEOMETRIC", ids,
            `${keyless.name}: the stem axis is ${mm(Math.abs(keyless.stemHeight - wheel.zCentre))} from ${wheel.name}'s mid-plane; the ${label}'s pitch radius is ${mm(r)}, so they ${engagement.heightError > 0 ? "do not reach each other" : "overlap"}.`,
            ["ASM-0019"]),
        );
      }
    }

    // KEY-003: winding must be derivable.
    const probe = solveGearTrain(movement, { mode: "WINDING", crownAngularVelocity: radiansPerSecond(1) });
    if (probe.winding.status === "UNAVAILABLE" && probe.winding.reason !== "NO_KEYLESS_WORKS") {
      const reason = probe.winding.reason;
      const skip = reason === "DRUM_NOT_RUNNING" && movement.drive === null; // KIN-001 already says nothing is driven
      if (!skip) {
        issues.push(
          issue("KEY-003", reason, reason === "RATCHET_NOT_CONNECTED" ? "error" : "warning", "L2_KINEMATIC", [keyless.id],
            `${keyless.name}: the crown cannot be shown winding: ${WINDING_UNAVAILABLE_TEXT[reason]}.`,
            ["REF-ENG §11", "ASM-0018"]),
        );
      }
    }

    // KEY-004: the crown must reach the hands (other setting problems are SET-001's).
    if (keyless.id === all[0]?.id) {
      const setting = crownSettingState(movement);
      if (setting.status === "UNAVAILABLE" && setting.reason === "CROWN_NOT_CONNECTED") {
        issues.push(
          issue("KEY-004", "not-connected", "error", "L2_KINEMATIC", [keyless.id],
            `${keyless.name}: pulled out, the sliding pinion's train does not reach the minutes hand, so the crown cannot set the hands.`,
            ["REF-ENG §8", "ASM-0019"]),
        );
      }
    }
  }
  return issues;
};

/** DIAL-001…DIAL-003. */
export const dialRules: Rule = ({ movement, placement }) => {
  const issues: ValidationIssue[] = [];
  const dials = Object.values(movement.dials);
  if (dials.length > 1) {
    issues.push(
      issue("DIAL-001", "several", "error", "L1_GEOMETRIC", dials.map((d) => d.id),
        `The movement has ${String(dials.length)} dials; one is expected.`, ["ASM-0020"]),
    );
  }
  for (const dial of dials) {
    const problems: string[] = [];
    if (!(Number.isFinite(dial.diameter) && dial.diameter > 0)) problems.push("its diameter must be a positive length");
    if (!(Number.isFinite(dial.thickness) && dial.thickness > 0)) problems.push("its thickness must be a positive length");
    if (!Number.isFinite(dial.faceHeight)) problems.push("its face height must be finite");
    if (!(dial.centreShaftId in movement.shafts)) problems.push("it is centred on an arbor that does not exist");
    for (const problem of problems) {
      issues.push(issue("DIAL-001", problem, "error", "L1_GEOMETRIC", [dial.id], `${dial.name}: ${problem}.`, ["ASM-0020"]));
    }
    const centre = placement.shaftPositions.get(dial.centreShaftId);
    if (problems.length > 0 || centre === undefined) continue;
    const radius = dial.diameter / 2;
    const dialRange = { lo: dial.faceHeight, hi: dial.faceHeight + dial.thickness };

    // DIAL-002: everything over the dial in plan must be above (on the +Z side of) its back.
    const blocking = (lo: number, hi: number): boolean => zOverlaps(dialRange, { lo, hi }) || hi <= dialRange.lo;
    for (const gear of Object.values(movement.gears)) {
      const axis = placement.shaftPositions.get(gear.shaftId);
      if (axis === undefined || !isValidToothCount(gear.toothCount) || !isValidModule(gear.module)) continue;
      if (!Number.isFinite(gear.zCentre) || !(gear.thickness > 0)) continue;
      const r = pitchDiameter(gear.module, gear.toothCount) / 2;
      const range = gearZRange(gear);
      if (distance(axis, centre) < radius + r && blocking(range.lo, range.hi)) {
        issues.push(
          issue("DIAL-002", "gear", "error", "L1_GEOMETRIC", [dial.id, gear.id],
            `${dial.name}: ${gear.name} is ${range.hi <= dialRange.lo ? "on the face side of" : "inside"} the dial. The dial must be below every part it covers.`,
            ["ASM-0014", "ASM-0020"]),
        );
      }
    }
    for (const frame of Object.values(movement.frames)) {
      if (!isCompleteFrame(frame) || !outlineOverlapsCircle(frame.outline, centre, radius)) continue;
      const range = frameZRange(frame);
      if (blocking(range.lo, range.hi)) {
        issues.push(
          issue("DIAL-002", "frame", "error", "L1_GEOMETRIC", [dial.id, frame.id],
            `${dial.name}: ${frame.name} is ${range.hi <= dialRange.lo ? "on the face side of" : "inside"} the dial. The dial must be below every part it covers.`,
            ["ASM-0010", "ASM-0020"]),
        );
      }
    }

    // DIAL-003: every hand must be over the dial.
    for (const shaft of Object.values(movement.shafts)) {
      const axis = placement.shaftPositions.get(shaft.id);
      if (shaft.hand === null || axis === undefined) continue;
      if (distance(axis, centre) >= radius) {
        issues.push(
          issue("DIAL-003", "hand-off-dial", "error", "L1_GEOMETRIC", [dial.id, shaft.id],
            `${dial.name}: ${shaft.name} carries the ${shaft.hand.toLowerCase()} hand but its axis lies outside the dial.`,
            ["ASM-0014"]),
        );
      }
    }
  }
  return issues;
};
