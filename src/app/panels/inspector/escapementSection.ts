import type { AppStore } from "@/app/store";
import { millimetres, type Length } from "@/units/length";
import { degrees, toDegrees, type Angle } from "@/units/angle";
import { toRpm } from "@/units/angularVelocity";
import { toBeatsPerHour } from "@/units/frequency";
import { updateEscapement } from "@/domain/movement";
import type { Escapement } from "@/domain/escapement";
import type { ShaftId } from "@/domain/shaft";
import { isValidToothCount } from "@/math/gearMath";
import { balanceFrequency, beatFrequency, beatsPerEscapeRevolution, impulseFraction } from "@/kinematics/escapement";
import { summarizeBalance } from "@/kinematics/balanceSummary";
import {
  micronewtonMillimetresPerRadian,
  milligramSquareCentimetres,
  toMicronewtonMillimetresPerRadian,
  toMilligramSquareCentimetres,
} from "@/units/rotational";
import { inputRow, mmText, parseRequired, readonlyRow, sectionHeader, selectRow, textRow } from "./fields";
import { deleteRow, positive, type Section } from "./common";
import { palletAndEnergyRows } from "./energySection";

function angleText(value: Angle): string {
  return Number.isFinite(value) ? String(toDegrees(value)) : "";
}

export function escapementSection(store: AppStore, esc: Escapement): Section {
  const { movement } = store;
  const edit = (patch: Parameters<typeof updateEscapement>[2]): void => {
    store.edit((m) => updateEscapement(m, esc.id, patch));
  };
  const arborSelect = (label: string, value: ShaftId, key: "escapeArborShaftId" | "palletArborShaftId" | "balanceShaftId", title: string): HTMLDivElement =>
    selectRow(label, value in movement.shafts ? value : "", [
      { value: "", label: "Choose an arbor…" },
      ...Object.values(movement.shafts).map((s) => ({ value: s.id, label: s.name })),
    ], (id) => { if (id !== "") edit({ [key]: id as ShaftId }); }, title);
  const w = esc.escapeWheel;
  const b = esc.balance;
  const setWheel = (patch: Partial<Escapement["escapeWheel"]>): void => { edit({ escapeWheel: { ...w, ...patch } }); };
  const setBalance = (patch: Partial<Escapement["balance"]>): void => { edit({ balance: { ...b, ...patch } }); };
  const length = (label: string, value: Length, onSet: (v: Length) => void, mustBePositive = true): HTMLDivElement =>
    inputRow({
      label, value: mmText(value), step: "0.05", invalid: mustBePositive ? !positive(value) : !Number.isFinite(value),
      onCommit: (raw) => { onSet(millimetres(parseRequired(raw))); },
    });
  const angle = (label: string, value: Angle, onSet: (v: Angle) => void, title: string): HTMLDivElement =>
    inputRow({
      label, value: angleText(value), step: "1", invalid: !positive(value), title,
      onCommit: (raw) => { onSet(degrees(parseRequired(raw))); },
    });

  const omega = store.analysis.train.shaftAngularVelocity.get(esc.escapeArborShaftId);
  const beats = omega !== undefined && omega !== 0 && isValidToothCount(w.toothCount) ? beatFrequency(omega, w.toothCount) : null;
  const fraction = impulseFraction(b.amplitude, b.liftAngle);
  const balance = summarizeBalance(movement, esc);
  const optionalRow = (label: string, text: string, value: number | null, onCommit: (raw: string) => void, title: string): HTMLDivElement =>
    inputRow({ label, value: text, step: "0.1", placeholder: "unknown", invalid: value !== null && !positive(value), title, onCommit });

  return [
    textRow("Name", esc.name, (name) => { edit({ name }); }),
    readonlyRow("Model", "SIMPLIFIED ESCAPEMENT MODEL (Swiss lever, kinematic L2)",
      "Drop, impact, sliding contact and tooth and pallet faces are not modeled (ESC-002, ASM-0023). Pallet locking geometry (ASM-0025), balance dynamics (ASM-0024) and the energy chain (ASM-0026) are simplified models, when their inputs are entered."),
    sectionHeader("Escape wheel"),
    arborSelect("Escape arbor", esc.escapeArborShaftId, "escapeArborShaftId", "The escape wheel turns with this arbor, driven by the train."),
    inputRow({
      label: "Escape teeth", value: Number.isFinite(w.toothCount) ? String(w.toothCount) : "", step: "1", invalid: !isValidToothCount(w.toothCount),
      onCommit: (raw) => { setWheel({ toothCount: parseRequired(raw) }); },
    }),
    selectRow("Tooth kind", w.toothKind, [
      { value: "CLUB", label: "Club" },
      { value: "RATCHET", label: "Ratchet (English)" },
    ], (value) => { setWheel({ toothKind: value as Escapement["escapeWheel"]["toothKind"] }); },
      "Tooth form (ASM-0038, SRC-0036). Club: the tooth has its own impulse face, so the derived tooth width must stay positive. Ratchet: a bare point, the entire lift is on the pallet, so the derived tooth width may be exactly zero."),
    length("Tip Ø (mm)", w.tipDiameter, (v) => { setWheel({ tipDiameter: v }); }),
    length("Thickness (mm)", w.thickness, (v) => { setWheel({ thickness: v }); }),
    length("Mid-plane height (mm)", w.zCentre, (v) => { setWheel({ zCentre: v }); }, false),
    sectionHeader("Pallet fork"),
    arborSelect("Pallet arbor", esc.palletArborShaftId, "palletArborShaftId", "Oscillates between its bankings; must not be gear-driven (ESC-102)."),
    angle("Lever angle (°)", esc.leverAngle, (v) => { edit({ leverAngle: v }); }, "Total swing of the fork from one banking to the other."),
    sectionHeader("Balance"),
    arborSelect("Balance staff", esc.balanceShaftId, "balanceShaftId", "Oscillates; must not be gear-driven (ESC-102)."),
    length("Diameter (mm)", b.diameter, (v) => { setBalance({ diameter: v }); }),
    length("Thickness (mm)", b.thickness, (v) => { setBalance({ thickness: v }); }),
    length("Mid-plane height (mm)", b.zCentre, (v) => { setBalance({ zCentre: v }); }, false),
    angle("Amplitude (°)", b.amplitude, (v) => { setBalance({ amplitude: v }); },
      "Declared peak swing either side of the dead point (ASM-0022). Used unless the energy model below can predict it from the mainspring, Q and escapement efficiency (ASM-0026)."),
    angle("Lift angle (°)", b.liftAngle, (v) => { setBalance({ liftAngle: v }); },
      "Balance angle over which the escapement acts; sets the impulse window (ASM-0023)."),
    sectionHeader("Balance dynamics (L3 simplified, optional)"),
    optionalRow("Inertia (mg·cm²)", b.inertia === null ? "" : String(toMilligramSquareCentimetres(b.inertia)), b.inertia,
      (raw) => { setBalance({ inertia: raw.trim() === "" ? null : milligramSquareCentimetres(Number(raw)) }); },
      "Moment of inertia of the balance about its staff. Entered, not derived from material or geometry. Empty = unknown."),
    optionalRow("Hairspring (µN·mm/rad)", b.hairspringStiffness === null ? "" : String(toMicronewtonMillimetresPerRadian(b.hairspringStiffness)), b.hairspringStiffness,
      (raw) => { setBalance({ hairspringStiffness: raw.trim() === "" ? null : micronewtonMillimetresPerRadian(Number(raw)) }); },
      "Torsional stiffness of the hairspring (restoring torque per radian). Empty = unknown."),
    inputRow({
      label: "Isochronism coeff. (s/day per °)",
      value: b.isochronismCoefficient === null ? "" : String(b.isochronismCoefficient * (Math.PI / 180)),
      step: "0.1", placeholder: "unmodeled",
      invalid: b.isochronismCoefficient !== null && !Number.isFinite(b.isochronismCoefficient),
      title: "Declared/measured rate sensitivity to amplitude, relative to the declared amplitude above (ASM-0034). Any sign is valid; no universal value exists. Empty = unmodeled (isochronous, ASM-0024).",
      onCommit: (raw) => { setBalance({ isochronismCoefficient: raw.trim() === "" ? null : Number(raw) / (Math.PI / 180) }); },
    }),
    readonlyRow("Free frequency", balance.freeFrequency === null ? "needs inertia and stiffness" : `${balance.freeFrequency.toFixed(4)} Hz`,
      "f = √(k/I) / 2π: linear, undamped, isochronous oscillator (ASM-0024)."),
    readonlyRow("Needed for nominal time", balance.nominalFrequency === null ? "—" : `${balance.nominalFrequency.toFixed(4)} Hz`),
    readonlyRow("Hairspring for nominal", balance.stiffnessForNominal === null ? "—" : `${toMicronewtonMillimetresPerRadian(balance.stiffnessForNominal).toFixed(2)} µN·mm/rad`,
      "k = I (2π f)² for the entered inertia."),
    readonlyRow(movement.drive?.kind === "BALANCE" ? "Predicted rate (governing)" : "Rate if it governed",
      balance.dailyRate === null ? "—" : `${balance.dailyRate >= 0 ? "+" : ""}${balance.dailyRate.toFixed(1)} s/day`,
      `Model prediction only: escapement, position and temperature effects are not modeled${b.isochronismCoefficient === null ? ", and amplitude dependence is not declared (ASM-0034)" : " (amplitude dependence is declared below, ASM-0034)"}. Requires physical validation.`),
    ...palletAndEnergyRows(store, esc),
    sectionHeader("Calculated (model predicts)"),
    readonlyRow("Beats per escape turn", isValidToothCount(w.toothCount) ? String(beatsPerEscapeRevolution(w.toothCount)) : "—",
      "2 per tooth (ASM-0021, SRC-0016/SRC-0017 — informal, Tier 6/7 sources)."),
    readonlyRow("Escape arbor speed", omega === undefined ? "not driven" : `${Math.abs(toRpm(omega)).toFixed(4)} rev/min`),
    readonlyRow("Beat rate", beats === null ? "—" : `${toBeatsPerHour(beats).toFixed(0)} beats/h`,
      "Implied by the train's speed at the current drive (ASM-0021)."),
    readonlyRow("Balance frequency (train)", beats === null ? "—" : `${balanceFrequency(beats).toFixed(4)} Hz`,
      "The balance frequency that matches the train's current speed (ASM-0021). Under a balance-governed drive it equals the free frequency above."),
    readonlyRow("Impulse window", fraction === null ? "—" : `${(fraction * 100).toFixed(1)} % of each beat`,
      "(2/π)·asin(lift / 2·amplitude), from the sinusoidal balance (ASM-0022, ASM-0023)."),
    readonlyRow("Rate accuracy", "not modeled; requires physical validation"),
    deleteRow(store, esc.id, "Delete escapement", "The arbors it refers to stay."),
  ];
}
