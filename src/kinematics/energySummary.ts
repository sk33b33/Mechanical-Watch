import type { Angle } from "@/units/angle";
import type { Energy } from "@/units/energy";
import type { Torque } from "@/units/torque";
import type { Movement } from "@/domain/movement";
import { mainsprings, type MainspringLink, type MainspringSpec } from "@/domain/coupling";
import type { Escapement } from "@/domain/escapement";
import { isValidToothCount } from "@/math/gearMath";
import type { GearTrainSolution } from "./solveGearTrain";
import { energyPerBeat, escapeTorque, powerReserveSeconds, springTorque, steadyAmplitude } from "./mainspringEnergy";

/**
 * The mainspring → train → escapement → balance energy chain for the
 * running train (SIMPLIFIED ENERGY MODEL, L3, ASM-0026). Everything is
 * derived from entered values; missing inputs are named, never assumed.
 */
export interface EnergySummary {
  spring: MainspringLink;
  spec: MainspringSpec | null;
  escapement: Escapement | null;
  /** Seconds from fully wound to let down at the running drum speed. */
  reserveSeconds: number | null;
  /** Torque at the escape wheel, fully wound and let down (lossless upper bound when no train efficiency is configured). */
  escapeTorqueFull: Torque | null;
  escapeTorqueLetDown: Torque | null;
  lossless: boolean;
  /** Energy per beat reaching the balance (null until the escapement efficiency is given). */
  deliveredPerBeatFull: Energy | null;
  deliveredPerBeatLetDown: Energy | null;
  amplitudeFull: Angle | null;
  amplitudeLetDown: Angle | null;
  /** Wind (turns) below which the predicted amplitude cannot reach half the lift angle, so the balance cannot unlock. */
  stopWindTurns: number | null;
  /** Reserve until the balance stops (≤ reserveSeconds). */
  runningReserveSeconds: number | null;
  /** Inputs the amplitude prediction still needs. */
  missingForAmplitude: string[];
}

function validSpec(spec: MainspringSpec | null): spec is MainspringSpec {
  return spec !== null && spec.usableTurns > 0 && spec.fullyWoundTorque > 0 && spec.letDownTorque > 0 && spec.fullyWoundTorque >= spec.letDownTorque
    && (spec.trainEfficiency === null || (spec.trainEfficiency > 0 && spec.trainEfficiency <= 1));
}

export function primaryMainspring(movement: Movement): MainspringLink | null {
  return mainsprings(movement.couplings)[0] ?? null;
}

/** Amplitude at a given state of wind (A ∝ √T, ASM-0026), or null when not predictable. */
export function amplitudeAtWind(summary: EnergySummary, windTurns: number): Angle | null {
  const { spec, escapeTorqueFull, amplitudeFull } = summary;
  if (spec === null || escapeTorqueFull === null || amplitudeFull === null) return null;
  const ratio = springTorque(spec, windTurns) / spec.fullyWoundTorque;
  return (amplitudeFull * Math.sqrt(ratio)) as Angle;
}

export function summarizeEnergy(movement: Movement, running: GearTrainSolution): EnergySummary | null {
  const spring = primaryMainspring(movement);
  if (spring === null) return null;
  const escapement = Object.values(movement.escapements)[0] ?? null;
  const spec = validSpec(spring.spring) ? spring.spring : null;
  const empty: EnergySummary = {
    spring, spec, escapement,
    reserveSeconds: null, escapeTorqueFull: null, escapeTorqueLetDown: null, lossless: spring.spring?.trainEfficiency == null,
    deliveredPerBeatFull: null, deliveredPerBeatLetDown: null, amplitudeFull: null, amplitudeLetDown: null,
    stopWindTurns: null, runningReserveSeconds: null, missingForAmplitude: [],
  };
  if (spec === null) return { ...empty, missingForAmplitude: ["mainspring data"] };

  const drumOmega = running.shaftAngularVelocity.get(spring.shaftBId);
  const reserveSeconds = drumOmega === undefined ? null : powerReserveSeconds(spec.usableTurns, drumOmega);
  const summary: EnergySummary = { ...empty, reserveSeconds, runningReserveSeconds: reserveSeconds, lossless: spec.trainEfficiency === null };
  if (escapement === null || drumOmega === undefined || drumOmega === 0) return { ...summary, missingForAmplitude: ["a running train with an escapement"] };

  const escapeOmega = running.shaftAngularVelocity.get(escapement.escapeArborShaftId);
  if (escapeOmega === undefined || escapeOmega === 0 || !isValidToothCount(escapement.escapeWheel.toothCount)) {
    return { ...summary, missingForAmplitude: ["a driven escape wheel"] };
  }
  const z = escapement.escapeWheel.toothCount;
  const escapeTorqueFull = escapeTorque(spec.fullyWoundTorque, drumOmega, escapeOmega, spec.trainEfficiency);
  const escapeTorqueLetDown = escapeTorque(spec.letDownTorque, drumOmega, escapeOmega, spec.trainEfficiency);
  const withTorque = { ...summary, escapeTorqueFull, escapeTorqueLetDown };

  const b = escapement.balance;
  const missing = [
    ...(escapement.escapementEfficiency === null ? ["escapement efficiency"] : []),
    ...(b.qualityFactor === null ? ["balance quality factor Q"] : []),
    ...(b.hairspringStiffness === null ? ["hairspring stiffness"] : []),
  ];
  const efficiency = escapement.escapementEfficiency;
  if (missing.length > 0 || efficiency === null || b.qualityFactor === null || b.hairspringStiffness === null) {
    return { ...withTorque, missingForAmplitude: missing };
  }
  const deliveredPerBeatFull = energyPerBeat(escapeTorqueFull, z, efficiency);
  const deliveredPerBeatLetDown = energyPerBeat(escapeTorqueLetDown, z, efficiency);
  const amplitudeFull = steadyAmplitude(deliveredPerBeatFull, b.qualityFactor, b.hairspringStiffness);
  const amplitudeLetDown = steadyAmplitude(deliveredPerBeatLetDown, b.qualityFactor, b.hairspringStiffness);

  // The balance must swing past half the lift angle to unlock. A ∝ √T, so it stops once
  // T < T_full (λ/2 / A_full)², which the linear torque curve reaches at a definite wind.
  let stopWindTurns: number | null = null;
  if (amplitudeFull !== null && b.liftAngle > 0) {
    const stopTorque = spec.fullyWoundTorque * (b.liftAngle / 2 / amplitudeFull) ** 2;
    const span = spec.fullyWoundTorque - spec.letDownTorque;
    stopWindTurns = stopTorque <= spec.letDownTorque ? 0
      : stopTorque >= spec.fullyWoundTorque ? spec.usableTurns
      : spec.usableTurns * ((stopTorque - spec.letDownTorque) / span);
  }
  const runningReserveSeconds = reserveSeconds === null || stopWindTurns === null
    ? reserveSeconds
    : reserveSeconds * ((spec.usableTurns - stopWindTurns) / spec.usableTurns);
  return {
    ...withTorque,
    deliveredPerBeatFull, deliveredPerBeatLetDown, amplitudeFull, amplitudeLetDown,
    stopWindTurns, runningReserveSeconds, missingForAmplitude: [],
  };
}
