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
import { inputRow, mmText, parseRequired, readonlyRow, sectionHeader, selectRow, textRow } from "./fields";
import { deleteRow, positive, type Section } from "./common";

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

  return [
    textRow("Name", esc.name, (name) => { edit({ name }); }),
    readonlyRow("Model", "SIMPLIFIED ESCAPEMENT MODEL (Swiss lever, kinematic L2)",
      "Locking, draw, drop, impact, sliding contact, banking geometry and balance dynamics are not modeled (ESC-002, ASM-0023)."),
    sectionHeader("Escape wheel"),
    arborSelect("Escape arbor", esc.escapeArborShaftId, "escapeArborShaftId", "The escape wheel turns with this arbor, driven by the train."),
    inputRow({
      label: "Escape teeth", value: Number.isFinite(w.toothCount) ? String(w.toothCount) : "", step: "1", invalid: !isValidToothCount(w.toothCount),
      onCommit: (raw) => { setWheel({ toothCount: parseRequired(raw) }); },
    }),
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
      "Declared peak swing either side of the dead point. An input, not predicted: no balance dynamics are modeled (ASM-0022)."),
    angle("Lift angle (°)", b.liftAngle, (v) => { setBalance({ liftAngle: v }); },
      "Balance angle over which the escapement acts; sets the impulse window (ASM-0023)."),
    sectionHeader("Calculated (model predicts)"),
    readonlyRow("Beats per escape turn", isValidToothCount(w.toothCount) ? String(beatsPerEscapeRevolution(w.toothCount)) : "—",
      "2 per tooth (ASM-0021, source pending)."),
    readonlyRow("Escape arbor speed", omega === undefined ? "not driven" : `${Math.abs(toRpm(omega)).toFixed(4)} rev/min`),
    readonlyRow("Beat rate", beats === null ? "—" : `${toBeatsPerHour(beats).toFixed(0)} beats/h`,
      "Implied by the train's speed at the current drive (ASM-0021)."),
    readonlyRow("Required balance frequency", beats === null ? "—" : `${balanceFrequency(beats).toFixed(4)} Hz`,
      "The frequency the balance must have for the train to run at this speed. The balance's own frequency (inertia, hairspring) is not modeled (ASM-0022)."),
    readonlyRow("Impulse window", fraction === null ? "—" : `${(fraction * 100).toFixed(1)} % of each beat`,
      "(2/π)·asin(lift / 2·amplitude), from the sinusoidal balance (ASM-0022, ASM-0023)."),
    readonlyRow("Rate accuracy", "not modeled; requires physical validation"),
    deleteRow(store, esc.id, "Delete escapement", "The arbors it refers to stay."),
  ];
}
