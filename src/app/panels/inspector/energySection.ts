import type { AppStore } from "@/app/store";
import { degrees, toDegrees, type Angle } from "@/units/angle";
import { newtonMillimetres, toNewtonMillimetres, type Torque } from "@/units/torque";
import { toMicrojoules } from "@/units/energy";
import { updateCouplingSpring, updateEscapement } from "@/domain/movement";
import type { MainspringLink, MainspringSpec } from "@/domain/coupling";
import type { Escapement, PalletGeometry } from "@/domain/escapement";
import { isValidToothCount } from "@/math/gearMath";
import { dropClearance, forkRatio, impulseAngle, isHalfToothSpan, spanAngle, tangentialCentreDistance, toothWidthAngle, wheelAngleBudgetPerBeat } from "@/kinematics/palletGeometry";
import { isochronismAdjustedRate } from "@/kinematics/balance";
import { summarizeBalance } from "@/kinematics/balanceSummary";
import { actionRow, formatMm, inputRow, parseRequired, readonlyRow, sectionHeader, selectRow } from "./fields";
import { positive, type Section } from "./common";

const ENERGY_MODEL_TITLE =
  "SIMPLIFIED ENERGY MODEL (L3, ASM-0026): linear torque curve, power balance through the train, steady amplitude where the energy per beat balances the loss 2πE/Q. Requires physical validation.";

function optionalText<T extends number>(value: T | null, scale: (v: T) => number = (v) => v): string {
  return value === null || !Number.isFinite(value) ? "" : String(scale(value));
}

function hours(seconds: number | null): string {
  return seconds === null ? "—" : `${(seconds / 3600).toFixed(1)} h`;
}

function degreesText(value: Angle | null): string {
  return value === null ? "—" : `${toDegrees(value).toFixed(1)}°`;
}

/** An empty entry clears an optional value; anything else must be a number. */
function parseOptional(raw: string): number | null {
  return raw.trim() === "" ? null : Number(raw);
}

/** Mainspring data on the barrel arbor (ASM-0026). Every value is entered; none is assumed. */
export function mainspringDataRows(store: AppStore, link: MainspringLink): Section {
  const spec = link.spring;
  const set = (next: MainspringSpec | null): void => {
    store.edit((m) => updateCouplingSpring(m, link.id, next));
  };
  if (spec === null) {
    return [
      readonlyRow("Spring data", "unknown", "Without it the power reserve and energy chain are not computed."),
      actionRow("Enter spring data", "Adds empty spring fields (turns and end torques) to fill from a source or measurement.", () => {
        set({ usableTurns: Number.NaN, fullyWoundTorque: newtonMillimetres(Number.NaN), letDownTorque: newtonMillimetres(Number.NaN), trainEfficiency: null });
      }),
    ];
  }
  const patch = (p: Partial<MainspringSpec>): void => { set({ ...spec, ...p }); };
  const torqueRow = (label: string, value: Torque, key: "fullyWoundTorque" | "letDownTorque", title: string): HTMLDivElement =>
    inputRow({
      label, value: optionalText(value, toNewtonMillimetres), step: "0.1", invalid: !positive(value), title,
      onCommit: (raw) => { patch({ [key]: newtonMillimetres(parseRequired(raw)) }); },
    });
  const energy = store.energy?.spring.id === link.id ? store.energy : null;
  const wind = store.mainspringWindTurns;
  return [
    readonlyRow("Model", "SIMPLIFIED ENERGY MODEL (L3)", ENERGY_MODEL_TITLE),
    inputRow({
      label: "Usable turns", value: optionalText(spec.usableTurns), step: "0.1", invalid: !positive(spec.usableTurns),
      title: "Arbor turns relative to the drum from let-down to fully wound.",
      onCommit: (raw) => { patch({ usableTurns: parseRequired(raw) }); },
    }),
    torqueRow("Torque fully wound (N·mm)", spec.fullyWoundTorque, "fullyWoundTorque", "Spring torque at full wind. Torque falls linearly to the let-down value (ASM-0026)."),
    torqueRow("Torque let down (N·mm)", spec.letDownTorque, "letDownTorque", "Spring torque at the end of the usable turns. Equal to the fully wound value for a constant-torque model."),
    inputRow({
      label: "Train efficiency (0–1)", value: optionalText(spec.trainEfficiency), step: "0.01", placeholder: "not configured",
      invalid: spec.trainEfficiency !== null && !(spec.trainEfficiency > 0 && spec.trainEfficiency <= 1),
      title: "Overall efficiency from barrel to escape wheel (ASM-0002). Empty: torques are the lossless upper bound.",
      onCommit: (raw) => { patch({ trainEfficiency: parseOptional(raw) }); },
    }),
    readonlyRow("Power reserve", hours(energy?.reserveSeconds ?? null), "Usable turns ÷ the drum's running speed."),
    readonlyRow("Running reserve", hours(energy?.runningReserveSeconds ?? null),
      "Until the predicted amplitude falls to half the lift angle and the balance can no longer unlock (needs the escapement's losses)."),
    readonlyRow("Wind now (simulation)", wind === null ? "—" : `${wind.toFixed(3)} turns`, "Starts fully wound when the simulation resets."),
    actionRow("Clear spring data", "Returns the spring to unknown. Undo with Ctrl+Z.", () => { set(null); }, true),
  ];
}

/** Pallet geometry (ASM-0025) and the escapement's losses for the energy model (ASM-0026). */
export function palletAndEnergyRows(store: AppStore, esc: Escapement): Section {
  const edit = (patch: Parameters<typeof updateEscapement>[2]): void => {
    store.edit((m) => updateEscapement(m, esc.id, patch));
  };
  return [...palletRows(esc, edit), ...lossRows(store, esc, edit)];
}

function palletRows(esc: Escapement, edit: (patch: Parameters<typeof updateEscapement>[2]) => void): Section {
  const pg = esc.pallets;
  const out: Section = [sectionHeader("Pallet geometry (optional)")];
  if (pg === null) {
    out.push(
      readonlyRow("Pallets", "not specified", "The locking geometry is not checked until it is entered (ESC-104…107)."),
      actionRow("Enter pallet geometry", "Adds empty span, lock, draw, run, drop and width fields to fill from a design or source.", () => {
        const empty = degrees(Number.NaN);
        edit({ pallets: { spanTeeth: Number.NaN, kind: "EQUIDISTANT", lockAngle: empty, drawAngle: empty, runAngle: empty, dropAngle: empty, widthAngle: empty } });
      }),
    );
    return out;
  }
  const patch = (p: Partial<PalletGeometry>): void => { edit({ pallets: { ...pg, ...p } }); };
  const angle = (label: string, value: Angle, key: "lockAngle" | "drawAngle" | "runAngle" | "dropAngle" | "widthAngle", invalid: boolean, title: string): HTMLDivElement =>
    inputRow({
      label, value: optionalText(value, toDegrees), step: "0.1", invalid, title,
      onCommit: (raw) => { patch({ [key]: degrees(parseRequired(raw)) }); },
    });
  const w = esc.escapeWheel;
  const span = isValidToothCount(w.toothCount) && isHalfToothSpan(pg.spanTeeth) ? spanAngle(w.toothCount, pg.spanTeeth) : null;
  const needed = span === null ? null : tangentialCentreDistance((w.tipDiameter / 2) as typeof w.tipDiameter, span);
  const impulse = impulseAngle(esc.leverAngle, pg.lockAngle, pg.runAngle);
  const ratio = forkRatio(esc.balance.liftAngle, esc.leverAngle);
  const runValid = Number.isFinite(pg.runAngle) && pg.runAngle >= 0;
  const budget = isValidToothCount(w.toothCount) ? wheelAngleBudgetPerBeat(w.toothCount) : null;
  const dropInBudget = budget !== null && positive(pg.dropAngle) && pg.dropAngle < budget;
  const widthValid = positive(pg.widthAngle);
  const tooth = isValidToothCount(w.toothCount) ? toothWidthAngle(w.toothCount, pg.widthAngle, pg.dropAngle) : null;
  const partitionValid = dropInBudget && widthValid && tooth !== null && tooth > 0;
  const clearance = partitionValid ? dropClearance((w.tipDiameter / 2) as typeof w.tipDiameter, pg.dropAngle) : null;
  out.push(
    readonlyRow("Model", "SIMPLIFIED PALLET GEOMETRY (L1)",
      "Tangential locking on the tip circle, (k+½)-pitch span, lever = lock + impulse + run (ASM-0025); drop and pallet width are declared wheel-side angles (ASM-0036, ASM-0037). Tooth and pallet FACE shapes, impact, sliding contact and recoil are not modeled."),
    inputRow({
      label: "Span (teeth)", value: optionalText(pg.spanTeeth), step: "0.5", invalid: !isHalfToothSpan(pg.spanTeeth),
      title: "Pitches between the entry and exit locking points: a whole number plus a half for two beats per tooth (ESC-104).",
      onCommit: (raw) => { patch({ spanTeeth: parseRequired(raw) }); },
    }),
    selectRow("Pallet type", pg.kind, [
      { value: "EQUIDISTANT", label: "Equidistant" },
      { value: "CIRCULAR", label: "Circular", disabled: true, title: "Not implemented yet (ASM-0037): no closed-form locking-point offset has been derived." },
    ], (value) => { patch({ kind: value as PalletGeometry["kind"] }); },
      "Which locking-point construction (ASM-0037, SRC-0036). This codebase's existing tangential-locking math already builds the equidistant case."),
    angle("Lock (°)", pg.lockAngle, "lockAngle", !positive(pg.lockAngle), "Lever rotation needed to unlock."),
    angle("Draw (°)", pg.drawAngle, "drawAngle", !positive(pg.drawAngle), "Angle of the locking face that pulls the lever onto its banking. Must be positive; whether it overcomes friction is not checked."),
    angle("Run (°)", pg.runAngle, "runAngle", !runValid, "Lever rotation from full lock to the banking."),
    angle("Drop (°, wheel-side)", pg.dropAngle, "dropAngle", !dropInBudget,
      "Escape wheel's free rotation between one pallet's tooth releasing and the next landing (ASM-0036). Measured at the wheel's own axis, not the lever's. Must be positive and under the one-beat wheel-angle budget (ESC-106)."),
    angle("Pallet width (°, wheel-side)", pg.widthAngle, "widthAngle", !widthValid,
      "Escape wheel's own angle for the pallet's acting face (ASM-0037), the same frame as drop. Must be positive and leave room for the tooth within the per-beat budget (ESC-106)."),
    readonlyRow("Span angle", degreesText(span), "Span × 360° / escape teeth."),
    readonlyRow("Pallet arbor distance needed", needed === null ? "—" : formatMm(needed), "R / cos(span/2): where the tangents at the two locking points meet."),
    readonlyRow("Impulse (lever)", Number.isFinite(impulse) ? `${toDegrees(impulse).toFixed(2)}°` : "—", "Lever angle − lock − run."),
    readonlyRow("Fork ratio (lift ÷ lever)", ratio === null ? "—" : ratio.toFixed(3), "Balance lift per unit of lever swing implied by the two declared angles."),
    readonlyRow("Wheel-angle budget per beat", budget === null ? "—" : `${toDegrees(budget).toFixed(2)}°`, "Half the tooth pitch, π/escapeTeeth (ASM-0021, ASM-0036): shared by the tooth's width, the pallet's width and drop."),
    readonlyRow("Escape-tooth width (derived)", tooth === null ? "—" : `${toDegrees(tooth).toFixed(2)}°`, "Budget − pallet width − drop (ASM-0037)."),
    readonlyRow("Drop clearance at tip circle", clearance === null ? "—" : formatMm(clearance), "Arc length = tip radius × drop angle (ASM-0036)."),
    actionRow("Clear pallet geometry", "Stops checking the locking geometry. Undo with Ctrl+Z.", () => { edit({ pallets: null }); }, true),
  );
  return out;
}

/** Rate at the predicted amplitude, with a declared isochronism coefficient applied (ASM-0034). Empty when none is declared. */
function isochronismRow(store: AppStore, esc: Escapement, amplitudeFull: Angle | null, amplitudeLetDown: Angle | null): Section {
  const coefficient = esc.balance.isochronismCoefficient;
  if (coefficient === null) return [];
  const baseline = summarizeBalance(store.movement, esc).dailyRate;
  if (baseline === null || amplitudeFull === null || amplitudeLetDown === null) {
    return [readonlyRow("Predicted rate (full → let down)", "needs the predicted amplitude above",
      "An isochronism coefficient is declared (ASM-0034), but there is nothing to apply it to yet.")];
  }
  const reference = esc.balance.amplitude;
  const full = isochronismAdjustedRate(baseline, coefficient, amplitudeFull, reference);
  const letDown = isochronismAdjustedRate(baseline, coefficient, amplitudeLetDown, reference);
  const fmt = (v: number): string => `${v >= 0 ? "+" : ""}${v.toFixed(1)} s/day`;
  return [readonlyRow("Predicted rate (full → let down)", `${fmt(full)} → ${fmt(letDown)}`,
    "Baseline daily rate + isochronism coefficient × (amplitude − declared amplitude) (ASM-0034). Model prediction only; requires physical validation.")];
}

function lossRows(
  store: AppStore,
  esc: Escapement,
  edit: (patch: Parameters<typeof updateEscapement>[2]) => void,
): Section {
  const b = esc.balance;
  const energy = store.energy?.escapement?.id === esc.id ? store.energy : null;
  const eta = esc.escapementEfficiency;
  const q = b.qualityFactor;
  const delivered = energy?.deliveredPerBeatFull ?? null;
  const deliveredLow = energy?.deliveredPerBeatLetDown ?? null;
  const missing = energy === null ? ["a mainspring with data"] : energy.missingForAmplitude;
  const amplitudeNow = store.displayAmplitude;
  return [
    sectionHeader("Energy (L3 simplified, optional)"),
    inputRow({
      label: "Escapement efficiency (0–1)", value: optionalText(eta), step: "0.01", placeholder: "unknown",
      invalid: eta !== null && !(eta > 0 && eta <= 1),
      title: "Fraction of the escape wheel's energy per beat that reaches the balance. Only measurement or a source can supply it; empty = unknown.",
      onCommit: (raw) => { edit({ escapementEfficiency: parseOptional(raw) }); },
    }),
    inputRow({
      label: "Balance quality factor Q", value: optionalText(q), step: "1", placeholder: "unknown",
      invalid: q !== null && !positive(q),
      title: "Loss per period is 2π × stored energy ÷ Q (ASM-0026). Only measurement or a source can supply it; empty = unknown.",
      onCommit: (raw) => { edit({ balance: { ...b, qualityFactor: parseOptional(raw) } }); },
    }),
    readonlyRow("Escape torque (full → let down)",
      energy?.escapeTorqueFull == null || energy.escapeTorqueLetDown === null
        ? "—"
        : `${(toNewtonMillimetres(energy.escapeTorqueFull) * 1000).toFixed(3)} → ${(toNewtonMillimetres(energy.escapeTorqueLetDown) * 1000).toFixed(3)} µN·m${energy.lossless ? " (lossless bound)" : ""}`,
      "Spring torque × drum speed ÷ escape speed × train efficiency (power balance)."),
    readonlyRow("Energy per beat to balance", delivered === null || deliveredLow === null ? "—" : `${toMicrojoules(delivered).toFixed(4)} → ${toMicrojoules(deliveredLow).toFixed(4)} µJ`,
      "Escape torque × π/z × escapement efficiency."),
    readonlyRow("Predicted amplitude (full → let down)",
      energy?.amplitudeFull == null || energy.amplitudeLetDown === null
        ? `needs ${missing.join(", ")}`
        : `${degreesText(energy.amplitudeFull)} → ${degreesText(energy.amplitudeLetDown)}`,
      "A = √(2 Q E_beat / (π k)). While predicted, it replaces the declared amplitude in the simulation display."),
    readonlyRow("Amplitude now (simulation)", store.goingTrainStopped ? "stopped (run down)" : amplitudeNow === null ? "declared value" : degreesText(amplitudeNow)),
    ...isochronismRow(store, esc, energy?.amplitudeFull ?? null, energy?.amplitudeLetDown ?? null),
    readonlyRow("Stops below", energy?.stopWindTurns == null ? "—" : `${energy.stopWindTurns.toFixed(3)} turns of wind`,
      "Where the predicted amplitude falls to half the lift angle (SPR-003)."),
  ];
}
